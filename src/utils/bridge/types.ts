import type { ContractRunner, TransactionReceipt } from "ethers";

import type { BridgeKind } from "../../configs/base";
import type { SwapPosition } from "../../consts/Enums";
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

export type BridgeDetail = BridgeRoute & {
    kind: BridgeKind;
    position: SwapPosition;
    txHash?: string;
};

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
};

export type BridgeSendParam = SendParam;
export type BridgeDirectSendTarget = OftDirectSendTarget;
export type BridgeDirectSendRunner = ContractRunner;
export type BridgeTransportClient = OftTransportClient;
export type BridgeProvider = Provider;

export type BridgeMsgFee = MsgFee;
export type BridgeTransaction = OftTransaction;
export type BridgeSentReceipt = TransactionReceipt;

export type BridgeSendQuote = {
    sendParam: BridgeSendParam;
    msgFee: BridgeMsgFee;
    bridgeLimit?: OftLimit;
    bridgeFeeDetails?: OftFeeDetail[];
    bridgeReceipt?: OftReceipt;
};

export type BridgeReceiveQuote = {
    amountIn: bigint;
    amountOut: bigint;
    msgFee: BridgeMsgFee;
    bridgeLimit?: OftLimit;
    bridgeFeeDetails?: OftFeeDetail[];
    bridgeReceipt?: OftReceipt;
};

export type BridgeSentEvent = OftSentEvent;
export type BridgeReceivedEvent = OftReceivedEvent;

export type BridgeTransportRunner = OftTransportRunner;

export type BridgeContract = OftContract;
