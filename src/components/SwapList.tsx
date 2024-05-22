import { BiRegularTrash } from "solid-icons/bi";
import { Accessor, For, Show, createMemo, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";

const SwapList = ({
    swapsSignal,
    onDelete,
}: {
    swapsSignal: Accessor<any[]>;
    onDelete?: () => Promise<any>;
}) => {
    const { deleteSwap, t } = useGlobalContext();
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
        let date = new Date();
        date.setTime(d);
        return date.toLocaleDateString();
    };

    const deleteSwapAction = async (swapId: string) => {
        if (confirm(t("delete_storage_single_swap", { id: swapId }))) {
            await deleteSwap(swapId);
            await onDelete();
        }
    };

    return (
        <div id="swaplist">
            <For each={sortedSwaps()}>
                {(swap) => (
                    <>
                        <div class="swaplist-item">
                            <a class="btn-small" href={`/swap/${swap.id}`}>
                                {t("view")}
                            </a>
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
                            <Show when={onDelete !== undefined}>
                                <span
                                    class="btn-small btn-danger"
                                    onClick={() => deleteSwapAction(swap.id)}>
                                    <BiRegularTrash size={14} />
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
