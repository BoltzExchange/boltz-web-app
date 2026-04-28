import type { ContractRunner, TransactionReceipt } from "ethers";

import type {
    CctpReceiveMode,
    CctpTransferMode,
    NetworkTransport,
} from "../../configs/base";
import type { CctpDirectSendTarget } from "../cctp/directSend";
import type { CctpSendParam } from "../cctp/types";
import type { OftDirectSendTarget } from "../oft/directSend";
import type { OftContract } from "../oft/registry";
import type {
    MsgFee,
    OftFeeDetail,
    OftLimit,
    OftReceipt,
    OftReceivedEvent,
    OftRoute,
    OftSentEvent,
    OftTransaction,
    OftTransportClient,
    OftTransportRunner,
    SendParam,
} from "../oft/types";
import type { Provider } from "../provider";

export type BridgeRoute = OftRoute;

export type BridgeNativeDrop = {
    amount: bigint;
    receiver: string;
};

export type BridgeNativeDropFailure =
    | {
          reason: "unavailable";
      }
    | {
          reason: "exceeds_cap";
          amount?: bigint;
          cap?: bigint;
      };

export type BridgeErrorLike = {
    data?: string;
    code?: string | number;
    message?: string;
    cause?: BridgeErrorLike;
};

export type BridgeQuoteOptions = {
    recipient?: string;
    nativeDrop?: BridgeNativeDrop;
    bridgeName?: string;
    cctpTransferMode?: CctpTransferMode;
    cctpReceiveMode?: CctpReceiveMode;
};

export type BridgeSendParam = SendParam | CctpSendParam;
export type BridgeDirectSendTarget = OftDirectSendTarget | CctpDirectSendTarget;
export type BridgeDirectSendRunner = ContractRunner;

// Transport-level handle returned by a bridge driver's `createContract` /
// `getQuotedContract`. Used by cross-driver code (SendToBridge,
// SwapExecutionWorker) to inspect the transport kind; driver-specific
// contract methods live on the narrower variants.
export type CctpTransportClient = {
    transport: NetworkTransport;
};
export type BridgeTransportClient = OftTransportClient | CctpTransportClient;
export type BridgeProvider = Provider;

export type BridgeMsgFee = MsgFee;
export type BridgeTransaction = OftTransaction;
export type BridgeSentReceipt = TransactionReceipt;

export type BridgeSendQuote = {
    sendParam: BridgeSendParam;
    msgFee: BridgeMsgFee;
    // Minimum amount guaranteed to exit the bridge (net of bridge-side fees).
    // For OFT this mirrors sendParam[3] (minAmountLD); for CCTP it's the net
    // after unbuffered protocol/forwarding fees.
    minAmount: bigint;
    bridgeLimit?: OftLimit;
    bridgeFeeDetails?: OftFeeDetail[];
    bridgeReceipt?: OftReceipt;
};

export type BridgeMessagingFee = {
    amount: bigint;
    token?: string;
};

export type BridgeReceiveQuote = {
    amountIn: bigint;
    amountOut: bigint;
    messagingFee?: BridgeMessagingFee;
    bridgeLimit?: OftLimit;
    bridgeFeeDetails?: OftFeeDetail[];
    bridgeReceipt?: OftReceipt;
};

export type BridgeSentEvent = OftSentEvent;
export type BridgeReceivedEvent = OftReceivedEvent;

export type BridgeTransportRunner = OftTransportRunner;

export type BridgeContract = OftContract;
