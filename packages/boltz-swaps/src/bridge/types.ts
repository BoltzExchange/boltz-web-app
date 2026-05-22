import type { PublicClient, TransactionReceipt } from "viem";

import type {
    CctpDirectSendTarget,
    CctpSendParam,
    SolanaCctpTransportClient,
} from "../cctp/index.ts";
import type { Signer } from "../interfaces/index.ts";
import type {
    MsgFee,
    OftContract,
    OftDirectSendTarget,
    OftFeeDetail,
    OftLimit,
    OftReceipt,
    OftReceivedEvent,
    OftSentEvent,
    OftTransportClient,
    OftTransportRunner,
    SendParam,
} from "../oft/index.ts";
import type {
    BridgeTransaction,
    CctpReceiveMode,
    CctpTransferMode,
    NetworkTransport,
} from "../types.ts";
import type { BridgeRoute } from "./route.ts";

export type { BridgeTransaction };
export type { BridgeRoute };

export enum PendingBridgeSendKind {
    EvmCctp = "evm-cctp",
    EvmOft = "evm-oft",
    SolanaCctp = "solana-cctp",
    SolanaOft = "solana-oft",
    TronOft = "tron-oft",
}

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
    cctpIncludeRecipientSetup?: boolean;
};

export type BridgeSendParam = SendParam | CctpSendParam;
export type BridgeDirectSendTarget = OftDirectSendTarget | CctpDirectSendTarget;
export type BridgeDirectSendRunner = Signer | PublicClient;

// Transport-level handle returned by a bridge driver's `createContract` /
// `getQuotedContract`. Used by cross-driver code (SendToBridge,
// SwapExecutionWorker) to inspect the transport kind; driver-specific
// contract methods live on the narrower variants.
export type CctpTransportClient =
    | {
          transport: NetworkTransport;
      }
    | SolanaCctpTransportClient;
export type BridgeTransportClient = OftTransportClient | CctpTransportClient;
export type BridgeProvider = PublicClient;

export type BridgeMsgFee = MsgFee;
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
