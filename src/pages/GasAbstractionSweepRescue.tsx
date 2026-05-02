import { useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { getAddress } from "ethers";
import type { Wallet } from "ethers";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import type { AssetType } from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { createTokenContract } from "../context/Web3";
import { useWeb3Signer } from "../context/Web3";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { sweepGasAbstractionToken } from "../utils/gasAbstractionSweep";
import { cropString } from "../utils/helper";

type SweepData = {
    amount: bigint;
    signer: Wallet;
};

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

    const [sweepData] = createResource<SweepData>(async () => {
        if (signer() === undefined || rescueFile() === undefined) {
            return undefined;
        }

        if (params.action !== RskRescueMode.Refund) {
            throw new Error(`unsupported action: ${params.action}`);
        }

        const gasSigner = getGasAbstractionSigner(params.asset, rescueFile());
        if (getAddress(gasSigner.address) !== getAddress(params.address)) {
            throw new Error(t("invalid_rescue_key_evm"));
        }

        const token = createTokenContract(params.asset, gasSigner);
        return {
            amount: await token.balanceOf(gasSigner.address),
            signer: gasSigner,
        };
    });

    const amount = (data: SweepData) =>
        formatAmount(
            new BigNumber(data.amount.toString()),
            denomination(),
            separator(),
            params.asset,
        );

    const sweep = async () => {
        const currentSigner = signer();
        const currentSweepData = sweepData();

        if (currentSigner === undefined || currentSweepData === undefined) {
            return;
        }

        setRefundTxId(
            await sweepGasAbstractionToken({
                asset: params.asset as AssetType,
                amount: currentSweepData.amount,
                destination: await currentSigner.getAddress(),
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
                                        <p>
                                            {t("refund")} {amount(data)}{" "}
                                            {formatDenomination(
                                                denomination(),
                                                params.asset,
                                            )}
                                        </p>
                                        <ContractTransaction
                                            asset={params.asset}
                                            signerOverride={() => data.signer}
                                            onClick={sweep}
                                            buttonText={t("refund")}
                                        />
                                    </Match>
                                    <Match when={refundTxId() !== undefined}>
                                        <p>{t("refunded")}</p>
                                        <hr />
                                        <BlockExplorer
                                            typeLabel={"refund_tx"}
                                            asset={params.asset}
                                            txId={refundTxId()}
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
