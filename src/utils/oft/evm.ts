import log from "loglevel";
import {
    type Hex,
    type PublicClient,
    type TransactionReceipt,
    getAbiItem,
    getAddress,
    isAddressEqual,
    isHex,
    parseAbi,
    parseEventLogs,
} from "viem";

import { NetworkTransport } from "../../configs/base";
import type { Signer } from "../../context/Web3";
import type {
    MsgFee,
    OftFeeDetail,
    OftLimit,
    OftReceipt,
    OftReceivedEvent,
    OftSentEvent,
    OftTransportClient,
    SendParam,
} from "./types";

export type EvmOftTransportClient = OftTransportClient & {
    abi: typeof oftAbi;
    approvalRequired: () => Promise<boolean>;
};

export const oftAbi = parseAbi([
    "function quoteOFT((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) sendParam) view returns ((uint256 minAmountLD,uint256 maxAmountLD), (int256 feeAmountLD,string description)[], (uint256 amountSentLD,uint256 amountReceivedLD))",
    "function quoteSend((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) sendParam, bool payInLzToken) view returns ((uint256 nativeFee,uint256 lzTokenFee))",
    "function approvalRequired() view returns (bool)",
    "function send((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) sendParam, (uint256 nativeFee,uint256 lzTokenFee) msgFee, address refundAddress) payable returns ((bytes32 guid,uint64 nonce,(uint256 amountSentLD,uint256 amountReceivedLD) receipt), (uint256 nativeFee,uint256 lzTokenFee))",
    "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
    "event OFTReceived(bytes32 indexed guid, uint32 srcEid, address indexed toAddress, uint256 amountReceivedLD)",
]);

const requireHex = (value: string, field: string): Hex => {
    if (!isHex(value, { strict: true })) {
        throw new Error(`invalid ${field}`);
    }

    return value;
};

export const toViemSendParam = ([
    dstEid,
    to,
    amountLD,
    minAmountLD,
    extraOptions,
    composeMsg,
    oftCmd,
]: SendParam) => ({
    dstEid,
    to: requireHex(to, "OFT recipient"),
    amountLD,
    minAmountLD,
    extraOptions: requireHex(extraOptions, "OFT extra options"),
    composeMsg: requireHex(composeMsg, "OFT compose message"),
    oftCmd: requireHex(oftCmd, "OFT command"),
});

const toViemMsgFee = ([nativeFee, lzTokenFee]: MsgFee) => ({
    nativeFee,
    lzTokenFee,
});

export const createEvmOftContract = (
    address: string,
    runner: PublicClient | Signer,
): EvmOftTransportClient => {
    const provider = "provider" in runner ? runner.provider : runner;
    const wallet = "sendTransaction" in runner ? runner : undefined;
    const contractAddress = getAddress(address);

    return {
        transport: NetworkTransport.Evm,
        abi: oftAbi,
        quoteOFT: async (sendParam) => {
            const [limit, feeDetails, receipt] = await provider.readContract({
                address: contractAddress,
                abi: oftAbi,
                functionName: "quoteOFT",
                args: [toViemSendParam(sendParam)],
                authorizationList: undefined,
            });
            const oftLimit: OftLimit = [limit.minAmountLD, limit.maxAmountLD];
            const oftFeeDetails: OftFeeDetail[] = feeDetails.map(
                ({ feeAmountLD, description }) => [feeAmountLD, description],
            );
            const oftReceipt: OftReceipt = [
                receipt.amountSentLD,
                receipt.amountReceivedLD,
            ];
            return [oftLimit, oftFeeDetails, oftReceipt];
        },
        quoteSend: async (sendParam, payInLzToken) => {
            const fee = await provider.readContract({
                address: contractAddress,
                abi: oftAbi,
                functionName: "quoteSend",
                args: [toViemSendParam(sendParam), payInLzToken],
                authorizationList: undefined,
            });
            return [fee.nativeFee, fee.lzTokenFee];
        },
        approvalRequired: () =>
            provider.readContract({
                address: contractAddress,
                abi: oftAbi,
                functionName: "approvalRequired",
                authorizationList: undefined,
            }),
        send: async (sendParam, msgFee, refundAddress, overrides) => {
            if (wallet === undefined) {
                throw new Error("OFT send requires a wallet client");
            }
            const hash = await wallet.writeContract({
                account: wallet.account,
                address: contractAddress,
                abi: oftAbi,
                functionName: "send",
                args: [
                    toViemSendParam(sendParam),
                    toViemMsgFee(msgFee),
                    getAddress(refundAddress),
                ],
                chain: null,
                value: overrides?.value,
            });
            return {
                hash,
            };
        },
    };
};

export const getEvmOftSentEvent = (
    contract: EvmOftTransportClient,
    receipt: Pick<TransactionReceipt, "logs">,
    contractAddress: string,
): OftSentEvent => {
    const address = getAddress(contractAddress);
    const oftSentLog = parseEventLogs({
        abi: contract.abi,
        eventName: "OFTSent",
        logs: receipt.logs,
    }).find((eventLog) => isAddressEqual(eventLog.address, address));

    if (oftSentLog === undefined) {
        throw new Error("could not find OFTSent event");
    }

    const event = {
        guid: oftSentLog.args.guid,
        dstEid: oftSentLog.args.dstEid,
        fromAddress: oftSentLog.args.fromAddress,
        amountSentLD: oftSentLog.args.amountSentLD,
        amountReceivedLD: oftSentLog.args.amountReceivedLD,
        logIndex: oftSentLog.logIndex ?? 0,
    };

    log.debug("Parsed OFTSent event", {
        contractAddress,
        guid: event.guid,
        dstEid: event.dstEid.toString(),
        fromAddress: event.fromAddress,
        amountSentLD: event.amountSentLD.toString(),
        amountReceivedLD: event.amountReceivedLD.toString(),
        logIndex: event.logIndex,
    });

    return event;
};

export const getEvmOftReceivedEvent = (
    contract: EvmOftTransportClient,
    receipt: Pick<TransactionReceipt, "logs">,
    contractAddress: string,
): OftReceivedEvent => {
    const address = getAddress(contractAddress);
    const oftReceivedLog = parseEventLogs({
        abi: contract.abi,
        eventName: "OFTReceived",
        logs: receipt.logs,
    }).find((eventLog) => isAddressEqual(eventLog.address, address));

    if (oftReceivedLog === undefined) {
        throw new Error("could not find OFTReceived event");
    }

    const event = {
        guid: oftReceivedLog.args.guid,
        srcEid: oftReceivedLog.args.srcEid,
        toAddress: oftReceivedLog.args.toAddress,
        amountReceivedLD: oftReceivedLog.args.amountReceivedLD,
        blockNumber: Number(oftReceivedLog.blockNumber ?? 0),
        logIndex: oftReceivedLog.logIndex ?? 0,
    };

    log.debug("Parsed OFTReceived event", {
        contractAddress,
        guid: event.guid,
        srcEid: event.srcEid.toString(),
        toAddress: event.toAddress,
        amountReceivedLD: event.amountReceivedLD.toString(),
        logIndex: event.logIndex,
    });

    return event;
};

export const getEvmOftReceivedEventByGuid = async (
    contract: EvmOftTransportClient,
    provider: Pick<PublicClient, "getLogs">,
    contractAddress: string,
    guid: string,
): Promise<OftReceivedEvent | undefined> => {
    if (!isHex(guid, { strict: true })) {
        throw new Error("invalid OFT guid");
    }

    const logs = await provider.getLogs({
        address: getAddress(contractAddress),
        event: getAbiItem({
            abi: oftAbi,
            name: "OFTReceived",
        }),
        args: { guid },
        fromBlock: 0n,
        toBlock: "latest",
    });
    const receivedLog = parseEventLogs({
        abi: contract.abi,
        eventName: "OFTReceived",
        logs,
    })[0];

    if (receivedLog === undefined) {
        return undefined;
    }

    const event = {
        guid: receivedLog.args.guid,
        srcEid: receivedLog.args.srcEid,
        toAddress: receivedLog.args.toAddress,
        amountReceivedLD: receivedLog.args.amountReceivedLD,
        blockNumber: Number(receivedLog.blockNumber ?? 0),
        logIndex: receivedLog.logIndex ?? 0,
    };
    log.debug("Found OFTReceived event by guid", {
        contractAddress,
        guid: event.guid,
        srcEid: event.srcEid.toString(),
        toAddress: event.toAddress,
        amountReceivedLD: event.amountReceivedLD.toString(),
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
    });

    return event;
};
