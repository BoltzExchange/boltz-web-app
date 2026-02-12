import log from "loglevel";
import {
    type Address,
    type DecodeEventLogReturnType,
    type Hex,
    type Log,
    type PublicClient,
    type WalletClient,
    decodeEventLog,
    encodeAbiParameters,
    getEventSelector,
    keccak256,
    parseAbiItem,
    parseEventLogs,
    toHex,
} from "viem";

import { config } from "../config";
import type { AssetType } from "../consts/Assets";
import { RBTC } from "../consts/Assets";
import { EtherSwapAbi } from "../context/Web3";
import { type Contracts } from "./boltzClient";
import { weiToSatoshi } from "./rootstock";

type GetPublicClient = () => PublicClient;
type GetWalletClient = () => WalletClient;
type GetContracts = () => Contracts;
type EventLog = Log<
    bigint,
    number,
    false,
    undefined,
    true,
    typeof EtherSwapAbi
>;

const bigIntMax = (...args: bigint[]) => args.reduce((m, e) => (e > m ? e : m));

const scanInterval = 2_000n;

export type LogRefundData = {
    asset: AssetType;
    blockNumber: bigint;
    transactionHash: Hex;

    preimageHash: string;
    amount: bigint;
    claimAddress: Address;
    refundAddress: Address;
    timelock: bigint;
};

export const getLogsFromReceipt = async (
    client: PublicClient,
    txHash: Hex,
): Promise<LogRefundData> => {
    const receipt = await client.getTransactionReceipt({
        hash: txHash,
    });
    const logs = parseEventLogs({
        abi: EtherSwapAbi,
        logs: receipt.logs,
    });

    const eventSignature = "Lockup(bytes32,uint256,address,address,uint256)";
    const topicHash = getEventSelector(eventSignature);
    for (const eventLog of logs) {
        if (eventLog.topics[0] !== topicHash) {
            continue;
        }

        return parseLockupEvent(eventLog).data;
    }

    throw new Error("could not find event");
};

async function* scanLogsForPossibleRefunds(
    abortSignal: AbortSignal,
    publicClient: GetPublicClient,
    walletClient: GetWalletClient,
    contracts: GetContracts,
) {
    const [[signerAddress], latestBlock] = await Promise.all([
        walletClient().getAddresses(),
        publicClient().getBlockNumber(),
    ]);

    const deployHeight = BigInt(config.assets[RBTC].contracts.deployHeight);

    log.info(
        `Scanning for possible refunds of ${signerAddress} from ${deployHeight} to ${latestBlock}`,
    );

    const scanProviderUrl = import.meta.env.VITE_RSK_LOG_SCAN_ENDPOINT;
    if (scanProviderUrl === undefined) {
        return;
    }

    for (
        let toBlock = latestBlock;
        toBlock >= deployHeight;
        toBlock -= scanInterval
    ) {
        if (abortSignal.aborted) {
            log.info(`Cancelling refund log scan of: ${signerAddress}`);
            return;
        }

        const fromBlock = bigIntMax(toBlock - scanInterval, 0n);
        log.debug(`Scanning possible refunds from ${fromBlock} to ${toBlock}`);
        const logs = await publicClient().getLogs({
            address: contracts().swapContracts.EtherSwap as Address,
            event: parseAbiItem(
                "event Lockup(bytes32, uint256, address, address, uint256)",
            ),
            fromBlock,
            toBlock,
            args: [null, null, null, signerAddress],
        });

        const results: { progress: number; events: LogRefundData[] } = {
            progress:
                latestBlock === deployHeight
                    ? 1
                    : Number(latestBlock - toBlock) /
                      Number(latestBlock - deployHeight),
            events: [],
        };

        for (const eventLog of logs) {
            log.debug(`Found lockup event in: ${eventLog.transactionHash}`);

            const { data, decoded } = parseLockupEvent(eventLog);
            // Contracts v5 switched from encodePacked to an assembly implementation of encode
            const stillLocked = (await publicClient().readContract({
                address: contracts().swapContracts.EtherSwap as Address,
                abi: EtherSwapAbi,
                functionName: "swaps",
                args: [
                    keccak256(
                        encodeAbiParameters(
                            [
                                { type: "bytes32" },
                                { type: "uint256" },
                                { type: "address" },
                                { type: "address" },
                                { type: "uint256" },
                            ],
                            [
                                decoded.args[0] as Hex,
                                decoded.args[1] as bigint,
                                data.claimAddress,
                                data.refundAddress,
                                data.timelock,
                            ],
                        ),
                    ),
                ],
                authorizationList: undefined,
            })) as boolean;

            if (!stillLocked) {
                log.info(
                    `Lockup event in ${eventLog.transactionHash} already spent`,
                );
                continue;
            }

            log.info(
                `Found lockup event that is still locked in: ${eventLog.transactionHash}`,
            );
            results.events.push(data);
        }

        yield results;
    }

    log.info(`Finished refund log scanning for ${signerAddress}`);
}

const parseLockupEvent = (
    log: EventLog,
): {
    data: LogRefundData;
    decoded: DecodeEventLogReturnType;
} => {
    const decoded = decodeEventLog({
        abi: EtherSwapAbi,
        data: log.data,
        topics: log.topics,
        eventName: "Lockup",
    });
    return {
        decoded,
        data: {
            asset: RBTC,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            preimageHash: decoded[0].substring(2),
            amount: weiToSatoshi(decoded[1]),
            claimAddress: decoded[2],
            refundAddress: decoded[3],
            timelock: decoded[4],
        },
    };
};

export { scanLogsForPossibleRefunds };
