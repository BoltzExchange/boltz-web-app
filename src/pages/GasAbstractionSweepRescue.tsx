import { useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { getGasAbstractionSweepDisplayAmount } from "boltz-swaps/evm";
import { createTokenContract } from "boltz-swaps/evm/contracts";
import { RskRescueMode } from "boltz-swaps/types";
import {
    Match,
    Show,
    Switch,
    createMemo,
    createResource,
    createSignal,
} from "solid-js";
import { getAddress } from "viem";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import {
    type AssetType,
    getAssetDisplaySymbol,
    getAssetNetwork,
} from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { type Signer, useWeb3Signer } from "../context/Web3";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import {
    gasAbstractionSweepAssets,
    sweepGasAbstractionToken,
} from "../utils/gasAbstractionSweep";
import { cropString } from "../utils/helper";

type SweepData = {
    asset: AssetType;
    amount: bigint;
    signer: Signer;
};

const isSweepableAsset = (asset: string): asset is AssetType =>
    (gasAbstractionSweepAssets as readonly string[]).includes(asset);

const GasAbstractionSweepRescue = () => {
    const params = useParams<{
        asset: string;
        address: string;
        action: RskRescueMode;
    }>();
    const { t, denomination, separator } = useGlobalContext();
    const { rescueFile } = useRescueContext();
    const { signer, getGasAbstractionSigner } = useWeb3Signer();
    const [refundTxId, setRefundTxId] = createSignal<string>();

    const sweepSource = createMemo(() => {
        const currentSigner = signer();
        const currentRescueFile = rescueFile();
        if (currentSigner === undefined || currentRescueFile === undefined) {
            return false;
        }
        return { rescueFile: currentRescueFile };
    });

    const [sweepData] = createResource(sweepSource, async (source) => {
        if (!isSweepableAsset(params.asset)) {
            throw new Error(`unsupported asset: ${params.asset}`);
        }
        if (params.action !== RskRescueMode.Refund) {
            throw new Error(`unsupported action: ${params.action}`);
        }

        const gasSigner = getGasAbstractionSigner(
            params.asset,
            source.rescueFile,
        );
        if (getAddress(gasSigner.address) !== getAddress(params.address)) {
            throw new Error(t("invalid_rescue_key_evm"));
        }

        const token = createTokenContract(params.asset, gasSigner);
        return {
            asset: params.asset,
            amount: await token.read.balanceOf([gasSigner.address]),
            signer: gasSigner,
        } satisfies SweepData;
    });

    const amount = (data: SweepData) =>
        formatAmount(
            new BigNumber(
                getGasAbstractionSweepDisplayAmount({
                    asset: data.asset,
                    amount: data.amount,
                }).toString(),
            ),
            denomination(),
            separator(),
            data.asset,
        );

    const sweep = async () => {
        const currentSigner = signer();
        const currentSweepData = sweepData();

        if (
            currentSigner === undefined ||
            currentSweepData === undefined ||
            !isSweepableAsset(params.asset)
        ) {
            return;
        }

        setRefundTxId(
            await sweepGasAbstractionToken({
                asset: params.asset,
                amount: currentSweepData.amount,
                destination: currentSigner.address,
                signer: currentSweepData.signer,
            }),
        );
    };

    return (
        <div class="frame">
            <Show
                when={signer() !== undefined}
                fallback={<h2>{t("no_wallet")}</h2>}>
                <SettingsCog />
                <SettingsMenu />
                <h2 class="frame-title" style={{ "margin-bottom": "6px" }}>
                    {t("refund")} {cropString(params.address, 15, 5)}
                </h2>
                <hr />
                <Switch>
                    <Match when={rescueFile() === undefined}>
                        <h3>{t("refund_scan_required")}</h3>
                    </Match>
                    <Match when={sweepData.state === "pending"}>
                        <LoadingSpinner />
                    </Match>
                    <Match when={sweepData.state === "errored"}>
                        <h2>{t("error")}</h2>
                        <h3>{formatError(sweepData.error)}</h3>
                    </Match>
                    <Match when={sweepData.state === "ready"}>
                        <Show
                            when={sweepData()}
                            keyed
                            fallback={<LoadingSpinner />}>
                            {(data) => (
                                <Switch>
                                    <Match when={data.amount === 0n}>
                                        <h3>
                                            {t("connected_wallet_no_swaps")}
                                        </h3>
                                    </Match>
                                    <Match when={refundTxId() === undefined}>
                                        <ContractTransaction
                                            asset={params.asset}
                                            signerOverride={() => data.signer}
                                            onClick={sweep}
                                            buttonText={t("refund")}
                                            promptText={`${t("refund")} ${amount(data)} ${formatDenomination(
                                                denomination(),
                                                data.asset,
                                            )}`}>
                                            <p>
                                                {t("refund_destination_hint", {
                                                    symbol: getAssetDisplaySymbol(
                                                        data.asset,
                                                    ),
                                                    network: getAssetNetwork(
                                                        data.asset,
                                                    ),
                                                })}
                                            </p>
                                        </ContractTransaction>
                                    </Match>
                                    <Match when={refundTxId() !== undefined}>
                                        <p>{t("refunded")}</p>
                                        <hr />
                                        <BlockExplorer
                                            typeLabel={"refund_tx"}
                                            asset={params.asset}
                                            kind={BlockExplorerTargetKind.Tx}
                                            id={refundTxId()!}
                                        />
                                    </Match>
                                </Switch>
                            )}
                        </Show>
                    </Match>
                </Switch>
            </Show>
        </div>
    );
};

export default GasAbstractionSweepRescue;
