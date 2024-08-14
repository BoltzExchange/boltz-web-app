import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import QrScanner from "qr-scanner";
import { Show, createEffect, createSignal, onMount } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import ConnectWallet from "../components/ConnectWallet";
import RefundButton from "../components/RefundButton";
import SwapList from "../components/SwapList";
import SwapListLogs from "../components/SwapListLogs";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { SwapType } from "../consts/Enums";
import { swapStatusFailed, swapStatusSuccess } from "../consts/SwapStatus";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { getLockupTransaction, getSwapStatus } from "../utils/boltzClient";
import {
    LogRefundData,
    scanLogsForPossibleRefunds,
} from "../utils/contractLogs";
import { validateRefundFile } from "../utils/refundFile";
import { SomeSwap } from "../utils/swapCreator";
import ErrorWasm from "./ErrorWasm";

const Refund = () => {
    const navigate = useNavigate();
    const { getSwap, getSwaps, updateSwapStatus, wasmSupported, t } =
        useGlobalContext();
    const { signer, providers, getEtherSwap } = useWeb3Signer();

    const [swapFound, setSwapFound] = createSignal(null);
    const [refundInvalid, setRefundInvalid] = createSignal(false);
    const [refundJson, setRefundJson] = createSignal(null);
    const [refundTxId, setRefundTxId] = createSignal<string>("");

    const checkRefundJsonKeys = async (input: HTMLInputElement, json: any) => {
        log.debug("checking refund json", json);

        try {
            const data = validateRefundFile(json);

            // When the swap id is found in the local storage, show a redirect to it
            const localStorageSwap = await getSwap(data.id);
            if (localStorageSwap !== null) {
                setSwapFound(data.id);
                return;
            }

            setRefundJson(data);
            setRefundInvalid(false);
        } catch (e) {
            log.warn("Refund json validation failed", e);
            setRefundInvalid(true);
            input.setCustomValidity(t("invalid_refund_file"));
        }
    };

    const uploadChange = (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const inputFile = input.files[0];
        input.setCustomValidity("");
        setRefundJson(null);
        setSwapFound(null);
        setRefundInvalid(false);

        if (inputFile.type === "image/png") {
            QrScanner.scanImage(inputFile, { returnDetailedScanResult: true })
                .then(
                    async (result) =>
                        await checkRefundJsonKeys(
                            input,
                            JSON.parse(result.data),
                        ),
                )
                .catch((e) => {
                    log.error("invalid QR code upload", e);
                    setRefundInvalid(true);
                    input.setCustomValidity(t("invalid_refund_file"));
                });
        } else {
            inputFile
                .text()
                .then(async (result) => {
                    await checkRefundJsonKeys(input, JSON.parse(result));
                })
                .catch((e) => {
                    log.error("invalid file upload", e);
                    setRefundInvalid(true);
                    input.setCustomValidity(t("invalid_refund_file"));
                });
        }
    };

    const refundSwapsSanityFilter = (swap: SomeSwap) =>
        swap.type !== SwapType.Reverse && swap.refundTx === undefined;

    const [refundableSwaps, setRefundableSwaps] = createSignal<SomeSwap[]>([]);
    const [logRefundableSwaps, setLogRefundableSwaps] = createSignal<
        LogRefundData[]
    >([]);

    let refundScanAbort: AbortController | undefined = undefined;

    createEffect(async () => {
        setLogRefundableSwaps([]);

        if (refundScanAbort !== undefined) {
            refundScanAbort.abort("signer changed");
        }

        if (signer() === undefined) {
            return;
        }

        refundScanAbort = new AbortController();

        const generator = scanLogsForPossibleRefunds(
            refundScanAbort!.signal,
            signer(),
            getEtherSwap(),
        );

        for await (const value of generator) {
            setLogRefundableSwaps(logRefundableSwaps().concat(value));
        }
    });

    onMount(async () => {
        const addToRefundableSwaps = (swap: SomeSwap) => {
            setRefundableSwaps(refundableSwaps().concat(swap));
        };

        const swapsToRefund = (await getSwaps())
            .filter(refundSwapsSanityFilter)
            .filter((swap) =>
                [
                    swapStatusFailed.InvoiceFailedToPay,
                    swapStatusFailed.TransactionLockupFailed,
                ].includes(swap.status),
            );
        setRefundableSwaps(swapsToRefund);

        (await getSwaps())
            .filter(refundSwapsSanityFilter)
            .filter(
                (swap) =>
                    swap.status !== swapStatusSuccess.TransactionClaimed &&
                    swapsToRefund.find((found) => found.id === swap.id) ===
                        undefined,
            )
            .map(async (swap) => {
                try {
                    const res = await getSwapStatus(swap.assetSend, swap.id);
                    if (
                        !(await updateSwapStatus(swap.id, res.status)) &&
                        Object.values(swapStatusFailed).includes(res.status)
                    ) {
                        if (res.status !== swapStatusFailed.SwapExpired) {
                            addToRefundableSwaps(swap);
                            return;
                        }

                        // Make sure coins were locked for the swap with status "swap.expired"
                        await getLockupTransaction(
                            swap.assetSend,
                            swap.id,
                            swap.type,
                        );
                        addToRefundableSwaps(swap);
                    }
                } catch (e) {
                    log.warn("failed to get swap status", swap.id, e);
                }
            });
    });

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div id="refund">
                <div class="frame" data-testid="refundFrame">
                    <SettingsCog />
                    <h2>{t("refund_a_swap")}</h2>
                    <p>{t("refund_a_swap_subline")}</p>
                    <Show when={logRefundableSwaps().length > 0}>
                        <SwapListLogs swaps={logRefundableSwaps} />
                    </Show>
                    <Show when={refundableSwaps().length > 0}>
                        <SwapList swapsSignal={refundableSwaps} />
                    </Show>
                    <input
                        required
                        type="file"
                        id="refundUpload"
                        data-testid="refundUpload"
                        accept="application/json,image/png"
                        onChange={(e) => uploadChange(e)}
                    />
                    <Show when={Object.keys(providers()).length > 0}>
                        <hr />
                        <ConnectWallet />
                    </Show>
                    <Show when={swapFound() !== null}>
                        <hr />
                        <p>{t("swap_in_history")}</p>
                        <button
                            class="btn btn-success"
                            onClick={() => navigate(`/swap/${swapFound()}`)}>
                            {t("open_swap")}
                        </button>
                    </Show>
                    <Show when={refundInvalid()}>
                        <hr />
                        <button class="btn" disabled={true}>
                            {t("invalid_refund_file")}
                        </button>
                    </Show>
                    <Show when={refundTxId() === "" && refundJson() !== null}>
                        <hr />
                        <RefundButton
                            swap={refundJson}
                            setRefundTxId={setRefundTxId}
                        />
                    </Show>
                    <Show when={refundTxId() !== ""}>
                        <hr />
                        <p>{t("refunded")}</p>
                        <hr />
                        <BlockExplorer
                            typeLabel={"refund_tx"}
                            asset={refundJson().asset || refundJson().assetSend}
                            txId={refundTxId()}
                        />
                    </Show>
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default Refund;
