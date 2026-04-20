import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { Wallet } from "ethers";
import log from "loglevel";

import type { Signer } from "../context/Web3";
import {
    postCommitmentRefundSignature,
    postCommitmentSignature,
} from "./boltzClient";
import {
    assertTransactionSignerProvider,
    getLockupEvent,
} from "./evmTransaction";
import { prefix0x } from "./rootstock";

export const emptyPreimageHash = prefix0x("00".repeat(32));

type PostCommitmentSignatureParams = {
    asset: string;
    swapId: string;
    preimageHash: string;
    commitmentTxHash: string;
    slippage: number;
    erc20Swap: ERC20Swap;
    signer: Signer | Wallet;
    waitTimeoutMs?: number;
};

export const postCommitmentSignatureForTransaction = async ({
    asset,
    swapId,
    preimageHash,
    commitmentTxHash,
    slippage,
    erc20Swap,
    signer,
    waitTimeoutMs = 120_000,
}: PostCommitmentSignatureParams) => {
    log.info("Waiting for commitment lockup receipt", {
        asset,
        swapId,
        commitmentTxHash,
        waitTimeoutMs,
    });

    const provider = assertTransactionSignerProvider(
        signer,
        "commitment transaction signer",
    );
    const connectedErc20Swap = erc20Swap.connect(provider) as ERC20Swap;

    const receipt = await provider.waitForTransaction(
        commitmentTxHash,
        1,
        waitTimeoutMs,
    );
    if (receipt === null) {
        throw new Error(
            "could not fetch commitment lockup transaction receipt",
        );
    }

    log.info("Commitment lockup receipt found", {
        asset,
        swapId,
        commitmentTxHash,
        blockNumber: receipt.blockNumber,
    });

    const [chainId, contractAddress, version] = await Promise.all([
        provider.getNetwork().then((n) => n.chainId),
        connectedErc20Swap.getAddress(),
        connectedErc20Swap.version(),
    ]);

    const {
        amount,
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock,
        logIndex,
    } = getLockupEvent(connectedErc20Swap, receipt, contractAddress);

    log.debug("Parsed commitment lockup event", {
        asset,
        swapId,
        commitmentTxHash,
        contractAddress,
        chainId: chainId.toString(),
        amount: amount.toString(),
        tokenAddress,
        claimAddress,
        refundAddress,
        timelock: timelock.toString(),
        logIndex,
    });

    const commitmentSignature = await signer.signTypedData(
        {
            name: "ERC20Swap",
            version: String(version),
            verifyingContract: contractAddress,
            chainId,
        },
        {
            Commit: [
                { name: "preimageHash", type: "bytes32" },
                { name: "amount", type: "uint256" },
                { name: "tokenAddress", type: "address" },
                { name: "claimAddress", type: "address" },
                { name: "refundAddress", type: "address" },
                { name: "timelock", type: "uint256" },
            ],
        },
        {
            preimageHash: prefix0x(preimageHash),
            amount,
            tokenAddress,
            claimAddress,
            refundAddress,
            timelock,
        },
    );

    log.debug("Signed commitment typed data", {
        asset,
        swapId,
        commitmentTxHash,
        contractAddress,
    });

    await postCommitmentSignature(
        asset,
        swapId,
        commitmentSignature,
        commitmentTxHash,
        logIndex,
        slippage * 100,
    );

    log.info("Posted commitment signature", {
        asset,
        swapId,
        commitmentTxHash,
        logIndex,
    });
};

export const buildCommitmentRefundAuthMessage = (
    chainSymbol: string,
    transactionHash: string,
    logIndex: number | undefined,
) =>
    [
        "Boltz commitment refund authorization",
        `chain: ${chainSymbol}`,
        `transactionHash: ${transactionHash}`,
        `logIndex: ${logIndex ?? "none"}`,
    ].join("\n");

type GetCommitmentRefundSignatureParams = {
    chainSymbol: string;
    transactionHash: string;
    logIndex?: number;
    signer: Signer | Wallet;
};

export const getCommitmentRefundSignature = async ({
    chainSymbol,
    transactionHash,
    logIndex,
    signer,
}: GetCommitmentRefundSignatureParams): Promise<string> => {
    const message = buildCommitmentRefundAuthMessage(
        chainSymbol,
        transactionHash,
        logIndex,
    );

    log.debug("Requesting commitment refund authorization signature", {
        chainSymbol,
        transactionHash,
        logIndex,
    });

    const refundAddressSignature = await signer.signMessage(message);

    const { signature } = await postCommitmentRefundSignature(
        chainSymbol,
        transactionHash,
        refundAddressSignature,
        logIndex,
    );

    log.info("Received commitment refund signature", {
        chainSymbol,
        transactionHash,
        logIndex,
    });

    return signature;
};
