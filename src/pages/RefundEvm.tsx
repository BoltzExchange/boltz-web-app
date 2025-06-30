import { useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import type { Setter } from "solid-js";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import type { LogRefundData } from "../utils/contractLogs";
import { getLogsFromReceipt } from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { cropString } from "../utils/helper";

type RefundData = LogRefundData & { currentHeight: bigint };

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RefundData;
    setRefundTxHash: Setter<string | undefined>;
}) => {
    const { t, denomination, separator } = useGlobalContext();

    const timelockExpired = () =>
        props.refundData.timelock <= props.refundData.currentHeight;

    return (
        <>
            <p>
                {t("refund")}{" "}
                {formatAmount(
                    new BigNumber(props.refundData.amount.toString()),
                    denomination(),
                    separator(),
                )}{" "}
                {formatDenomination(denomination(), props.asset)}
            </p>

            <Show when={!timelockExpired()}>
                <h3>
                    {t("refund_available_in", {
                        blocks: (
                            props.refundData.timelock -
                            props.refundData.currentHeight
                        ).toString(),
                    })}
                </h3>
            </Show>

            <RefundButton
                disabled={!timelockExpired()}
                setRefundTxHash={props.setRefundTxHash}
                amount={Number(props.refundData.amount)}
                preimageHash={props.refundData.preimageHash}
                claimAddress={props.refundData.claimAddress}
                signerAddress={props.refundData.refundAddress}
                timeoutBlockHeight={Number(props.refundData.timelock)}
            />
            <hr />
            <BlockExplorer
                typeLabel={"lockup_tx"}
                asset={props.asset}
                txId={props.lockupTxHash}
            />
        </>
    );
};

const RefundEvm = () => {
    const params = useParams<{ asset: string; txHash: string }>();

    const { t } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();

    const [refundData] = createResource<RefundData>(async () => {
        if (signer() === undefined) {
            return undefined;
        }

        const [logData, currentHeight] = await Promise.all([
            getLogsFromReceipt(signer(), getEtherSwap(), params.txHash),
            signer().provider.getBlockNumber(),
        ]);

        return {
            ...logData,
            currentHeight: BigInt(currentHeight),
        };
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
                        <h2 style={{ "margin-bottom": "6px" }}>
                            {t("refund")} {cropString(params.txHash, 15, 5)}
                        </h2>
                        <Show
                            when={refundTxHash() === undefined}
                            fallback={
                                <>
                                    <p>{t("refunded")}</p>
                                    <hr />
                                    <BlockExplorer
                                        typeLabel={"refund_tx"}
                                        asset={params.asset}
                                        txId={refundTxHash()}
                                    />
                                </>
                            }>
                            <RefundState
                                asset={params.asset}
                                lockupTxHash={params.txHash}
                                refundData={refundData()}
                                setRefundTxHash={setRefundTxHash}
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
