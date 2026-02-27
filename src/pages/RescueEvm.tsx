import { useNavigate, useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import type { Setter } from "solid-js";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { type RefundableAssetType } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim, relayClaimTransaction } from "../rif/Signer";
import type { LogRefundData } from "../utils/contractLogs";
import { getLogsFromReceipt } from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { cropString } from "../utils/helper";
import { getTimeoutEta } from "../utils/rescue";
import { rskDerivationPath } from "../utils/rescueFile";
import { prefix0x, satoshiToWei } from "../utils/rootstock";

type RescueData = LogRefundData & { currentHeight: bigint };

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RescueData;
    setRefundTxId: Setter<string>;
}) => {
    const { t, denomination, separator } = useGlobalContext();

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

            <RefundButton
                setRefundTxId={props.setRefundTxId}
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

const ClaimState = (props: {
    asset: string;
    lockupTxHash: string;
    claimData: RescueData;
    setClaimTxId: Setter<string>;
}) => {
    const navigate = useNavigate();
    const { t, notify } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();
    const { rskRescuableSwaps } = useRescueContext();

    const preimage = () => {
        const swapFromContext = rskRescuableSwaps().find(
            (s) => s.preimageHash === props.claimData.preimageHash,
        );
        return swapFromContext?.preimage
            ? Buffer.from(swapFromContext.preimage, "hex")
            : undefined;
    };

    const claimTransaction = async () => {
        const currentPreimage = preimage();
        if (!currentPreimage) return;

        try {
            let transactionHash: string;

            const balance = await signer().provider.getBalance(
                await signer().getAddress(),
            );
            const gasPrice = (await signer().provider.getFeeData()).gasPrice;
            const useRif =
                gasPrice === null || balance <= gasPrice * GasNeededToClaim;

            if (useRif) {
                transactionHash = await relayClaimTransaction(
                    signer(),
                    getEtherSwap(),
                    currentPreimage.toString("hex"),
                    Number(props.claimData.amount),
                    props.claimData.refundAddress,
                    Number(props.claimData.timelock),
                );
            } else {
                transactionHash = (
                    await getEtherSwap()[
                        "claim(bytes32,uint256,address,uint256)"
                    ](
                        prefix0x(currentPreimage.toString("hex")),
                        satoshiToWei(Number(props.claimData.amount)),
                        props.claimData.refundAddress,
                        props.claimData.timelock,
                    )
                ).hash;
            }

            props.setClaimTxId(transactionHash);
        } catch (error) {
            log.error(error);
            notify("error", t("error_occurred", { error: formatError(error) }));
        }
    };

    return (
        <Show
            when={preimage() !== undefined}
            fallback={
                <>
                    <p>{t("claim_scan_required")}</p>
                    <button
                        class="btn"
                        onClick={() => navigate("/rescue/external/rsk")}>
                        {t("back")}
                    </button>
                </>
            }>
            <ContractTransaction
                onClick={claimTransaction}
                address={{
                    address: props.claimData.claimAddress,
                    derivationPath: rskDerivationPath,
                }}
                buttonText={t("continue")}
                promptText={t("transaction_prompt_receive", {
                    button: t("continue"),
                    asset: props.asset,
                })}
                waitingText={t("tx_ready_to_claim")}
            />
        </Show>
    );
};

const RescueEvm = () => {
    const params = useParams<{
        asset: string;
        txHash: string;
        action: RskRescueMode;
    }>();

    const { t } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();

    const [refundTxId, setRefundTxId] = createSignal<string | undefined>(
        undefined,
    );
    const [claimTxId, setClaimTxId] = createSignal<string | undefined>(
        undefined,
    );

    const [rescueData] = createResource<RescueData>(async () => {
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

    const isRefundAction = () => params.action === RskRescueMode.Refund;

    const timelockExpired = () =>
        rescueData() && rescueData().timelock <= rescueData().currentHeight;

    const canRefund = () => isRefundAction() && timelockExpired();

    const pageTitle = () => {
        if (isRefundAction()) {
            return t("refund");
        }
        return t("claim");
    };

    return (
        <div class="frame">
            <Show
                when={signer() !== undefined}
                fallback={<h2>{t("no_wallet")}</h2>}>
                <Switch>
                    <Match when={rescueData.state === "ready"}>
                        <SettingsCog />
                        <SettingsMenu />
                        <h2 style={{ "margin-bottom": "6px" }}>
                            {pageTitle()} {cropString(params.txHash, 15, 5)}
                        </h2>
                        <hr />
                        <Switch>
                            <Match when={canRefund()}>
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
                                        refundData={rescueData()}
                                        setRefundTxId={setRefundTxId}
                                    />
                                </Show>
                            </Match>
                            <Match when={!isRefundAction()}>
                                <Show
                                    when={claimTxId() === undefined}
                                    fallback={
                                        <>
                                            <p>{t("claimed")}</p>
                                            <hr />
                                            <BlockExplorer
                                                typeLabel={"claim_tx"}
                                                asset={params.asset}
                                                txId={claimTxId()}
                                            />
                                        </>
                                    }>
                                    <ClaimState
                                        asset={params.asset}
                                        lockupTxHash={params.txHash}
                                        claimData={rescueData()}
                                        setClaimTxId={setClaimTxId}
                                    />
                                </Show>
                            </Match>
                            <Match
                                when={isRefundAction() && !timelockExpired()}>
                                <RefundEta
                                    timeoutEta={() =>
                                        getTimeoutEta(
                                            params.asset as RefundableAssetType,
                                            Number(rescueData().timelock),
                                            Number(rescueData().currentHeight),
                                        )
                                    }
                                    timeoutBlockHeight={() =>
                                        Number(rescueData().timelock)
                                    }
                                    refundableAsset={
                                        params.asset as RefundableAssetType
                                    }
                                />
                            </Match>
                        </Switch>
                    </Match>
                    <Match when={rescueData.state === "pending"}>
                        <h2>{pageTitle()}</h2>
                        <LoadingSpinner />
                    </Match>
                    <Match when={rescueData.state === "errored"}>
                        <h2>{t("error")}</h2>
                        <h3>{formatError(rescueData.error)}</h3>
                    </Match>
                </Switch>
            </Show>
        </div>
    );
};

export default RescueEvm;
