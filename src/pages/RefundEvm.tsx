import { useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import type { Setter } from "solid-js";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import { AssetKind, type AssetType, getKindForAsset } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import type { LogRefundData } from "../utils/contractLogs";
import {
    getLogsFromReceipt,
    getTimelockBlockNumber,
} from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { cropString } from "../utils/helper";
import { createAssetProvider } from "../utils/provider";
import { assetAmountToSats } from "../utils/rootstock";

type RefundData = LogRefundData & { currentHeight: bigint };

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RefundData;
    setRefundTxId: Setter<string>;
}) => {
    const { t, denomination, separator } = useGlobalContext();

    const timelockExpired = () =>
        props.refundData.timelock <= props.refundData.currentHeight;

    const isCommitmentLockup = () =>
        props.refundData.preimageHash === "00".repeat(32);

    const refundGated = () => !isCommitmentLockup() && !timelockExpired();

    return (
        <>
            <p>
                {t("refund")}{" "}
                {formatAmount(
                    new BigNumber(
                        assetAmountToSats(
                            props.refundData.amount,
                            props.asset,
                        ).toString(),
                    ),
                    denomination(),
                    separator(),
                    props.asset,
                )}{" "}
                {formatDenomination(denomination(), props.asset)}
            </p>

            <Show when={refundGated()}>
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
                asset={props.asset}
                disabled={refundGated()}
                setRefundTxId={props.setRefundTxId}
                signerAddress={props.refundData.refundAddress}
                lockupTxHash={props.lockupTxHash}
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
    const { signer, getEtherSwap, getErc20Swap } = useWeb3Signer();

    const getSwapContract = (asset: string) =>
        getKindForAsset(asset) === AssetKind.ERC20
            ? getErc20Swap(asset)
            : getEtherSwap(asset);

    const [refundData] = createResource<RefundData>(async () => {
        if (signer() === undefined) {
            return undefined;
        }

        const provider = createAssetProvider(params.asset);
        const contract = getSwapContract(params.asset).connect(
            provider,
        ) as ReturnType<typeof getSwapContract>;

        const [logData, currentHeight] = await Promise.all([
            getLogsFromReceipt(
                provider,
                params.asset as AssetType,
                contract,
                params.txHash,
            ),
            getTimelockBlockNumber(provider, params.asset as AssetType),
        ]);

        return {
            ...logData,
            currentHeight: BigInt(currentHeight),
        };
    });

    const [refundTxId, setRefundTxId] = createSignal<string | undefined>(
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
                            when={refundTxId() === undefined}
                            fallback={
                                <>
                                    <p>{t("refunded")}</p>
                                    <hr />
                                    <BlockExplorer
                                        typeLabel={"refund_tx"}
                                        asset={params.asset}
                                        txId={refundTxId()}
                                    />
                                </>
                            }>
                            <RefundState
                                asset={params.asset}
                                lockupTxHash={params.txHash}
                                refundData={refundData()}
                                setRefundTxId={setRefundTxId}
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
