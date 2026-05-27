import { SwapPosition } from "boltz-swaps/types";
import log from "loglevel";
import { Show, createSignal, onCleanup, onMount, untrack } from "solid-js";

import LoadingSpinner from "../components/LoadingSpinner";
import SideSwapRecovery from "../components/SideSwapRecovery";
import { config } from "../config";
import { LBTC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { broadcastToExplorer, getFeeEstimations } from "../utils/blockchain";
import {
    buildMultiAssetSweepTransaction,
    deriveTempLiquidWallet,
    findAllOutputsForScript,
    findOutputForScript,
    signPset,
    unblindOutput,
} from "../utils/liquidWallet";
import { type SideSwapUtxo, executeSideSwapTrade } from "../utils/sideswap";
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
    const castSwap = swap as ReverseSwap | ChainSwap;
    return castSwap.claimPrivateKeyIndex ?? swap.sideswap?.tempKeyIndex ?? 0;
};

type SideSwapExecutionProps = {
    swap: SomeSwap;
};

const SideSwapExecution = (props: SideSwapExecutionProps) => {
    const { t, setSwapStorage, rescueFile, notify } = useGlobalContext();
    const { setSwap } = usePayContext();
    const initialSwap = untrack(() => props.swap);

    const [status, setStatus] = createSignal<SideSwapStatus>(
        initialSwap.sideswap?.status ?? SideSwapStatus.Pending,
    );
    const [txid, setTxid] = createSignal<string | undefined>(
        initialSwap.sideswap?.txid,
    );

    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let latestSwap = initialSwap;

    const updateSwapSideswap = async (
        update: Partial<SideSwapDetail>,
        swapUpdate: Partial<SomeSwap> = {},
    ) => {
        const current = latestSwap.sideswap;
        if (!current) return;

        const updated = { ...current, ...update };
        const updatedSwap = {
            ...latestSwap,
            ...swapUpdate,
            sideswap: updated,
        } as SomeSwap;
        latestSwap = updatedSwap;
        await setSwapStorage(updatedSwap);
        setSwap(updatedSwap);
    };

    const waitForClaimTx = async (): Promise<string> => {
        const claimTx = latestSwap.claimTx;
        if (!claimTx) {
            throw new Error("No claim transaction found");
        }

        setStatus(SideSwapStatus.WaitingConfirmation);
        await updateSwapSideswap({
            status: SideSwapStatus.WaitingConfirmation,
        });

        return new Promise<string>((resolve) => {
            const check = async () => {
                try {
                    const txHex = await fetchBlockExplorerTx(LBTC, claimTx);
                    if (txHex) {
                        resolve(txHex);
                        return;
                    }
                } catch (e) {
                    log.debug("Waiting for Liquid claim tx:", e);
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
            await new Promise((resolve) =>
                setTimeout(resolve, CONFIRMATION_POLL_INTERVAL),
            );
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
            log.warn("No outputs found at temp wallet after SideSwap trade");
            return;
        }

        const feeApis = config.assets?.[LBTC]?.blockExplorerApis;
        let feeRate = 0.1;
        if (feeApis?.length) {
            try {
                feeRate = await getFeeEstimations(feeApis[0]);
            } catch (e) {
                log.warn("Could not fetch fee estimation, using default:", e);
            }
        }

        const sweepHex = await buildMultiAssetSweepTransaction(
            utxos,
            wallet,
            userAddress,
            feeRate,
        );

        const result = await broadcastToExplorer(LBTC, sweepHex);
        log.info("SideSwap sweep transaction broadcast:", result.id);
    };

    const executeSideSwap = async () => {
        const sideswap = props.swap.sideswap;
        const file = rescueFile();
        if (!sideswap || file === null) return;

        try {
            if (sideswap.status === SideSwapStatus.Confirmed) {
                setStatus(SideSwapStatus.Confirmed);
                setTxid(sideswap.txid);
                return;
            }

            if (sideswap.txid) {
                setStatus(SideSwapStatus.Confirmed);
                setTxid(sideswap.txid);
                return;
            }

            const keyIndex = getClaimKeyIndex(props.swap);
            const wallet = deriveTempLiquidWallet(file, keyIndex);
            const txHex = await waitForClaimTx();
            const vout = findOutputForScript(txHex, wallet.outputScript);
            if (vout === undefined) {
                throw new Error(
                    "Could not find temp wallet output in claim transaction",
                );
            }

            const unblinded = await unblindOutput(
                txHex,
                vout,
                wallet.blindingPrivateKey,
            );
            const lbtcUtxos = [unblinded].filter(
                (utxo) => utxo.asset === sideswap.baseAssetId,
            );

            if (lbtcUtxos.length === 0) {
                throw new Error("Could not find L-BTC UTXO at temp wallet");
            }

            const lbtcAmount = lbtcUtxos.reduce(
                (sum, utxo) => sum + utxo.value,
                0,
            );
            const utxos: SideSwapUtxo[] = lbtcUtxos.map((utxo) => ({
                txid: utxo.txid,
                vout: utxo.vout,
                asset: utxo.asset,
                value: utxo.value,
                asset_bf: utxo.assetBlindingFactor,
                value_bf: utxo.valueBlindingFactor,
                redeem_script: null,
            }));

            setStatus(SideSwapStatus.Signing);
            await updateSwapSideswap({
                status: SideSwapStatus.Signing,
                tempAddress: wallet.address,
                tempKeyIndex: wallet.keyIndex,
            });

            const result = await executeSideSwapTrade(
                utxos,
                lbtcAmount,
                sideswap.userAddress,
                wallet.address,
                (psetBase64: string) =>
                    Promise.resolve(signPset(psetBase64, wallet)),
                sideswap.quoteAmountEstimate > 0
                    ? Math.floor(
                          sideswap.quoteAmountEstimate *
                              (1 - SLIPPAGE_TOLERANCE),
                      )
                    : undefined,
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
                    "Post-trade sweep failed; user can retry via recovery:",
                    e,
                );
            }

            setStatus(SideSwapStatus.Confirmed);
            setTxid(result.txid);
            await updateSwapSideswap(
                {
                    status: SideSwapStatus.Confirmed,
                    txid: result.txid,
                    quoteAmountEstimate: result.quoteAmount,
                },
                {
                    receiveAmount: result.quoteAmount,
                    dex:
                        latestSwap.dex?.position === SwapPosition.Post
                            ? {
                                  ...latestSwap.dex,
                                  quoteAmount: result.quoteAmount,
                              }
                            : latestSwap.dex,
                },
            );
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

            <Show when={status() === SideSwapStatus.Signing}>
                <h2>{t("sideswap_signing")}</h2>
                <p>{t("signing_sideswap_transaction")}</p>
                <LoadingSpinner />
            </Show>

            <Show when={status() === SideSwapStatus.Broadcasting}>
                <h2>{t("sideswap_finalizing")}</h2>
                <p>{t("sideswap_checking_change")}</p>
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
