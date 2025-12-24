import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { OutputType } from "boltz-core";
import log from "loglevel";
import type { Accessor } from "solid-js";
import {
    Match,
    Show,
    Switch,
    createResource,
    createSignal,
    onCleanup,
} from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import RefundButton from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import { type RefundableAssetType } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useRescueContext } from "../context/Rescue";
import type { ChainSwapDetails, RestorableSwap } from "../utils/boltzClient";
import { getSwapStatus } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import {
    getCurrentBlockHeight,
    getRescuableUTXOs,
    getTimeoutEta,
} from "../utils/rescue";
import { deriveKey } from "../utils/rescueFile";
import type { ChainSwap, SomeSwap, SubmarineSwap } from "../utils/swapCreator";

export const mapSwap = (
    swap?: RestorableSwap,
): Partial<SomeSwap> | undefined => {
    if (swap === undefined) {
        return undefined;
    }

    switch (swap.type) {
        case SwapType.Submarine:
            return {
                ...swap,
                swapTree: swap.refundDetails.tree,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                blindingKey: swap.refundDetails.blindingKey,
                address: swap.refundDetails.lockupAddress,
                refundPrivateKeyIndex: swap.refundDetails.keyIndex,
                claimPublicKey: swap.refundDetails.serverPublicKey,
                timeoutBlockHeight: swap.refundDetails.timeoutBlockHeight,
            };
        case SwapType.Chain:
            return {
                ...swap,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                address: swap.claimDetails?.lockupAddress, // RSK doesn't have claimDetails yet
                refundPrivateKeyIndex: swap.refundDetails.keyIndex,
                claimPublicKey: swap.claimDetails?.serverPublicKey,
                claimPrivateKeyIndex: swap.claimDetails?.keyIndex,
                timeoutBlockHeight: swap.refundDetails.timeoutBlockHeight,
                lockupDetails: {
                    ...swap.refundDetails,
                    swapTree: swap.refundDetails.tree,
                } as ChainSwapDetails,
            };
        case SwapType.Reverse:
            return {
                ...swap,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                address: swap.claimDetails.lockupAddress,
                timeoutBlockHeight: swap.claimDetails.timeoutBlockHeight,
                claimPublicKey: swap.claimDetails.serverPublicKey,
                claimPrivateKeyIndex: swap.claimDetails.keyIndex,
                sendAmount: swap.claimDetails.amount,
            };
        default:
            return undefined;
    }
};

const RefundRescue = () => {
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation<{
        waitForSwapTimeout?: boolean | undefined;
    }>();

    const { t, notify } = useGlobalContext();
    const {
        swap,
        setSwap,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setRefundableUTXOs,
        setShouldIgnoreBackendStatus,
    } = usePayContext();
    const { rescuableSwaps, rescueFile } = useRescueContext();

    const [waitForSwapTimeout, setWaitForTimeout] = createSignal<boolean>(
        location.state?.waitForSwapTimeout ?? false,
    );

    const rescuableSwap = () =>
        mapSwap(rescuableSwaps().find((swap) => swap.id === params.id));

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockHeight, setTimeoutBlockHeight] = createSignal<number>(0);
    const [refundTxId, setRefundTxId] = createSignal<string>("");
    const [loading, setLoading] = createSignal<boolean>(false);

    createResource(async () => {
        try {
            if (rescuableSwap()) {
                setLoading(true);
                try {
                    setSwap(rescuableSwap() as SomeSwap);
                    log.debug("selecting swap", rescuableSwap());
                    const res = await getSwapStatus(rescuableSwap().id);
                    setSwapStatus(res.status);
                    setSwapStatusTransaction(res.transaction);
                    setFailureReason(res.failureReason);
                } catch (e) {
                    log.error(
                        `failed to get swap status for swap ${swap().id}:`,
                        e,
                    );
                }

                // For uncooperative swaps, we don't rely on backend for status updates
                setShouldIgnoreBackendStatus(waitForSwapTimeout());

                const utxos = await getRescuableUTXOs(
                    rescuableSwap() as SomeSwap,
                );

                if (utxos.length === 0) {
                    throw new Error(
                        `failed to get refundable UTXOs for swap ${swap().id}`,
                    );
                }

                setRefundableUTXOs(utxos);

                if (waitForSwapTimeout()) {
                    try {
                        const currentBlockHeight: number = (
                            await getCurrentBlockHeight([
                                rescuableSwap() as SomeSwap,
                            ])
                        )?.[rescuableSwap().assetSend];

                        const timeoutBlockHeight = (
                            rescuableSwap() as RestorableSwap
                        ).refundDetails.timeoutBlockHeight;

                        const timeoutEta = getTimeoutEta(
                            rescuableSwap().assetSend as RefundableAssetType,
                            timeoutBlockHeight,
                            currentBlockHeight,
                        );

                        setTimeoutEta(timeoutEta);
                        setTimeoutBlockHeight(timeoutBlockHeight);
                    } catch (e) {
                        log.error(
                            `failed to get uncooperative timeout ETA for swap ${swap().id}:`,
                            e,
                        );
                        // if we can't obtain block height data because 3rd party explorer is down, we allow the user to attempt an uncoop refund anyway
                        setWaitForTimeout(false);
                    }
                }
            }
        } catch (e) {
            log.error(e);
            notify("error", t("get_refundable_error"));
        } finally {
            setLoading(false);
        }
    });

    onCleanup(() => {
        log.debug("cleanup RefundRescue");
        setRefundableUTXOs([]);
        setShouldIgnoreBackendStatus(false);
    });

    return (
        <div class="frame">
            <Show
                when={rescuableSwap() !== undefined}
                fallback={<h2>{t("pay_swap_404")}</h2>}>
                <Show when={!loading()} fallback={<LoadingSpinner />}>
                    <h2>{t("refund_swap")}</h2>

                    <Switch>
                        <Match when={waitForSwapTimeout()}>
                            <hr />
                            <RefundEta
                                timeoutEta={timeoutEta}
                                timeoutBlockHeight={timeoutBlockHeight}
                                refundableAsset={swap().assetSend}
                            />
                            <BlockExplorer
                                asset={swap().assetSend}
                                txId={swap().lockupTx}
                                address={
                                    swap().type === SwapType.Submarine
                                        ? (swap() as SubmarineSwap).address
                                        : (swap() as ChainSwap).lockupDetails
                                              .lockupAddress
                                }
                            />
                            <button
                                class="btn btn-light"
                                data-testid="backBtn"
                                onClick={() => {
                                    navigate(-1);
                                }}>
                                {t("back")}
                            </button>
                        </Match>
                        <Match when={!waitForSwapTimeout()}>
                            <Show when={refundTxId() === ""}>
                                <hr />
                                <RefundButton
                                    swap={
                                        swap as Accessor<
                                            SubmarineSwap | ChainSwap
                                        >
                                    }
                                    setRefundTxId={setRefundTxId}
                                    deriveKeyFn={(index: number) =>
                                        ECPair.fromPrivateKey(
                                            Buffer.from(
                                                deriveKey(rescueFile(), index)
                                                    .privateKey,
                                            ),
                                        )
                                    }
                                />
                            </Show>
                            <Show when={refundTxId() !== ""}>
                                <hr />
                                <p>{t("refunded")}</p>
                                <hr />
                                <BlockExplorer
                                    typeLabel={"refund_tx"}
                                    asset={rescuableSwap().assetSend}
                                    txId={refundTxId()}
                                />
                            </Show>
                        </Match>
                    </Switch>
                </Show>
            </Show>
        </div>
    );
};

export default RefundRescue;
