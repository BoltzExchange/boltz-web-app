import { useParams } from "@solidjs/router";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { LogRefundData, getLogsFromReceipt } from "../utils/contractLogs";
import { formatError } from "../utils/errors";

const RefundEvm = () => {
    const params = useParams<{ asset: string; txHash: string }>();
    const { t } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();

    const [refundData] = createResource<LogRefundData>(async () => {
        if (signer() === undefined) {
            return undefined;
        }

        return await getLogsFromReceipt(
            signer(),
            getEtherSwap(),
            params.txHash,
        );
    });

    const [refundTxHash, setRefundTxHash] = createSignal<string | undefined>(
        undefined,
    );

    return (
        <div class="frame">
            <Show
                when={signer() !== undefined}
                fallback={<h2>{t("no_wallet")}</h2>}>
                <Switch>
                    <Match when={refundData.state === "ready"}>
                        <h2>{t("refund")}</h2>
                        <Show
                            when={refundTxHash() !== undefined}
                            fallback={
                                <RefundButton
                                    setRefundTxHash={setRefundTxHash}
                                    amount={Number(refundData().amount)}
                                    preimageHash={refundData().preimageHash}
                                    claimAddress={refundData().claimAddress}
                                    signerAddress={refundData().refundAddress}
                                    timeoutBlockHeight={Number(
                                        refundData().timelock,
                                    )}
                                />
                            }>
                            <p>{t("refunded")}</p>
                            <hr />
                            <BlockExplorer
                                typeLabel={"refund_tx"}
                                asset={params.asset}
                                txId={refundTxHash()}
                            />
                        </Show>
                    </Match>
                    <Match when={refundData.state === "pending"}>
                        <h2>{t("refund")}</h2>
                        <LoadingSpinner />
                    </Match>
                    <Match when={refundData.state === "errored"}>
                        <h2>{t("error")}</h2>
                        <h3>{formatError(refundData.error)}</h3>
                    </Match>
                </Switch>
            </Show>
        </div>
    );
};

export default RefundEvm;
