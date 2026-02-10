import log from "loglevel";
import { getWagmiEtherSwapContractConfig } from "src/config/wagmi";
import { EtherSwapAbi } from "src/context/Web3";
import type { Contracts } from "src/utils/boltzClient";
import {
    type Address,
    type PublicClient,
    type WalletClient,
    encodeFunctionData,
} from "viem";

import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import {
    getSmartWalletAddress as getSmartWalletAddressFunc,
    getSmartWalletFactoryAddress,
    getSmartWalletNonce,
    getWalletNonce,
} from "./Contracts";
import type { Metadata } from "./Relay";
import { estimate, getChainInfo, relay } from "./Relay";
import { calculateGasPrice, getValidUntilTime, isDeployRequest } from "./Utils";
import type { EnvelopingRequest } from "./types/TypedRequestData";
import {
    deployRequestType,
    getEnvelopingRequestDataV4Field,
    relayRequestType,
} from "./types/TypedRequestData";

type PublicClientGetter = () => PublicClient;
type WalletClientGetter = () => WalletClient;
type ContractsGetter = () => Contracts;

const ZeroAddress: Address = "0x0000000000000000000000000000000000000000";

// With some extra buffer; just in case
export const GasNeededToClaim = BigInt(35355) * 2n;

export const MaxRelayNonceGap = 10;

const sign = async (
    walletClient: WalletClientGetter,
    request: EnvelopingRequest,
) => {
    const chainId = await walletClient().getChainId();

    const data = getEnvelopingRequestDataV4Field({
        chainId: Number(chainId),
        envelopingRequest: request,
        verifier: request.relayData.callForwarder as Address,
        requestTypes: isDeployRequest(request)
            ? deployRequestType
            : relayRequestType,
    });

    return walletClient().signTypedData({
        types: data.types,
        primaryType: data.primaryType,
        message: data.value,
        account: walletClient().account,
    });
};

export const relayClaimTransaction = async (
    publicClient: PublicClientGetter,
    walletClient: WalletClientGetter,
    getContracts: ContractsGetter,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
) => {
    const callData = encodeFunctionData({
        abi: EtherSwapAbi,
        functionName: "claim",
        args: [
            prefix0x(preimage),
            satoshiToWei(amount),
            refundAddress,
            timeoutBlockHeight,
        ],
    });
    const [
        chainInfo,
        smartWalletAddress,
        gasPrice,
        signerAddress,
        etherSwapAddress,
    ] = await Promise.all([
        getChainInfo(),
        getSmartWalletAddress(publicClient, walletClient, getContracts),
        publicClient().getGasPrice(),
        Promise.resolve(walletClient().account.address),
        Promise.resolve(getContracts().swapContracts.EtherSwap),
    ]);

    const smartWalletExists =
        (await publicClient().getCode({
            address: smartWalletAddress.address as Address,
        })) !== "0x";
    log.info("RIF smart wallet exists:", smartWalletExists);

    const envelopingRequest: EnvelopingRequest = {
        request: {
            value: "0",
            data: callData,
            tokenAmount: "0",
            tokenGas: "20000",
            from: signerAddress,
            to: etherSwapAddress,
            tokenContract: ZeroAddress,
            relayHub: chainInfo.relayHubAddress,
            validUntilTime: getValidUntilTime(),
        },
        relayData: {
            feesReceiver: chainInfo.feesReceiver,
            callVerifier: config.assets[RBTC].contracts.deployVerifier,
            gasPrice: calculateGasPrice(
                gasPrice,
                chainInfo.minGasPrice,
            ).toString(),
        },
    };

    if (!smartWalletExists) {
        envelopingRequest.request.recoverer = ZeroAddress;
        envelopingRequest.request.index = Number(smartWalletAddress.nonce);
        envelopingRequest.request.nonce = (
            await getSmartWalletNonce(publicClient, signerAddress)
        ).toString();

        envelopingRequest.relayData.callForwarder =
            getSmartWalletFactoryAddress();
    } else {
        envelopingRequest.request.gas = GasNeededToClaim.toString();
        envelopingRequest.request.nonce = (
            await getWalletNonce(
                publicClient,
                smartWalletAddress.address as Address,
            )
        ).toString();

        envelopingRequest.relayData.callForwarder = smartWalletAddress;
    }

    const metadata: Metadata = {
        signature: "SERVER_SIGNATURE_REQUIRED",
        relayHubAddress: chainInfo.relayHubAddress,
        relayMaxNonce:
            (await publicClient().getTransactionCount({
                address: chainInfo.relayWorkerAddress as Address,
            })) + MaxRelayNonceGap,
    };

    const estimateRes = await estimate(envelopingRequest, metadata);
    log.debug("RIF gas estimation response", estimateRes);

    envelopingRequest.request.tokenGas = estimateRes.estimation;
    envelopingRequest.request.tokenAmount = estimateRes.requiredTokenAmount;
    metadata.signature = await sign(walletClient, envelopingRequest);

    const relayRes = await relay(envelopingRequest, metadata);
    return relayRes.txHash;
};

export const getSmartWalletAddress = async (
    publicClient: PublicClientGetter,
    walletClient: WalletClientGetter,
    getContracts: ContractsGetter,
): Promise<{
    nonce: bigint;
    address: string;
}> => {
    const nonce = BigInt(
        await publicClient().getTransactionCount({
            address: getWagmiEtherSwapContractConfig(getContracts).address,
            blockTag: "pending",
        }),
    );
    const [ownerAddress] = await walletClient().getAddresses();
    const smartWalletAddress = await getSmartWalletAddressFunc(
        publicClient,
        ownerAddress,
        ZeroAddress,
        nonce,
    );
    log.debug(
        `RIF smart wallet address ${smartWalletAddress} with nonce ${nonce}`,
    );
    return {
        nonce,
        address: smartWalletAddress,
    };
};
