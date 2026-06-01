import { useNavigate } from "@solidjs/router";
import type { LogRefundData, RskRescueMode } from "boltz-swaps/types";
import { type Accessor, For, Show, createMemo } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/swaplist.scss";
import { cropString } from "../utils/helper";
import { SwapListAssetIcon } from "./SwapIcons";

const SwapListLogs = (props: {
    swaps: Accessor<LogRefundData[]>;
    action: RskRescueMode;
}) => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();

    const sortedSwaps = createMemo(() => {
        return props.swaps().sort((a, b) => {
            return a.blockNumber - b.blockNumber;
        });
    });

    return (
        <div class="swaplist">
            <hr />
            <For each={sortedSwaps()}>
                {(swap, index) => (
                    <>
                        <div
                            class="swaplist-item"
                            onClick={() =>
                                navigate(
                                    `/swap/rescue/evm/${swap.asset}/${swap.transactionHash}/${props.action}`,
                                )
                            }>
                            <a class="btn-small hidden-mobile" href="#">
                                {t("view")}
                            </a>
                            <span class="swaplist-asset swaplist-asset-single">
                                <SwapListAssetIcon asset={swap.asset} />
                            </span>
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;
                                <span class="monospace">
                                    {cropString(swap.transactionHash, 15, 5)}
                                </span>
                            </span>
                            <span class="swaplist-asset-date">
                                {t("created")}:&nbsp;
                                <span class="monospace">
                                    {`${t("block")} ${swap.blockNumber}`}
                                </span>
                            </span>
                        </div>
                        <Show when={index() < sortedSwaps().length - 1}>
                            <hr />
                        </Show>
                    </>
                )}
            </For>
        </div>
    );
};

export default SwapListLogs;
