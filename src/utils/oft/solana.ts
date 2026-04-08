import type { Umi } from "@metaplex-foundation/umi";
import type { WalletAdapter as UmiWalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { hex } from "@scure/base";
import type { AccountRole, ReadonlyUint8Array } from "@solana/kit";
import type {
    AccountMeta,
    Connection,
    TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import log from "loglevel";

import { config } from "../../config";
import { NetworkTransport } from "../../configs/base";
import lazySolanaOft from "../../lazy/solanaOft";
import {
    getConnectedSolanaWalletAddress,
    getSolanaAssociatedTokenAddress,
    getSolanaConnection,
} from "../chains/solana";
import { formatError } from "../errors";
import type { MsgFee, OftTransportClient, SendParam } from "./types";

type SolanaOftModules = Awaited<ReturnType<(typeof lazySolanaOft)["get"]>>;

type Context = {
    modules: SolanaOftModules;
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
    sourceAsset: string;
    programAddress: string;
    storeAddress: string;
    walletProvider?: SolanaWalletProvider;
};

const solanaOftComputeUnitLimit = 1_000_000;
const programReturnPrefix = "Program return: ";
const creditsSeed = "Credits";
const eventAuthoritySeed = "__event_authority";
const peerSeed = "Peer";

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

type SolanaKitInstruction = {
    programAddress: string;
    accounts: ReadonlyArray<{
        address: string;
        role: AccountRole;
    }>;
    data: ReadonlyUint8Array;
};

const toLegacyInstruction = (
    modules: SolanaOftModules,
    instruction: SolanaKitInstruction,
): TransactionInstruction =>
    new modules.web3.TransactionInstruction({
        programId: new modules.web3.PublicKey(instruction.programAddress),
        keys: instruction.accounts.map((account) => ({
            pubkey: new modules.web3.PublicKey(account.address),
            isSigner: modules.solanaKit.isSignerRole(account.role),
            isWritable: modules.solanaKit.isWritableRole(account.role),
        })),
        data: Buffer.from(instruction.data),
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

const derivePda = (
    modules: SolanaOftModules,
    programId: string,
    ...seeds: Uint8Array[]
): string =>
    modules.web3.PublicKey.findProgramAddressSync(
        seeds.map((seed) => Buffer.from(seed)),
        new modules.web3.PublicKey(programId),
    )[0].toBase58();

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
    sourceAsset: string,
    walletProvider?: SolanaWalletProvider,
): Promise<string> => {
    const walletAddress =
        walletProvider === undefined
            ? undefined
            : await getConnectedSolanaWalletAddress(walletProvider);

    if (walletAddress !== undefined) {
        return walletAddress;
    }

    const configuredQuotePayer =
        config.assets?.[sourceAsset]?.network?.oftQuotePayer;
    if (configuredQuotePayer !== undefined) {
        return configuredQuotePayer;
    }

    throw new Error(
        `Could not determine a valid Solana quote payer for ${sourceAsset}`,
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
    sourceAsset,
    programAddress,
    storeAddress,
    walletProvider,
}: SolanaLegacyMeshConfig): Promise<Context> => {
    const modules = await lazySolanaOft.get();
    try {
        const connection = await getSolanaConnection(sourceAsset);
        const accountInfo = await connection.getAccountInfo(
            new modules.web3.PublicKey(storeAddress),
            "confirmed",
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

        return {
            modules,
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
            quotePayer: await getQuotePayer(sourceAsset, walletProvider),
            addressLookupTableAddress,
        };
    } catch (error) {
        log.warn(
            "Failed to initialize Solana OFT context",
            sourceAsset,
            formatError(error),
        );
        throw new Error(
            `Failed to initialize Solana OFT context for ${sourceAsset}: ${formatError(error)}`,
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
): Promise<Uint8Array> => {
    const { modules } = context;
    const peerAddress = derivePeerAddress(
        modules,
        context.programAddress,
        dstEid,
    );
    const peerInfo = await context.connection.getAccountInfo(
        new modules.web3.PublicKey(peerAddress),
        "confirmed",
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
};

const getRemainingAccounts = async (
    kind: "quote" | "send",
    context: Context,
    payer: string,
    dstEid: number,
    receiver: Uint8Array,
) => {
    const { modules } = context;
    const endpoint = new modules.lzSolanaUmi.EndpointProgram.Endpoint(
        modules.umi.publicKey(context.endpointProgram) as never,
    );
    const sendLibrary = await endpoint.getSendLibrary(
        context.umi.rpc as never,
        modules.umi.publicKey(context.storeAddress) as never,
        dstEid,
    );
    if (!sendLibrary.programId) {
        throw new Error("Send library not initialized for Solana legacy mesh");
    }

    const sendLibraryProgramId = String(sendLibrary.programId);
    let msgLibProgram;
    switch (sendLibraryProgramId) {
        case modules.lzSolanaUmi.SimpleMessageLibProgram
            .SIMPLE_MESSAGELIB_PROGRAM_ID:
            msgLibProgram =
                new modules.lzSolanaUmi.SimpleMessageLibProgram.SimpleMessageLib(
                    modules.umi.publicKey(sendLibraryProgramId) as never,
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
            sender: modules.umi.publicKey(context.storeAddress) as never,
            dstEid,
            receiver,
        },
        msgLibProgram,
    };
    const metas =
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

    return metas.map((meta) => ({
        pubkey: new modules.web3.PublicKey(meta.pubkey),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
    }));
};

const formatSolanaLogsMessage = (logs: string[] | undefined | null): string =>
    logs === undefined || logs === null || logs.length === 0
        ? ""
        : `\nLogs:\n${logs.join("\n")}`;

const createTransaction = async (
    context: Context,
    instructions: TransactionInstruction[],
    payerAddress: string,
) => {
    const { modules } = context;
    const latestBlockhash =
        await context.connection.getLatestBlockhash("confirmed");

    let lookupTables = [];
    if (context.addressLookupTableAddress !== undefined) {
        const lookupTableAccount = await context.connection.getAccountInfo(
            new modules.web3.PublicKey(context.addressLookupTableAddress),
            "confirmed",
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
        log.error(
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

    const buffer = Buffer.from(encodedData, "base64");

    return "deserialize" in serializer
        ? serializer.deserialize(buffer, 0)[0]
        : serializer.decode(buffer);
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
    sourceAsset: string,
    context: Context,
    sendParam: SendParam,
    msgFee: MsgFee,
) => {
    const { modules } = context;
    const signerAddress = context.walletAdapter?.publicKey?.toBase58();
    const walletProvider = context.walletProvider;
    if (signerAddress === undefined || walletProvider === undefined) {
        throw new Error(
            `Missing connected Solana wallet for OFT send from ${sourceAsset}`,
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
    const { latestBlockhash, transaction } = await createTransaction(
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
            wait: async () =>
                await context.connection.confirmTransaction(
                    {
                        signature,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight:
                            latestBlockhash.lastValidBlockHeight,
                    },
                    "confirmed",
                ),
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

        const payload = Buffer.from(
            logLine.slice(separatorIndex + 1),
            "base64",
        );
        return `0x${hex.encode(payload.subarray(0, 32))}`;
    }

    return undefined;
};

export const getSolanaOftTokenBalance = async (
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
        send: async (sendParam, msgFee) =>
            await sendLegacyMesh(
                contextConfig.sourceAsset,
                await contextPromise,
                sendParam,
                msgFee,
            ),
    };
};
