import {
    Contract,
    type ContractRunner,
    type Log,
    type TransactionReceipt,
} from "ethers";
import log from "loglevel";

import { NetworkTransport } from "../../configs/base";
import type { Provider } from "../provider";
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

type OftEventName = "OFTSent" | "OFTReceived";

type EvmOftAbiContract = {
    interface: Contract["interface"];
    quoteOFT: {
        staticCall: (
            sendParam: SendParam,
        ) => Promise<[OftLimit, OftFeeDetail[], OftReceipt]>;
    };
    quoteSend: {
        staticCall: (
            sendParam: SendParam,
            payInLzToken: boolean,
        ) => Promise<MsgFee>;
    };
    approvalRequired: () => Promise<boolean>;
    send: (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: {
            value?: bigint;
        },
    ) => Promise<{
        hash: string;
        wait: (confirmations?: number) => Promise<unknown>;
    }>;
};

export type EvmOftTransportClient = OftTransportClient & {
    interface: Contract["interface"];
    approvalRequired: () => Promise<boolean>;
};

export const oftAbi = [
    "function quoteOFT(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)) view returns (tuple(uint256,uint256), tuple(int256,string)[], tuple(uint256,uint256))",
    "function quoteSend(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), bool) view returns (tuple(uint256,uint256))",
    "function approvalRequired() view returns (bool)",
    "function send(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), tuple(uint256,uint256), address) payable returns (tuple(bytes32,uint64,tuple(uint256,uint256)), tuple(uint256,uint256))",
    "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
    "event OFTReceived(bytes32 indexed guid, uint32 srcEid, address indexed toAddress, uint256 amountReceivedLD)",
] as const;

export const createEvmOftContract = (
    address: string,
    runner: ContractRunner,
): EvmOftTransportClient => {
    const contract = new Contract(
        address,
        oftAbi,
        runner,
    ) as unknown as EvmOftAbiContract;

    return {
        transport: NetworkTransport.Evm,
        interface: contract.interface,
        quoteOFT: (sendParam) => contract.quoteOFT.staticCall(sendParam),
        quoteSend: (sendParam, payInLzToken) =>
            contract.quoteSend.staticCall(sendParam, payInLzToken),
        approvalRequired: () => contract.approvalRequired(),
        send: (sendParam, msgFee, refundAddress, overrides) =>
            contract.send(sendParam, msgFee, refundAddress, overrides),
    };
};

const getOftEventLog = (
    contract: EvmOftTransportClient,
    receipt: Pick<TransactionReceipt, "logs">,
    contractAddress: string,
    eventName: OftEventName,
) => {
    const oftLog = receipt.logs.find((eventLog) => {
        if (eventLog.address.toLowerCase() !== contractAddress.toLowerCase()) {
            return false;
        }

        return hasOftEventName(contract, eventLog, eventName);
    });

    if (oftLog === undefined) {
        throw new Error(`could not find ${eventName} event`);
    }

    return oftLog;
};

const hasOftEventName = (
    contract: EvmOftTransportClient,
    eventLog: Pick<Log, "data" | "topics">,
    eventName: OftEventName,
) => {
    try {
        const parsedLog = contract.interface.parseLog({
            data: eventLog.data,
            topics: eventLog.topics,
        });
        return parsedLog?.name === eventName;
    } catch {
        return false;
    }
};

const parseOftSentLog = (
    contract: EvmOftTransportClient,
    oftSentLog: Log,
): OftSentEvent => {
    const parsedOftSent = contract.interface.parseLog({
        data: oftSentLog.data,
        topics: oftSentLog.topics,
    });
    if (parsedOftSent?.name !== "OFTSent") {
        throw new Error("could not parse OFTSent event");
    }

    const { guid, dstEid, fromAddress, amountSentLD, amountReceivedLD } =
        parsedOftSent.args;

    return {
        guid,
        dstEid,
        fromAddress,
        amountSentLD,
        amountReceivedLD,
        logIndex: oftSentLog.index,
    };
};

const parseOftReceivedLog = (
    contract: EvmOftTransportClient,
    oftReceivedLog: Log,
): OftReceivedEvent => {
    const parsedOftReceived = contract.interface.parseLog({
        data: oftReceivedLog.data,
        topics: oftReceivedLog.topics,
    });
    if (parsedOftReceived?.name !== "OFTReceived") {
        throw new Error("could not parse OFTReceived event");
    }

    const { guid, srcEid, toAddress, amountReceivedLD } =
        parsedOftReceived.args;

    return {
        guid,
        srcEid,
        toAddress,
        amountReceivedLD,
        blockNumber: oftReceivedLog.blockNumber,
        logIndex: oftReceivedLog.index,
    };
};

export const getEvmOftSentEvent = (
    contract: EvmOftTransportClient,
    receipt: TransactionReceipt,
    contractAddress: string,
): OftSentEvent => {
    const oftSentLog = getOftEventLog(
        contract,
        receipt,
        contractAddress,
        "OFTSent",
    );
    const event = parseOftSentLog(contract, oftSentLog);

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
    receipt: TransactionReceipt,
    contractAddress: string,
): OftReceivedEvent => {
    const oftReceivedLog = getOftEventLog(
        contract,
        receipt,
        contractAddress,
        "OFTReceived",
    );
    const event = parseOftReceivedLog(contract, oftReceivedLog);

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
    provider: Pick<Provider, "getLogs">,
    contractAddress: string,
    guid: string,
): Promise<OftReceivedEvent | undefined> => {
    const [eventTopic, guidTopic] = contract.interface.encodeFilterTopics(
        "OFTReceived",
        [guid],
    );
    const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: 0,
        toBlock: "latest",
        topics: [eventTopic, guidTopic],
    });
    const receivedLog = logs.find((eventLog) =>
        hasOftEventName(contract, eventLog, "OFTReceived"),
    );

    if (receivedLog === undefined) {
        return undefined;
    }

    const event = parseOftReceivedLog(contract, receivedLog);
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
