import type { Hex, PublicClient, Signature, TransactionRequest } from "viem";

import { getAssetBridge, getBoltzSwapsConfig } from "../config.ts";
import type {
    AlchemyCall,
    RouterContract,
    Signer,
} from "../interfaces/index.ts";
import {
    type BridgeKind,
    type ExplorerKind,
    type NetworkTransport,
    type SwapPosition,
} from "../types.ts";
import type {
    BridgeContract,
    BridgeDirectSendRunner,
    BridgeDirectSendTarget,
    BridgeErrorLike,
    BridgeMsgFee,
    BridgeNativeDropFailure,
    BridgeQuoteOptions,
    BridgeReceiveQuote,
    BridgeReceivedEvent,
    BridgeRoute,
    BridgeSendParam,
    BridgeSendQuote,
    BridgeSentEvent,
    BridgeSentReceipt,
    BridgeTransaction,
    BridgeTransportClient,
    BridgeTransportRunner,
} from "./types.ts";

export type BridgeRoutePosition = BridgeRoute & {
    kind: BridgeKind;
    position: SwapPosition;
};

export type EncodeRouterExecuteArgs = {
    router: RouterContract;
    route: BridgeRoute;
    bridgeContract: BridgeContract;
    routerCalls: {
        target: string;
        value: string | bigint;
        callData: string;
    }[];
    sendParam: BridgeSendParam;
    minAmountLd: bigint;
    lzTokenFee: bigint;
    refundAddress: string;
};

export type PopulateRouterClaimBridgeArgs = {
    router: RouterContract;
    signer: Signer;
    chainId: bigint;
    preimage: string;
    claimAmount: bigint;
    claimTokenAddress: string;
    refundAddress: string;
    timeoutBlockHeight: number;
    claimSignature: Signature;
    route: BridgeRoute;
    bridgeContract: BridgeContract;
    outputTokenAddress: string;
    routerCalls: {
        target: string;
        value: string | bigint;
        callData: string;
    }[];
    sendParam: BridgeSendParam;
    minAmountLd: bigint;
    lzTokenFee: bigint;
};

export abstract class BridgeDriver {
    public abstract readonly kind: BridgeKind;

    public supportsAsset = (asset: string): boolean => {
        return getAssetBridge(asset)?.kind === this.kind;
    };

    public getRoutePosition = (
        route: BridgeRoute,
        position: SwapPosition,
    ): BridgeRoutePosition => {
        return {
            ...route,
            kind: this.kind,
            position,
        };
    };

    public getPreRoute = (asset: string): BridgeRoute | undefined => {
        const bridge = getAssetBridge(asset);
        const assets = getBoltzSwapsConfig().assets;
        if (
            bridge?.kind !== this.kind ||
            bridge.canonicalAsset === asset ||
            assets?.[bridge.canonicalAsset] === undefined
        ) {
            return undefined;
        }

        return {
            sourceAsset: asset,
            destinationAsset: bridge.canonicalAsset,
        };
    };

    public getPostRoute = (asset: string): BridgeRoute | undefined => {
        const bridge = getAssetBridge(asset);
        const assets = getBoltzSwapsConfig().assets;
        if (
            bridge?.kind !== this.kind ||
            bridge.canonicalAsset === asset ||
            assets?.[asset] === undefined ||
            assets?.[bridge.canonicalAsset] === undefined
        ) {
            return undefined;
        }

        return {
            sourceAsset: bridge.canonicalAsset,
            destinationAsset: asset,
        };
    };

    public abstract getTransport: (asset: string) => NetworkTransport;

    public abstract getExplorerKind: (
        route: BridgeRoute,
    ) => ExplorerKind | undefined;

    public abstract getMessagingFeeToken: (
        route: BridgeRoute,
    ) => string | undefined;

    public abstract getTransferFeeAsset: (
        route: BridgeRoute,
    ) => string | undefined;

    public getNativeDropFailure = (
        error: BridgeErrorLike,
    ): BridgeNativeDropFailure | undefined => {
        void error;
        return undefined;
    };

    public abstract buildQuoteOptions: (
        destinationAsset: string,
        destination: string,
        getGasToken: boolean,
    ) => Promise<BridgeQuoteOptions>;

    public abstract quoteReceiveAmount: (
        route: BridgeRoute,
        amount: bigint,
        options?: BridgeQuoteOptions,
    ) => Promise<BridgeReceiveQuote>;

    public abstract quoteAmountInForAmountOut: (
        route: BridgeRoute,
        amountOut: bigint,
        options?: BridgeQuoteOptions,
    ) => Promise<bigint>;

    public abstract quoteSend: (
        contract: BridgeTransportClient,
        route: BridgeRoute,
        recipient: string | undefined,
        amount: bigint,
        options?: BridgeQuoteOptions,
    ) => Promise<BridgeSendQuote>;

    public abstract buildApprovalCall: (
        route: BridgeRoute,
        owner: string,
        amount: bigint,
        signer: Signer,
    ) => Promise<AlchemyCall | undefined>;

    public abstract getQuotedContract: (
        route: BridgeRoute,
    ) => Promise<BridgeTransportClient>;

    public abstract createContract: (
        route: BridgeRoute,
        runner?: BridgeTransportRunner,
    ) => Promise<BridgeTransportClient>;

    public abstract getContract: (
        route: BridgeRoute,
    ) => Promise<BridgeContract>;

    public abstract getProvider: (sourceAsset: string) => PublicClient;

    public abstract getSentEvent: (
        contract: BridgeTransportClient,
        receipt: BridgeSentReceipt,
        contractAddress: string,
    ) => BridgeSentEvent;

    public abstract getReceivedEventByGuid: (
        contract: BridgeTransportClient,
        provider: PublicClient,
        contractAddress: string,
        guid: string,
        options?: { fromBlock?: bigint },
    ) => Promise<BridgeReceivedEvent | undefined>;

    public abstract deriveSolanaSentGuid: (args: {
        sourceAsset: string;
        txHash: string;
        logMessages: string[];
    }) => string | undefined;

    public getTransportRequiredNativeBalance = (
        route: BridgeRoute,
        msgFee: BridgeMsgFee,
    ): Promise<bigint> => {
        void route;
        return Promise.resolve(msgFee[0]);
    };

    public abstract getSourceTokenBalance: (
        route: BridgeRoute,
        ownerAddress: string,
    ) => Promise<bigint>;

    public abstract getSourceNativeBalance: (
        route: BridgeRoute,
        ownerAddress: string,
    ) => Promise<bigint>;

    public abstract getTransactionSender: (
        sourceAsset: string,
        txHash: string,
    ) => Promise<string | undefined>;

    public abstract getDirectSendTarget: (
        route: BridgeRoute,
    ) => Promise<BridgeDirectSendTarget>;

    public abstract requiresDirectUserApproval: (
        target: BridgeDirectSendTarget,
        runner: BridgeDirectSendRunner,
    ) => Promise<boolean>;

    public abstract getDirectRequiredTokenAmount: (
        target: BridgeDirectSendTarget,
        amount: bigint,
        msgFee: BridgeMsgFee,
    ) => bigint;

    public abstract getDirectRequiredNativeBalance: (
        target: BridgeDirectSendTarget,
        msgFee: BridgeMsgFee,
    ) => bigint;

    public abstract sendDirect: (args: {
        target: BridgeDirectSendTarget;
        runner: BridgeDirectSendRunner;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }) => Promise<BridgeTransaction>;

    public abstract sendTransport: (args: {
        contract: BridgeTransportClient;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }) => Promise<BridgeTransaction>;

    public abstract encodeRouterExecuteData: (
        args: EncodeRouterExecuteArgs,
    ) => Hex;

    public abstract populateRouterClaimBridgeTransaction: (
        args: PopulateRouterClaimBridgeArgs,
    ) => Promise<TransactionRequest>;
}
