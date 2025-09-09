import { useLocation, useParams } from "@solidjs/router";
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
    getRefundableUTXOs,
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
            };
        case SwapType.Chain:
            return {
                ...swap,
                assetSend: swap.from,
                assetReceive: swap.to,
                version: OutputType.Taproot,
                address: swap.claimDetails.lockupAddress,
                refundPrivateKeyIndex: swap.refundDetails.keyIndex,
                claimPublicKey: swap.claimDetails.serverPublicKey,
                claimPrivateKeyIndex: swap.claimDetails.keyIndex,
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
    const location = useLocation<{
        waitForSwapTimeout?: boolean | undefined;
    }>();
    const waitForSwapTimeoutState = location.state?.waitForSwapTimeout ?? false;

    const { t } = useGlobalContext();
    const {
        swap,
        setSwap,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setRefundableUTXOs,
        waitForSwapTimeout,
        setWaitForSwapTimeout,
    } = usePayContext();
    const { rescuableSwaps, rescueFile } = useRescueContext();

    const rescuableSwap = () =>
        mapSwap(rescuableSwaps().find((swap) => swap.id === params.id));

    const [timeoutEta, setTimeoutEta] = createSignal<number>(0);
    const [timeoutBlockHeight, setTimeoutBlockHeight] = createSignal<number>(0);
    const [refundTxId, setRefundTxId] = createSignal<string>("");
    const [loading, setLoading] = createSignal<boolean>(false);

    createResource(async () => {
        setLoading(true);
        if (rescuableSwap()) {
            const res = await getSwapStatus(rescuableSwap().id);
            log.debug("selecting swap", rescuableSwap());
            setSwap(rescuableSwap() as SomeSwap);
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction);
            setFailureReason(res.failureReason);
            setWaitForSwapTimeout(waitForSwapTimeoutState);

            const utxos = await getRefundableUTXOs(rescuableSwap() as SomeSwap);
            setRefundableUTXOs(utxos);

            if (waitForSwapTimeout()) {
                try {
                    const currentBlockHeight = (
                        await getCurrentBlockHeight([
                            rescuableSwap() as SomeSwap,
                        ])
                    )?.[rescuableSwap().assetSend];

                    const timeoutBlockHeight = (
                        rescuableSwap() as RestorableSwap
                    ).refundDetails.timeoutBlockHeight;

                    const timeoutEta = getTimeoutEta({
                        asset: rescuableSwap().assetSend as RefundableAssetType,
                        currentBlockHeight,
                        timeoutBlockHeight,
                    });

                    setTimeoutEta(timeoutEta);
                    setTimeoutBlockHeight(timeoutBlockHeight);
                } catch (e) {
                    log.error(
                        `failed to get uncooperative timeout ETA for swap ${swap().id}:`,
                        e,
                    );
                    // if we can't obtain block height data because 3rd party explorer is down, we allow the user to attempt an uncoop refund anyway
                    setWaitForSwapTimeout(false);
                } finally {
                    setLoading(false);
                }
            }
        }
        setLoading(false);
    });

    onCleanup(() => {
        log.debug("cleanup RefundRescue");
        setRefundableUTXOs([]);
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
                            />
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
