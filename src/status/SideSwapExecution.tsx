import log from "loglevel";
import { Show, createSignal, onCleanup, onMount } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import SideSwapRecovery from "../components/SideSwapRecovery";
import { LBTC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { broadcastToExplorer, getFeeEstimations } from "../utils/blockchain";
import { config } from "../config";
import {
    buildMultiAssetSweepTransaction,
    deriveTempLiquidWallet,
    findAllOutputsForScript,
    findOutputForScript,
    signPset,
    unblindOutput,
} from "../utils/liquidWallet";
import {
    type SideSwapUtxo,
    executeSideSwapTrade,
} from "../utils/sideswap";
import { fetchBlockExplorerTx } from "../utils/sideswapHelpers";
import {
    type ChainSwap,
    type ReverseSwap,
    type SideSwapDetail,
    SideSwapStatus,
    type SomeSwap,
} from "../utils/swapCreator";

const CONFIRMATION_POLL_INTERVAL = 5_000;
const SLIPPAGE_TOLERANCE = 0.03;

const getClaimKeyIndex = (swap: SomeSwap): number => {
    const legacy = swap.sideswap?.tempKeyIndex;
    const castSwap = swap as ReverseSwap | ChainSwap;
    return castSwap.claimPrivateKeyIndex ?? legacy ?? 0;
};

type SideSwapExecutionProps = {
    swap: SomeSwap;
};

const SideSwapExecution = (props: SideSwapExecutionProps) => {
    const { t, setSwapStorage, rescueFile, notify } = useGlobalContext();
    const { setSwap } = usePayContext();

    const [status, setStatus] = createSignal<SideSwapStatus>(
        props.swap.sideswap?.status ?? SideSwapStatus.Pending,
    );
    const [txid, setTxid] = createSignal<string | undefined>(
        props.swap.sideswap?.txid,
    );

    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const updateSwapSideswap = async (
        update: Partial<SideSwapDetail>,
    ) => {
        const current = props.swap.sideswap;
        if (!current) return;

        const updated = { ...current, ...update };
        const updatedSwap = { ...props.swap, sideswap: updated };
        await setSwapStorage(updatedSwap);
        setSwap(updatedSwap);
    };

    const waitForConfirmation = async (): Promise<string> => {
        const claimTx = props.swap.claimTx;
        if (!claimTx) {
            throw new Error("No claim transaction found");
        }

        setStatus(SideSwapStatus.WaitingConfirmation);
        await updateSwapSideswap({ status: SideSwapStatus.WaitingConfirmation });

        return new Promise<string>((resolve, reject) => {
            const check = async () => {
                try {
                    const txHex = await fetchBlockExplorerTx(LBTC, claimTx);
                    if (txHex) {
                        resolve(txHex);
                        return;
                    }
                } catch (e) {
                    log.debug("Waiting for claim tx confirmation:", e);
                }
                pollTimer = setTimeout(check, CONFIRMATION_POLL_INTERVAL);
            };
            void check();
        });
    };

    const sweepToUserAddress = async (
        tradeTxid: string,
        wallet: ReturnType<typeof deriveTempLiquidWallet>,
        userAddress: string,
    ) => {
        setStatus(SideSwapStatus.Broadcasting);
        await updateSwapSideswap({ status: SideSwapStatus.Broadcasting });

        let tradeTxHex: string | undefined;
        for (let attempt = 0; attempt < 30; attempt++) {
            try {
                tradeTxHex = await fetchBlockExplorerTx(LBTC, tradeTxid);
                if (tradeTxHex) break;
            } catch {
                // tx may not be indexed yet
            }
            await new Promise((r) => setTimeout(r, CONFIRMATION_POLL_INTERVAL));
        }

        if (!tradeTxHex) {
            throw new Error("Could not fetch SideSwap trade transaction");
        }

        const utxos = await findAllOutputsForScript(
            tradeTxHex,
            wallet.outputScript,
            wallet.blindingPrivateKey,
        );

        if (utxos.length === 0) {
            log.warn("No outputs found at temp wallet after trade");
            return;
        }

        log.info("Sweeping temp wallet UTXOs:", utxos);

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

        const sweepHex = await buildMultiAssetSweepTransaction(
            utxos,
            wallet,
            userAddress,
            feeRate,
        );

        const result = await broadcastToExplorer(LBTC, sweepHex);
        log.info("Sweep transaction broadcast:", result.id);
    };

    const executeSideSwap = async () => {
        const sideswap = props.swap.sideswap;
        if (!sideswap) return;

        try {
            if (sideswap.status === SideSwapStatus.Confirmed) {
                setStatus(SideSwapStatus.Confirmed);
                return;
            }

            if (sideswap.txid) {
                setStatus(SideSwapStatus.Confirmed);
                setTxid(sideswap.txid);
                return;
            }

            const txHex = await waitForConfirmation();

            setStatus(SideSwapStatus.Quoting);
            await updateSwapSideswap({ status: SideSwapStatus.Quoting });

            const keyIndex = getClaimKeyIndex(props.swap);
            const wallet = deriveTempLiquidWallet(rescueFile(), keyIndex);

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

            log.info("Unblinded intermediate UTXO:", {
                txid: unblindedUtxo.txid,
                vout: unblindedUtxo.vout,
                asset: unblindedUtxo.asset,
                value: unblindedUtxo.value,
                asset_bf_len: unblindedUtxo.assetBlindingFactor.length,
                value_bf_len: unblindedUtxo.valueBlindingFactor.length,
                asset_bf: unblindedUtxo.assetBlindingFactor,
                value_bf: unblindedUtxo.valueBlindingFactor,
            });

            const utxo: SideSwapUtxo = {
                txid: unblindedUtxo.txid,
                vout: unblindedUtxo.vout,
                asset: unblindedUtxo.asset,
                value: unblindedUtxo.value,
                asset_bf: unblindedUtxo.assetBlindingFactor,
                value_bf: unblindedUtxo.valueBlindingFactor,
            };

            setStatus(SideSwapStatus.Signing);
            await updateSwapSideswap({ status: SideSwapStatus.Signing });

            const result = await executeSideSwapTrade(
                [utxo],
                unblindedUtxo.value,
                sideswap.userAddress,
                wallet.address,
                (psetBase64: string) => signPset(psetBase64, wallet),
            );

            const withinSlippage =
                sideswap.quoteAmountEstimate <= 0 ||
                result.quoteAmount >=
                    sideswap.quoteAmountEstimate * (1 - SLIPPAGE_TOLERANCE);

            if (!withinSlippage) {
                log.warn("SideSwap quote outside slippage tolerance", {
                    expected: sideswap.quoteAmountEstimate,
                    actual: result.quoteAmount,
                    tolerance: SLIPPAGE_TOLERANCE,
                });
            }

            try {
                await sweepToUserAddress(
                    result.txid,
                    wallet,
                    sideswap.userAddress,
                );
            } catch (e) {
                log.warn(
                    "Post-trade sweep failed (user can retry via recovery):",
                    e,
                );
            }

            setStatus(SideSwapStatus.Confirmed);
            setTxid(result.txid);
            await updateSwapSideswap({
                status: SideSwapStatus.Confirmed,
                txid: result.txid,
            });

            log.info("SideSwap trade completed:", result.txid);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            log.error("SideSwap execution failed:", errorMsg);
            setStatus(SideSwapStatus.Failed);
            notify("error", errorMsg);
            await updateSwapSideswap({
                status: SideSwapStatus.Failed,
                error: errorMsg,
            });
        }
    };

    onMount(() => {
        if (
            props.swap.sideswap?.status === SideSwapStatus.Failed &&
            !props.swap.sideswap?.txid
        ) {
            const storedError = props.swap.sideswap?.error;
            if (storedError) {
                log.warn("Retrying previously failed SideSwap:", storedError);
            }
        }
        void executeSideSwap();
    });

    onCleanup(() => {
        if (pollTimer) {
            clearTimeout(pollTimer);
        }
    });

    return (
        <div>
            <Show when={status() === SideSwapStatus.Pending}>
                <h2>{t("tx_confirmed")}</h2>
                <p>{t("preparing_sideswap")}</p>
                <LoadingSpinner />
            </Show>

            <Show when={status() === SideSwapStatus.WaitingConfirmation}>
                <h2>{t("tx_confirmed")}</h2>
                <p>{t("waiting_liquid_confirmation")}</p>
                <LoadingSpinner />
            </Show>

            <Show when={status() === SideSwapStatus.Quoting}>
                <h2>{t("sideswap_quoting")}</h2>
                <p>{t("getting_sideswap_quote")}</p>
                <LoadingSpinner />
            </Show>

            <Show when={status() === SideSwapStatus.Signing}>
                <h2>{t("sideswap_signing")}</h2>
                <p>{t("signing_sideswap_transaction")}</p>
                <LoadingSpinner />
            </Show>

            <Show when={status() === SideSwapStatus.Broadcasting}>
                <h2>{t("sideswap_complete")}</h2>
                <p>{t("preparing_sideswap")}</p>
                <LoadingSpinner />
            </Show>

            <Show when={status() === SideSwapStatus.Confirmed}>
                <h2>{t("sideswap_complete")}</h2>
                <Show when={txid()}>
                    <p>
                        {t("sideswap_transaction")}: {txid()}
                    </p>
                </Show>
            </Show>

            <Show when={status() === SideSwapStatus.Failed}>
                <h2>{t("sideswap_failed")}</h2>
                <SideSwapRecovery swap={props.swap} />
            </Show>
        </div>
    );
};

export default SideSwapExecution;
