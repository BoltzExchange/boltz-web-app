import { useParams } from "@solidjs/router";
import { OutputType } from "boltz-core";
import log from "loglevel";
import type { Accessor } from "solid-js";
import { Show, createResource, createSignal, onCleanup } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import RefundButton from "../components/RefundButton";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useRescueContext } from "../context/Rescue";
import type { ChainSwapDetails, RestorableSwap } from "../utils/boltzClient";
import { getSwapStatus } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { getRefundableUTXOs } from "../utils/rescue";
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

    const { t } = useGlobalContext();
    const {
        swap,
        setSwap,
        setSwapStatus,
        setSwapStatusTransaction,
        setFailureReason,
        setRefundableUTXOs,
    } = usePayContext();
    const { rescuableSwaps, rescueFile } = useRescueContext();

    const rescuableSwap = () =>
        mapSwap(rescuableSwaps().find((swap) => swap.id === params.id));

    const [refundTxId, setRefundTxId] = createSignal<string>("");

    createResource(async () => {
        if (rescuableSwap()) {
            const res = await getSwapStatus(rescuableSwap().id);
            log.debug("selecting swap", rescuableSwap());
            setSwap(rescuableSwap() as SomeSwap);
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction);
            setFailureReason(res.failureReason);

            const utxos = await getRefundableUTXOs(rescuableSwap() as SomeSwap);
            setRefundableUTXOs(utxos);
        }
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
                <h2>{t("refund_swap")}</h2>

                <Show when={refundTxId() === ""}>
                    <hr />
                    <RefundButton
                        swap={swap as Accessor<SubmarineSwap | ChainSwap>}
                        setRefundTxId={setRefundTxId}
                        deriveKeyFn={(index: number) =>
                            ECPair.fromPrivateKey(
                                Buffer.from(
                                    deriveKey(rescueFile(), index).privateKey,
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
            </Show>
        </div>
    );
};

export default RefundRescue;
