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
import type { RescuableSwap } from "../utils/boltzClient";
import { getSwapStatus } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { getRefundableUTXOs } from "../utils/refund";
import { deriveKey } from "../utils/rescueFile";
import type { ChainSwap, SubmarineSwap } from "../utils/swapCreator";

export const mapSwap = (
    swap?: RescuableSwap,
): SubmarineSwap | ChainSwap | undefined => {
    if (swap === undefined) {
        return undefined;
    }

    if (swap.type === SwapType.Submarine) {
        return {
            ...swap,
            swapTree: swap.tree,
            assetSend: swap.symbol,
            version: OutputType.Taproot,
            address: swap.lockupAddress,
            refundPrivateKeyIndex: swap.keyIndex,
            claimPublicKey: swap.serverPublicKey,
        } as Partial<SubmarineSwap> as SubmarineSwap;
    } else if (swap.type === SwapType.Chain) {
        return {
            ...swap,
            assetSend: swap.symbol,
            version: OutputType.Taproot,
            refundPrivateKeyIndex: swap.keyIndex,
            lockupDetails: {
                swapTree: swap.tree,
                blindingKey: swap.blindingKey,
                lockupAddress: swap.lockupAddress,
                serverPublicKey: swap.serverPublicKey,
            } as Partial<ChainSwap["lockupDetails"]>,
        } as Partial<ChainSwap> as ChainSwap;
    }

    return undefined;
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
            setSwap(rescuableSwap());
            setSwapStatus(res.status);
            setSwapStatusTransaction(res.transaction);
            setFailureReason(res.failureReason);

            const utxos = await getRefundableUTXOs(rescuableSwap());
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
