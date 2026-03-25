import log from "loglevel";
import { Show, createSignal } from "solid-js";

import { config } from "../config";
import { LBTC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    broadcastToExplorer,
    getAddressUTXOs,
    getFeeEstimations,
} from "../utils/blockchain";
import { validateAddress } from "../utils/compat";
import {
    buildMultiAssetSweepTransaction,
    deriveTempLiquidWallet,
    findAllOutputsForScript,
} from "../utils/liquidWallet";
import { fetchBlockExplorerTx } from "../utils/sideswapHelpers";
import type { RescueFile } from "../utils/rescueFile";
import {
    type ChainSwap,
    type ReverseSwap,
    SideSwapStatus,
    type SomeSwap,
} from "../utils/swapCreator";
import LoadingSpinner from "./LoadingSpinner";

type SideSwapRecoveryProps = {
    swap: SomeSwap;
    rescueFileOverride?: RescueFile;
};

const SideSwapRecovery = (props: SideSwapRecoveryProps) => {
    const { t, setSwapStorage, rescueFile: globalRescueFile, notify } = useGlobalContext();
    const { setSwap } = usePayContext();

    const rescueFile = () => props.rescueFileOverride ?? globalRescueFile();

    const [sweepAddress, setSweepAddress] = createSignal("");
    const [addressValid, setAddressValid] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [sweepTxid, setSweepTxid] = createSignal<string | undefined>();

    const onAddressInput = (value: string) => {
        setSweepAddress(value);
        setAddressValid(validateAddress(LBTC, value));
    };

    const buttonMessage = () => {
        if (addressValid() || !sweepAddress()) {
            return t("refund");
        }
        return t("invalid_address", { asset: LBTC });
    };

    const executeSweep = async () => {
        const sideswap = props.swap.sideswap;
        if (!sideswap) return;
        if (!addressValid()) return;

        setLoading(true);
        try {
            const castSwap = props.swap as ReverseSwap | ChainSwap;
            const keyIndex =
                castSwap.claimPrivateKeyIndex ??
                sideswap.tempKeyIndex ??
                0;
            const wallet = deriveTempLiquidWallet(rescueFile(), keyIndex);

            const claimTx = props.swap.claimTx;
            const tradeTx = sideswap.txid;
            const sourceTx = tradeTx ?? claimTx;

            let utxos: Awaited<ReturnType<typeof findAllOutputsForScript>>;

            if (sourceTx) {
                const txHex = await fetchBlockExplorerTx(LBTC, sourceTx);
                utxos = await findAllOutputsForScript(
                    txHex,
                    wallet.outputScript,
                    wallet.blindingPrivateKey,
                );
            } else {
                const addressUtxos = await getAddressUTXOs(
                    LBTC,
                    wallet.address,
                );
                const allUtxos: Awaited<
                    ReturnType<typeof findAllOutputsForScript>
                > = [];
                for (const u of addressUtxos) {
                    const txHex = await fetchBlockExplorerTx(LBTC, u.txid);
                    const outputs = await findAllOutputsForScript(
                        txHex,
                        wallet.outputScript,
                        wallet.blindingPrivateKey,
                    );
                    allUtxos.push(...outputs);
                }
                utxos = allUtxos;
            }

            if (utxos.length === 0) {
                throw new Error(
                    "No UTXOs found at temp wallet",
                );
            }

            log.info("Sweeping temp wallet:", {
                utxoCount: utxos.length,
                to: sweepAddress(),
            });

            const feeApis = config.assets[LBTC]?.blockExplorerApis;
            let feeRate = 0.1;
            if (feeApis?.length > 0) {
                try {
                    feeRate = await getFeeEstimations(feeApis[0]);
                } catch (e) {
                    log.warn(
                        "Could not fetch fee estimation, using default:",
                        e,
                    );
                }
            }

            const sweepTxHex = await buildMultiAssetSweepTransaction(
                utxos,
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

            notify("success", t("refunded"));
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            log.error("Refund failed:", errorMsg);
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
                        <h3>{t("refunded")}</h3>
                        <p>
                            {t("sideswap_transaction")}: {sweepTxid()}
                        </p>
                    </div>
                }>
                <p>{t("sideswap_refund_description", { asset: LBTC })}</p>
                <input
                    type="text"
                    placeholder={t("onchain_address", { asset: LBTC })}
                    value={sweepAddress()}
                    onInput={(e) => onAddressInput(e.currentTarget.value)}
                    disabled={loading()}
                />
                <button
                    class="btn"
                    disabled={!addressValid() || loading()}
                    onClick={executeSweep}>
                    <Show when={loading()} fallback={buttonMessage()}>
                        <LoadingSpinner class="inner-spinner" />
                    </Show>
                </button>
            </Show>
        </div>
    );
};

export default SideSwapRecovery;
