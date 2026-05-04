import { Show } from "solid-js";

import { useGlobalContext } from "../context/Global";
import type { ExplorerKind } from "../utils/explorerLink";
import { blockExplorerLink } from "../utils/explorerLink";
import ExternalLink from "./ExternalLink";

export const enum BlockExplorerTargetKind {
    Tx = "tx",
    Address = "address",
}

const BlockExplorer = (props: {
    asset: string;
    kind: BlockExplorerTargetKind;
    id: string;
    explorer?: ExplorerKind;
    typeLabel?: "lockup_address" | "lockup_tx" | "claim_tx" | "refund_tx";
}) => {
    const { t } = useGlobalContext();

    const href = () =>
        props.kind === BlockExplorerTargetKind.Tx
            ? blockExplorerLink(props.asset, true, props.id, props.explorer)
            : blockExplorerLink(props.asset, false, props.id);

    const typeLabel = () =>
        props.typeLabel ||
        (props.kind === BlockExplorerTargetKind.Tx
            ? "claim_tx"
            : "lockup_address");

    return (
        <Show when={href()}>
            {(resolved) => (
                <ExternalLink class="btn btn-explorer" href={resolved()}>
                    {t("blockexplorer", {
                        typeLabel: t(`blockexplorer_${typeLabel()}`),
                    })}
                </ExternalLink>
            )}
        </Show>
    );
};

export default BlockExplorer;
