import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { Signature, type TransactionRequest, type Wallet } from "ethers";
import log from "loglevel";
import type { Accessor, Setter } from "solid-js";
import { Show, createMemo, createResource, createSignal } from "solid-js";

import RefundEta from "../components/RefundEta";
import {
    AssetKind,
    getKindForAsset,
    getTokenAddress,
    isEvmAsset,
} from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { type Signer, useWeb3Signer } from "../context/Web3";
import { getEipRefundSignature } from "../utils/boltzClient";
import { validateAddress } from "../utils/compat";
import { formatError } from "../utils/errors";
import {
    getCommitmentLockupEvent,
    getSignerForGasAbstraction,
    sendPopulatedTransaction,
} from "../utils/evmTransaction";
import { decodeInvoice } from "../utils/invoice";
import { RefundType, refund } from "../utils/rescue";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import {
    type ChainSwap,
    GasAbstractionType,
    type SubmarineSwap,
} from "../utils/swapCreator";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";

export const incorrectAssetError = "incorrect asset was sent";

const assertTransactionSignerProvider = (signer: Signer | Wallet) => {
    if (signer.provider === null) {
        throw new Error("refund transaction signer requires a provider");
    }

    return signer.provider;
};

export const sendRefundTransaction = async (
    gasAbstraction: GasAbstractionType,
    transactionSigner: Signer | Wallet,
    timeoutBlockHeight: number,
    refundCooperative: () => Promise<TransactionRequest>,
    refundTimeout: () => Promise<TransactionRequest>,
): Promise<string> => {
    const provider = assertTransactionSignerProvider(transactionSigner);
    let transactionHash: string;

    try {
        const tx = await refundCooperative();
        transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx,
        );
    } catch (cooperativeError) {
        // TODO: For Arbitrum that block height is the L1 block height; we gotta fetch that
        const currentBlock = await provider.getBlockNumber();
        if (timeoutBlockHeight >= currentBlock) {
            throw cooperativeError;
        }
        log.warn(
            "cooperative refund failed, falling back to timeout refund",
            cooperativeError,
        );
        const tx = await refundTimeout();
        transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx,
        );
    }

    await provider.waitForTransaction(transactionHash, 1);
    return transactionHash;
};

export const RefundEvm = (props: {
    asset: string;
    gasAbstraction?: GasAbstractionType;
    disabled?: boolean;
    swapId?: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
    swapType?: SwapType;
    commitmentLockupTxHash?: string;
    setRefundTxId: Setter<string>;
}) => {
    const { getErc20Swap, getEtherSwap, signer, getGasAbstractionSigner } =
        useWeb3Signer();
    const { t } = useGlobalContext();

    return (
        <ContractTransaction
            disabled={props.disabled}
            asset={props.asset}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const gasAbstraction =
                    props.gasAbstraction ?? GasAbstractionType.None;
                const transactionSigner = getSignerForGasAbstraction(
                    gasAbstraction,
                    signer(),
                    getGasAbstractionSigner(props.asset),
                );
                const contractKind = getKindForAsset(props.asset);
                const tokenAddress =
                    contractKind === AssetKind.ERC20
                        ? getTokenAddress(props.asset)
                        : undefined;
                if (
                    contractKind === AssetKind.ERC20 &&
                    tokenAddress === undefined
                ) {
                    throw new Error(
                        `missing token address for asset ${props.asset}`,
                    );
                }

                const isCommitmentLockup =
                    props.commitmentLockupTxHash !== undefined;

                let refundData: {
                    amount: bigint;
                    preimageHash: string;
                    tokenAddress?: string;
                    claimAddress: string;
                    refundAddress: string;
                    timelock: bigint;
                };

                if (isCommitmentLockup) {
                    log.debug("Refunding commitment lockup");
                    const receipt =
                        await transactionSigner.provider.getTransactionReceipt(
                            props.commitmentLockupTxHash,
                        );
                    if (receipt === null) {
                        throw new Error(
                            "could not fetch commitment lockup transaction receipt",
                        );
                    }

                    const contract =
                        contractKind === AssetKind.ERC20
                            ? getErc20Swap(props.asset)
                            : getEtherSwap(props.asset);
                    const {
                        amount: lockupEventAmount,
                        tokenAddress: lockupTokenAddress,
                        claimAddress: lockupClaimAddress,
                        refundAddress: lockupRefundAddress,
                        timelock: lockupTimelock,
                        preimageHash: lockupPreimageHash,
                    } = getCommitmentLockupEvent(
                        contract,
                        receipt,
                        await contract.getAddress(),
                    );

                    refundData = {
                        amount: lockupEventAmount,
                        tokenAddress: lockupTokenAddress,
                        claimAddress: lockupClaimAddress,
                        refundAddress: lockupRefundAddress,
                        timelock: lockupTimelock,
                        preimageHash: lockupPreimageHash,
                    };
                } else {
                    refundData = {
                        preimageHash: prefix0x(props.preimageHash),
                        amount: satsToAssetAmount(props.amount, props.asset),
                        tokenAddress: tokenAddress,
                        claimAddress: props.claimAddress,
                        refundAddress: await signer().getAddress(),
                        timelock: BigInt(props.timeoutBlockHeight),
                    };
                }

                const refundCooperative = async () => {
                    if (props.swapId === undefined) {
                        throw new Error(
                            "swap id is required for cooperative refunds",
                        );
                    }

                    const { signature } = await getEipRefundSignature(
                        props.swapId,
                        props.swapType ?? SwapType.Submarine,
                    );
                    const decSignature = Signature.from(signature);

                    if (contractKind === AssetKind.ERC20) {
                        const contract = getErc20Swap(props.asset).connect(
                            transactionSigner,
                        );
                        return await contract[
                            "refundCooperative(bytes32,uint256,address,address,address,uint256,uint8,bytes32,bytes32)"
                        ].populateTransaction(
                            refundData.preimageHash,
                            refundData.amount,
                            refundData.tokenAddress,
                            refundData.claimAddress,
                            refundData.refundAddress,
                            refundData.timelock,
                            decSignature.v,
                            decSignature.r,
                            decSignature.s,
                        );
                    }

                    const contract = getEtherSwap(props.asset).connect(
                        transactionSigner,
                    );
                    return await contract[
                        "refundCooperative(bytes32,uint256,address,address,uint256,uint8,bytes32,bytes32)"
                    ].populateTransaction(
                        refundData.preimageHash,
                        refundData.amount,
                        refundData.claimAddress,
                        refundData.refundAddress,
                        refundData.timelock,
                        decSignature.v,
                        decSignature.r,
                        decSignature.s,
                    );
                };

                const refundTimeout = async () => {
                    if (contractKind === AssetKind.ERC20) {
                        const contract = getErc20Swap(props.asset).connect(
                            transactionSigner,
                        );
                        return await contract[
                            "refund(bytes32,uint256,address,address,address,uint256)"
                        ].populateTransaction(
                            refundData.preimageHash,
                            refundData.amount,
                            refundData.tokenAddress,
                            refundData.claimAddress,
                            refundData.refundAddress,
                            refundData.timelock,
                        );
                    }

                    const contract = getEtherSwap(props.asset).connect(
                        transactionSigner,
                    );
                    return await contract[
                        "refund(bytes32,uint256,address,address,uint256)"
                    ].populateTransaction(
                        refundData.preimageHash,
                        refundData.amount,
                        refundData.claimAddress,
                        refundData.refundAddress,
                        refundData.timelock,
                    );
                };

                const transactionHash = await sendRefundTransaction(
                    gasAbstraction,
                    transactionSigner,
                    props.timeoutBlockHeight,
                    refundCooperative,
                    refundTimeout,
                );
                props.setRefundTxId(transactionHash);
            }}
            address={{
                address: props.signerAddress,
                derivationPath: props.derivationPath,
            }}
            buttonText={t("refund")}
        />
    );
};

export const RefundBtc = (props: {
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId: Setter<string>;
    buttonOverride?: string;
    deriveKeyFn?: deriveKeyFn;
}) => {
    const { setRefundAddress, refundAddress, notify, t, deriveKey } =
        useGlobalContext();
    const { refundableUTXOs, failureReason } = usePayContext();

    const [timeoutEta, setTimeoutEta] = createSignal<number | null>(null);
    const [timeoutBlockheight, setTimeoutBlockheight] = createSignal<
        number | null
    >(null);

    const [valid, setValid] = createSignal<boolean>(false);
    const [refundRunning, setRefundRunning] = createSignal<boolean>(false);

    const validateRefundAddress = () => {
        if (!refundAddress()) {
            setValid(false);
            return;
        }

        const lockupAddress =
            props.swap().type === SwapType.Submarine
                ? (props.swap() as SubmarineSwap).address
                : (props.swap() as ChainSwap).lockupDetails.lockupAddress;

        if (refundAddress() === lockupAddress) {
            log.debug("refunds to lockup address are blocked");
            setValid(false);
            return;
        }

        const asset = props.swap()?.assetSend;
        if (!asset) return;

        setValid(validateAddress(asset, refundAddress()));
    };

    const refundAction = async () => {
        setRefundRunning(true);

        try {
            const refundTxId = await refund(
                props.deriveKeyFn || deriveKey,
                props.swap(),
                refundAddress(),
                refundableUTXOs(),
                failureReason() === incorrectAssetError
                    ? RefundType.AssetRescue
                    : RefundType.Cooperative,
            );

            props.setRefundTxId(refundTxId);

            setRefundAddress("");
        } catch (error) {
            log.warn("refund failed", error);
            if (typeof error === "string") {
                let msg = error;
                if (
                    msg === "bad-txns-inputs-missingorspent" ||
                    msg === "Transaction already in block chain" ||
                    msg.startsWith("insufficient fee")
                ) {
                    msg = t("already_refunded");
                } else if (
                    msg.endsWith("script-verify-flag-failed") ||
                    msg === "non-final"
                ) {
                    msg = t("locktime_not_satisfied");
                    const legacyTx = refundableUTXOs().find(
                        (tx) => tx.timeoutEta && tx.timeoutBlockHeight,
                    );
                    if (legacyTx) {
                        setTimeoutEta(legacyTx.timeoutEta);
                        setTimeoutBlockheight(legacyTx.timeoutBlockHeight);
                    }
                }
                log.error(msg);
                notify("error", msg);
            } else {
                log.error(formatError(error));
                notify("error", formatError(error));
            }
        }

        setRefundRunning(false);
    };

    const buttonMessage = createMemo(() => {
        if (refundableUTXOs()?.length === 0) {
            return t("no_lockup_transaction");
        }
        if (valid() || !refundAddress() || !props.swap()) {
            return t("refund");
        }
        return t("invalid_address", { asset: props.swap()?.assetSend });
    });

    return (
        <Show when={refundableUTXOs()} fallback={<LoadingSpinner />}>
            <Show when={timeoutEta() > 0 || timeoutBlockheight() > 0}>
                <RefundEta
                    timeoutEta={timeoutEta}
                    timeoutBlockHeight={timeoutBlockheight}
                    refundableAsset={props.swap().assetSend}
                />
            </Show>
            <Show when={refundableUTXOs().length > 0}>
                <h3 style={{ color: "var(--color-text)" }}>
                    {props.swap()
                        ? t("refund_address_header", {
                              asset: props.swap()?.assetSend,
                          })
                        : t("refund_address_header_no_asset")}
                </h3>
                <input
                    data-testid="refundAddress"
                    id="refundAddress"
                    value={refundAddress()}
                    onInput={(e) => {
                        setRefundAddress(e.target.value.trim());
                        validateRefundAddress();
                    }}
                    disabled={refundRunning()}
                    type="text"
                    name="refundAddress"
                    placeholder={
                        props.swap()
                            ? t("onchain_address", {
                                  asset: props.swap()?.assetSend,
                              })
                            : t("onchain_address_no_asset")
                    }
                />
            </Show>
            <Show
                when={!props.buttonOverride && refundableUTXOs().length === 0}>
                <p class="frame-text">{t("refresh_for_refund")}</p>
            </Show>
            <button
                data-testid="refundButton"
                class="btn"
                disabled={!valid() || refundRunning()}
                onClick={() => refundAction()}>
                {refundRunning() ? (
                    <LoadingSpinner class="inner-spinner" />
                ) : (
                    (props.buttonOverride ?? buttonMessage())
                )}
            </button>
        </Show>
    );
};

const RefundButton = (props: {
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId: Setter<string>;
    buttonOverride?: string;
    deriveKeyFn?: deriveKeyFn;
}) => {
    const [preimageHash] = createResource(async () => {
        return (await decodeInvoice((props.swap() as SubmarineSwap).invoice))
            .preimageHash;
    });

    return (
        <Show
            when={
                props.swap() === null ||
                props.swap() === undefined ||
                !isEvmAsset(props.swap().assetSend)
            }
            fallback={
                <Show
                    when={props.swap().type === SwapType.Submarine}
                    fallback={
                        <RefundEvm
                            swapId={props.swap().id}
                            gasAbstraction={props.swap().gasAbstraction}
                            signerAddress={props.swap().signer}
                            derivationPath={props.swap().derivationPath}
                            amount={
                                (props.swap() as ChainSwap).lockupDetails.amount
                            }
                            claimAddress={
                                (props.swap() as ChainSwap).lockupDetails
                                    .claimAddress
                            }
                            timeoutBlockHeight={
                                (props.swap() as ChainSwap).lockupDetails
                                    .timeoutBlockHeight
                            }
                            swapType={SwapType.Chain}
                            preimageHash={hex.encode(
                                sha256(
                                    hex.decode(
                                        (props.swap() as ChainSwap).preimage,
                                    ),
                                ),
                            )}
                            setRefundTxId={props.setRefundTxId}
                            asset={props.swap().assetSend}
                            commitmentLockupTxHash={
                                props.swap().commitmentLockupTxHash
                            }
                        />
                    }>
                    <Show
                        when={!preimageHash.loading}
                        fallback={<LoadingSpinner />}>
                        <RefundEvm
                            swapId={props.swap().id}
                            gasAbstraction={props.swap().gasAbstraction}
                            signerAddress={props.swap().signer}
                            claimAddress={props.swap().claimAddress}
                            derivationPath={props.swap().derivationPath}
                            amount={
                                (props.swap() as SubmarineSwap).expectedAmount
                            }
                            timeoutBlockHeight={
                                (props.swap() as SubmarineSwap)
                                    .timeoutBlockHeight
                            }
                            swapType={SwapType.Submarine}
                            preimageHash={preimageHash()}
                            setRefundTxId={props.setRefundTxId}
                            asset={props.swap().assetSend}
                            commitmentLockupTxHash={
                                props.swap().commitmentLockupTxHash
                            }
                        />
                    </Show>
                </Show>
            }>
            <RefundBtc {...props} />
        </Show>
    );
};

export default RefundButton;
