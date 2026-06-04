import type { Umi } from "@metaplex-foundation/umi";
import type { WalletAdapter as UmiWalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { base58, hex } from "@scure/base";
import type {
    AccountMeta,
    AddressLookupTableAccount,
    Connection,
    SendOptions,
    Transaction,
    TransactionInstruction,
    VersionedTransaction,
} from "@solana/web3.js";

import type { PendingSolanaOftBridgeSend } from "../bridge/pendingSend.ts";
import { PendingBridgeSendKind } from "../bridge/types.ts";
import { getCachedValue } from "../cache.ts";
import { getBoltzSwapsConfig } from "../config.ts";
import { formatError, isWalletRejectionError } from "../errors.ts";
import { prefix0x } from "../evm/prefix0x.ts";
import { getLogger } from "../logger.ts";
import {
    getPhantomSimulationWarningComplianceDebugInfo,
    getSolanaVersionedTransactionSummaryDebugInfo,
} from "../solana/debug.ts";
import {
    derivePda,
    formatSolanaLogsMessage,
    getConnectedSolanaWalletAddress,
    getSolanaAccountInfo,
    getSolanaAssociatedTokenAddress,
    getSolanaConnection,
    toLegacyInstruction,
} from "../solana/index.ts";
import { solanaOft as lazySolanaOft } from "../solana/lazy.ts";
import {
    BridgeKind,
    type BridgeTransaction,
    NetworkTransport,
} from "../types.ts";
import { decodeBase64 } from "../util/base64.ts";
import type {
    MsgFee,
    OftTransportClient,
    PendingBridgeSendCallbacks,
    SendParam,
} from "./types.ts";

type SolanaOftModules = Awaited<ReturnType<(typeof lazySolanaOft)["get"]>>;

type Context = {
    modules: SolanaOftModules;
    asset: string;
    connection: Connection;
    umi: Umi;
    walletProvider?: SolanaWalletProvider;
    walletAdapter?: UmiWalletAdapter;
    programAddress: string;
    storeAddress: string;
    creditsAddress: string;
    tokenMint: string;
    tokenEscrow: string;
    endpointProgram: string;
    quotePayer: string;
    addressLookupTableAddress?: string;
};

type SolanaReturnSerializer<T> =
    | {
          deserialize: (buffer: Uint8Array, offset?: number) => [T, number];
      }
    | {
          decode: (buffer: Uint8Array) => T;
      };

export type SolanaLegacyMeshConfig = {
    asset: string;
    programAddress: string;
    storeAddress: string;
    walletProvider?: SolanaWalletProvider;
};

const solanaOftComputeUnitLimit = 1_000_000;
const programReturnPrefix = "Program return: ";
const creditsSeed = "Credits";
const eventAuthoritySeed = "__event_authority";
const peerSeed = "Peer";
const cachePrefix = "oft:";
const peerReceiverCachePrefix = `${cachePrefix}peer-receiver:`;
const remainingAccountsCachePrefix = `${cachePrefix}remaining-accounts:`;

const encodeU32 = (value: number, littleEndian = true): Uint8Array => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(
        0,
        value,
        littleEndian,
    );
    return bytes;
};

const hexToBytes = (value: string): Uint8Array =>
    value === "0x"
        ? new Uint8Array()
        : hex.decode(value.startsWith("0x") ? value.slice(2) : value);

const getCacheScope = (context: Context): string =>
    [
        context.asset,
        context.programAddress,
        context.storeAddress,
        context.endpointProgram,
    ].join(":");

const getSendParamArgs = (
    sendParam: SendParam,
): {
    dstEid: number;
    to: Uint8Array;
    amountLd: bigint;
    minAmountLd: bigint;
    extraOptions: Uint8Array;
    composeMsg: Uint8Array | null;
} => ({
    dstEid: sendParam[0],
    to: hexToBytes(sendParam[1]),
    amountLd: sendParam[2],
    minAmountLd: sendParam[3],
    extraOptions: hexToBytes(sendParam[4]),
    composeMsg: sendParam[5] === "0x" ? null : hexToBytes(sendParam[5]),
});

const appendRemainingAccounts = (
    modules: SolanaOftModules,
    instruction: TransactionInstruction,
    remainingAccounts: AccountMeta[],
): TransactionInstruction => {
    if (remainingAccounts.length === 0) {
        return instruction;
    }

    return new modules.web3.TransactionInstruction({
        programId: instruction.programId,
        keys: [...instruction.keys, ...remainingAccounts],
        data: instruction.data,
    });
};

const derivePeerAddress = (
    modules: SolanaOftModules,
    programId: string,
    dstEid: number,
): string =>
    derivePda(
        modules,
        programId,
        new TextEncoder().encode(peerSeed),
        encodeU32(dstEid, false),
    );

const createSolanaWalletAdapter = async (
    modules: SolanaOftModules,
    walletProvider: SolanaWalletProvider,
): Promise<UmiWalletAdapter> => {
    const walletAddress = await getConnectedSolanaWalletAddress(walletProvider);

    return {
        publicKey:
            walletProvider.publicKey ??
            (walletAddress !== undefined
                ? new modules.web3.PublicKey(walletAddress)
                : null),
        signMessage: walletProvider.signMessage?.bind(walletProvider),
        signTransaction: walletProvider.signTransaction?.bind(walletProvider),
        signAllTransactions:
            walletProvider.signAllTransactions?.bind(walletProvider),
    };
};

const getQuotePayer = async (
    asset: string,
    walletProvider?: SolanaWalletProvider,
): Promise<string> => {
    const walletAddress =
        walletProvider === undefined
            ? undefined
            : await getConnectedSolanaWalletAddress(walletProvider);

    if (walletAddress !== undefined) {
        return walletAddress;
    }

    const bridge = getBoltzSwapsConfig().assets?.[asset]?.bridge;
    const configuredQuotePayer =
        bridge?.kind === BridgeKind.Oft ? bridge.oft?.quotePayer : undefined;
    if (configuredQuotePayer !== undefined) {
        return configuredQuotePayer;
    }

    throw new Error(
        `Could not determine a valid Solana quote payer for ${asset}`,
    );
};

const createUmiContext = async (
    modules: SolanaOftModules,
    connection: Connection,
    walletProvider?: SolanaWalletProvider,
): Promise<{
    umi: Umi;
    walletAdapter?: UmiWalletAdapter;
}> => {
    const umi = modules.umiBundleDefaults
        .createUmi(connection)
        .use(modules.mplToolbox.mplToolbox());
    if (walletProvider === undefined) {
        return { umi };
    }

    const walletAdapter = await createSolanaWalletAdapter(
        modules,
        walletProvider,
    );
    umi.use(
        modules.umiWalletAdapters.walletAdapterIdentity(
            walletAdapter as never,
            true,
        ),
    );

    return { umi, walletAdapter };
};

export const getSolanaLegacyMeshContext = async ({
    asset,
    programAddress,
    storeAddress,
    walletProvider,
}: SolanaLegacyMeshConfig): Promise<Context> => {
    try {
        const modules = await lazySolanaOft.get();
        const connection = await getSolanaConnection(asset);
        const accountInfo = await getSolanaAccountInfo(
            asset,
            storeAddress,
            connection,
        );
        if (accountInfo === null) {
            throw new Error(`missing Solana OFT store account ${storeAddress}`);
        }

        const { umi, walletAdapter } = await createUmiContext(
            modules,
            connection,
            walletProvider,
        );

        const storeInfo = modules.generated
            .getOFTStoreDecoder()
            .decode(accountInfo.data);
        const tokenMint = String(storeInfo.tokenMint);
        const tokenEscrow = String(storeInfo.tokenEscrow);
        const endpointProgram = String(storeInfo.endpointProgram);
        const addressLookupTableAddress = modules.solanaKit.isSome(
            storeInfo.alt,
        )
            ? String(storeInfo.alt.value)
            : undefined;
        const quotePayer = await getQuotePayer(asset, walletProvider);

        return {
            modules,
            asset,
            connection,
            umi,
            walletProvider,
            walletAdapter,
            programAddress,
            storeAddress,
            creditsAddress: derivePda(
                modules,
                programAddress,
                new TextEncoder().encode(creditsSeed),
            ),
            tokenMint,
            tokenEscrow,
            endpointProgram,
            quotePayer,
            addressLookupTableAddress,
        };
    } catch (error) {
        getLogger().warn("Failed to initialize Solana OFT context", {
            sourceAsset: asset,
            programAddress,
            storeAddress,
            formattedError: formatError(error),
        });
        throw new Error(
            `Failed to initialize Solana OFT context for ${asset}: ${formatError(error)}`,
            { cause: error },
        );
    }
};

const createLegacySendInstruction = (
    context: Context,
    sendParam: SendParam,
    msgFee: MsgFee,
    signerAddress: string,
    remainingAccounts: AccountMeta[],
) => {
    const { modules } = context;
    const eventAuthority = derivePda(
        modules,
        context.programAddress,
        new TextEncoder().encode(eventAuthoritySeed),
    );
    const instruction = toLegacyInstruction(
        modules,
        modules.generated.getSendInstruction(
            {
                signer: modules.solanaKit.createNoopSigner(
                    modules.solanaKit.address(signerAddress),
                ),
                peer: modules.solanaKit.address(
                    derivePeerAddress(
                        modules,
                        context.programAddress,
                        sendParam[0],
                    ),
                ),
                oftStore: modules.solanaKit.address(context.storeAddress),
                credits: modules.solanaKit.address(context.creditsAddress),
                tokenSource: modules.solanaKit.address(
                    modules.splToken
                        .getAssociatedTokenAddressSync(
                            new modules.web3.PublicKey(context.tokenMint),
                            new modules.web3.PublicKey(signerAddress),
                            false,
                            modules.splToken.TOKEN_PROGRAM_ID,
                        )
                        .toBase58(),
                ),
                tokenEscrow: modules.solanaKit.address(context.tokenEscrow),
                tokenMint: modules.solanaKit.address(context.tokenMint),
                tokenProgram: modules.solanaKit.address(
                    modules.splToken.TOKEN_PROGRAM_ID.toBase58(),
                ),
                eventAuthority: modules.solanaKit.address(eventAuthority),
                program: modules.solanaKit.address(context.programAddress),
                params: {
                    ...getSendParamArgs(sendParam),
                    nativeFee: msgFee[0],
                    lzTokenFee: msgFee[1],
                },
            },
            {
                programAddress: modules.solanaKit.address(
                    context.programAddress,
                ),
            },
        ),
    );

    return appendRemainingAccounts(modules, instruction, remainingAccounts);
};

const getLegacyPeerReceiver = async (
    context: Context,
    dstEid: number,
): Promise<Uint8Array> =>
    await getCachedValue(
        peerReceiverCachePrefix,
        `${getCacheScope(context)}:${dstEid}`,
        async () => {
            const { modules } = context;
            const peerAddress = derivePeerAddress(
                modules,
                context.programAddress,
                dstEid,
            );
            const peerInfo = await getSolanaAccountInfo(
                context.asset,
                peerAddress,
                context.connection,
            );
            if (peerInfo === null) {
                throw new Error(
                    `Missing Solana legacy peer account ${peerAddress} for ${dstEid}`,
                );
            }

            return Uint8Array.from(
                modules.generated.getPeerConfigDecoder().decode(peerInfo.data)
                    .peerAddress,
            );
        },
    );

const getRemainingAccounts = async (
    kind: "quote" | "send",
    context: Context,
    payer: string,
    dstEid: number,
    receiver: Uint8Array,
) => {
    const { modules } = context;
    return await getCachedValue(
        remainingAccountsCachePrefix,
        `${getCacheScope(context)}:${kind}:${payer}:${dstEid}:${hex.encode(receiver)}`,
        async (): Promise<AccountMeta[]> => {
            const endpoint = new modules.lzSolanaUmi.EndpointProgram.Endpoint(
                modules.umi.publicKey(context.endpointProgram) as never,
            );
            const sendLibrary = await endpoint.getSendLibrary(
                context.umi.rpc as never,
                modules.umi.publicKey(context.storeAddress) as never,
                dstEid,
            );
            if (!sendLibrary.programId) {
                throw new Error(
                    "Send library not initialized for Solana legacy mesh",
                );
            }

            const sendLibraryProgramId = String(sendLibrary.programId);
            let msgLibProgram;
            switch (sendLibraryProgramId) {
                case modules.lzSolanaUmi.SimpleMessageLibProgram
                    .SIMPLE_MESSAGELIB_PROGRAM_ID:
                    msgLibProgram =
                        new modules.lzSolanaUmi.SimpleMessageLibProgram.SimpleMessageLib(
                            modules.umi.publicKey(
                                sendLibraryProgramId,
                            ) as never,
                        );
                    break;

                case modules.lzSolanaUmi.UlnProgram.ULN_PROGRAM_ID:
                    msgLibProgram = new modules.lzSolanaUmi.UlnProgram.Uln(
                        modules.umi.publicKey(sendLibraryProgramId) as never,
                    );
                    break;

                default:
                    throw new Error(
                        `Unsupported Solana legacy mesh send library ${sendLibraryProgramId}`,
                    );
            }

            const cpiPath = {
                path: {
                    sender: modules.umi.publicKey(
                        context.storeAddress,
                    ) as never,
                    dstEid,
                    receiver,
                },
                msgLibProgram,
            };
            const accountMetas =
                kind === "quote"
                    ? await endpoint.getQuoteIXAccountMetaForCPI(
                          context.umi.rpc as never,
                          modules.umi.publicKey(payer) as never,
                          cpiPath,
                      )
                    : await endpoint.getSendIXAccountMetaForCPI(
                          context.umi.rpc as never,
                          modules.umi.publicKey(payer) as never,
                          cpiPath,
                      );

            return accountMetas.map((meta) => ({
                pubkey: new modules.web3.PublicKey(meta.pubkey),
                isSigner: meta.isSigner,
                isWritable: meta.isWritable,
            }));
        },
    );
};

const createTransaction = async (
    context: Context,
    instructions: TransactionInstruction[],
    payerAddress: string,
) => {
    const { modules } = context;
    const latestBlockhash =
        await context.connection.getLatestBlockhash("confirmed");

    let lookupTables: AddressLookupTableAccount[] = [];
    if (context.addressLookupTableAddress !== undefined) {
        const lookupTableAccount = await getSolanaAccountInfo(
            context.asset,
            context.addressLookupTableAddress,
            context.connection,
        );
        if (lookupTableAccount === null) {
            throw new Error(
                `Missing Solana lookup table ${context.addressLookupTableAddress}`,
            );
        }

        lookupTables = [
            new modules.web3.AddressLookupTableAccount({
                key: new modules.web3.PublicKey(
                    context.addressLookupTableAddress,
                ),
                state: modules.web3.AddressLookupTableAccount.deserialize(
                    lookupTableAccount.data,
                ),
            }),
        ];
    }

    return {
        latestBlockhash,
        transaction: new modules.web3.VersionedTransaction(
            new modules.web3.TransactionMessage({
                payerKey: new modules.web3.PublicKey(payerAddress),
                recentBlockhash: latestBlockhash.blockhash,
                instructions,
            }).compileToV0Message(
                lookupTables.length > 0 ? lookupTables : undefined,
            ),
        ),
    };
};

const getSignedTransactionSignature = (
    signedTransaction: Transaction | VersionedTransaction,
): string => {
    const signature = signedTransaction.signatures[0];
    const bytes =
        signature instanceof Uint8Array ? signature : signature?.signature;
    // Solana initialises signature slots to 64 zero bytes; a wallet that
    // returns the transaction unsigned would leave them that way.
    if (
        bytes === undefined ||
        bytes === null ||
        bytes.every((byte) => byte === 0)
    ) {
        throw new Error("Solana wallet did not return a transaction signature");
    }
    return base58.encode(bytes);
};

const simulateTransactionReturn = async <T>(
    context: Context,
    instructions: TransactionInstruction[],
    payerAddress: string,
    serializer: SolanaReturnSerializer<T>,
): Promise<T> => {
    const { transaction } = await createTransaction(
        context,
        instructions,
        payerAddress,
    );
    const simulation = await context.connection.simulateTransaction(
        transaction,
        {
            sigVerify: false,
            replaceRecentBlockhash: true,
            commitment: "confirmed",
        },
    );
    if (simulation.value.err !== null) {
        getLogger().error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
            {
                cause: simulation.value.err,
            },
            formatSolanaLogsMessage(simulation.value.logs),
        );
        throw new Error(
            `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
        );
    }
    const returnData = simulation.value.returnData;

    if (
        returnData?.programId !==
        instructions[instructions.length - 1]?.programId.toBase58()
    ) {
        throw new Error(`Simulate Fail: ${JSON.stringify(simulation)}`);
    }

    const [encodedData, encoding] = returnData.data;
    if (encoding !== "base64") {
        throw new Error(
            `Unsupported Solana simulation return encoding: ${String(encoding)}`,
        );
    }

    const decoded = decodeBase64(encodedData);

    return "deserialize" in serializer
        ? serializer.deserialize(decoded, 0)[0]
        : serializer.decode(decoded);
};

const quoteOft = async (context: Context, sendParam: SendParam) => {
    const { modules } = context;
    const instruction = toLegacyInstruction(
        modules,
        modules.generated.getQuoteOftInstruction(
            {
                oftStore: modules.solanaKit.address(context.storeAddress),
                credits: modules.solanaKit.address(context.creditsAddress),
                peer: modules.solanaKit.address(
                    derivePeerAddress(
                        modules,
                        context.programAddress,
                        sendParam[0],
                    ),
                ),
                ...getSendParamArgs(sendParam),
                payInLzToken: false,
            },
            {
                programAddress: modules.solanaKit.address(
                    context.programAddress,
                ),
            },
        ),
    );

    const simulationInstructions = [
        modules.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: solanaOftComputeUnitLimit,
        }),
        instruction,
    ];
    const result = await simulateTransactionReturn(
        context,
        simulationInstructions,
        context.quotePayer,
        modules.generated.getQuoteOFTResultDecoder(),
    );

    const oftLimit: [bigint, bigint] = [
        result.oftLimits.minAmountLd,
        result.oftLimits.maxAmountLd,
    ];
    const oftFeeDetails: [bigint, string][] = result.oftFeeDetails.map(
        (detail: { feeAmountLd: bigint; description: string }) => [
            detail.feeAmountLd,
            detail.description,
        ],
    );
    const oftReceipt: [bigint, bigint] = [
        result.oftReceipt.amountSentLd,
        result.oftReceipt.amountReceivedLd,
    ];

    return [oftLimit, oftFeeDetails, oftReceipt] as [
        [bigint, bigint],
        [bigint, string][],
        [bigint, bigint],
    ];
};

const quoteSend = async (
    context: Context,
    sendParam: SendParam,
    payInLzToken: boolean,
): Promise<MsgFee> => {
    const { modules } = context;
    const receiver = await getLegacyPeerReceiver(context, sendParam[0]);
    const remainingAccounts = await getRemainingAccounts(
        "quote",
        context,
        context.quotePayer,
        sendParam[0],
        receiver,
    );
    const instruction = toLegacyInstruction(
        modules,
        modules.generated.getQuoteSendInstruction(
            {
                oftStore: modules.solanaKit.address(context.storeAddress),
                credits: modules.solanaKit.address(context.creditsAddress),
                peer: modules.solanaKit.address(
                    derivePeerAddress(
                        modules,
                        context.programAddress,
                        sendParam[0],
                    ),
                ),
                params: {
                    ...getSendParamArgs(sendParam),
                    payInLzToken,
                },
            },
            {
                programAddress: modules.solanaKit.address(
                    context.programAddress,
                ),
            },
        ),
    );
    const result = await simulateTransactionReturn(
        context,
        [
            modules.web3.ComputeBudgetProgram.setComputeUnitLimit({
                units: solanaOftComputeUnitLimit,
            }),
            appendRemainingAccounts(modules, instruction, remainingAccounts),
        ],
        context.quotePayer,
        modules.generated.getMessagingFeeDecoder(),
    );

    return [result.nativeFee, result.lzTokenFee];
};

const sendLegacyMesh = async (
    asset: string,
    context: Context,
    sendParam: SendParam,
    msgFee: MsgFee,
    pendingSendCallbacks?: PendingBridgeSendCallbacks,
): Promise<BridgeTransaction> => {
    const { modules } = context;
    const signerAddress = context.walletAdapter?.publicKey?.toBase58();
    const walletProvider = context.walletProvider;
    if (signerAddress === undefined || walletProvider === undefined) {
        throw new Error(
            `Missing connected Solana wallet for OFT send from ${asset}`,
        );
    }

    const receiver = await getLegacyPeerReceiver(context, sendParam[0]);
    const remainingAccounts = await getRemainingAccounts(
        "send",
        context,
        signerAddress,
        sendParam[0],
        receiver,
    );
    const instruction = createLegacySendInstruction(
        context,
        sendParam,
        msgFee,
        signerAddress,
        remainingAccounts,
    );
    const instructions = [
        modules.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: solanaOftComputeUnitLimit,
        }),
        instruction,
    ];
    const { transaction, latestBlockhash } = await createTransaction(
        context,
        instructions,
        signerAddress,
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
            "[PHANTOM_DEBUG] Solana OFT exact-blockhash local simulation threw",
            {
                sourceAsset: asset,
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
                "[PHANTOM_DEBUG] Solana OFT Phantom compliance evidence",
                {
                    sourceAsset: asset,
                    signerAddress,
                    selectedSigningMethod,
                    localSignaturesAppliedBeforeWallet,
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
                            localSignerPublicKeys: [],
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
                "[PHANTOM_DEBUG] Solana OFT compliance evidence logging failed",
                { sourceAsset: asset, error: formatError(error) },
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
        await logPhantomDocsCompliance("signAndSendTransaction", false);
        getLogger().warn(
            "[PHANTOM_DEBUG] Solana OFT wallet-managed signing fallback",
            {
                sourceAsset: asset,
                signerAddress,
                selectedSigningMethod: "signAndSendTransaction",
                reason,
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
        getLogger().warn("Falling back to wallet-managed Solana OFT send", {
            sourceAsset: asset,
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
                    "[PHANTOM_DEBUG] Solana OFT wallet returned signed transaction",
                    {
                        sourceAsset: asset,
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
                    "[PHANTOM_DEBUG] Solana OFT signed transaction logging failed",
                    { sourceAsset: asset, error: formatError(error) },
                );
            }
            signature = getSignedTransactionSignature(signedTransaction);
            serializedSignedTransaction = signedTransaction.serialize();
        } catch (error) {
            getLogger().warn(
                "[PHANTOM_DEBUG] Solana OFT signTransaction failed",
                {
                    sourceAsset: asset,
                    signerAddress,
                    selectedSigningMethod: "signTransaction",
                    isWalletRejection: isWalletRejectionError(error),
                    formattedError: formatError(error),
                },
            );
            if (isWalletRejectionError(error)) {
                throw error;
            }

            getLogger().warn("Falling back to wallet-managed Solana OFT send", {
                sourceAsset: asset,
                sender: signerAddress,
                reason: formatError(error),
            });
            return await sendWithWallet("signTransaction threw non-rejection");
        }

        const pendingSend: PendingSolanaOftBridgeSend = {
            kind: PendingBridgeSendKind.SolanaOft,
            sourceAsset: asset,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature,
        };
        getLogger().info("Signed pending Solana OFT send", {
            sourceAsset: asset,
            sender: signerAddress,
            signature,
        });

        const rawTransaction = Buffer.from(serializedSignedTransaction);
        const encodedTransaction = rawTransaction.toString("base64");

        getLogger().info("Broadcasting pending Solana OFT send...", {
            sourceAsset: asset,
            sender: signerAddress,
            encodedTransaction,
        });
        const broadcastSignature =
            await context.connection.sendEncodedTransaction(
                encodedTransaction,
                sendOptions,
            );
        await pendingSendCallbacks?.persist(pendingSend);

        // The RPC derives the signature from the bytes we sent so it should
        // always match the one we computed locally; re-persist if it ever
        // doesn't so recovery looks for the right one.
        if (broadcastSignature !== signature) {
            getLogger().warn(
                "Solana RPC returned a different broadcast signature",
                {
                    expected: signature,
                    broadcastSignature,
                },
            );
            await pendingSendCallbacks?.persist({
                ...pendingSend,
                signature: broadcastSignature,
            });
        }
        getLogger().info("Broadcast pending Solana OFT send", {
            sourceAsset: asset,
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
                "[PHANTOM_DEBUG] Solana OFT send failed with SendTransactionError",
                {
                    sourceAsset: asset,
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
        getLogger().warn("[PHANTOM_DEBUG] Solana OFT send failed", {
            sourceAsset: asset,
            signerAddress,
            isWalletRejection: isWalletRejectionError(error),
            formattedError: formatError(error),
        });
        throw error;
    }
};

export const getSolanaOftGuidFromLogs = (
    logMessages: string[],
): string | undefined => {
    for (const logLine of [...logMessages].reverse()) {
        if (!logLine.startsWith(programReturnPrefix)) {
            continue;
        }
        const separatorIndex = logLine.indexOf(" ", programReturnPrefix.length);
        if (separatorIndex === -1) {
            continue;
        }

        const payload = decodeBase64(logLine.slice(separatorIndex + 1));
        return prefix0x(hex.encode(payload.subarray(0, 32)));
    }

    return undefined;
};

export const getSolanaTokenBalance = async (
    contextConfig: SolanaLegacyMeshConfig,
    ownerAddress: string,
): Promise<bigint> => {
    const context = await getSolanaLegacyMeshContext(contextConfig);
    const { modules } = context;
    const tokenSource = await getSolanaAssociatedTokenAddress(
        context.tokenMint,
        ownerAddress,
    );

    try {
        const balance = await context.connection.getTokenAccountBalance(
            new modules.web3.PublicKey(tokenSource),
        );

        return BigInt(balance.value.amount);
    } catch {
        return 0n;
    }
};

export const createSolanaOftContract = (
    contextConfig: SolanaLegacyMeshConfig,
): OftTransportClient => {
    const contextPromise = getSolanaLegacyMeshContext(contextConfig);

    return {
        transport: NetworkTransport.Solana,
        quoteOFT: async (sendParam) =>
            await quoteOft(await contextPromise, sendParam),
        quoteSend: async (sendParam, payInLzToken) =>
            await quoteSend(await contextPromise, sendParam, payInLzToken),
        send: async (sendParam, msgFee, refundAddress, overrides) => {
            void refundAddress;
            return await sendLegacyMesh(
                contextConfig.asset,
                await contextPromise,
                sendParam,
                msgFee,
                overrides?.pendingSendCallbacks,
            );
        },
    };
};
