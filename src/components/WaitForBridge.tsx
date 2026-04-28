import log from "loglevel";
import { Match, Switch, createEffect, createSignal, onCleanup } from "solid-js";

import { BridgeKind } from "../configs/base";
import { useGlobalContext } from "../context/Global";
import { bridgeRegistry } from "../utils/bridge";
import { formatError } from "../utils/errors";
import { waitForOftTransactionConfirmationTimestamp } from "../utils/oft/oft";
import { computeOftEtaSeconds } from "../utils/oftEta";
import type { BridgeDetail } from "../utils/swapCreator";
import BlockExplorer from "./BlockExplorer";
import LoadingSpinner from "./LoadingSpinner";

const WaitForOft = (props: {
    sourceAsset: string;
    destinationAsset: string;
    txHash: string;
}) => {
    const { t } = useGlobalContext();
    const formatEta = (seconds: number): string => {
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        const remainingSeconds = seconds % 60;

        if (days > 0) {
            return [
                t("oft_eta_day_unit", { value: days }),
                t("oft_eta_hour_unit", { value: hours }),
                t("oft_eta_minute_unit", { value: minutes }),
                t("oft_eta_second_unit", { value: remainingSeconds }),
            ].join(" ");
        }

        if (hours > 0) {
            return [
                t("oft_eta_hour_unit", { value: hours }),
                t("oft_eta_minute_unit", { value: minutes }),
                t("oft_eta_second_unit", { value: remainingSeconds }),
            ].join(" ");
        }

        if (minutes > 0) {
            return [
                t("oft_eta_minute_unit", { value: minutes }),
                t("oft_eta_second_unit", { value: remainingSeconds }),
            ].join(" ");
        }

        return t("oft_eta_second_unit", { value: remainingSeconds });
    };

    const [remaining, setRemaining] = createSignal<number | undefined>();

    createEffect(() => {
        const eta = computeOftEtaSeconds(
            props.sourceAsset,
            props.destinationAsset,
        );
        if (eta === undefined) {
            setRemaining(undefined);
            return;
        }

        const txHash = props.txHash;
        const sourceAsset = props.sourceAsset;

        const updateRemainingFromConfirmation = (
            confirmationTimeSecs: number,
        ) => {
            const elapsedSecs = Date.now() / 1_000 - confirmationTimeSecs;
            const remainingSecs = Math.max(Math.ceil(eta - elapsedSecs), 0);
            setRemaining(remainingSecs);
        };

        const controller = new AbortController();
        setRemaining(undefined);

        waitForOftTransactionConfirmationTimestamp(sourceAsset, txHash, {
            signal: controller.signal,
        })
            .then((confirmationTimeSecs) => {
                if (
                    controller.signal.aborted ||
                    confirmationTimeSecs === undefined
                ) {
                    return;
                }

                updateRemainingFromConfirmation(confirmationTimeSecs);
            })
            .catch((e) => {
                if (controller.signal.aborted) {
                    return;
                }

                log.warn("Failed to fetch OFT tx confirmation time", {
                    sourceAsset,
                    txHash,
                    error: formatError(e),
                });
            });

        onCleanup(() => controller.abort());
    });

    const timer = setInterval(() => {
        setRemaining((prev) => {
            if (prev === undefined) return undefined;
            return Math.max(prev - 1, 0);
        });
    }, 1_000);

    onCleanup(() => clearInterval(timer));

    const countdownLabel = () => {
        const secs = remaining();

        if (secs === undefined) {
            return t("oft_transfer_in_progress");
        }

        if (secs < 1) {
            return t("oft_arriving_soon");
        }

        return t("oft_eta", { time: formatEta(secs) });
    };

    return (
        <>
            <h2>{t("waiting_for_oft")}</h2>
            <LoadingSpinner />
            <p>{countdownLabel()}</p>
        </>
    );
};

const WaitForGenericBridge = (props: {
    bridge: BridgeDetail;
    transactionHash: string;
}) => {
    const { t } = useGlobalContext();

    return (
        <>
            <h2>{t("waiting_for_bridge")}</h2>
            <LoadingSpinner />
            <BlockExplorer
                asset={props.bridge.sourceAsset}
                txId={props.transactionHash}
                explorer={bridgeRegistry.getExplorerKind(props.bridge)}
                typeLabel={"lockup_tx"}
            />
        </>
    );
};

const WaitForBridge = (props: {
    bridge: BridgeDetail;
    transactionHash: string;
}) => {
    return (
        <Switch
            fallback={
                <WaitForGenericBridge
                    bridge={props.bridge}
                    transactionHash={props.transactionHash}
                />
            }>
            <Match when={props.bridge.kind === BridgeKind.Oft}>
                <WaitForOft
                    sourceAsset={props.bridge.sourceAsset}
                    destinationAsset={props.bridge.destinationAsset}
                    txHash={props.transactionHash}
                />
            </Match>
        </Switch>
    );
};

export default WaitForBridge;
