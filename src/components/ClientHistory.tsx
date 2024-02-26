import { useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { Match, Show, Switch } from "solid-js";
import { client } from "src/utils/client/api";

import { useGlobalContext } from "../context/Global";
import SwapList from "./SwapList";

const ClientHistory = () => {
    const navigate = useNavigate();

    const { t } = useGlobalContext();

    const query = createQuery(() => ({
        queryKey: ["swaps"],
        queryFn: async () => {
            const data = await client()["/v1/listswaps"].get();

            const transform = (swap, reverse) => {
                return {
                    ...swap,
                    asset: reverse ? swap.pair.to : swap.pair.from,
                    reverse,
                    date: swap.createdAt * 1000,
                };
            };

            const swaps = data.swaps.map((swap) => transform(swap, false));
            swaps.concat(
                data.reverseSwaps.map((swap) => transform(swap, true)),
            );

            console.log(swaps);
            return swaps;
        },
    }));

    return (
        <div id="history">
            <div class="frame">
                <h2>{t("refund_past_swaps")}</h2>
                <hr />
                <Switch>
                    <Match when={query.isSuccess}>
                        <Show
                            when={query.data.length > 0}
                            fallback={
                                <div>
                                    <p>{t("history_no_swaps")}</p>
                                    <button
                                        class="btn"
                                        onClick={() => navigate("/swap")}>
                                        {t("new_swap")}
                                    </button>
                                </div>
                            }>
                            <SwapList
                                swapsSignal={() => query.data}
                                deleteSwap={(swapId) => {
                                    console.log("delete", swapId);
                                }}
                            />
                            <hr />
                        </Show>
                    </Match>
                </Switch>
            </div>
        </div>
    );
};
export default ClientHistory;
