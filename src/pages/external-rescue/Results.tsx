import BigNumber from "bignumber.js";
import { getGasAbstractionSweepDisplayAmount } from "boltz-swaps/evm";
import { For, Match, Show, Switch } from "solid-js";

import LoadingSpinner from "../../components/LoadingSpinner";
import Pagination, {
    desktopItemsPerPage,
    mobileItemsPerPage,
} from "../../components/Pagination";
import { SwapIcons, SwapListAssetIcon } from "../../components/SwapIcons";
import { getSwapListHeight } from "../../components/SwapList";
import { hiddenInformation } from "../../components/settings/PrivacyMode";
import { useGlobalContext } from "../../context/Global";
import { formatAmount, formatDenomination } from "../../utils/denomination";
import type { GasAbstractionSweep } from "../../utils/gasAbstractionSweep";
import { cropString, isMobile } from "../../utils/helper";
import { RescueAction } from "../../utils/rescue";
import type { SomeSwap } from "../../utils/swapCreator";
import { getSwapDate } from "./scan";
import {
    BtcSearchState,
    RescueResultSource,
    type UnifiedRescueResult,
} from "./types";
import type { ExternalRescueSearch } from "./useExternalRescueSearch";

const EvmAssetIcon = (props: { asset: string }) => (
    <span class="swaplist-asset swaplist-asset-single">
        <SwapListAssetIcon asset={props.asset} />
    </span>
);

const resultActionLabel = (
    action: RescueAction,
    t: ReturnType<typeof useGlobalContext>["t"],
) => {
    switch (action) {
        case RescueAction.Pending:
            return t("in_progress");
        case RescueAction.Claim:
            return t("claim");
        case RescueAction.Refund:
            return t("refund");
        case RescueAction.Failed:
            return t("failed");
        case RescueAction.Successful:
        default:
            return t("completed");
    }
};

const getSweepAmount = (
    sweep: GasAbstractionSweep,
    denomination: ReturnType<typeof useGlobalContext>["denomination"],
    separator: ReturnType<typeof useGlobalContext>["separator"],
) =>
    formatAmount(
        new BigNumber(getGasAbstractionSweepDisplayAmount(sweep).toString()),
        denomination(),
        separator(),
        sweep.asset,
    );

const resultDetailLabel = (
    result: UnifiedRescueResult,
    t: ReturnType<typeof useGlobalContext>["t"],
) => {
    if (result.source === RescueResultSource.Evm) {
        return t("block");
    }

    return result.source === RescueResultSource.Sweep
        ? t("balance")
        : t("created");
};

const formatResultDetail = (
    result: UnifiedRescueResult,
    denomination: ReturnType<typeof useGlobalContext>["denomination"],
    separator: ReturnType<typeof useGlobalContext>["separator"],
) => {
    if (result.source === RescueResultSource.Evm) {
        return result.swap.blockNumber.toString();
    }

    if (result.source === RescueResultSource.Sweep) {
        return `${getSweepAmount(result.swap, denomination, separator)} ${formatDenomination(
            denomination(),
            result.swap.asset,
        )}`;
    }

    const date = new Date();
    date.setTime(getSwapDate(result.swap));
    return date.toLocaleDateString();
};

const resultId = (result: UnifiedRescueResult) => {
    switch (result.source) {
        case RescueResultSource.Evm:
            return cropString(result.swap.transactionHash, 15, 5);
        case RescueResultSource.Sweep:
            return cropString(result.swap.signer.address, 15, 5);
        case RescueResultSource.Restore:
            return result.swap.id;
    }
};

const resultTestId = (result: UnifiedRescueResult) =>
    result.source === RescueResultSource.Restore
        ? `swaplist-item-${result.swap.id}`
        : `swaplist-item-${result.key}`;

const UnifiedResultAssets = (props: { result: UnifiedRescueResult }) => (
    <Switch>
        <Match when={props.result.source === RescueResultSource.Restore}>
            <SwapIcons
                swap={
                    (
                        props.result as Extract<
                            UnifiedRescueResult,
                            { source: RescueResultSource.Restore }
                        >
                    ).swap
                }
            />
        </Match>
        <Match when={props.result.source === RescueResultSource.Evm}>
            <EvmAssetIcon
                asset={
                    (
                        props.result as Extract<
                            UnifiedRescueResult,
                            { source: RescueResultSource.Evm }
                        >
                    ).swap.asset
                }
            />
        </Match>
        <Match when={props.result.source === RescueResultSource.Sweep}>
            <EvmAssetIcon
                asset={
                    (
                        props.result as Extract<
                            UnifiedRescueResult,
                            { source: RescueResultSource.Sweep }
                        >
                    ).swap.asset
                }
            />
        </Match>
    </Switch>
);

type ResultsProps = {
    state: ExternalRescueSearch["state"];
    results: ExternalRescueSearch["results"];
};

const UnifiedRescueList = (props: {
    results: ExternalRescueSearch["results"];
}) => {
    const { t, denomination, separator, privacyMode } = useGlobalContext();

    return (
        <div id="swaplist" class="rescue-external-result-list">
            <hr />
            <For each={props.results.current()}>
                {(result, index) => (
                    <>
                        <div
                            data-testid={resultTestId(result)}
                            class={`swaplist-item ${
                                !result.actionable ? "disabled" : ""
                            }`}
                            onClick={() => props.results.open(result)}>
                            <a
                                class="btn-small"
                                href="#"
                                onClick={(e) => e.preventDefault()}>
                                {resultActionLabel(result.action, t)}
                            </a>
                            <UnifiedResultAssets result={result} />
                            <span class="swaplist-asset-id">
                                {t("id")}:&nbsp;
                                <Show
                                    when={!privacyMode()}
                                    fallback={hiddenInformation}>
                                    <span class="monospace">
                                        {resultId(result)}
                                    </span>
                                </Show>
                            </span>
                            <span class="swaplist-asset-date hidden-mobile">
                                {resultDetailLabel(result, t)}:&nbsp;
                                <span class="monospace">
                                    {formatResultDetail(
                                        result,
                                        denomination,
                                        separator,
                                    )}
                                </span>
                            </span>
                        </div>
                        <Show
                            when={index() < props.results.current().length - 1}>
                            <hr />
                        </Show>
                    </>
                )}
            </For>
            <hr />
        </div>
    );
};

export const Results = (props: ResultsProps) => {
    const { t } = useGlobalContext();

    return (
        <>
            <Show when={props.state.btc.searchState === BtcSearchState.Loading}>
                <p class="restore-loading-progress">
                    {t("swaps_found", {
                        count: props.state.btc.loadedSwaps,
                    })}
                </p>
                <LoadingSpinner class="restore-loading-spinner" />
            </Show>
            <Show when={props.state.btc.searchState === BtcSearchState.Errored}>
                <h3 class="frame-text-spaced">
                    {t("error")}: {props.state.btc.error}
                </h3>
            </Show>

            <Show when={props.results.currentEvmProgress()}>
                <p class="frame-text">{props.results.currentEvmProgress()}</p>
            </Show>

            <Show
                when={
                    props.state.btc.listLoading &&
                    props.results.all().length === 0
                }>
                <LoadingSpinner />
            </Show>

            <Show when={props.results.all().length > 0}>
                <div class="rescue-external-results">
                    <div
                        style={getSwapListHeight(
                            props.results.all() as never as SomeSwap[],
                            isMobile(),
                        )}>
                        <UnifiedRescueList results={props.results} />
                    </div>
                    <Pagination
                        items={props.results.all}
                        setDisplayedItems={props.results.setCurrent}
                        totalItems={props.results.all().length}
                        itemsPerPage={
                            isMobile()
                                ? mobileItemsPerPage
                                : desktopItemsPerPage
                        }
                        currentPage={props.results.currentPage}
                        setCurrentPage={props.results.setCurrentPage}
                    />
                </div>
            </Show>

            <Show when={props.state.evm.unmatchedRefundSwaps > 0}>
                <p class="frame-text">
                    {t("unmatched_swaps", {
                        count: props.state.evm.unmatchedRefundSwaps,
                    })}
                </p>
            </Show>
            <Show when={props.state.evm.unmatchedClaimSwaps > 0}>
                <p class="frame-text">
                    {t("unmatched_swaps", {
                        count: props.state.evm.unmatchedClaimSwaps,
                    })}
                </p>
            </Show>
            <Show when={props.state.search.error}>
                <h3 class="frame-text-spaced">
                    {t("error")}: {props.state.search.error}
                </h3>
            </Show>
            <Show
                when={
                    props.state.search.hasSearched &&
                    !props.state.search.isSearching &&
                    !props.results.hasAny()
                }>
                <h3>{t("no_swaps_found")}</h3>
            </Show>
        </>
    );
};
