import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { Show } from "solid-js";

import type { AlchemyCall } from "../alchemy/Alchemy";
import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { buildPreBridgeReverseBridgeRefundCalls } from "../components/RefundButton";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import { sendPopulatedTransaction } from "../utils/evmTransaction";
import {
    GasAbstractionType,
    type PreBridgeRecovery,
    PreBridgeRecoveryStatus,
    type SomeSwap,
} from "../utils/swapCreator";

const PreBridgeDexQuoteBlocked = () => {
    const navigate = useNavigate();
    const { t, getSwap, setSwapStorage, slippage } = useGlobalContext();
    const { swap, setSwap } = usePayContext();
    const { getGasAbstractionSigner } = useWeb3Signer();

    const recovery = (): PreBridgeRecovery | undefined =>
        swap()?.execution?.preBridgeRecovery;

    const persistRecovery = async (nextRecovery: PreBridgeRecovery) => {
        const currentSwap = swap();
        if (currentSwap === null) {
            return;
        }

        const latestSwap = await getSwap<SomeSwap>(currentSwap.id);
        if (latestSwap?.execution?.preBridgeRecovery === undefined) {
            return;
        }

        latestSwap.execution = {
            ...latestSwap.execution,
            preBridgeRecovery: nextRecovery,
        };
        await setSwapStorage(latestSwap);
        setSwap(latestSwap);
    };

    const retryQuote = async () => {
        const currentRecovery = recovery();
        if (currentRecovery === undefined) {
            return;
        }

        log.info(
            `User requested a pre-bridge quote retry for swap ${swap()?.id}`,
            {
                asset: currentRecovery.asset,
                amount: currentRecovery.amount,
            },
        );
        await persistRecovery({
            ...currentRecovery,
            status: PreBridgeRecoveryStatus.Retrying,
        });
    };

    const recover = async () => {
        const currentRecovery = recovery();
        const currentSwap = swap();
        if (currentRecovery === undefined || currentSwap === null) {
            log.warn(
                `Cannot recover pre-bridge funds for swap ${swap()?.id}: ` +
                    "missing recovery state or swap",
            );
            return;
        }
        if (currentSwap.bridge === undefined || currentSwap.dex === undefined) {
            log.warn(
                `Cannot recover pre-bridge funds for swap ${currentSwap.id}: ` +
                    "missing bridge or DEX details",
            );
            return;
        }

        const gasAbstractionSigner = getGasAbstractionSigner(
            currentRecovery.asset,
        );
        const reverseBridgeCalls = await buildPreBridgeReverseBridgeRefundCalls(
            {
                transactionSigner: gasAbstractionSigner,
                asset: currentRecovery.asset,
                amount: BigInt(currentRecovery.amount),
                slippage: slippage(),
                dexDetails: currentSwap.dex,
                bridge: currentSwap.bridge,
            },
        );
        const calls: AlchemyCall[] = [];
        if (currentRecovery.receiveCall !== undefined) {
            calls.push(currentRecovery.receiveCall);
        }
        calls.push(...reverseBridgeCalls);

        log.info(
            `Refunding bridged funds for swap ${currentSwap.id} to the original sender`,
            {
                asset: currentRecovery.asset,
                amount: currentRecovery.amount,
            },
        );
        const txHash = await sendPopulatedTransaction(
            GasAbstractionType.Signer,
            gasAbstractionSigner,
            calls,
        );
        log.info(
            `Refunded bridged funds for swap ${currentSwap.id} in ${txHash}`,
        );

        await persistRecovery({
            ...currentRecovery,
            status: PreBridgeRecoveryStatus.Recovered,
            txHash,
        });
    };

    return (
        <Show when={recovery()} keyed>
            {(currentRecovery) => {
                return (
                    <div>
                        <Show
                            when={
                                currentRecovery.status !==
                                PreBridgeRecoveryStatus.Recovered
                            }
                            fallback={
                                <>
                                    <p>{t("pre_bridge_refund_initiated")}</p>
                                    <Show when={currentRecovery.txHash} keyed>
                                        {(txHash) => (
                                            <>
                                                <hr />
                                                <BlockExplorer
                                                    asset={
                                                        currentRecovery.asset
                                                    }
                                                    kind={
                                                        BlockExplorerTargetKind.Tx
                                                    }
                                                    id={txHash}
                                                    typeLabel="refund_tx"
                                                />
                                            </>
                                        )}
                                    </Show>
                                    <hr />
                                    <span
                                        class="btn"
                                        onClick={() => navigate("/swap")}>
                                        {t("new_swap")}
                                    </span>
                                </>
                            }>
                            <h2>{t("pre_bridge_dex_quote_blocked")}</h2>
                            <Show
                                when={
                                    currentRecovery.status ===
                                    PreBridgeRecoveryStatus.Blocked
                                }
                                fallback={
                                    <>
                                        <p>{t("retrying_quote")}</p>
                                        <LoadingSpinner />
                                    </>
                                }>
                                <p>{t("pre_bridge_dex_quote_blocked_line")}</p>
                                <button
                                    class="btn btn-light"
                                    onClick={() => void retryQuote()}>
                                    {t("retry_quote")}
                                </button>
                                <ContractTransaction
                                    asset={currentRecovery.asset}
                                    signerOverride={() =>
                                        getGasAbstractionSigner(
                                            currentRecovery.asset,
                                        )
                                    }
                                    onClick={recover}
                                    buttonText={t("refund")}
                                    waitingText={t("recovering_bridged_funds")}
                                />
                            </Show>
                        </Show>
                    </div>
                );
            }}
        </Show>
    );
};

export default PreBridgeDexQuoteBlocked;
