import { Show, createMemo } from "solid-js";

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

    const etaDate = createMemo(() => {
        const etaSeconds = computeOftEtaSeconds(
            props.sourceAsset,
            props.destinationAsset,
        );
        if (etaSeconds === undefined) {
            return undefined;
        }
        return new Date(Date.now() + etaSeconds * 1_000).toLocaleString();
    });

    return (
        <>
            <h2>{t("waiting_for_oft")}</h2>
            <LoadingSpinner />
            <Show when={etaDate() !== undefined}>
                <p>
                    {t("oft_eta")}: {etaDate()}
                </p>
            </Show>
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
