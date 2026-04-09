import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import type { Contract, ContractRunner } from "ethers";

import type { NetworkTransport } from "../../configs/base";

export type OftRoute = {
    sourceAsset: string;
    destinationAsset: string;
};

export type SendParam = [
    number,
    string,
    bigint,
    bigint,
    string,
    string,
    string,
];

export type MsgFee = [bigint, bigint];

export type OftNativeDrop = {
    amount: bigint;
    receiver: string;
};

export type OftQuoteOptions = {
    recipient?: string;
    nativeDrop?: OftNativeDrop;
    oftName?: string;
};

export type OftLimit = [bigint, bigint];
export type OftFeeDetail = [bigint, string];
export type OftReceipt = [bigint, bigint];

export type OftTransaction = {
    hash: string;
    wait: (confirmations?: number) => Promise<unknown>;
};

export type OftReceiveQuote = {
    amountIn: bigint;
    amountOut: bigint;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
};

export type OftSentEvent = {
    guid: string;
    dstEid: bigint;
    fromAddress: string;
    amountSentLD: bigint;
    amountReceivedLD: bigint;
    logIndex: number;
};

export type OftReceivedEvent = {
    guid: string;
    srcEid: bigint;
    toAddress: string;
    amountReceivedLD: bigint;
    blockNumber: number;
    logIndex: number;
};
export type OftTransportRunner =
    | ContractRunner
    | SolanaWalletProvider
    | undefined;

export type OftTransportClient = {
    transport: NetworkTransport;
    interface?: Contract["interface"];
    quoteOFT: (
        sendParam: SendParam,
    ) => Promise<[OftLimit, OftFeeDetail[], OftReceipt]>;
    quoteSend: (sendParam: SendParam, payInLzToken: boolean) => Promise<MsgFee>;
    send: (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: {
            value?: bigint;
        },
    ) => Promise<OftTransaction>;
    approvalRequired?: () => Promise<boolean>;
};
