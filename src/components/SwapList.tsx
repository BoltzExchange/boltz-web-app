import { useNavigate } from "@solidjs/router";
import { BiRegularTrash } from "solid-icons/bi";
import { Accessor, For, Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";
import { SomeSwap } from "../utils/swapCreator";
import { SwapIcons } from "./SwapIcons";

const SwapList = (props: {
    swapsSignal: Accessor<SomeSwap[]>;
    action: string;
    onDelete?: () => Promise<unknown>;
}) => {
    const navigate = useNavigate();
    const { deleteSwap, t } = useGlobalContext();
    const [sortedSwaps, setSortedSwaps] = createSignal<SomeSwap[]>([]);
    const [lastSwap, setLastSwap] = createSignal();

    createEffect(() => {
        const sorted = props
            .swapsSignal()
            .sort((a: SomeSwap, b: SomeSwap) =>
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

    const deleteSwapAction = async (e: Event, swapId: string) => {
        e.stopPropagation();
        e.preventDefault();
        if (confirm(t("delete_storage_single_swap", { id: swapId }))) {
            await deleteSwap(swapId);
            await props.onDelete();
        }
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
                                {props.action}
                            </a>
                            <SwapIcons swap={swap} />
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;
                                <span class="monospace">{swap.id}</span>
                            </span>
                            <span class="swaplist-asset-date">
                                {t("created")}:&nbsp;
                                <span class="monospace">
                                    {formatDate(swap.date)}
                                </span>
                            </span>
                            <Show when={props.onDelete !== undefined}>
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
