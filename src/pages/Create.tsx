import { useLocation, useSearchParams } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import { Show, createEffect, createSignal, on, onMount } from "solid-js";

import Accordion from "../components/Accordion";
import AddressInput from "../components/AddressInput";
import Asset from "../components/Asset";
import AssetSelect from "../components/AssetSelect";
import ConnectWallet from "../components/ConnectWallet";
import CreateButton, { BackupDone } from "../components/CreateButton";
import { FeeComparisonTable } from "../components/FeeComparisonTable";
import Fees from "../components/Fees";
import InvoiceInput from "../components/InvoiceInput";
import LoadingSpinner from "../components/LoadingSpinner";
import QrScan from "../components/QrScan";
import Reverse from "../components/Reverse";
import WeblnButton from "../components/WeblnButton";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { config } from "../config";
import { RBTC } from "../consts/Assets";
import { Denomination, Side, SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
    calculateReceiveAmount,
    calculateSendAmount,
} from "../utils/calculate";
import {
    calculateDigits,
    convertAmount,
    formatAmount,
    formatDenomination,
    getValidationRegex,
} from "../utils/denomination";
import { isMobile } from "../utils/helper";
import ErrorWasm from "./ErrorWasm";

const Create = () => {
    let receiveAmountRef: HTMLInputElement | undefined;
    let sendAmountRef: HTMLInputElement | undefined;

    const location = useLocation<{ backupDone?: string }>();
    const [searchParams] = useSearchParams();
    const [isAccordionOpen, setIsAccordionOpen] = createSignal(false);

    const {
        separator,
        setSeparator,
        setDenomination,
        denomination,
        wasmSupported,
        webln,
        t,
        notify,
        pairs,
        regularPairs,
    } = useGlobalContext();
    const {
        swapType,
        assetSend,
        assetReceive,
        assetSelect,
        assetSelected,
        invoiceValid,
        addressValid,
        sendAmount,
        setSendAmount,
        receiveAmount,
        setReceiveAmount,
        sendAmountFormatted,
        setSendAmountFormatted,
        receiveAmountFormatted,
        setReceiveAmountFormatted,
        amountChanged,
        setAmountChanged,
        minimum,
        maximum,
        setAmountValid,
        boltzFee,
        minerFee,
        pairValid,
        setAssetSend,
        setAssetReceive,
    } = useCreateContext();

    // if btc and amount > 10, switch to sat
    // user failed to notice the non satoshi denomination
    const changeDenomination = (amount: string) => {
        if (amount === "") return;
        if (denomination() === Denomination.Btc && Number(amount) >= 10) {
            setDenomination(Denomination.Sat);
        } else if (denomination() === Denomination.Sat && Number(amount) < 1) {
            setDenomination(Denomination.Btc);
        }
    };

    const isEmptyAmount = (amount: string): boolean => {
        return amount === "";
    };

    const resetAmounts = () => {
        setReceiveAmount(BigNumber(0));
        setSendAmount(BigNumber(0));
    };

    const changeReceiveAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value
            .trim()
            .replaceAll(" ", "")
            .replaceAll(",", ".");
        if (isEmptyAmount(amount)) {
            resetAmounts();
            validateAmount();
            return;
        }
        changeDenomination(amount);
        const satAmount = convertAmount(BigNumber(amount), denomination());
        const sendAmount = calculateSendAmount(
            satAmount,
            boltzFee(),
            minerFee(),
            swapType(),
        );
        setAmountChanged(Side.Receive);
        setReceiveAmount(satAmount);
        setSendAmount(sendAmount);
        validateAmount();
    };

    const changeSendAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value
            .trim()
            .replaceAll(" ", "")
            .replaceAll(",", ".");
        if (isEmptyAmount(amount)) {
            resetAmounts();
            validateAmount();
            return;
        }
        changeDenomination(amount);
        const satAmount = convertAmount(BigNumber(amount), denomination());
        const receiveAmount = calculateReceiveAmount(
            satAmount,
            boltzFee(),
            minerFee(),
            swapType(),
        );
        setAmountChanged(Side.Send);
        setSendAmount(satAmount);
        setReceiveAmount(receiveAmount);
        validateAmount();
    };

    const validateInput = (evt: KeyboardEvent) => {
        const input = evt.currentTarget as HTMLInputElement;
        const keycode = evt.key;
        if (keycode === "." || keycode === ",") {
            setSeparator(keycode);
            // switch to BTC denomination
            if (denomination() == "sat") {
                setDenomination(Denomination.Btc);
            }
        }
        const hasDot = input.value.includes(".") || input.value.includes(",");
        const regex =
            denomination() == "sat" || hasDot ? /[0-9]/ : /[0-9]|\.|,/;
        if (!regex.test(keycode)) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };

    const sanitizeInputValue = (value: string) =>
        value.replace(",", ".").replace(" ", "");

    const validatePaste = (evt: ClipboardEvent) => {
        const clipboardData = evt.clipboardData || globalThis.clipboardData;
        const pastedData = clipboardData
            .getData("Text")
            .replace(/\s+/g, "")
            .trim();
        if (!getValidationRegex(maximum()).test(pastedData)) {
            evt.stopPropagation();
            evt.preventDefault();
            notify("error", t("paste_invalid"));
            return;
        }

        if (pastedData.includes(".") || pastedData.includes(",")) {
            setSeparator(pastedData.includes(".") ? "." : ",");
        }

        const input = evt.currentTarget as HTMLInputElement;
        // prevent pasting the same value
        if (
            input.value &&
            sanitizeInputValue(pastedData) === sanitizeInputValue(input.value)
        ) {
            evt.stopPropagation();
            evt.preventDefault();
            return;
        }
        // replace values from input before pasting
        input.value = "";
    };

    const validateAmount = () => {
        const setCustomValidity = (val: string, isZero: boolean) => {
            [sendAmountRef, receiveAmountRef].forEach((ref) => {
                ref.setCustomValidity(val);
                if (!isZero && val !== "") {
                    ref.classList.add("invalid");
                } else {
                    ref.classList.remove("invalid");
                }
            });
        };

        setCustomValidity("", false);

        const amount = Number(sendAmount());
        if (
            swapType() === SwapType.Chain &&
            assetSend() !== RBTC &&
            amount === 0
        ) {
            setAmountValid(true);
            return;
        }

        const lessThanMin = amount < minimum();

        if (lessThanMin || amount > maximum()) {
            const params = {
                amount: formatAmount(
                    BigNumber(lessThanMin ? minimum() : maximum()),
                    denomination(),
                    separator(),
                ),
                denomination: formatDenomination(denomination(), assetSend()),
            };
            const label = lessThanMin ? "minimum_amount" : "maximum_amount";
            const errorMsg = t(label, params);
            setCustomValidity(errorMsg, amount === 0);
            setAmountValid(false);
            return;
        }
        setAmountValid(true);
    };

    const setAmount = (amount: number) => {
        setSendAmount(BigNumber(amount));
        setReceiveAmount(
            calculateReceiveAmount(
                BigNumber(amount),
                boltzFee(),
                minerFee(),
                swapType(),
            ),
        );
        validateAmount();
        sendAmountRef?.focus();
    };

    onMount(() => {
        sendAmountRef?.focus();
    });

    createEffect(
        on([boltzFee, minerFee, swapType, assetReceive], () => {
            if (amountChanged() === Side.Receive) {
                setSendAmount(
                    calculateSendAmount(
                        receiveAmount(),
                        boltzFee(),
                        minerFee(),
                        swapType(),
                    ),
                );
            } else {
                setReceiveAmount(
                    calculateReceiveAmount(
                        sendAmount(),
                        boltzFee(),
                        minerFee(),
                        swapType(),
                    ),
                );
            }
            if (receiveAmount().isGreaterThan(0)) validateAmount();
        }),
    );

    createEffect(() => {
        if (assetSelect()) {
            return;
        }

        const ref =
            assetSelected() === Side.Send ? sendAmountRef : receiveAmountRef;
        ref?.focus();
    });

    createEffect(() => {
        const rAmount = Number(receiveAmount());
        if (rAmount > 0) {
            setReceiveAmountFormatted(
                formatAmount(
                    BigNumber(rAmount),
                    denomination(),
                    separator(),
                ).toString(),
            );
        } else {
            setReceiveAmountFormatted("");
        }
        const sAmount = Number(sendAmount());
        if (sAmount > 0) {
            setSendAmountFormatted(
                formatAmount(
                    BigNumber(sAmount),
                    denomination(),
                    separator(),
                ).toString(),
            );
        } else {
            setSendAmountFormatted("");
        }
    });

    createEffect(() => {
        if (searchParams.sendAsset) {
            setAssetSend(searchParams.sendAsset as string);
        }
        if (searchParams.receiveAsset) {
            setAssetReceive(searchParams.receiveAsset as string);
        }
    });

    // validate amounts when invoice is valid, because we
    // set the amount based on invoice amount if amount is 0
    createEffect(() => {
        if (invoiceValid()) {
            validateAmount();
        }
    });
    createEffect(() => {
        if (addressValid()) {
            validateAmount();
        }
    });

    const creatingSwap = () => location.state?.backupDone === BackupDone.True;

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div class="frame">
                <div
                    class="creating-swap-loading"
                    style={{
                        display: creatingSwap() ? "flex" : "none",
                    }}>
                    <LoadingSpinner />
                </div>
                <div
                    style={{
                        display: !creatingSwap() ? "block" : "none",
                    }}>
                    <SettingsCog />
                    <h2 data-testid="create-swap-title">{t("create_swap")}</h2>
                    {t("create_swap_subline")} <br />
                    <span class="swap-limits">
                        <span>
                            {t("send")} {t("min")}:
                            <span
                                onClick={() => setAmount(minimum())}
                                class="btn-small btn-light">
                                {formatAmount(
                                    BigNumber(minimum()),
                                    denomination(),
                                    separator(),
                                )}
                            </span>
                            <span
                                class="denominator"
                                data-denominator={denomination()}
                            />
                        </span>
                        <span>
                            {t("max")}:
                            <span
                                onClick={() => setAmount(maximum())}
                                class="btn-small btn-light">
                                {formatAmount(
                                    BigNumber(maximum()),
                                    denomination(),
                                    separator(),
                                )}
                            </span>
                            <span
                                class="denominator"
                                data-denominator={denomination()}
                            />
                        </span>
                    </span>
                    <Show when={config.isPro}>
                        <Accordion
                            title={t("swap_opportunities_accordion")}
                            isOpen={isAccordionOpen()}
                            onClick={() =>
                                setIsAccordionOpen(!isAccordionOpen())
                            }>
                            <FeeComparisonTable
                                proPairs={pairs()}
                                regularPairs={regularPairs()}
                                onSelect={(opportunity) => {
                                    if (
                                        assetSend() !== opportunity.assetSend ||
                                        assetReceive() !==
                                            opportunity.assetReceive
                                    ) {
                                        setAssetSend(opportunity.assetSend);
                                        setAssetReceive(
                                            opportunity.assetReceive,
                                        );
                                    }
                                    setIsAccordionOpen(false);
                                }}
                            />
                        </Accordion>
                    </Show>
                    <div class="icons">
                        <div>
                            <Asset side={Side.Send} signal={assetSend} />
                            <input
                                ref={sendAmountRef}
                                autofocus
                                required
                                type="text"
                                placeholder="0"
                                maxlength={calculateDigits(
                                    maximum(),
                                    denomination(),
                                )}
                                inputmode={
                                    denomination() == "btc"
                                        ? "decimal"
                                        : "numeric"
                                }
                                id="sendAmount"
                                data-testid="sendAmount"
                                autocomplete="off"
                                value={sendAmountFormatted()}
                                onPaste={(e) => validatePaste(e)}
                                onKeyPress={(e) => validateInput(e)}
                                onInput={(e) => changeSendAmount(e)}
                            />
                        </div>
                        <Reverse />
                        <div>
                            <Asset side={Side.Receive} signal={assetReceive} />
                            <input
                                ref={receiveAmountRef}
                                required
                                type="text"
                                placeholder="0"
                                maxlength={calculateDigits(
                                    maximum(),
                                    denomination(),
                                )}
                                inputmode={
                                    denomination() == "btc"
                                        ? "decimal"
                                        : "numeric"
                                }
                                id="receiveAmount"
                                data-testid="receiveAmount"
                                autocomplete="off"
                                value={receiveAmountFormatted()}
                                onPaste={(e) => validatePaste(e)}
                                onKeyPress={(e) => validateInput(e)}
                                onInput={(e) => changeReceiveAmount(e)}
                            />
                        </div>
                    </div>
                    <Fees />
                    <hr class="spacer" />
                    <Show when={assetReceive() === RBTC}>
                        <ConnectWallet disabled={() => !pairValid()} />
                        <hr class="spacer" />
                    </Show>
                    <Show
                        when={
                            swapType() !== SwapType.Submarine &&
                            assetReceive() !== RBTC
                        }>
                        <AddressInput />
                    </Show>
                    <Show when={swapType() === SwapType.Submarine}>
                        <Show when={webln()}>
                            <WeblnButton />
                            <hr class="spacer" />
                        </Show>
                        <InvoiceInput />
                    </Show>
                    <Show when={isMobile() && assetReceive() !== RBTC}>
                        <QrScan />
                    </Show>
                    <CreateButton />
                    <AssetSelect />
                    <SettingsMenu />
                </div>
            </div>
        </Show>
    );
};

export default Create;
