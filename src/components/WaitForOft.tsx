import { createEffect, createSignal, onCleanup } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { computeOftEtaSeconds } from "../utils/oftEta";
import BlockExplorer, { ExplorerKind } from "./BlockExplorer";
import LoadingSpinner from "./LoadingSpinner";

const WaitForOft = (props: {
    sourceAsset: string;
    destinationAsset: string;
    transactionHash: string;
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
        setRemaining(eta !== undefined ? Math.ceil(eta) : undefined);
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
            <BlockExplorer
                asset={props.sourceAsset}
                txId={props.transactionHash}
                explorer={ExplorerKind.LayerZero}
                typeLabel={"lockup_tx"}
            />
        </>
    );
};

export default WaitForOft;
