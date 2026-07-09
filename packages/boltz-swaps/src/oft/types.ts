import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import type { TronConnector } from "@reown/appkit-utils/tron";
import type { Abi, PublicClient } from "viem";

import type { PendingBridgeSend } from "../bridge/pendingSend.ts";
import type { BridgeRoute } from "../bridge/route.ts";
import type { Signer } from "../interfaces/signer.ts";
import type { BridgeTransaction, NetworkTransport } from "../types.ts";

export type OftRoute<A extends string = string> = BridgeRoute<A>;

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

export type PendingBridgeSendCallbacks = {
    persist: (pending: PendingBridgeSend) => Promise<void>;
};

export type OftSendOverrides = {
    value?: bigint;
    pendingSendCallbacks?: PendingBridgeSendCallbacks;
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
    dstEid: number;
    fromAddress: string;
    amountSentLD: bigint;
    amountReceivedLD: bigint;
    logIndex: number;
};

export type OftReceivedEvent = {
    guid: string;
    srcEid: number;
    toAddress: string;
    amountReceivedLD: bigint;
    blockNumber: number;
    logIndex: number;
};
export type OftTransportRunner =
    PublicClient | Signer | SolanaWalletProvider | TronConnector | undefined;

export type OftTransportClient = {
    transport: NetworkTransport;
    abi?: Abi;
    quoteOFT: (
        sendParam: SendParam,
    ) => Promise<[OftLimit, OftFeeDetail[], OftReceipt]>;
    quoteSend: (sendParam: SendParam, payInLzToken: boolean) => Promise<MsgFee>;
    send: (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: OftSendOverrides,
    ) => Promise<BridgeTransaction>;
    approvalRequired?: () => Promise<boolean>;
};
