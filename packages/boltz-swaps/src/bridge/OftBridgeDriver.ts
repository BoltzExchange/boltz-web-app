import {
    type Hex,
    type PublicClient,
    type TransactionRequest,
    encodeAbiParameters,
    encodeFunctionData,
    getAddress,
    getContract,
    keccak256,
    parseAbiParameters,
    parseSignature,
} from "viem";

import { getBoltzSwapsConfig, getTokenAddress } from "../config.ts";
import { prefix0x } from "../evm/prefix0x.ts";
import { erc20Abi, routerAbi } from "../generated/evm-abis.ts";
import type {
    AlchemyCall,
    RouterContract,
    Signer,
} from "../interfaces/index.ts";
import {
    type OftDirectSendTarget,
    type OftTransportClient,
    type SendParam,
    buildOftApprovalCall,
    createOftContract,
    decodeExecutorNativeAmountExceedsCapError,
    getBufferedOftNativeFee,
    getOftContract,
    getOftDirectRequiredNativeBalance,
    getOftDirectRequiredTokenAmount,
    getOftDirectSendTarget,
    getOftProvider,
    getOftReceivedEventByGuid,
    getOftSentEvent,
    getOftTransactionSender,
    getOftTransport,
    getQuotedOftContract,
    getRequiredSolanaOftNativeBalance,
    getSolanaOftGuidFromLogs,
    getSolanaOftTokenBalance,
    getTronOftTokenBalance,
    isExecutorNativeAmountExceedsCapError,
    quoteOftAmountInForAmountOut,
    quoteOftReceiveAmount,
    quoteOftSend,
    requiresOftDirectUserApproval,
    sendOftDirect,
} from "../oft/index.ts";
import { getSolanaNativeBalance } from "../solana/index.ts";
import { getTronNativeBalance } from "../tron/index.ts";
import { BridgeKind, ExplorerKind, NetworkTransport } from "../types.ts";
import {
    BridgeDriver,
    type EncodeRouterExecuteArgs,
    type PopulateRouterClaimBridgeArgs,
} from "./driver.ts";
import { toRouterCalls } from "./router.ts";
import { vFromSignature } from "./signature.ts";
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

export class OftBridgeDriver extends BridgeDriver {
    public readonly kind = BridgeKind.Oft;

    public getTransport = (asset: string): NetworkTransport => {
        return getOftTransport(asset);
    };

    public getExplorerKind = (route: BridgeRoute): ExplorerKind => {
        void route;
        return ExplorerKind.LayerZero;
    };

    public getMessagingFeeToken = (route: BridgeRoute): string | undefined => {
        return getBoltzSwapsConfig().assets?.[route.sourceAsset]?.network
            ?.gasToken;
    };

    public getTransferFeeAsset = (route: BridgeRoute): string | undefined => {
        return route.sourceAsset;
    };

    public override getNativeDropFailure = (
        error: BridgeErrorLike,
    ): BridgeNativeDropFailure | undefined => {
        if (!isExecutorNativeAmountExceedsCapError(error)) {
            return undefined;
        }

        const decoded = decodeExecutorNativeAmountExceedsCapError(error);
        return {
            reason: "exceeds_cap",
            amount: decoded?.amount,
            cap: decoded?.cap,
        };
    };

    public buildQuoteOptions = async (
        destinationAsset: string,
        destination: string,
        getGasToken: boolean,
    ): Promise<BridgeQuoteOptions> => {
        const config = getBoltzSwapsConfig();
        const supportsGasTopUp =
            config.gasTopUpSupported?.(destinationAsset) ?? false;
        return {
            recipient: destination,
            nativeDrop:
                getGasToken && supportsGasTopUp
                    ? {
                          amount: await this.requireGasTopUpNativeAmount(
                              destinationAsset,
                          ),
                          receiver: destination,
                      }
                    : undefined,
        };
    };

    private requireGasTopUpNativeAmount = async (
        asset: string,
    ): Promise<bigint> => {
        const fn = getBoltzSwapsConfig().getGasTopUpNativeAmount;
        if (fn === undefined) {
            throw new Error(
                "BoltzSwapsConfig.getGasTopUpNativeAmount is not configured",
            );
        }
        return await fn(asset);
    };

    public quoteReceiveAmount = async (
        route: BridgeRoute,
        amount: bigint,
        options: BridgeQuoteOptions = {},
    ): Promise<BridgeReceiveQuote> => {
        const quote = await quoteOftReceiveAmount(route, amount, {
            recipient: options.recipient,
            nativeDrop: options.nativeDrop,
            oftName: options.bridgeName,
        });

        return {
            amountIn: quote.amountIn,
            amountOut: quote.amountOut,
            messagingFee: {
                amount: quote.msgFee[0],
                token: this.getMessagingFeeToken(route),
            },
            bridgeLimit: quote.oftLimit,
            bridgeFeeDetails: quote.oftFeeDetails,
            bridgeReceipt: quote.oftReceipt,
        };
    };

    public quoteAmountInForAmountOut = async (
        route: BridgeRoute,
        amountOut: bigint,
        options: BridgeQuoteOptions = {},
    ): Promise<bigint> => {
        return await quoteOftAmountInForAmountOut(route, amountOut, {
            recipient: options.recipient,
            nativeDrop: options.nativeDrop,
            oftName: options.bridgeName,
        });
    };

    public quoteSend = async (
        contract: BridgeTransportClient,
        route: BridgeRoute,
        recipient: string | undefined,
        amount: bigint,
        options: BridgeQuoteOptions = {},
    ): Promise<BridgeSendQuote> => {
        const quote = await quoteOftSend(
            contract as OftTransportClient,
            route,
            recipient,
            amount,
            {
                recipient: options.recipient,
                nativeDrop: options.nativeDrop,
                oftName: options.bridgeName,
            },
        );

        return {
            sendParam: quote.sendParam,
            msgFee: quote.msgFee,
            minAmount: quote.sendParam[3],
            bridgeLimit: quote.oftLimit,
            bridgeFeeDetails: quote.oftFeeDetails,
            bridgeReceipt: quote.oftReceipt,
        };
    };

    public buildApprovalCall = async (
        route: BridgeRoute,
        owner: string,
        amount: bigint,
        signer: Signer,
    ): Promise<AlchemyCall | undefined> => {
        return await buildOftApprovalCall(route, owner, amount, signer);
    };

    public getQuotedContract = async (
        route: BridgeRoute,
    ): Promise<BridgeTransportClient> => {
        return await getQuotedOftContract(route);
    };

    public createContract = async (
        route: BridgeRoute,
        runner?: BridgeTransportRunner,
    ): Promise<BridgeTransportClient> => {
        return await createOftContract(route, runner);
    };

    public getContract = async (
        route: BridgeRoute,
    ): Promise<BridgeContract> => {
        return await getOftContract(route);
    };

    public getProvider = (sourceAsset: string): PublicClient => {
        return getOftProvider(sourceAsset);
    };

    public getSentEvent = (
        contract: BridgeTransportClient,
        receipt: BridgeSentReceipt,
        contractAddress: string,
    ): BridgeSentEvent =>
        getOftSentEvent(
            contract as OftTransportClient,
            receipt as Parameters<typeof getOftSentEvent>[1],
            contractAddress,
        );

    public getReceivedEventByGuid = async (
        contract: BridgeTransportClient,
        provider: PublicClient,
        contractAddress: string,
        guid: string,
        options?: { fromBlock?: bigint },
    ): Promise<BridgeReceivedEvent | undefined> => {
        return await getOftReceivedEventByGuid(
            contract as OftTransportClient,
            provider,
            contractAddress,
            guid,
            options,
        );
    };

    public deriveSolanaSentGuid = (args: {
        sourceAsset: string;
        txHash: string;
        logMessages: string[];
    }): string | undefined => {
        void args.sourceAsset;
        void args.txHash;
        return getSolanaOftGuidFromLogs(args.logMessages);
    };

    public override getTransportRequiredNativeBalance = async (
        route: BridgeRoute,
        msgFee: BridgeMsgFee,
    ): Promise<bigint> => {
        const transport = this.getTransport(route.sourceAsset);

        switch (transport) {
            case NetworkTransport.Solana:
                return await getRequiredSolanaOftNativeBalance(
                    route.sourceAsset,
                    msgFee[0],
                );
            case NetworkTransport.Tron:
                return msgFee[0];
            case NetworkTransport.Evm:
                return getBufferedOftNativeFee(msgFee[0]);
        }
    };

    public getSourceTokenBalance = async (
        route: BridgeRoute,
        ownerAddress: string,
    ): Promise<bigint> => {
        const transport = this.getTransport(route.sourceAsset);

        switch (transport) {
            case NetworkTransport.Solana:
                return await getSolanaOftTokenBalance(route, ownerAddress);
            case NetworkTransport.Evm: {
                const tokenContract = getContract({
                    address: getAddress(getTokenAddress(route.sourceAsset)),
                    abi: erc20Abi,
                    client: this.getProvider(route.sourceAsset),
                });

                return await tokenContract.read.balanceOf([
                    getAddress(ownerAddress),
                ]);
            }
            case NetworkTransport.Tron:
                return await getTronOftTokenBalance(route, ownerAddress);
            default: {
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported bridge source transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    public getSourceNativeBalance = async (
        route: BridgeRoute,
        ownerAddress: string,
    ): Promise<bigint> => {
        const transport = this.getTransport(route.sourceAsset);

        switch (transport) {
            case NetworkTransport.Solana:
                return await getSolanaNativeBalance(
                    route.sourceAsset,
                    ownerAddress,
                );
            case NetworkTransport.Evm:
                return await this.getProvider(route.sourceAsset).getBalance({
                    address: getAddress(ownerAddress),
                });
            case NetworkTransport.Tron:
                return await getTronNativeBalance(
                    route.sourceAsset,
                    ownerAddress,
                );
            default: {
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported bridge source transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    public getTransactionSender = async (
        sourceAsset: string,
        txHash: string,
    ): Promise<string | undefined> => {
        return await getOftTransactionSender(sourceAsset, txHash);
    };

    public getDirectSendTarget = async (
        route: BridgeRoute,
    ): Promise<BridgeDirectSendTarget> => {
        return await getOftDirectSendTarget(route);
    };

    public requiresDirectUserApproval = async (
        target: BridgeDirectSendTarget,
        runner: BridgeDirectSendRunner,
    ): Promise<boolean> => {
        return await requiresOftDirectUserApproval(
            target as OftDirectSendTarget,
            runner,
        );
    };

    public getDirectRequiredTokenAmount = (
        target: BridgeDirectSendTarget,
        amount: bigint,
        msgFee: BridgeMsgFee,
    ): bigint =>
        getOftDirectRequiredTokenAmount(
            target as OftDirectSendTarget,
            amount,
            msgFee,
        );

    public getDirectRequiredNativeBalance = (
        target: BridgeDirectSendTarget,
        msgFee: BridgeMsgFee,
    ): bigint =>
        getOftDirectRequiredNativeBalance(
            target as OftDirectSendTarget,
            msgFee,
        );

    public sendDirect = async (args: {
        target: BridgeDirectSendTarget;
        runner: BridgeDirectSendRunner;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> =>
        await sendOftDirect({
            ...args,
            target: args.target as OftDirectSendTarget,
            runner: args.runner as Signer,
            sendParam: args.sendParam as SendParam,
        });

    public sendTransport = async (args: {
        contract: BridgeTransportClient;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> =>
        await (args.contract as OftTransportClient).send(
            args.sendParam as SendParam,
            args.msgFee,
            args.refundAddress,
        );

    public encodeRouterExecuteData = (args: EncodeRouterExecuteArgs): Hex => {
        const sendData = this.toSendData(args.sendParam);
        return encodeFunctionData({
            abi: routerAbi,
            functionName: "executeOft",
            args: [
                toRouterCalls(args.routerCalls),
                getAddress(getTokenAddress(args.route.sourceAsset)),
                getAddress(args.bridgeContract.address),
                {
                    ...sendData,
                    to: sendData.to as Hex,
                    extraOptions: sendData.extraOptions as Hex,
                    composeMsg: sendData.composeMsg as Hex,
                    oftCmd: sendData.oftCmd as Hex,
                },
                args.minAmountLd,
                args.lzTokenFee,
                getAddress(args.refundAddress),
            ],
        });
    };

    public populateRouterClaimBridgeTransaction = async (
        args: PopulateRouterClaimBridgeArgs,
    ): Promise<TransactionRequest> => {
        const sourceTransport = this.getTransport(args.route.sourceAsset);
        if (sourceTransport !== NetworkTransport.Evm) {
            throw new Error(
                `Bridge approvals require an EVM source contract, got ${String(sourceTransport)}`,
            );
        }

        const sendData = this.toSendData(args.sendParam);
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
                    ClaimSend: [
                        { name: "preimage", type: "bytes32" },
                        { name: "token", type: "address" },
                        { name: "oft", type: "address" },
                        { name: "sendData", type: "bytes32" },
                        { name: "minAmountLD", type: "uint256" },
                        { name: "lzTokenFee", type: "uint256" },
                        { name: "refundAddress", type: "address" },
                    ],
                } as const,
                primaryType: "ClaimSend",
                message: {
                    preimage: prefix0x(args.preimage),
                    token: getAddress(args.outputTokenAddress),
                    oft: getAddress(args.bridgeContract.address),
                    sendData: (await this.hashSendData(
                        args.router,
                        sendData,
                    )) as Hex,
                    minAmountLD: args.minAmountLd,
                    lzTokenFee: args.lzTokenFee,
                    refundAddress: getAddress(args.refundAddress),
                },
            }),
        );

        return {
            to: args.router.address,
            data: encodeFunctionData({
                abi: routerAbi,
                functionName: "claimERC20ExecuteOft",
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
                        dstEid: sendData.dstEid,
                        to: sendData.to as Hex,
                        extraOptions: sendData.extraOptions as Hex,
                        composeMsg: sendData.composeMsg as Hex,
                        oftCmd: sendData.oftCmd as Hex,
                    },
                    {
                        minAmountLd: args.minAmountLd,
                        lzTokenFee: args.lzTokenFee,
                        refundAddress: getAddress(args.refundAddress),
                        v: vFromSignature(authSignature),
                        r: authSignature.r,
                        s: authSignature.s,
                    },
                ],
            }),
        } satisfies TransactionRequest;
    };

    // Structured projection of the positional OFT send-param tuple.
    // Tuple layout: [dstEid, to, amountLD, minAmountLD, extraOptions, composeMsg, oftCmd].
    private toSendData = (sendParam: BridgeSendParam) => {
        const oftSendParam = sendParam as SendParam;
        return {
            dstEid: oftSendParam[0],
            to: oftSendParam[1],
            extraOptions: oftSendParam[4],
            composeMsg: oftSendParam[5],
            oftCmd: oftSendParam[6],
        };
    };

    private hashSendData = async (
        router: RouterContract,
        sendData: {
            dstEid: number;
            to: string;
            extraOptions: string;
            composeMsg: string;
            oftCmd: string;
        },
    ): Promise<string> =>
        keccak256(
            encodeAbiParameters(
                parseAbiParameters(
                    "bytes32,uint32,bytes32,bytes32,bytes32,bytes32",
                ),
                [
                    (await router.read.TYPEHASH_SEND_DATA()) as Hex,
                    sendData.dstEid,
                    sendData.to as Hex,
                    keccak256(sendData.extraOptions as Hex),
                    keccak256(sendData.composeMsg as Hex),
                    keccak256(sendData.oftCmd as Hex),
                ],
            ),
        );
}
