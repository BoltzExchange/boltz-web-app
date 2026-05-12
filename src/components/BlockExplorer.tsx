import type { ExplorerKind } from "boltz-swaps/types";
import { Show } from "solid-js";

import { useGlobalContext } from "../context/Global";
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
    typeLabel?:
        | "lockup_address"
        | "lockup_tx"
        | "claim_tx"
        | "refund_tx"
        | "bridge_status";
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

    const label = () => {
        const current = typeLabel();
        if (current === "bridge_status") {
            return t("check_bridge_status");
        }
        return t("blockexplorer", {
            typeLabel: t(`blockexplorer_${current}`),
        });
    };

    return (
        <Show when={href()}>
            {(resolved) => (
                <ExternalLink class="btn btn-explorer" href={resolved()}>
                    {label()}
                </ExternalLink>
            )}
        </Show>
    );
};

export default BlockExplorer;
