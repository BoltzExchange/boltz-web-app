import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import {
    type Hash,
    type Hex,
    type PublicClient,
    type TransactionReceipt,
    TransactionReceiptNotFoundError,
    type TransactionRequest,
    encodeFunctionData,
    getAddress,
    getContract,
    parseSignature,
} from "viem";

import type { AlchemyCall } from "../../alchemy/Alchemy";
import {
    BridgeKind,
    CctpReceiveMode,
    CctpTransferMode,
    NetworkTransport,
} from "../../configs/base";
import type { Asset } from "../../configs/base";
import {
    getAssetBridge,
    getNetworkTransport,
    getTokenAddress,
} from "../../consts/Assets";
import type { Signer } from "../../context/Web3";
import { erc20Abi, routerAbi } from "../../generated/evm-abis";
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
    createCctpSolanaForwardHookData,
    hashCctpData,
} from "../cctp/evm";
import { type CctpFee, cctpFeeBpsDenominator, getCctpFee } from "../cctp/fee";
import {
    type SolanaCctpTransportClient,
    createSolanaCctpContract,
    getSolanaCctpRequiredNativeBalance,
    getSolanaCctpTokenBalance,
} from "../cctp/solana";
import type { CctpData, CctpSendParam } from "../cctp/types";
import * as solanaChain from "../chains/solana";
import { prefix0x } from "../evmTransaction";
import { ExplorerKind } from "../explorerLink";
import { createAssetProvider } from "../provider";
import { toRouterCalls } from "../router";
import { vFromSignature } from "../signature";
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

    public getExplorerKind = (): ExplorerKind => {
        return ExplorerKind.Cctp;
    };

    public getMessagingFeeToken = (route: BridgeRoute): string | undefined => {
        void route;
        return undefined;
    };

    public getTransferFeeAsset = (route: BridgeRoute): string | undefined => {
        return route.sourceAsset;
    };

    public buildQuoteOptions = async (
        destinationAsset: string,
        destination: string,
        getGasToken: boolean,
    ): Promise<BridgeQuoteOptions> => {
        void getGasToken;

        const destinationTransport = this.getTransport(destinationAsset);
        const cctpIncludeRecipientSetup =
            destinationTransport === NetworkTransport.Solana
                ? await solanaChain.shouldCreateSolanaTokenAccount(
                      destinationAsset,
                      destination,
                  )
                : false;

        return {
            recipient: destination,
            cctpTransferMode:
                this.requireCctpConfig(destinationAsset).transferMode,
            cctpReceiveMode: this.getDefaultReceiveMode(destinationAsset),
            ...(cctpIncludeRecipientSetup ? { cctpIncludeRecipientSetup } : {}),
        };
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
        const receiveMode = this.getReceiveMode(
            route.destinationAsset,
            options,
        );
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
            mintRecipient: await this.encodeMintRecipient(
                route.destinationAsset,
                mintRecipient,
            ),
            destinationCaller: cctpZeroBytes32,
            maxFee: bufferedMaxFee,
            minFinalityThreshold:
                transferMode === CctpTransferMode.Fast
                    ? cctpFastFinalityThreshold
                    : cctpStandardFinalityThreshold,
            hookData: this.getHookData(
                route.destinationAsset,
                receiveMode,
                mintRecipient,
                options,
            ),
        };

        const msgFee: BridgeMsgFee =
            this.getTransport(route.sourceAsset) === NetworkTransport.Solana
                ? [
                      await getSolanaCctpRequiredNativeBalance(
                          route.sourceAsset,
                      ),
                      0n,
                  ]
                : [0n, 0n];

        return {
            sendParam,
            msgFee,
            minAmount:
                amount > unbufferedMaxFee ? amount - unbufferedMaxFee : 0n,
        };
    };

    public buildApprovalCall = (
        route: BridgeRoute,
        owner: string,
        amount: bigint,
        signer: Signer,
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
        if (this.getTransport(route.sourceAsset) === NetworkTransport.Solana) {
            return Promise.resolve(
                createSolanaCctpContract({
                    asset: route.sourceAsset,
                    tokenMint: getTokenAddress(route.sourceAsset),
                    walletProvider: runner as SolanaWalletProvider | undefined,
                }),
            );
        }

        return Promise.resolve(this.buildTransportClient(route));
    };

    public getContract = (route: BridgeRoute): Promise<BridgeContract> => {
        // The router calls depositForBurn on the SOURCE-chain TokenMessenger;
        // the burn then flows to the destination domain.
        const sourceConfig = this.requireCctpConfig(route.sourceAsset);
        return Promise.resolve({
            name: "CCTP",
            address: getAddress(sourceConfig.tokenMessenger),
            explorer: "",
        });
    };

    public getProvider = (sourceAsset: string): PublicClient => {
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
            guid: encodeCctpGuid(info.sourceDomain, receipt.transactionHash),
            dstEid: info.destinationDomain,
            fromAddress: info.sender,
            amountSentLD: info.amountSent,
            amountReceivedLD: info.amountSent,
            logIndex: info.logIndex,
        };
    };

    public getReceivedEventByGuid = async (
        contract: BridgeTransportClient,
        provider: PublicClient,
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

        let forwardReceipt: TransactionReceipt;
        try {
            forwardReceipt = await provider.getTransactionReceipt({
                hash: forwardTxHash as Hash,
            });
        } catch (error) {
            if (error instanceof TransactionReceiptNotFoundError) {
                return undefined;
            }
            throw error;
        }

        // A forward tx is typically 1:1 with a source message. Take the first
        // `MintAndWithdraw`; if Circle starts batching, callers can filter by
        // recipient.
        const [mint] = parseCctpMintAndWithdraws({
            ...forwardReceipt,
            blockNumber: Number(forwardReceipt.blockNumber),
        });
        if (mint === undefined) {
            throw new Error(
                `no MintAndWithdraw log in CCTP forward tx ${forwardTxHash}`,
            );
        }

        return {
            guid,
            srcEid: decoded.sourceDomain,
            toAddress: mint.mintRecipient,
            amountReceivedLD: mint.amount,
            blockNumber: mint.blockNumber,
            logIndex: mint.logIndex,
        };
    };

    public deriveSolanaSentGuid = (args: {
        sourceAsset: string;
        txHash: string;
        logMessages: string[];
    }): string | undefined => {
        void args.logMessages;
        return encodeCctpGuid(
            this.requireCctpConfig(args.sourceAsset).domain,
            args.txHash,
        );
    };

    public getSourceTokenBalance = async (
        route: BridgeRoute,
        ownerAddress: string,
    ): Promise<bigint> => {
        if (this.getTransport(route.sourceAsset) === NetworkTransport.Solana) {
            return await getSolanaCctpTokenBalance(
                {
                    asset: route.sourceAsset,
                    tokenMint: getTokenAddress(route.sourceAsset),
                },
                ownerAddress,
            );
        }

        const tokenContract = getContract({
            address: getAddress(getTokenAddress(route.sourceAsset)),
            abi: erc20Abi,
            client: this.getProvider(route.sourceAsset),
        });

        return await tokenContract.read.balanceOf([getAddress(ownerAddress)]);
    };

    public getSourceNativeBalance = async (
        route: BridgeRoute,
        ownerAddress: string,
    ): Promise<bigint> => {
        if (this.getTransport(route.sourceAsset) === NetworkTransport.Solana) {
            return await solanaChain.getSolanaNativeBalance(
                route.sourceAsset,
                ownerAddress,
            );
        }

        return await this.getProvider(route.sourceAsset).getBalance({
            address: getAddress(ownerAddress),
        });
    };

    public getTransactionSender = async (
        sourceAsset: string,
        txHash: string,
    ): Promise<string | undefined> => {
        if (this.getTransport(sourceAsset) === NetworkTransport.Solana) {
            return await solanaChain.getSolanaTransactionSender(
                sourceAsset,
                txHash,
            );
        }

        const tx = await this.getProvider(sourceAsset).getTransaction({
            hash: txHash as Hash,
        });
        return tx?.from ?? undefined;
    };

    public getDirectSendTarget = (
        route: BridgeRoute,
    ): Promise<BridgeDirectSendTarget> => {
        return Promise.resolve(
            getCctpDirectSendTarget(
                route,
                getAddress(
                    this.requireCctpConfig(route.sourceAsset).tokenMessenger,
                ),
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
            runner: args.runner as Signer,
            sendParam: args.sendParam as CctpSendParam,
        });
    };

    public sendTransport = async (args: {
        contract: BridgeTransportClient;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> => {
        if (!("send" in args.contract)) {
            throw new Error(
                "CCTP transport sends are only supported on Solana",
            );
        }

        return await (args.contract as SolanaCctpTransportClient).send(
            args.sendParam as CctpSendParam,
            args.msgFee,
            args.refundAddress,
        );
    };

    public encodeRouterExecuteData = (args: EncodeRouterExecuteArgs): Hex => {
        const cctpData = this.toCctpData(args.sendParam);
        return encodeFunctionData({
            abi: routerAbi,
            functionName: "executeCctp",
            args: [
                toRouterCalls(args.routerCalls),
                getAddress(getTokenAddress(args.route.sourceAsset)),
                getAddress(args.bridgeContract.address),
                {
                    ...cctpData,
                    mintRecipient: cctpData.mintRecipient as Hex,
                    destinationCaller: cctpData.destinationCaller as Hex,
                    hookData: cctpData.hookData as Hex,
                },
                args.minAmountLd,
            ],
        });
    };

    public populateRouterClaimBridgeTransaction = async (
        args: PopulateRouterClaimBridgeArgs,
    ): Promise<TransactionRequest> => {
        const cctpData = this.toCctpData(args.sendParam);
        const authSignature = parseSignature(
            await args.signer.signTypedData({
                account: args.signer.account,
                domain: {
                    name: "Router",
                    version: "2",
                    verifyingContract: args.router.address,
                    chainId: args.chainId,
                },
                types: {
                    ClaimCctp: [
                        { name: "preimage", type: "bytes32" },
                        { name: "token", type: "address" },
                        { name: "tokenMessenger", type: "address" },
                        { name: "cctpData", type: "bytes32" },
                        { name: "minAmount", type: "uint256" },
                    ],
                } as const,
                primaryType: "ClaimCctp",
                message: {
                    preimage: prefix0x(args.preimage),
                    token: getAddress(args.outputTokenAddress),
                    tokenMessenger: getAddress(args.bridgeContract.address),
                    cctpData: hashCctpData(cctpData) as Hex,
                    minAmount: args.minAmountLd,
                },
            }),
        );

        return {
            to: args.router.address,
            data: encodeFunctionData({
                abi: routerAbi,
                functionName: "claimERC20ExecuteCctp",
                args: [
                    {
                        preimage: prefix0x(args.preimage),
                        amount: args.claimAmount,
                        tokenAddress: getAddress(args.claimTokenAddress),
                        refundAddress: getAddress(args.refundAddress),
                        timelock: BigInt(args.timeoutBlockHeight),
                        v: vFromSignature(args.claimSignature),
                        r: args.claimSignature.r,
                        s: args.claimSignature.s,
                    },
                    toRouterCalls(args.routerCalls),
                    getAddress(args.outputTokenAddress),
                    getAddress(args.bridgeContract.address),
                    {
                        destinationDomain: cctpData.destinationDomain,
                        mintRecipient: cctpData.mintRecipient as Hex,
                        destinationCaller: cctpData.destinationCaller as Hex,
                        maxFee: cctpData.maxFee,
                        minFinalityThreshold: cctpData.minFinalityThreshold,
                        hookData: cctpData.hookData as Hex,
                    },
                    {
                        minAmount: args.minAmountLd,
                        v: vFromSignature(authSignature),
                        r: authSignature.r,
                        s: authSignature.s,
                    },
                ],
            }),
        } satisfies TransactionRequest;
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

    private getDefaultReceiveMode = (
        destinationAsset: string,
    ): CctpReceiveMode => {
        const destinationBridge = getAssetBridge(destinationAsset);
        return destinationBridge?.kind === BridgeKind.Cctp &&
            destinationBridge.canonicalAsset === destinationAsset
            ? CctpReceiveMode.Manual
            : CctpReceiveMode.Forwarded;
    };

    private getReceiveMode = (
        destinationAsset: string,
        options: BridgeQuoteOptions,
    ): CctpReceiveMode => {
        return (
            options.cctpReceiveMode ??
            this.getDefaultReceiveMode(destinationAsset)
        );
    };

    private encodeMintRecipient = async (
        destinationAsset: string,
        recipient: string,
    ): Promise<Hex> => {
        const destinationTransport = this.getTransport(destinationAsset);
        switch (destinationTransport) {
            case NetworkTransport.Evm:
                return addressToBytes32(recipient);

            case NetworkTransport.Solana: {
                const ata = await solanaChain.getSolanaAssociatedTokenAddress(
                    getTokenAddress(destinationAsset),
                    recipient,
                    true,
                );
                return solanaChain.encodeSolanaRecipient(ata) as Hex;
            }

            case NetworkTransport.Tron:
                throw new Error("CCTP does not support Tron destinations");

            default: {
                const exhaustiveTransport: never = destinationTransport;
                throw new Error(
                    `Unsupported CCTP destination transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    private getHookData = (
        destinationAsset: string,
        receiveMode: CctpReceiveMode,
        recipient: string,
        options: BridgeQuoteOptions,
    ): Hex => {
        if (receiveMode === CctpReceiveMode.Manual) {
            return cctpEmptyHookData as Hex;
        }

        if (
            this.getTransport(destinationAsset) === NetworkTransport.Solana &&
            options.cctpIncludeRecipientSetup === true
        ) {
            return createCctpSolanaForwardHookData(recipient) as Hex;
        }

        return cctpForwardHookData as Hex;
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
            this.getReceiveMode(route.destinationAsset, options),
            options.cctpIncludeRecipientSetup === true,
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
