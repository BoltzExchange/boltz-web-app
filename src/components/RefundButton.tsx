import { crypto } from "bitcoinjs-lib";
import type { TransactionResponse } from "ethers";
import { Signature } from "ethers";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";
import type { Accessor, Setter } from "solid-js";
import { Show, createMemo, createResource, createSignal } from "solid-js";

import RefundEta from "../components/RefundEta";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { deriveKeyFn } from "../context/Global";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { getEipRefundSignature } from "../utils/boltzClient";
import { getAddress, getNetwork } from "../utils/compat";
import { formatError } from "../utils/errors";
import { decodeInvoice } from "../utils/invoice";
import { RefundType, refund } from "../utils/rescue";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";

export const incorrectAssetError = "incorrect asset was sent";

export const RefundEvm = (props: {
    disabled?: boolean;
    swapId?: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
    setRefundTxId: Setter<string>;
}) => {
    const { getEtherSwap, signer } = useWeb3Signer();
    const { t } = useGlobalContext();

    return (
        <ContractTransaction
            disabled={props.disabled}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const contract = getEtherSwap();

                let tx: TransactionResponse;

                if (
                    props.timeoutBlockHeight <
                    (await signer().provider.getBlockNumber())
                ) {
                    tx = await contract[
                        "refund(bytes32,uint256,address,uint256)"
                    ](
                        prefix0x(props.preimageHash),
                        satoshiToWei(props.amount),
                        props.claimAddress,
                        props.timeoutBlockHeight,
                    );
                } else {
                    const { signature } = await getEipRefundSignature(
                        props.preimageHash,
                        // The endpoints for submarine and chain swap call the same endpoint
                        SwapType.Submarine,
                    );
                    const decSignature = Signature.from(signature);

                    tx = await contract[
                        "refundCooperative(bytes32,uint256,address,uint256,uint8,bytes32,bytes32)"
                    ](
                        prefix0x(props.preimageHash),
                        satoshiToWei(props.amount),
                        props.claimAddress,
                        props.timeoutBlockHeight,
                        decSignature.v,
                        decSignature.r,
                        decSignature.s,
                    );
                }

                props.setRefundTxId(tx.hash);

                await tx.wait(1);
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

        try {
            getAddress(asset).toOutputScript(
                refundAddress(),
                getNetwork(asset) as LiquidNetwork,
            );
            setValid(true);
        } catch (e) {
            log.debug("parsing refund address failed", e);
            setValid(false);
        }
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
                props.swap().assetSend !== RBTC
            }
            fallback={
                <Show
                    when={props.swap().type === SwapType.Submarine}
                    fallback={
                        <RefundEvm
                            swapId={props.swap().id}
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
                            preimageHash={crypto
                                .sha256(
                                    Buffer.from(
                                        (props.swap() as ChainSwap).preimage,
                                        "hex",
                                    ),
                                )
                                .toString("hex")}
                            setRefundTxId={props.setRefundTxId}
                        />
                    }>
                    <Show
                        when={!preimageHash.loading}
                        fallback={<LoadingSpinner />}>
                        <RefundEvm
                            swapId={props.swap().id}
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
                            preimageHash={preimageHash()}
                            setRefundTxId={props.setRefundTxId}
                        />
                    </Show>
                </Show>
            }>
            <RefundBtc {...props} />
        </Show>
    );
};

export default RefundButton;
