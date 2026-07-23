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
import { getAddress, isAddress } from "viem";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import EvmRefundDestination from "../components/EvmRefundDestination";
import LoadingSpinner from "../components/LoadingSpinner";
import SignerNetworkGuard from "../components/SignerNetworkGuard";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import type { AssetType } from "../consts/Assets";
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
import { createSignerNetworkCheck } from "../utils/signerNetwork";

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
    const [manualDestination, setManualDestination] = createSignal("");
    const destinationAddress = () =>
        signer()?.address ?? manualDestination().trim();
    const walletNetwork = createSignerNetworkCheck(signer, () => params.asset);
    const walletOnRefundNetwork = () =>
        signer() === undefined || walletNetwork.valid() === true;

    const sweepSource = createMemo(() => {
        const currentRescueFile = rescueFile();
        if (currentRescueFile === undefined) {
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
        const currentSweepData = sweepData();
        const destination = destinationAddress();

        if (
            currentSweepData === undefined ||
            !isAddress(destination) ||
            !isSweepableAsset(params.asset) ||
            !walletOnRefundNetwork()
        ) {
            return;
        }

        setRefundTxId(
            await sweepGasAbstractionToken({
                asset: params.asset,
                amount: currentSweepData.amount,
                destination: getAddress(destination),
                signer: currentSweepData.signer,
            }),
        );
    };

    return (
        <div class="frame">
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
                                    <h3>{t("no_rescuable_swaps")}</h3>
                                </Match>
                                <Match when={refundTxId() === undefined}>
                                    <p data-testid="refund-amount">
                                        {t("refund")} {amount(data)}{" "}
                                        {formatDenomination(
                                            denomination(),
                                            data.asset,
                                        )}
                                    </p>
                                    <EvmRefundDestination
                                        asset={params.asset}
                                        value={manualDestination()}
                                        setValue={setManualDestination}
                                    />
                                    <SignerNetworkGuard network={walletNetwork}>
                                        <Show when={walletOnRefundNetwork()}>
                                            <ContractTransaction
                                                asset={params.asset}
                                                disabled={
                                                    !isAddress(
                                                        destinationAddress(),
                                                    )
                                                }
                                                signerOverride={() =>
                                                    data.signer
                                                }
                                                onClick={sweep}
                                                buttonText={t("refund")}
                                            />
                                        </Show>
                                    </SignerNetworkGuard>
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
        </div>
    );
};

export default GasAbstractionSweepRescue;
