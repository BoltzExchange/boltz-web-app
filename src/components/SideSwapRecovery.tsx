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
import type { RescueFile } from "../utils/rescueFile";
import { fetchBlockExplorerTx } from "../utils/sideswapHelpers";
import {
    type ChainSwap,
    type ReverseSwap,
    SideSwapStatus,
    type SomeSwap,
} from "../utils/swapCreator";
import BlockExplorer, { BlockExplorerTargetKind } from "./BlockExplorer";
import LoadingSpinner from "./LoadingSpinner";

type SideSwapRecoveryProps = {
    swap: SomeSwap;
    rescueFileOverride?: RescueFile;
};

const SideSwapRecovery = (props: SideSwapRecoveryProps) => {
    const {
        t,
        setSwapStorage,
        rescueFile: globalRescueFile,
        notify,
    } = useGlobalContext();
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
        const file = rescueFile();
        if (!sideswap || file === null || file === undefined) return;
        if (!addressValid()) return;

        setLoading(true);
        try {
            const castSwap = props.swap as ReverseSwap | ChainSwap;
            const keyIndex =
                castSwap.claimPrivateKeyIndex ?? sideswap.tempKeyIndex ?? 0;
            const wallet = deriveTempLiquidWallet(file, keyIndex);
            const sourceTx = sideswap.txid ?? props.swap.claimTx;

            const utxos =
                sourceTx !== undefined
                    ? await findAllOutputsForScript(
                          await fetchBlockExplorerTx(LBTC, sourceTx),
                          wallet.outputScript,
                          wallet.blindingPrivateKey,
                      )
                    : (
                          await Promise.all(
                              (await getAddressUTXOs(LBTC, wallet.address)).map(
                                  async (utxo) =>
                                      findAllOutputsForScript(
                                          await fetchBlockExplorerTx(
                                              LBTC,
                                              utxo.txid,
                                          ),
                                          wallet.outputScript,
                                          wallet.blindingPrivateKey,
                                      ),
                              ),
                          )
                      ).flat();

            if (utxos.length === 0) {
                throw new Error("No UTXOs found at temp wallet");
            }

            log.info("Sweeping temp Liquid wallet:", {
                utxoCount: utxos.length,
                to: sweepAddress(),
            });

            const feeApis = config.assets?.[LBTC]?.blockExplorerApis;
            let feeRate = 0.1;
            if (feeApis?.length) {
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
            log.error("SideSwap recovery sweep failed:", errorMsg);
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
                        <BlockExplorer
                            asset={LBTC}
                            kind={BlockExplorerTargetKind.Tx}
                            id={sweepTxid()!}
                            typeLabel="refund_tx"
                        />
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
