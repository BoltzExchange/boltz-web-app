import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import type { Signer } from "ethers";
import { ZeroAddress } from "ethers";
import log from "loglevel";

import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import { getForwarder, getSmartWalletFactory } from "./Contracts";
import type { Metadata } from "./Relay";
import { estimate, getChainInfo, relay } from "./Relay";
import { calculateGasPrice, getValidUntilTime, isDeployRequest } from "./Utils";
import type { EnvelopingRequest } from "./types/TypedRequestData";
import {
    deployRequestType,
    getEnvelopingRequestDataV4Field,
    relayRequestType,
} from "./types/TypedRequestData";

// With some extra buffer; just in case
export const GasNeededToClaim = BigInt(35355) * 2n;

export const MaxRelayNonceGap = 10;

const sign = async (signer: Signer, request: EnvelopingRequest) => {
    const { chainId } = await signer.provider.getNetwork();

    const data = getEnvelopingRequestDataV4Field({
        chainId: Number(chainId),
        envelopingRequest: request,
        verifier: request.relayData.callForwarder as string,
        requestTypes: isDeployRequest(request)
            ? deployRequestType
            : relayRequestType,
    });

    return signer.signTypedData(data.domain, data.types, data.value);
};

export const relayClaimTransaction = async (
    signer: Signer,
    etherSwap: EtherSwap,
    preimage: string,
    amount: number,
    refundAddress: string,
    timeoutBlockHeight: number,
) => {
    const callData = etherSwap.interface.encodeFunctionData(
        "claim(bytes32,uint256,address,uint256)",
        [
            prefix0x(preimage),
            satoshiToWei(amount),
            refundAddress,
            timeoutBlockHeight,
        ],
    );
    const [
        chainInfo,
        smartWalletAddress,
        feeData,
        signerAddress,
        etherSwapAddress,
    ] = await Promise.all([
        getChainInfo(),
        getSmartWalletAddress(signer),
        signer.provider.getFeeData(),
        signer.getAddress(),
        etherSwap.getAddress(),
    ]);

    const smartWalletExists =
        (await signer.provider.getCode(smartWalletAddress.address)) !== "0x";
    log.info("RIF smart wallet exists:", smartWalletExists);

    const smartWalletFactory = getSmartWalletFactory(signer);

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
                feeData.gasPrice,
                chainInfo.minGasPrice,
            ).toString(),
        },
    };

    if (!smartWalletExists) {
        envelopingRequest.request.recoverer = ZeroAddress;
        envelopingRequest.request.index = Number(smartWalletAddress.nonce);
        envelopingRequest.request.nonce = (
            await smartWalletFactory.nonce(signerAddress)
        ).toString();

        envelopingRequest.relayData.callForwarder =
            await smartWalletFactory.getAddress();
    } else {
        envelopingRequest.request.gas = GasNeededToClaim.toString();
        envelopingRequest.request.nonce = (
            await getForwarder(signer, smartWalletAddress.address).nonce()
        ).toString();

        envelopingRequest.relayData.callForwarder = smartWalletAddress;
    }

    const metadata: Metadata = {
        signature: "SERVER_SIGNATURE_REQUIRED",
        relayHubAddress: chainInfo.relayHubAddress,
        relayMaxNonce:
            (await signer.provider.getTransactionCount(
                chainInfo.relayWorkerAddress,
            )) + MaxRelayNonceGap,
    };

    const estimateRes = await estimate(envelopingRequest, metadata);
    log.debug("RIF gas estimation response", estimateRes);

    envelopingRequest.request.tokenGas = estimateRes.estimation;
    envelopingRequest.request.tokenAmount = estimateRes.requiredTokenAmount;
    metadata.signature = await sign(signer, envelopingRequest);

    const relayRes = await relay(envelopingRequest, metadata);
    return relayRes.txHash;
};

export const getSmartWalletAddress = async (
    signer: Signer,
): Promise<{
    nonce: bigint;
    address: string;
}> => {
    const factory = getSmartWalletFactory(signer);

    const nonce = await factory.nonce(await signer.getAddress());
    const smartWalletAddress: string = await factory.getSmartWalletAddress(
        await signer.getAddress(),
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
