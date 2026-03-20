import log from "loglevel";
import { Show, createSignal } from "solid-js";

import { config } from "../config";
import { LBTC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { broadcastToExplorer, getFeeEstimations } from "../utils/blockchain";
import { validateAddress } from "../utils/compat";
import {
    buildSweepTransaction,
    deriveTempLiquidWallet,
    findOutputForScript,
    unblindOutput,
} from "../utils/liquidWallet";
import { fetchBlockExplorerTx } from "../utils/sideswapHelpers";
import { SideSwapStatus, type SomeSwap } from "../utils/swapCreator";
import LoadingSpinner from "./LoadingSpinner";

type SideSwapRecoveryProps = {
    swap: SomeSwap;
};

const SideSwapRecovery = (props: SideSwapRecoveryProps) => {
    const { t, setSwapStorage, rescueFile, notify } = useGlobalContext();
    const { setSwap } = usePayContext();

    const [sweepAddress, setSweepAddress] = createSignal("");
    const [addressValid, setAddressValid] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [sweepTxid, setSweepTxid] = createSignal<string | undefined>();

    const onAddressInput = (value: string) => {
        setSweepAddress(value);
        setAddressValid(validateAddress(LBTC, value));
    };

    const executeSweep = async () => {
        const sideswap = props.swap.sideswap;
        if (!sideswap) return;
        if (!addressValid()) return;

        setLoading(true);
        try {
            const wallet = deriveTempLiquidWallet(
                rescueFile(),
                sideswap.tempKeyIndex,
            );

            const claimTx = props.swap.claimTx;
            if (!claimTx) {
                throw new Error("No claim transaction to sweep from");
            }

            const txHex = await fetchBlockExplorerTx(LBTC, claimTx);

            const vout = await findOutputForScript(txHex, wallet.outputScript);
            if (vout === undefined) {
                throw new Error(
                    "Could not find temp wallet output in claim transaction",
                );
            }

            const unblindedUtxo = await unblindOutput(
                txHex,
                vout,
                wallet.blindingPrivateKey,
            );

            log.info("Sweeping intermediate L-BTC:", {
                value: unblindedUtxo.value,
                to: sweepAddress(),
            });

            const feeApis = config.assets[LBTC]?.blockExplorerApis;
            let feeRate = 0.1;
            if (feeApis?.length > 0) {
                try {
                    feeRate = await getFeeEstimations(feeApis[0]);
                } catch (e) {
                    log.warn("Could not fetch fee estimation, using default:", e);
                }
            }

            const sweepTxHex = await buildSweepTransaction(
                unblindedUtxo,
                wallet,
                sweepAddress(),
                feeRate,
            );

            const result = await broadcastToExplorer(LBTC, sweepTxHex);

            log.info("Sweep transaction broadcast:", result.id);
            setSweepTxid(result.id);

            const updatedSwap = {
                ...props.swap,
                sideswap: {
                    ...sideswap,
                    status: SideSwapStatus.Failed,
                    error: `Funds swept to ${sweepAddress()} (tx: ${result.id})`,
                },
            };
            await setSwapStorage(updatedSwap);
            setSwap(updatedSwap);

            notify("success", t("sweep_successful"));
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            log.error("Sweep failed:", errorMsg);
            notify("error", errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div class="sideswap-recovery">
            <Show
                when={!sweepTxid()}
                fallback={
                    <div>
                        <h3>{t("sweep_successful")}</h3>
                        <p>
                            {t("sideswap_transaction")}: {sweepTxid()}
                        </p>
                    </div>
                }>
                <h3>{t("recover_intermediate_lbtc")}</h3>
                <p>{t("sideswap_recovery_description")}</p>
                <input
                    type="text"
                    placeholder={t("liquid_address")}
                    value={sweepAddress()}
                    onInput={(e) => onAddressInput(e.currentTarget.value)}
                    disabled={loading()}
                />
                <Show when={sweepAddress() !== "" && !addressValid()}>
                    <p class="error">{t("invalid_address", { asset: LBTC })}</p>
                </Show>
                <button
                    class="btn"
                    disabled={!addressValid() || loading()}
                    onClick={executeSweep}>
                    <Show when={loading()} fallback={t("sweep_lbtc")}>
                        <LoadingSpinner class="inner-spinner" />
                    </Show>
                </button>
            </Show>
        </div>
    );
};

export default SideSwapRecovery;
