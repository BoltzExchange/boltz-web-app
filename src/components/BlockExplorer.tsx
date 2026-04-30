import { useGlobalContext } from "../context/Global";
import type { ExplorerKind } from "../utils/explorerLink";
import { blockExplorerLink } from "../utils/explorerLink";
import ExternalLink from "./ExternalLink";

type PropsBase = {
    asset: string;
    explorer?: ExplorerKind;
    typeLabel?: "lockup_address" | "lockup_tx" | "claim_tx" | "refund_tx";
};

type PropsTxId = PropsBase & {
    txId: string;
};

type PropsAddress = PropsBase & {
    address: string;
};

const BlockExplorer = (props: PropsTxId | PropsAddress) => {
    const { t } = useGlobalContext();

    const href = () =>
        "txId" in props && props.txId !== undefined
            ? blockExplorerLink(props.asset, true, props.txId, props.explorer)
            : blockExplorerLink(
                  props.asset,
                  false,
                  (props as PropsAddress).address,
              );

    const typeLabel = () =>
        props.typeLabel ||
        ("txId" in props && props.txId !== undefined
            ? "claim_tx"
            : "lockup_address");

    return (
        <ExternalLink class="btn btn-explorer" href={href()}>
            {t("blockexplorer", {
                typeLabel: t(`blockexplorer_${typeLabel()}`),
            })}
        </ExternalLink>
    );
};

export default BlockExplorer;
