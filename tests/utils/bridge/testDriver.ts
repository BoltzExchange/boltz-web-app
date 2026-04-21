import { BridgeKind, NetworkTransport } from "../../../src/configs/base";
import type { BridgeDriver as BaseBridgeDriver } from "../../../src/utils/bridge";
import { BridgeDriver } from "../../../src/utils/bridge";

const notImplemented = (name: string) => (): never => {
    throw new Error(`TestBridgeDriver.${name} not implemented`);
};

/**
 * Minimal concrete `BridgeDriver` for exercising the base class and
 * `BridgeRegistry`. Every abstract member throws — consumers should only
 * touch the base-class default helpers (`supportsAsset`, `getRoutePosition`,
 * `getPreRoute`, `getPostRoute`, `getNativeDropFailure`) or the ones they
 * explicitly override on a subclass of this helper.
 */
export class TestBridgeDriver extends BridgeDriver {
    public readonly kind: BridgeKind;

    public constructor(kind: BridgeKind = BridgeKind.Oft) {
        super();
        this.kind = kind;
    }

    public getTransport = (): NetworkTransport => NetworkTransport.Evm;
    public getExplorerKind = notImplemented("getExplorerKind");
    public getMessagingFeeToken = () => undefined;
    public getTransferFeeAsset = () => undefined;
    public buildQuoteOptions = notImplemented("buildQuoteOptions");
    public quoteReceiveAmount = notImplemented("quoteReceiveAmount");
    public quoteAmountInForAmountOut = notImplemented(
        "quoteAmountInForAmountOut",
    );
    public quoteSend = notImplemented("quoteSend");
    public buildApprovalCall = notImplemented("buildApprovalCall");
    public getQuotedContract = notImplemented("getQuotedContract");
    public createContract = notImplemented("createContract");
    public getContract = notImplemented("getContract");
    public getProvider = notImplemented("getProvider");
    public getSentEvent = notImplemented("getSentEvent");
    public getReceivedEventByGuid = notImplemented("getReceivedEventByGuid");
    public getGuidFromSolanaLogs = () => undefined;
    public getBufferedNativeFee = (nativeFee: bigint) => nativeFee;
    public getSourceTokenBalance = notImplemented("getSourceTokenBalance");
    public getSourceNativeBalance = notImplemented("getSourceNativeBalance");
    public getTransactionSender = notImplemented("getTransactionSender");
    public getDirectSendTarget = notImplemented("getDirectSendTarget");
    public requiresDirectUserApproval = notImplemented(
        "requiresDirectUserApproval",
    );
    public getDirectRequiredTokenAmount = notImplemented(
        "getDirectRequiredTokenAmount",
    );
    public getDirectRequiredNativeBalance = notImplemented(
        "getDirectRequiredNativeBalance",
    );
    public sendDirect = notImplemented("sendDirect");
    public encodeRouterExecuteData = notImplemented("encodeRouterExecuteData");
    public populateRouterClaimBridgeTransaction = notImplemented(
        "populateRouterClaimBridgeTransaction",
    );
}

export type { BaseBridgeDriver };
