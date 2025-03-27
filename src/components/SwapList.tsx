import { useNavigate } from "@solidjs/router";
import { BiRegularTrash } from "solid-icons/bi";
import { Accessor, For, Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";
import type { RescuableSwap } from "../utils/boltzClient";
import { SomeSwap } from "../utils/swapCreator";
import { SwapIcons } from "./SwapIcons";

type Swap = (SomeSwap | RescuableSwap) & { disabled?: boolean };

const getSwapDate = <T extends Swap>(swap: T) => {
    if ("date" in swap) {
        return swap.date;
    }

    return swap.createdAt * 1_000;
};

export const sortSwaps = <T extends Swap>(swaps: T[]) => {
    return swaps.sort((a, b) => {
        const aDate = getSwapDate(a);
        const bDate = getSwapDate(b);

        if (a.disabled !== b.disabled) {
            return a.disabled ? 1 : -1;
        }

        // Within each group (disabled/enabled), sort by date descending
        return aDate > bDate ? -1 : aDate === bDate ? 0 : 1;
    });
};

const SwapList = (props: {
    swapsSignal: Accessor<Swap[]>;
    action: (swap: Swap) => string;
    onDelete?: () => Promise<unknown>;
    onClick?: (swap: Swap) => void;
    surroundingSeparators?: boolean;
    hideStatusOnMobile?: boolean;
    hideDateOnMobile?: boolean;
}) => {
    const navigate = useNavigate();
    const { deleteSwap, t } = useGlobalContext();
    const [sortedSwaps, setSortedSwaps] = createSignal<Swap[]>([]);
    const [lastSwap, setLastSwap] = createSignal();

    createEffect(() => {
        const sorted = sortSwaps(props.swapsSignal());
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
            <Show when={props.surroundingSeparators ?? true}>
                <hr />
            </Show>
            <For each={sortedSwaps()}>
                {(swap) => (
                    <>
                        <div
                            data-testid={`swaplist-item-${swap.id}`}
                            class={`swaplist-item ${swap.disabled ? "disabled" : ""}`}
                            onClick={() => {
                                if (swap.disabled) {
                                    return;
                                }

                                if (props.onClick) {
                                    props.onClick(swap);
                                } else {
                                    navigate(`/swap/${swap.id}`);
                                }
                            }}>
                            <a
                                class={`btn-small ${props.hideStatusOnMobile ? "hidden-mobile" : ""}`}
                                href="#">
                                {props.action(swap)}
                            </a>
                            <SwapIcons swap={swap} />
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;
                                <span class="monospace">{swap.id}</span>
                            </span>
                            <span
                                class={`swaplist-asset-date ${props.hideDateOnMobile ? "hidden-mobile" : ""}`}>
                                {t("created")}:&nbsp;
                                <span class="monospace">
                                    {formatDate(getSwapDate(swap))}
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
            <Show when={props.surroundingSeparators ?? true}>
                <hr />
            </Show>
        </div>
    );
};

export default SwapList;
