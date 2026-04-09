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

        return `${t("oft_eta")} ~${secs}s`;
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
