import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import { hex } from "@scure/base";
import type { Connection, TransactionInstruction } from "@solana/web3.js";

import { NetworkTransport } from "../../configs/base";
import {
    solanaMessageTransmitterV2,
    solanaTokenMessengerMinterV2,
} from "../../configs/cctp";
import lazySolanaCctp from "../../lazy/solanaCctp";
import type { BridgeTransaction } from "../bridge/types";
import {
    getConnectedSolanaWalletAddress,
    getSolanaAssociatedTokenAddress,
    getSolanaConnection,
    getSolanaRentExemptMinimumBalance,
} from "../chains/solana";
import { toLegacyInstruction } from "../solana/instruction";
import { formatSolanaLogsMessage } from "../solana/logs";
import { derivePda } from "../solana/pda";
import { cctpEmptyHookData } from "./evm";
import type { CctpSendParam } from "./types";

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
    ) => Promise<BridgeTransaction>;
};

type Context = {
    modules: SolanaCctpModules;
    asset: string;
    connection: Connection;
    tokenMint: string;
    walletProvider?: SolanaWalletProvider;
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
    modules: SolanaCctpModules,
    destinationDomain: number,
): string =>
    derivePda(
        modules,
        solanaTokenMessengerMinterV2,
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

const getContext = async (config: SolanaCctpConfig): Promise<Context> => ({
    modules: await lazySolanaCctp.get(),
    asset: config.asset,
    connection: await getSolanaConnection(config.asset),
    tokenMint: config.tokenMint,
    walletProvider: config.walletProvider,
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
    messageSentEventDataAddress: string,
): Promise<TransactionInstruction> => {
    if (sendParam.hookData !== cctpEmptyHookData) {
        throw new Error(
            "Solana CCTP source sends do not support hook data yet",
        );
    }

    const { modules } = context;
    const programAddress = modules.solanaKit.address(
        solanaTokenMessengerMinterV2,
    );
    const burnTokenMint = new modules.web3.PublicKey(context.tokenMint);
    const owner = modules.solanaKit.createNoopSigner(
        modules.solanaKit.address(ownerAddress),
    );
    const messageSentEventData = modules.solanaKit.createNoopSigner(
        modules.solanaKit.address(messageSentEventDataAddress),
    );
    const derive = (...seeds: Uint8Array[]) =>
        derivePda(modules, solanaTokenMessengerMinterV2, ...seeds);

    return toLegacyInstruction(
        modules,
        modules.generated.getDepositForBurnInstruction(
            {
                owner,
                eventRentPayer: owner,
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
                        solanaMessageTransmitterV2,
                        textEncoder.encode("message_transmitter"),
                    ),
                ),
                tokenMessenger: modules.solanaKit.address(
                    derive(textEncoder.encode("token_messenger")),
                ),
                remoteTokenMessenger: modules.solanaKit.address(
                    deriveRemoteTokenMessenger(
                        modules,
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

    const messageSentEventData = modules.web3.Keypair.generate();
    const instruction = await createDepositForBurnInstruction(
        context,
        sendParam,
        signerAddress,
        messageSentEventData.publicKey.toBase58(),
    );
    const instructions = [
        modules.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: solanaCctpComputeUnitLimit,
        }),
        instruction,
    ];
    const { transaction, latestBlockhash } = await createTransaction(
        context,
        instructions,
        signerAddress,
    );
    transaction.sign([messageSentEventData]);

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
