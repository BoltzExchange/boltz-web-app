import { abi as ERC20Abi } from "boltz-core/out/ERC20.sol/ERC20.json";
import type { ERC20 } from "boltz-core/typechain/ERC20";
import type { Router } from "boltz-core/typechain/Router";
import { AbiCoder, Contract, Signature, keccak256 } from "ethers";
import type { TransactionRequest, Wallet } from "ethers";

import type { AlchemyCall } from "../../alchemy/Alchemy";
import { ExplorerKind } from "../../components/BlockExplorer";
import { config } from "../../config";
import { BridgeKind, NetworkTransport } from "../../configs/base";
import { getTokenAddress } from "../../consts/Assets";
import type { Signer } from "../../context/Web3";
import { getSolanaNativeBalance } from "../chains/solana";
import {
    getOftDirectRequiredNativeBalance,
    getOftDirectRequiredTokenAmount,
    getOftDirectSendTarget,
    requiresOftDirectUserApproval,
    sendOftDirect,
} from "../oft/directSend";
import {
    buildOftApprovalCall,
    createOftContract,
    decodeExecutorNativeAmountExceedsCapError,
    getBufferedOftNativeFee,
    getOftProvider,
    getOftReceivedEventByGuid,
    getOftSentEvent,
    getOftTransactionSender,
    getOftTransport,
    getQuotedOftContract,
    getSolanaOftTokenBalance,
    isExecutorNativeAmountExceedsCapError,
    quoteOftAmountInForAmountOut,
    quoteOftReceiveAmount,
    quoteOftSend,
} from "../oft/oft";
import { getOftContract } from "../oft/registry";
import { getSolanaOftGuidFromLogs } from "../oft/solana";
import type { Provider } from "../provider";
import { gasTopUpSupported, getGasTopUpNativeAmount } from "../quoter";
import {
    BridgeDriver,
    type EncodeRouterExecuteArgs,
    type PopulateRouterClaimBridgeArgs,
} from "./driver";
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
} from "./types";

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
        return config.assets?.[route.sourceAsset]?.network?.gasToken;
    };

    public getTransferFeeAsset = (route: BridgeRoute): string | undefined => {
        return route.sourceAsset;
    };

    public getNativeDropFailure = (
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
        return {
            recipient: destination,
            nativeDrop:
                getGasToken && gasTopUpSupported(destinationAsset)
                    ? {
                          amount: await getGasTopUpNativeAmount(
                              destinationAsset,
                          ),
                          receiver: destination,
                      }
                    : undefined,
        };
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
            msgFee: quote.msgFee,
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
        const quote = await quoteOftSend(contract, route, recipient, amount, {
            recipient: options.recipient,
            nativeDrop: options.nativeDrop,
            oftName: options.bridgeName,
        });

        return {
            sendParam: quote.sendParam,
            msgFee: quote.msgFee,
            bridgeLimit: quote.oftLimit,
            bridgeFeeDetails: quote.oftFeeDetails,
            bridgeReceipt: quote.oftReceipt,
        };
    };

    public buildApprovalCall = async (
        route: BridgeRoute,
        owner: string,
        amount: bigint,
        signer: Signer | Wallet,
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

    public getProvider = (sourceAsset: string): Provider => {
        return getOftProvider(sourceAsset);
    };

    public getSentEvent = (
        contract: BridgeTransportClient,
        receipt: BridgeSentReceipt,
        contractAddress: string,
    ): BridgeSentEvent => getOftSentEvent(contract, receipt, contractAddress);

    public getReceivedEventByGuid = async (
        contract: BridgeTransportClient,
        provider: Pick<Provider, "getLogs">,
        contractAddress: string,
        guid: string,
    ): Promise<BridgeReceivedEvent | undefined> => {
        return await getOftReceivedEventByGuid(
            contract,
            provider,
            contractAddress,
            guid,
        );
    };

    public getGuidFromSolanaLogs = (
        logMessages: string[],
    ): string | undefined => {
        return getSolanaOftGuidFromLogs(logMessages);
    };

    public getBufferedNativeFee = (nativeFee: bigint): bigint => {
        return getBufferedOftNativeFee(nativeFee);
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
                const tokenContract = new Contract(
                    getTokenAddress(route.sourceAsset),
                    ERC20Abi,
                    this.getProvider(route.sourceAsset),
                ) as unknown as ERC20;

                return await tokenContract.balanceOf(ownerAddress);
            }
            case NetworkTransport.Tron:
                throw new Error(
                    "Bridge source token balance is not implemented for tron yet",
                );
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
                return await this.getProvider(route.sourceAsset).getBalance(
                    ownerAddress,
                );
            case NetworkTransport.Tron:
                throw new Error(
                    "Bridge source native balance is not implemented for tron yet",
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
        return await requiresOftDirectUserApproval(target, runner);
    };

    public getDirectRequiredTokenAmount = (
        target: BridgeDirectSendTarget,
        amount: bigint,
        msgFee: BridgeMsgFee,
    ): bigint => getOftDirectRequiredTokenAmount(target, amount, msgFee);

    public getDirectRequiredNativeBalance = (
        target: BridgeDirectSendTarget,
        msgFee: BridgeMsgFee,
    ): bigint => getOftDirectRequiredNativeBalance(target, msgFee);

    public sendDirect = async (args: {
        target: BridgeDirectSendTarget;
        runner: BridgeDirectSendRunner;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> => await sendOftDirect(args);

    public encodeRouterExecuteData = (
        args: EncodeRouterExecuteArgs,
    ): string => {
        return args.router.interface.encodeFunctionData("executeOft", [
            args.routerCalls,
            getTokenAddress(args.route.sourceAsset),
            args.bridgeContract.address,
            this.toSendData(args.sendParam),
            args.minAmountLd,
            args.lzTokenFee,
            args.refundAddress,
        ]);
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
        const authSignature = Signature.from(
            await args.signer.signTypedData(
                {
                    name: "Router",
                    version: "2",
                    verifyingContract: await args.router.getAddress(),
                    chainId: args.chainId,
                },
                {
                    ClaimSend: [
                        { name: "preimage", type: "bytes32" },
                        { name: "token", type: "address" },
                        { name: "oft", type: "address" },
                        { name: "sendData", type: "bytes32" },
                        { name: "minAmountLD", type: "uint256" },
                        { name: "lzTokenFee", type: "uint256" },
                        { name: "refundAddress", type: "address" },
                    ],
                },
                {
                    preimage: `0x${args.preimage}`,
                    token: args.outputTokenAddress,
                    oft: args.bridgeContract.address,
                    sendData: await this.hashSendData(args.router, sendData),
                    minAmountLD: args.minAmountLd,
                    lzTokenFee: args.lzTokenFee,
                    refundAddress: args.refundAddress,
                },
            ),
        );

        return await args.router.claimERC20ExecuteOft.populateTransaction(
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
            sendData,
            {
                minAmountLd: args.minAmountLd,
                lzTokenFee: args.lzTokenFee,
                refundAddress: args.refundAddress,
                v: authSignature.v,
                r: authSignature.r,
                s: authSignature.s,
            },
        );
    };

    // Structured projection of the positional OFT send-param tuple.
    // Tuple layout: [dstEid, to, amountLD, minAmountLD, extraOptions, composeMsg, oftCmd].
    private toSendData = (sendParam: BridgeSendParam) => ({
        dstEid: sendParam[0],
        to: sendParam[1],
        extraOptions: sendParam[4],
        composeMsg: sendParam[5],
        oftCmd: sendParam[6],
    });

    private hashSendData = async (
        router: Router,
        sendData: {
            dstEid: number;
            to: string;
            extraOptions: string;
            composeMsg: string;
            oftCmd: string;
        },
    ): Promise<string> =>
        keccak256(
            AbiCoder.defaultAbiCoder().encode(
                [
                    "bytes32",
                    "uint32",
                    "bytes32",
                    "bytes32",
                    "bytes32",
                    "bytes32",
                ],
                [
                    await router.TYPEHASH_SEND_DATA(),
                    sendData.dstEid,
                    sendData.to,
                    keccak256(sendData.extraOptions),
                    keccak256(sendData.composeMsg),
                    keccak256(sendData.oftCmd),
                ],
            ),
        );
}
