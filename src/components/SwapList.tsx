import { useNavigate } from "@solidjs/router";
import { Accessor, For, Show, createMemo, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";

const SwapList = ({
    swapsSignal,
    deleteSwap,
}: {
    swapsSignal: Accessor<any[]>;
    deleteSwap?: (swapId: string) => void;
}) => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();
    const [sortedSwaps, setSortedSwaps] = createSignal([]);
    const [lastSwap, setLastSwap] = createSignal();

    createMemo(() => {
        const sorted = swapsSignal().sort((a: any, b: any) =>
            a.date > b.date ? -1 : a.date === b.date ? 0 : 1,
        );
        setSortedSwaps(sorted);
        setLastSwap(sorted[sorted.length - 1]);
    });

    const formatDate = (d: number) => {
        const date = new Date();
        date.setTime(d);
        return date.toLocaleDateString();
    };

    return (
        <div id="swaplist">
            <For each={sortedSwaps()}>
                {(swap) => (
                    <>
                        <div class="swaplist-item">
                            <span
                                class="btn-small"
                                onClick={() => navigate("/swap/" + swap.id)}>
                                {t("view")}
                            </span>
                            <span
                                data-reverse={swap.reverse}
                                data-asset={swap.asset}
                                class="swaplist-asset">
                                -&gt;
                            </span>
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;{swap.id}
                            </span>
                            <span class="swaplist-asset-date">
                                {t("created")}:&nbsp;{formatDate(swap.date)}
                            </span>
                            <Show when={deleteSwap}>
                                <span
                                    class="btn-small btn-danger"
                                    onClick={() => deleteSwap(swap.id)}>
                                    {t("delete")}
                                </span>
                            </Show>
                        </div>
                        <Show when={lastSwap() !== swap}>
                            <hr />
                        </Show>
                    </>
                )}
            </For>
        </div>
    );
};

export default SwapList;
