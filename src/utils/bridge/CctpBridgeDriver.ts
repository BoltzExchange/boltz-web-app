import { abi as ERC20Abi } from "boltz-core/out/ERC20.sol/ERC20.json";
import { Contract, Signature } from "ethers";
import type { TransactionRequest, Wallet } from "ethers";

import type { AlchemyCall } from "../../alchemy/Alchemy";
import type { ExplorerKind } from "../../components/BlockExplorer";
import {
    BridgeKind,
    CctpReceiveMode,
    CctpTransferMode,
} from "../../configs/base";
import type { Asset, NetworkTransport } from "../../configs/base";
import {
    getAssetBridge,
    getNetworkTransport,
    getTokenAddress,
} from "../../consts/Assets";
import type { Signer } from "../../context/Web3";
import { getCctpForwardTxHash } from "../cctp/attestation";
import {
    type CctpDirectSendTarget,
    getCctpDirectRequiredNativeBalance,
    getCctpDirectRequiredTokenAmount,
    getCctpDirectSendTarget,
    sendCctpDirect,
} from "../cctp/directSend";
import {
    decodeCctpGuid,
    encodeCctpGuid,
    parseCctpMessageSent,
    parseCctpMintAndWithdraws,
} from "../cctp/events";
import {
    addressToBytes32,
    cctpEmptyHookData,
    cctpFastFinalityThreshold,
    cctpForwardHookData,
    cctpStandardFinalityThreshold,
    cctpZeroBytes32,
    hashCctpData,
} from "../cctp/evm";
import { type CctpFee, cctpFeeBpsDenominator, getCctpFee } from "../cctp/fee";
import type { CctpData, CctpSendParam } from "../cctp/types";
import { createAssetProvider } from "../provider";
import type { Provider } from "../provider";
import {
    BridgeDriver,
    type EncodeRouterExecuteArgs,
    type PopulateRouterClaimBridgeArgs,
} from "./driver";
import type {
    BridgeContract,
    BridgeDirectSendRunner,
    BridgeDirectSendTarget,
    BridgeMsgFee,
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
} from "./types";

type CctpConfig = Extract<
    NonNullable<Asset["bridge"]>,
    { kind: BridgeKind.Cctp }
>["cctp"];

const cctpMaxFeeBufferBps = 2n;
const bpsDenominator = 10_000n;

export class CctpBridgeDriver extends BridgeDriver {
    public readonly kind = BridgeKind.Cctp;

    public getTransport = (asset: string): NetworkTransport => {
        const transport = getNetworkTransport(asset);
        if (transport === undefined) {
            throw new Error(`missing transport for CCTP asset ${asset}`);
        }

        return transport;
    };

    public getExplorerKind = (route: BridgeRoute): ExplorerKind | undefined => {
        void route;
        return undefined;
    };

    public getMessagingFeeToken = (route: BridgeRoute): string | undefined => {
        void route;
        return undefined;
    };

    public getTransferFeeAsset = (route: BridgeRoute): string | undefined => {
        return route.sourceAsset;
    };

    public buildQuoteOptions = (
        destinationAsset: string,
        destination: string,
        getGasToken: boolean,
    ): Promise<BridgeQuoteOptions> => {
        void getGasToken;

        return Promise.resolve({
            recipient: destination,
            cctpTransferMode:
                this.requireCctpConfig(destinationAsset).transferMode,
            cctpReceiveMode: CctpReceiveMode.Forwarded,
        });
    };

    public quoteReceiveAmount = async (
        route: BridgeRoute,
        amount: bigint,
        options: BridgeQuoteOptions = {},
    ): Promise<BridgeReceiveQuote> => {
        if (amount <= 0n) {
            return {
                amountIn: amount,
                amountOut: amount,
            };
        }

        const fee = await this.getFee(route, options);
        const totalFee = this.computeTotalFee(amount, fee);

        return {
            amountIn: amount,
            amountOut: amount > totalFee ? amount - totalFee : 0n,
        };
    };

    public quoteAmountInForAmountOut = async (
        route: BridgeRoute,
        amountOut: bigint,
        options: BridgeQuoteOptions = {},
    ): Promise<bigint> => {
        if (amountOut <= 0n) {
            return amountOut;
        }

        const fee = await this.getFee(route, options);
        const netDenominator = cctpFeeBpsDenominator - fee.bpsUnits;
        if (netDenominator <= 0n) {
            throw new Error("invalid CCTP fee configuration");
        }

        // Need: amountIn - protocolFee(amountIn) - forwardFee >= amountOut,
        // where protocolFee(amountIn) = amountIn * bpsUnits / denominator.
        return this.ceilDiv(
            (amountOut + fee.forwardFee) * cctpFeeBpsDenominator,
            netDenominator,
        );
    };

    public quoteSend = async (
        contract: BridgeTransportClient,
        route: BridgeRoute,
        recipient: string | undefined,
        amount: bigint,
        options: BridgeQuoteOptions = {},
    ): Promise<BridgeSendQuote> => {
        void contract;

        const destinationConfig = this.requireCctpConfig(
            route.destinationAsset,
        );
        const transferMode = this.getTransferMode(
            route.destinationAsset,
            options,
        );
        const receiveMode = this.getReceiveMode(options);
        const mintRecipient = recipient ?? options.recipient;
        if (mintRecipient === undefined) {
            throw new Error(
                "CCTP quoteSend requires a destination recipient address",
            );
        }

        const unbufferedFee = await this.getFee(route, options);
        const unbufferedMaxFee = this.computeTotalFee(amount, unbufferedFee);
        const bufferedMaxFee = this.addBps(
            unbufferedMaxFee,
            cctpMaxFeeBufferBps,
        );
        const sendParam: CctpSendParam = {
            amount,
            destinationDomain: destinationConfig.domain,
            mintRecipient: addressToBytes32(mintRecipient),
            destinationCaller: cctpZeroBytes32,
            maxFee: bufferedMaxFee,
            minFinalityThreshold:
                transferMode === CctpTransferMode.Fast
                    ? cctpFastFinalityThreshold
                    : cctpStandardFinalityThreshold,
            hookData:
                receiveMode === CctpReceiveMode.Forwarded
                    ? cctpForwardHookData
                    : cctpEmptyHookData,
        };

        return {
            sendParam,
            msgFee: [0n, 0n],
            minAmount:
                amount > unbufferedMaxFee ? amount - unbufferedMaxFee : 0n,
        };
    };

    public buildApprovalCall = (
        route: BridgeRoute,
        owner: string,
        amount: bigint,
        signer: Signer | Wallet,
    ): Promise<AlchemyCall | undefined> => {
        void route;
        void owner;
        void amount;
        void signer;
        // The Router's sendBalanceToCctp forceApproves the TokenMessenger
        // internally, so callers do not need to pre-approve.
        return Promise.resolve(undefined);
    };

    public getQuotedContract = (
        route: BridgeRoute,
    ): Promise<BridgeTransportClient> => {
        return Promise.resolve(this.buildTransportClient(route));
    };

    public createContract = (
        route: BridgeRoute,
        runner?: BridgeTransportRunner,
    ): Promise<BridgeTransportClient> => {
        void runner;
        return Promise.resolve(this.buildTransportClient(route));
    };

    public getContract = (route: BridgeRoute): Promise<BridgeContract> => {
        // The router calls depositForBurn on the SOURCE-chain TokenMessenger;
        // the burn then flows to the destination domain.
        const sourceConfig = this.requireCctpConfig(route.sourceAsset);
        return Promise.resolve({
            name: "CCTP",
            address: sourceConfig.tokenMessenger,
            explorer: "",
        });
    };

    public getProvider = (sourceAsset: string): Provider => {
        return createAssetProvider(sourceAsset);
    };

    public getSentEvent = (
        contract: BridgeTransportClient,
        receipt: BridgeSentReceipt,
        contractAddress: string,
    ): BridgeSentEvent => {
        void contract;
        void contractAddress;

        const info = parseCctpMessageSent(receipt);
        if (info === undefined) {
            throw new Error(
                "no MessageSent log in CCTP burn receipt — cannot derive guid",
            );
        }

        // Circle's Iris API indexes messages by source-chain tx hash, so we
        // key the guid on that. Map the rest onto the OFT-shaped event shape.
        // `amountReceivedLD` is an estimate at send time (destination fees
        // aren't known yet); the true mint amount comes from the received
        // event.
        return {
            guid: encodeCctpGuid(info.sourceDomain, receipt.hash),
            dstEid: BigInt(info.destinationDomain),
            fromAddress: info.sender,
            amountSentLD: info.amountSent,
            amountReceivedLD: info.amountSent,
            logIndex: info.logIndex,
        };
    };

    public getReceivedEventByGuid = async (
        contract: BridgeTransportClient,
        provider: Pick<Provider, "getLogs" | "getTransactionReceipt">,
        contractAddress: string,
        guid: string,
    ): Promise<BridgeReceivedEvent | undefined> => {
        void contract;
        void contractAddress;

        const decoded = decodeCctpGuid(guid);
        if (decoded === undefined) {
            throw new Error(`invalid CCTP guid: ${guid}`);
        }

        const forwardTxHash = await getCctpForwardTxHash(
            decoded.sourceDomain,
            decoded.sourceTxHash,
        );
        if (forwardTxHash === undefined) {
            return undefined;
        }

        const forwardReceipt =
            await provider.getTransactionReceipt(forwardTxHash);
        if (forwardReceipt === null) {
            // Forward tx was returned by Circle but isn't visible on the RPC
            // yet — surface as "not ready" and let the caller poll again.
            return undefined;
        }

        // A forward tx is typically 1:1 with a source message. Take the first
        // `MintAndWithdraw`; if Circle starts batching, callers can filter by
        // recipient.
        const [mint] = parseCctpMintAndWithdraws(forwardReceipt);
        if (mint === undefined) {
            throw new Error(
                `no MintAndWithdraw log in CCTP forward tx ${forwardTxHash}`,
            );
        }

        return {
            guid,
            srcEid: BigInt(decoded.sourceDomain),
            toAddress: mint.mintRecipient,
            amountReceivedLD: mint.amount,
            blockNumber: mint.blockNumber,
            logIndex: mint.logIndex,
        };
    };

    public getGuidFromSolanaLogs = (
        logMessages: string[],
    ): string | undefined => {
        void logMessages;
        return undefined;
    };

    public getBufferedNativeFee = (nativeFee: bigint): bigint => {
        return nativeFee;
    };

    public getSourceTokenBalance = async (
        route: BridgeRoute,
        ownerAddress: string,
    ): Promise<bigint> => {
        const tokenContract = new Contract(
            getTokenAddress(route.sourceAsset),
            ERC20Abi,
            this.getProvider(route.sourceAsset),
        );

        return (await tokenContract.balanceOf(ownerAddress)) as bigint;
    };

    public getSourceNativeBalance = async (
        route: BridgeRoute,
        ownerAddress: string,
    ): Promise<bigint> => {
        return await this.getProvider(route.sourceAsset).getBalance(
            ownerAddress,
        );
    };

    public getTransactionSender = async (
        sourceAsset: string,
        txHash: string,
    ): Promise<string | undefined> => {
        const tx = await this.getProvider(sourceAsset).getTransaction(txHash);
        return tx?.from;
    };

    public getDirectSendTarget = (
        route: BridgeRoute,
    ): Promise<BridgeDirectSendTarget> => {
        return Promise.resolve(
            getCctpDirectSendTarget(
                route,
                this.requireCctpConfig(route.sourceAsset).tokenMessenger,
            ),
        );
    };

    // USDC is always pulled via ERC20 `transferFrom`, so a CCTP direct send
    // always requires the user to approve the TokenMessenger. The caller
    // (SendToBridge) then reads the actual allowance to decide whether the
    // approval is current.
    public requiresDirectUserApproval = (
        target: BridgeDirectSendTarget,
        runner: BridgeDirectSendRunner,
    ): Promise<boolean> => {
        void target;
        void runner;
        return Promise.resolve(true);
    };

    protected requiresDirectUserApprovalUnchecked = (
        target: BridgeDirectSendTarget,
        runner: BridgeDirectSendRunner,
    ): Promise<boolean> => {
        void target;
        void runner;
        return Promise.resolve(true);
    };

    public getDirectRequiredTokenAmount = (
        target: BridgeDirectSendTarget,
        amount: bigint,
        msgFee: BridgeMsgFee,
    ): bigint => {
        void target;
        void msgFee;
        return getCctpDirectRequiredTokenAmount(amount);
    };

    public getDirectRequiredNativeBalance = (
        target: BridgeDirectSendTarget,
        msgFee: BridgeMsgFee,
    ): bigint => {
        void target;
        void msgFee;
        return getCctpDirectRequiredNativeBalance();
    };

    public sendDirect = async (args: {
        target: BridgeDirectSendTarget;
        runner: BridgeDirectSendRunner;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> => {
        void args.msgFee;
        void args.refundAddress;
        return await sendCctpDirect({
            target: args.target as CctpDirectSendTarget,
            runner: args.runner,
            sendParam: args.sendParam as CctpSendParam,
        });
    };

    public encodeRouterExecuteData = (
        args: EncodeRouterExecuteArgs,
    ): string => {
        return args.router.interface.encodeFunctionData("executeCctp", [
            args.routerCalls,
            getTokenAddress(args.route.sourceAsset),
            args.bridgeContract.address,
            this.toCctpData(args.sendParam),
            args.minAmountLd,
        ]);
    };

    public populateRouterClaimBridgeTransaction = async (
        args: PopulateRouterClaimBridgeArgs,
    ): Promise<TransactionRequest> => {
        const cctpData = this.toCctpData(args.sendParam);
        const authSignature = Signature.from(
            await args.signer.signTypedData(
                {
                    name: "Router",
                    version: "2",
                    verifyingContract: await args.router.getAddress(),
                    chainId: args.chainId,
                },
                {
                    ClaimCctp: [
                        { name: "preimage", type: "bytes32" },
                        { name: "token", type: "address" },
                        { name: "tokenMessenger", type: "address" },
                        { name: "cctpData", type: "bytes32" },
                        { name: "minAmount", type: "uint256" },
                    ],
                },
                {
                    preimage: `0x${args.preimage}`,
                    token: args.outputTokenAddress,
                    tokenMessenger: args.bridgeContract.address,
                    cctpData: hashCctpData(cctpData),
                    minAmount: args.minAmountLd,
                },
            ),
        );

        return await args.router.claimERC20ExecuteCctp.populateTransaction(
            {
                preimage: `0x${args.preimage}`,
                amount: args.claimAmount,
                tokenAddress: args.claimTokenAddress,
                refundAddress: args.refundAddress,
                timelock: args.timeoutBlockHeight,
                v: args.claimSignature.v,
                r: args.claimSignature.r,
                s: args.claimSignature.s,
            },
            args.routerCalls,
            args.outputTokenAddress,
            args.bridgeContract.address,
            cctpData,
            {
                minAmount: args.minAmountLd,
                v: authSignature.v,
                r: authSignature.r,
                s: authSignature.s,
            },
        );
    };

    private buildTransportClient = (
        route: BridgeRoute,
    ): BridgeTransportClient => ({
        transport: this.getTransport(route.sourceAsset),
    });

    // Project a BridgeSendParam down to the 6-field on-chain `CctpData` struct,
    // dropping `amount` (which the router passes separately as `minAmountLd`).
    // Prevents `amount` from silently riding along in router ABI encodings.
    private toCctpData = (sendParam: BridgeSendParam): CctpData => {
        const {
            destinationDomain,
            mintRecipient,
            destinationCaller,
            maxFee,
            minFinalityThreshold,
            hookData,
        } = sendParam as CctpSendParam;
        return {
            destinationDomain,
            mintRecipient,
            destinationCaller,
            maxFee,
            minFinalityThreshold,
            hookData,
        };
    };

    private requireCctpConfig = (asset: string): CctpConfig => {
        const bridge = getAssetBridge(asset);
        if (bridge?.kind !== BridgeKind.Cctp) {
            throw new Error(`missing CCTP config for asset ${asset}`);
        }

        return bridge.cctp;
    };

    private getTransferMode = (
        destinationAsset: string,
        options: BridgeQuoteOptions,
    ): CctpTransferMode => {
        return (
            options.cctpTransferMode ??
            this.requireCctpConfig(destinationAsset).transferMode
        );
    };

    private getReceiveMode = (options: BridgeQuoteOptions): CctpReceiveMode => {
        return options.cctpReceiveMode ?? CctpReceiveMode.Forwarded;
    };

    private getFee = async (
        route: BridgeRoute,
        options: BridgeQuoteOptions,
    ): Promise<CctpFee> => {
        const sourceConfig = this.requireCctpConfig(route.sourceAsset);
        const destinationConfig = this.requireCctpConfig(
            route.destinationAsset,
        );

        return await getCctpFee(
            sourceConfig.domain,
            destinationConfig.domain,
            this.getTransferMode(route.destinationAsset, options),
            this.getReceiveMode(options),
        );
    };

    // Combined `maxFee` the burn tolerates: protocol basis-point fee plus the
    // flat Forwarding Service fee that Circle deducts off-chain.
    private computeTotalFee = (amount: bigint, fee: CctpFee): bigint => {
        return (amount * fee.bpsUnits) / cctpFeeBpsDenominator + fee.forwardFee;
    };

    private addBps = (amount: bigint, bps: bigint): bigint => {
        return this.ceilDiv(amount * (bpsDenominator + bps), bpsDenominator);
    };

    private ceilDiv = (numerator: bigint, denominator: bigint): bigint => {
        return (numerator + denominator - 1n) / denominator;
    };
}
