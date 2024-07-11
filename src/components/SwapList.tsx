import { useNavigate } from "@solidjs/router";
import { BiRegularTrash } from "solid-icons/bi";
import { Accessor, For, Show, createMemo, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";
import { SwapIcons } from "./SwapIcons";

const SwapList = ({
    swapsSignal,
    onDelete,
}: {
    swapsSignal: Accessor<any[]>;
    onDelete?: () => Promise<any>;
}) => {
    const navigate = useNavigate();
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

    const deleteSwapAction = async (e: Event, swapId: string) => {
        if (confirm(t("delete_storage_single_swap", { id: swapId }))) {
            await deleteSwap(swapId);
            await onDelete();
        }
        e.stopPropagation();
    };

    return (
        <div id="swaplist">
            <hr />
            <For each={sortedSwaps()}>
                {(swap) => (
                    <>
                        <div
                            class="swaplist-item"
                            onClick={() => navigate(`/swap/${swap.id}`)}>
                            <a class="btn-small hidden-mobile" href="#">
                                {t("view")}
                            </a>
                            <SwapIcons swap={swap} />
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;{swap.id}
                            </span>
                            <span class="swaplist-asset-date">
                                {t("created")}:&nbsp;{formatDate(swap.date)}
                            </span>
                            <Show when={onDelete !== undefined}>
                                <span
                                    class="btn-small btn-danger hidden-mobile"
                                    onClick={(e) =>
                                        deleteSwapAction(e, swap.id)
                                    }>
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
            <hr />
        </div>
    );
};

export default SwapList;
