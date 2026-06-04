import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { base58, hex } from "@scure/base";
import type {
    Connection,
    SendOptions,
    Transaction,
    TransactionInstruction,
    VersionedTransaction,
} from "@solana/web3.js";

import type { PendingSolanaCctpBridgeSend } from "../bridge/pendingSend.ts";
import { PendingBridgeSendKind } from "../bridge/types.ts";
import { getAssetBridge, getBoltzSwapsConfig } from "../config.ts";
import { formatError, isWalletRejectionError } from "../errors.ts";
import { constructRequestOptions } from "../helper.ts";
import { getLogger } from "../logger.ts";
import {
    getPhantomSimulationWarningComplianceDebugInfo,
    getSolanaVersionedTransactionSummaryDebugInfo,
} from "../solana/debug.ts";
import {
    derivePda,
    formatSolanaLogsMessage,
    getConnectedSolanaWalletAddress,
    getSolanaAssociatedTokenAddress,
    getSolanaConnection,
    getSolanaRentExemptMinimumBalance,
    toLegacyInstruction,
} from "../solana/index.ts";
import { solanaCctp as lazySolanaCctp } from "../solana/lazy.ts";
import {
    BridgeKind,
    type BridgeTransaction,
    NetworkTransport,
} from "../types.ts";
import { cctpEmptyHookData } from "./evm.ts";
import type { CctpSendOverrides, CctpSendParam } from "./types.ts";

type SolanaCctpModules = Awaited<ReturnType<(typeof lazySolanaCctp)["get"]>>;

export type SolanaCctpConfig = {
    asset: string;
    tokenMint: string;
    walletProvider?: SolanaWalletProvider;
};

export type SolanaCctpTransportClient = {
    transport: NetworkTransport.Solana;
    send: (
        sendParam: CctpSendParam,
        msgFee: [bigint, bigint],
        refundAddress: string,
        overrides?: CctpSendOverrides,
    ) => Promise<BridgeTransaction>;
};

type Context = {
    modules: SolanaCctpModules;
    asset: string;
    connection: Connection;
    tokenMint: string;
    walletProvider?: SolanaWalletProvider;
    // Solana CCTP program IDs sourced from the asset's bridge config (set by
    // the host app on each USDC variant). Stored on the context so derivePda
    // calls below don't need to re-resolve them per call.
    tokenMessenger: string;
    messageTransmitter: string;
};

const requireSolanaCctpProgramIds = (
    asset: string,
): { tokenMessenger: string; messageTransmitter: string } => {
    const bridge = getAssetBridge(asset);
    if (bridge?.kind !== BridgeKind.Cctp) {
        throw new Error(`Asset ${asset} is not configured as CCTP`);
    }
    return {
        tokenMessenger: bridge.cctp.tokenMessenger,
        messageTransmitter: bridge.cctp.messageTransmitter,
    };
};

const solanaCctpComputeUnitLimit = 300_000;
export const solanaCctpMessageSentAccountSize = 428;

const textEncoder = new TextEncoder();

const stripHexPrefix = (value: string): string =>
    value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;

const hexBytes32ToSolanaAddress = (
    modules: SolanaCctpModules,
    value: string,
): string => {
    const bytes = hex.decode(stripHexPrefix(value));
    if (bytes.length !== 32) {
        throw new Error("CCTP Solana recipient fields must be bytes32");
    }

    return new modules.web3.PublicKey(bytes).toBase58();
};

const deriveRemoteTokenMessenger = (
    context: Context,
    destinationDomain: number,
): string =>
    derivePda(
        context.modules,
        context.tokenMessenger,
        textEncoder.encode("remote_token_messenger"),
        textEncoder.encode(String(destinationDomain)),
    );

export const getSolanaCctpRequiredNativeBalance = async (
    asset: string,
): Promise<bigint> =>
    await getSolanaRentExemptMinimumBalance(
        asset,
        solanaCctpMessageSentAccountSize,
    );

export type SolburnAllocation = {
    eventRentPayerSecret: Uint8Array;
    messageSentEventDataSecret: Uint8Array;
};

// POSTs to solburn's /allocate to obtain ephemeral keypairs for the rent
// payer and the MessageSentEventData account. Solburn watches the resulting
// burn tx, fetches the Circle attestation, and 5 days later reclaims the
// rent back to the burn tx's fee payer (= the user wallet). Returns null on
// any failure so callers can fall back to the local-keypair path.
export const tryFetchSolburnAllocation = async (
    solburnUrl: string,
): Promise<SolburnAllocation | null> => {
    const trimmed = solburnUrl.replace(/\/+$/, "");
    const { opts, requestTimeout } = constructRequestOptions(
        {
            method: "POST",
            headers: { Accept: "application/json" },
        },
        10_000,
    );
    try {
        const response = await fetch(`${trimmed}/allocate`, opts);
        if (!response.ok) {
            getLogger().warn(
                `solburn /allocate failed: HTTP ${response.status}`,
            );
            return null;
        }
        const body = (await response.json()) as {
            event_rent_payer: { secret: number[] };
            message_sent_event_data: { secret: number[] };
        };
        return {
            eventRentPayerSecret: new Uint8Array(body.event_rent_payer.secret),
            messageSentEventDataSecret: new Uint8Array(
                body.message_sent_event_data.secret,
            ),
        };
    } catch (error) {
        getLogger().warn(`solburn /allocate error: ${String(error)}`);
        return null;
    } finally {
        clearTimeout(requestTimeout);
    }
};

const getContext = async (config: SolanaCctpConfig): Promise<Context> => {
    try {
        const modules = await lazySolanaCctp.get();
        const connection = await getSolanaConnection(config.asset);
        const programIds = requireSolanaCctpProgramIds(config.asset);

        return {
            modules,
            asset: config.asset,
            connection,
            tokenMint: config.tokenMint,
            walletProvider: config.walletProvider,
            ...programIds,
        };
    } catch (error) {
        getLogger().warn("Solana CCTP context init failed", {
            sourceAsset: config.asset,
            tokenMint: config.tokenMint,
            formattedError: formatError(error),
        });
        throw error;
    }
};

const createTransaction = async (
    context: Context,
    instructions: TransactionInstruction[],
    payerAddress: string,
) => {
    const { modules } = context;
    const latestBlockhash =
        await context.connection.getLatestBlockhash("confirmed");

    return {
        latestBlockhash,
        transaction: new modules.web3.VersionedTransaction(
            new modules.web3.TransactionMessage({
                payerKey: new modules.web3.PublicKey(payerAddress),
                recentBlockhash: latestBlockhash.blockhash,
                instructions,
            }).compileToV0Message(),
        ),
    };
};

const getSignedTransactionSignature = (
    signedTransaction: Transaction | VersionedTransaction,
): string => {
    const signature = signedTransaction.signatures[0];
    const bytes =
        signature instanceof Uint8Array ? signature : signature?.signature;
    if (
        bytes === undefined ||
        bytes === null ||
        bytes.every((byte) => byte === 0)
    ) {
        throw new Error("Solana wallet did not return a transaction signature");
    }
    return base58.encode(bytes);
};

const createDepositForBurnInstruction = async (
    context: Context,
    sendParam: CctpSendParam,
    ownerAddress: string,
    eventRentPayerAddress: string,
    messageSentEventDataAddress: string,
): Promise<TransactionInstruction> => {
    if (sendParam.hookData !== cctpEmptyHookData) {
        throw new Error(
            "Solana CCTP source sends do not support hook data yet",
        );
    }

    const { modules } = context;
    const programAddress = modules.solanaKit.address(context.tokenMessenger);
    const burnTokenMint = new modules.web3.PublicKey(context.tokenMint);
    const owner = modules.solanaKit.createNoopSigner(
        modules.solanaKit.address(ownerAddress),
    );
    const eventRentPayer = modules.solanaKit.createNoopSigner(
        modules.solanaKit.address(eventRentPayerAddress),
    );
    const messageSentEventData = modules.solanaKit.createNoopSigner(
        modules.solanaKit.address(messageSentEventDataAddress),
    );
    const derive = (...seeds: Uint8Array[]) =>
        derivePda(modules, context.tokenMessenger, ...seeds);

    return toLegacyInstruction(
        modules,
        modules.generated.getDepositForBurnInstruction(
            {
                owner,
                eventRentPayer,
                senderAuthorityPda: modules.solanaKit.address(
                    derive(textEncoder.encode("sender_authority")),
                ),
                burnTokenAccount: modules.solanaKit.address(
                    await getSolanaAssociatedTokenAddress(
                        context.tokenMint,
                        ownerAddress,
                    ),
                ),
                denylistAccount: modules.solanaKit.address(
                    derive(
                        textEncoder.encode("denylist_account"),
                        new modules.web3.PublicKey(ownerAddress).toBytes(),
                    ),
                ),
                messageTransmitter: modules.solanaKit.address(
                    derivePda(
                        modules,
                        context.messageTransmitter,
                        textEncoder.encode("message_transmitter"),
                    ),
                ),
                tokenMessenger: modules.solanaKit.address(
                    derive(textEncoder.encode("token_messenger")),
                ),
                remoteTokenMessenger: modules.solanaKit.address(
                    deriveRemoteTokenMessenger(
                        context,
                        sendParam.destinationDomain,
                    ),
                ),
                tokenMinter: modules.solanaKit.address(
                    derive(textEncoder.encode("token_minter")),
                ),
                localToken: modules.solanaKit.address(
                    derive(
                        textEncoder.encode("local_token"),
                        burnTokenMint.toBytes(),
                    ),
                ),
                burnTokenMint: modules.solanaKit.address(context.tokenMint),
                messageSentEventData,
                eventAuthority: modules.solanaKit.address(
                    derive(textEncoder.encode("__event_authority")),
                ),
                program: programAddress,
                amount: sendParam.amount,
                destinationDomain: sendParam.destinationDomain,
                mintRecipient: modules.solanaKit.address(
                    hexBytes32ToSolanaAddress(modules, sendParam.mintRecipient),
                ),
                destinationCaller: modules.solanaKit.address(
                    hexBytes32ToSolanaAddress(
                        modules,
                        sendParam.destinationCaller,
                    ),
                ),
                maxFee: sendParam.maxFee,
                minFinalityThreshold: sendParam.minFinalityThreshold,
            },
            { programAddress },
        ),
    );
};

const send = async (
    context: Context,
    sendParam: CctpSendParam,
    overrides?: CctpSendOverrides,
): Promise<BridgeTransaction> => {
    const { modules, walletProvider } = context;
    if (walletProvider === undefined) {
        throw new Error("Missing connected Solana wallet for CCTP send");
    }

    const signerAddress = await getConnectedSolanaWalletAddress(walletProvider);
    if (signerAddress === undefined) {
        throw new Error(
            "Missing connected Solana wallet address for CCTP send",
        );
    }

    const { solburnUrl } = getBoltzSwapsConfig();
    // Try to obtain ephemeral keypairs from solburn so the MessageSent rent
    // can be reclaimed 5 days after the burn lands. On any failure (network,
    // service, missing config), fall back to the legacy path: user wallet
    // pays the rent directly via a locally-generated MessageSentEventData
    // and the rent stays stuck on chain.
    const allocation = solburnUrl
        ? await tryFetchSolburnAllocation(solburnUrl)
        : null;

    const messageSentEventData =
        allocation === null
            ? modules.web3.Keypair.generate()
            : modules.web3.Keypair.fromSecretKey(
                  allocation.messageSentEventDataSecret,
              );
    const eventRentPayer =
        allocation === null
            ? null
            : modules.web3.Keypair.fromSecretKey(
                  allocation.eventRentPayerSecret,
              );
    const eventRentPayerAddress =
        eventRentPayer?.publicKey.toBase58() ?? signerAddress;

    const instruction = await createDepositForBurnInstruction(
        context,
        sendParam,
        signerAddress,
        eventRentPayerAddress,
        messageSentEventData.publicKey.toBase58(),
    );

    const instructions: TransactionInstruction[] = [
        modules.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: solanaCctpComputeUnitLimit,
        }),
    ];
    if (eventRentPayer !== null) {
        // Prefund the ephemeral rent payer so it can cover the MessageSent
        // account's rent during the burn ix.
        const rentLamports = await getSolanaRentExemptMinimumBalance(
            context.asset,
            solanaCctpMessageSentAccountSize,
        );
        instructions.push(
            modules.web3.SystemProgram.transfer({
                fromPubkey: new modules.web3.PublicKey(signerAddress),
                toPubkey: eventRentPayer.publicKey,
                lamports: rentLamports,
            }),
        );
    }
    instructions.push(instruction);

    const { transaction, latestBlockhash } = await createTransaction(
        context,
        instructions,
        signerAddress,
    );
    const signers = [messageSentEventData];
    if (eventRentPayer !== null) {
        signers.push(eventRentPayer);
    }
    const localSignerPublicKeys = signers.map((signer) =>
        signer.publicKey.toBase58(),
    );

    const simulation = await context.connection.simulateTransaction(
        transaction,
        {
            sigVerify: false,
            replaceRecentBlockhash: true,
            commitment: "confirmed",
        },
    );
    let exactBlockhashSimulation:
        | {
              err: unknown;
              logs?: string[] | null;
              returnData?: unknown;
              unitsConsumed?: number;
          }
        | undefined;
    let exactBlockhashSimulationError: string | undefined;
    try {
        const exactBlockhashSimulationResult =
            await context.connection.simulateTransaction(transaction, {
                sigVerify: false,
                replaceRecentBlockhash: false,
                commitment: "confirmed",
            });
        exactBlockhashSimulation = exactBlockhashSimulationResult.value;
    } catch (error) {
        exactBlockhashSimulationError = formatError(error);
        getLogger().warn(
            "[PHANTOM_DEBUG] Solana CCTP exact-blockhash local simulation threw",
            {
                sourceAsset: context.asset,
                signerAddress,
                simulationOptions: {
                    commitment: "confirmed",
                    replaceRecentBlockhash: false,
                    sigVerify: false,
                },
                formattedError: exactBlockhashSimulationError,
                rpcEndpoint: context.connection.rpcEndpoint,
            },
        );
    }

    const logPhantomDocsCompliance = async (
        selectedSigningMethod: "signAndSendTransaction" | "signTransaction",
        localSignaturesAppliedBeforeWallet: boolean,
    ) => {
        // Diagnostic instrumentation must never abort a real send, so any
        // failure while building the debug payload is swallowed.
        try {
            getLogger().info(
                "[PHANTOM_DEBUG] Solana CCTP Phantom compliance evidence",
                {
                    sourceAsset: context.asset,
                    signerAddress,
                    selectedSigningMethod,
                    localSignaturesAppliedBeforeWallet,
                    localSignerPublicKeys,
                    transaction:
                        await getSolanaVersionedTransactionSummaryDebugInfo(
                            transaction,
                            { includeSerializedBase64: true },
                        ),
                    compliance:
                        await getPhantomSimulationWarningComplianceDebugInfo({
                            connection: context.connection,
                            exactBlockhashSimulation,
                            exactBlockhashSimulationError,
                            localSignerPublicKeys,
                            localSignaturesAppliedBeforeWallet,
                            selectedSigningMethod,
                            simulation: simulation.value,
                            transaction,
                            walletSignerAddress: signerAddress,
                        }),
                },
            );
        } catch (error) {
            getLogger().warn(
                "[PHANTOM_DEBUG] Solana CCTP compliance evidence logging failed",
                { sourceAsset: context.asset, error: formatError(error) },
            );
        }
    };

    if (simulation.value.err !== null) {
        await logPhantomDocsCompliance("signTransaction", false);
        throw new Error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}${formatSolanaLogsMessage(simulation.value.logs)}`,
        );
    }

    const sendOptions: SendOptions = {
        skipPreflight: true,
        preflightCommitment: "confirmed",
    };
    const sendWithWallet = async (
        reason: string,
    ): Promise<BridgeTransaction> => {
        transaction.sign(signers);
        await logPhantomDocsCompliance("signAndSendTransaction", true);
        getLogger().warn(
            "[PHANTOM_DEBUG] Solana CCTP wallet-managed signing fallback",
            {
                sourceAsset: context.asset,
                signerAddress,
                selectedSigningMethod: "signAndSendTransaction",
                reason,
                localSignerPublicKeys,
            },
        );
        const signature = await walletProvider.signAndSendTransaction(
            transaction,
            sendOptions,
        );
        return {
            hash: signature,
            details: {
                solana: {
                    blockhash: latestBlockhash.blockhash,
                },
            },
        };
    };

    const signTransaction =
        walletProvider.signTransaction?.bind(walletProvider);
    if (signTransaction === undefined) {
        getLogger().warn("Falling back to wallet-managed Solana CCTP send", {
            sourceAsset: context.asset,
            sender: signerAddress,
            reason: "Connected Solana wallet does not support signing transactions without broadcasting",
        });
        return await sendWithWallet("signTransaction method missing");
    }

    try {
        let signature: string;
        let serializedSignedTransaction: Uint8Array;
        try {
            await logPhantomDocsCompliance("signTransaction", false);
            const signedTransaction = await signTransaction(transaction);
            try {
                getLogger().info(
                    "[PHANTOM_DEBUG] Solana CCTP wallet returned signed transaction",
                    {
                        sourceAsset: context.asset,
                        signerAddress,
                        selectedSigningMethod: "signTransaction",
                        transaction:
                            await getSolanaVersionedTransactionSummaryDebugInfo(
                                signedTransaction as VersionedTransaction,
                            ),
                    },
                );
            } catch (error) {
                getLogger().warn(
                    "[PHANTOM_DEBUG] Solana CCTP signed transaction logging failed",
                    {
                        sourceAsset: context.asset,
                        error: formatError(error),
                    },
                );
            }
            signature = getSignedTransactionSignature(signedTransaction);
            signedTransaction.sign(signers);
            serializedSignedTransaction = signedTransaction.serialize();
        } catch (error) {
            getLogger().warn(
                "[PHANTOM_DEBUG] Solana CCTP signTransaction failed",
                {
                    sourceAsset: context.asset,
                    signerAddress,
                    selectedSigningMethod: "signTransaction",
                    isWalletRejection: isWalletRejectionError(error),
                    formattedError: formatError(error),
                },
            );
            if (isWalletRejectionError(error)) {
                throw error;
            }

            getLogger().warn(
                "Falling back to wallet-managed Solana CCTP send",
                {
                    sourceAsset: context.asset,
                    sender: signerAddress,
                    reason: formatError(error),
                },
            );
            return await sendWithWallet("signTransaction threw non-rejection");
        }

        const pendingSend: PendingSolanaCctpBridgeSend = {
            kind: PendingBridgeSendKind.SolanaCctp,
            sourceAsset: context.asset,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature,
        };
        getLogger().info("Signed pending Solana CCTP send", {
            sourceAsset: context.asset,
            sender: signerAddress,
            signature,
        });

        const encodedTransaction = Buffer.from(
            serializedSignedTransaction,
        ).toString("base64");

        getLogger().info("Broadcasting pending Solana CCTP send...", {
            sourceAsset: context.asset,
            sender: signerAddress,
            encodedTransaction,
        });
        const broadcastSignature =
            await context.connection.sendEncodedTransaction(
                encodedTransaction,
                sendOptions,
            );
        await overrides?.pendingSendCallbacks?.persist(pendingSend);

        if (broadcastSignature !== signature) {
            getLogger().warn(
                "Solana RPC returned a different broadcast signature",
                {
                    expected: signature,
                    broadcastSignature,
                },
            );
            await overrides?.pendingSendCallbacks?.persist({
                ...pendingSend,
                signature: broadcastSignature,
            });
        }
        getLogger().info("Broadcast pending Solana CCTP send", {
            sourceAsset: context.asset,
            sender: signerAddress,
            signature: broadcastSignature,
        });

        return {
            hash: broadcastSignature,
            details: {
                solana: {
                    blockhash: latestBlockhash.blockhash,
                },
            },
        };
    } catch (error) {
        if (error instanceof modules.web3.SendTransactionError) {
            const logs = await error
                .getLogs(context.connection)
                .catch(() => error.logs);
            getLogger().error(
                "[PHANTOM_DEBUG] Solana CCTP send failed with SendTransactionError",
                {
                    sourceAsset: context.asset,
                    signerAddress,
                    formattedError: formatError(error),
                    logs,
                },
            );
            throw new Error(
                `${error.message}${formatSolanaLogsMessage(logs)}`,
                {
                    cause: error,
                },
            );
        }
        getLogger().warn("[PHANTOM_DEBUG] Solana CCTP send failed", {
            sourceAsset: context.asset,
            signerAddress,
            isWalletRejection: isWalletRejectionError(error),
            formattedError: formatError(error),
        });
        throw error;
    }
};

export const getSolanaCctpTokenBalance = async (
    config: Pick<SolanaCctpConfig, "asset" | "tokenMint">,
    ownerAddress: string,
): Promise<bigint> => {
    const [modules, connection] = await Promise.all([
        lazySolanaCctp.get(),
        getSolanaConnection(config.asset),
    ]);
    const tokenAccount = await getSolanaAssociatedTokenAddress(
        config.tokenMint,
        ownerAddress,
    );

    try {
        const balance = await connection.getTokenAccountBalance(
            new modules.web3.PublicKey(tokenAccount),
        );

        return BigInt(balance.value.amount);
    } catch {
        return 0n;
    }
};

export const createSolanaCctpContract = (
    config: SolanaCctpConfig,
): SolanaCctpTransportClient => {
    const contextPromise = getContext(config);

    return {
        transport: NetworkTransport.Solana,
        send: async (sendParam, msgFee, refundAddress, overrides) => {
            void msgFee;
            void refundAddress;
            return await send(await contextPromise, sendParam, overrides);
        },
    };
};
