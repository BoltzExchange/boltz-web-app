import { useNavigate } from "@solidjs/router";
import { BiRegularTrash } from "solid-icons/bi";
import type { Accessor } from "solid-js";
import { For, Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";
import type { RestorableSwap } from "../utils/boltzClient";
import { RescueAction, RescueNoAction } from "../utils/rescue";
import type { SomeSwap } from "../utils/swapCreator";
import { desktopItemsPerPage, mobileItemsPerPage } from "./Pagination";
import { SwapIcons } from "./SwapIcons";
import { hiddenInformation } from "./settings/PrivacyMode";

export type Swap = (SomeSwap | RestorableSwap) & {
    action?: RescueAction;
    timedOut?: boolean;
    waitForSwapTimeout?: boolean;
};

const getSwapDate = <T extends Swap>(swap: T) => {
    if ("date" in swap) {
        return swap.date;
    }

    return swap.createdAt * 1_000;
};

export const sortSwaps = <T extends Swap>(swaps: T[]) => {
    const actionPriority: Record<RescueAction, number> = {
        [RescueAction.Claim]: 0,
        [RescueAction.Refund]: 0,
        [RescueAction.Failed]: 1,
        [RescueAction.Pending]: 1,
        [RescueAction.Successful]: 1,
    };

    return swaps.sort((a, b) => {
        const aPriority = actionPriority[a.action];
        const bPriority = actionPriority[b.action];

        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }

        // Within the same priority group, sort by date descending
        const aDate = getSwapDate(a);
        const bDate = getSwapDate(b);
        return aDate > bDate ? -1 : aDate === bDate ? 0 : 1;
    });
};

// to avoid layout shift when changing pages
export const getSwapListHeight = (swaps: SomeSwap[], isMobile: boolean) => {
    if (isMobile) {
        return {
            "min-height":
                swaps.length > mobileItemsPerPage
                    ? `${45 * mobileItemsPerPage}px`
                    : "auto",
        };
    }

    return {
        "min-height":
            swaps.length > desktopItemsPerPage
                ? `${45 * desktopItemsPerPage}px`
                : "auto",
    };
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
    const { deleteSwap, t, privacyMode } = useGlobalContext();
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
        if (
            confirm(
                t("delete_storage_single_swap", {
                    id: privacyMode() ? hiddenInformation : swapId,
                }),
            )
        ) {
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
                            class={`swaplist-item ${
                                RescueNoAction.includes(swap.action)
                                    ? "disabled"
                                    : ""
                            }`}
                            onClick={() => {
                                if (RescueNoAction.includes(swap.action)) {
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
                                <Show
                                    when={!privacyMode()}
                                    fallback={hiddenInformation}>
                                    <span class="monospace">{swap.id}</span>
                                </Show>
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
                                    data-testid={`delete-swap-${swap.id}`}
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
