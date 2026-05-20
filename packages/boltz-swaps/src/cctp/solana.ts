import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { hex } from "@scure/base";
import type { Connection, TransactionInstruction } from "@solana/web3.js";

import { getAssetBridge, getBoltzSwapsConfig } from "../config.ts";
import { constructRequestOptions } from "../helper.ts";
import { getLogger } from "../logger.ts";
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
import type { CctpSendParam } from "./types.ts";

type SolanaCctpModules = Awaited<ReturnType<(typeof lazySolanaCctp)["get"]>>;

export type SolanaCctpConfig = {
    asset: string;
    tokenMint: string;
    walletProvider?: SolanaWalletProvider;
};

export type SolanaCctpTransportClient = {
    transport: NetworkTransport.Solana;
    send: (sendParam: CctpSendParam) => Promise<BridgeTransaction>;
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

const getContext = async (config: SolanaCctpConfig): Promise<Context> => ({
    modules: await lazySolanaCctp.get(),
    asset: config.asset,
    connection: await getSolanaConnection(config.asset),
    tokenMint: config.tokenMint,
    walletProvider: config.walletProvider,
    ...requireSolanaCctpProgramIds(config.asset),
});

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

    // Try to obtain ephemeral keypairs from solburn so the MessageSent rent
    // can be reclaimed 5 days after the burn lands. On any failure (network,
    // service, missing config), fall back to the legacy path: user wallet
    // pays the rent directly via a locally-generated MessageSentEventData
    // and the rent stays stuck on chain.
    const { solburnUrl } = getBoltzSwapsConfig();
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
    transaction.sign(signers);

    const simulation = await context.connection.simulateTransaction(
        transaction,
        {
            sigVerify: false,
            replaceRecentBlockhash: true,
            commitment: "confirmed",
        },
    );
    if (simulation.value.err !== null) {
        throw new Error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}${formatSolanaLogsMessage(simulation.value.logs)}`,
        );
    }

    try {
        const signature = await walletProvider.signAndSendTransaction(
            transaction,
            {
                skipPreflight: true,
                preflightCommitment: "confirmed",
            },
        );
        return {
            hash: signature,
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
            throw new Error(
                `${error.message}${formatSolanaLogsMessage(logs)}`,
                {
                    cause: error,
                },
            );
        }
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
        send: async (sendParam) => await send(await contextPromise, sendParam),
    };
};
