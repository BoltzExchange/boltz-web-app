import { useSearchParams } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import { getRpcUrls } from "boltz-swaps/config";
import { AssetKind, NetworkTransport } from "boltz-swaps/types";
import log from "loglevel";
import {
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    on,
    onCleanup,
    onMount,
} from "solid-js";

import Accordion from "../components/Accordion";
import AddressInput from "../components/AddressInput";
import Asset from "../components/Asset";
import AssetSelect from "../components/AssetSelect";
import ConnectWallet from "../components/ConnectWallet";
import CreateButton from "../components/CreateButton";
import { FeeComparisonTable } from "../components/FeeComparisonTable";
import Fees from "../components/Fees";
import FiatAmount from "../components/FiatAmount";
import InvoiceInput from "../components/InvoiceInput";
import NetworkSelect from "../components/NetworkSelect";
import QrScan from "../components/QrScan";
import Reverse from "../components/Reverse";
import SwapLimits from "../components/SwapLimits";
import WeblnButton from "../components/WeblnButton";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { config } from "../config";
import {
    LN,
    RBTC,
    getNetworkTransport,
    isWalletConnectableAsset,
} from "../consts/Assets";
import { Denomination, Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useFiatContext } from "../context/Fiat";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import Pair, { RequiredInput } from "../utils/Pair";
import { getAssetNativeBalance } from "../utils/chains/balance";
import { canCommitSubmarineSendAmount } from "../utils/commitmentSwap";
import { getConnectedMaximum } from "../utils/connectedMaximum";
import {
    calculateDigits,
    convertAmount,
    formatAmount,
    formatDenomination,
    getValidationRegex,
} from "../utils/denomination";
import { isMobile } from "../utils/helper";
import { decodeInvoice, isBolt12Offer, isLnurl } from "../utils/invoice";
import { gasTopUpSupported, getGasTopUpNativeAmount } from "../utils/quoter";
import ErrorWasm from "./ErrorWasm";

// TODO: formatted amounts should be *instant* and not depend on quote being calculated

const Create = () => {
    let receiveAmountRef: HTMLInputElement | undefined;
    let sendAmountRef: HTMLInputElement | undefined;

    const [searchParams, setSearchParams] = useSearchParams();
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
        gasTopUp,
        embeddedMode,
    } = useGlobalContext();
    const { fetchBtcPrice } = useFiatContext();
    const {
        pair,
        setPair,
        getGasToken,
        setGetGasToken,
        assetSelection,
        assetSelected,
        invoice,
        lnurl,
        bolt12Offer,
        setInvoice,
        invoiceValid,
        setInvoiceValid,
        setInvoiceError,
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
        limitsLoading,
        setAmountValid,
        boltzFee,
        minerFee,
        onchainAddress,
        quoteLoading,
        setQuoteLoading,
        destinationLocked,
    } = useCreateContext();
    const { connectedWallet, signer } = useWeb3Signer();

    let quoteDebounceTimeout: number | undefined;
    let quoteRequestId = 0;

    const connectedDestination = () => {
        const walletAddress = connectedWallet()?.address;
        const transport = getNetworkTransport(pair().toAsset);
        const normalize = (address: string) =>
            transport === NetworkTransport.Evm
                ? address.toLowerCase()
                : address;

        return (
            walletAddress !== undefined &&
            onchainAddress() !== "" &&
            normalize(onchainAddress()) === normalize(walletAddress)
        );
    };
    const walletConnectAsset = () =>
        isWalletConnectableAsset(pair().toAsset)
            ? pair().toAsset
            : pair().fromAsset;
    const showsWalletConnect = createMemo(
        () =>
            isWalletConnectableAsset(pair().fromAsset) ||
            isWalletConnectableAsset(pair().toAsset),
    );
    const receiveAmountQuoteLoading = createMemo(
        () => quoteLoading() && amountChanged() === Side.Send,
    );
    const sendAmountQuoteLoading = createMemo(
        () => quoteLoading() && amountChanged() === Side.Receive,
    );
    const limitActionsLoading = createMemo(() => limitsLoading());
    const requiresInvoiceInput = createMemo(
        () =>
            pair().requiredInput === RequiredInput.Invoice ||
            (pair().requiredInput === RequiredInput.Unknown &&
                pair().toAsset === LN),
    );
    const hasDeferredInvoiceDestination = createMemo(() => {
        const currentInvoice = invoice();
        return (
            isLnurl(currentInvoice) ||
            isBolt12Offer(currentInvoice) ||
            (lnurl() !== "" && currentInvoice === lnurl()) ||
            (bolt12Offer() !== undefined && currentInvoice === bolt12Offer())
        );
    });
    const invoiceInputDisabled = createMemo(
        () =>
            requiresInvoiceInput() &&
            canCommitSubmarineSendAmount(pair(), amountChanged()) &&
            sendAmount().isFinite() &&
            sendAmount().isGreaterThan(0) &&
            !hasDeferredInvoiceDestination(),
    );
    const showsInvoiceInputSlot = createMemo(
        () => requiresInvoiceInput() && !destinationLocked(),
    );

    const gasTopUpTrigger = createMemo(() => {
        const rpcUrls = getRpcUrls(pair().toAsset);
        const gasTopUpEnabled = gasTopUp();
        const supported = gasTopUpSupported(pair().toAsset);
        const connected = connectedDestination();
        const validAddress = addressValid();
        const hasAddress = onchainAddress() !== "";
        const hasRpcUrls = rpcUrls !== undefined;

        return {
            address: onchainAddress(),
            enabled:
                gasTopUpEnabled &&
                supported &&
                connected &&
                validAddress &&
                hasAddress &&
                hasRpcUrls,
            rpcUrls,
            supported,
            connected,
            validAddress,
            hasAddress,
            hasRpcUrls,
            gasTopUpEnabled,
            asset: pair().toAsset,
            hasPostBridge: pair().hasPostBridge,
        };
    });
    createResource(
        gasTopUpTrigger,
        async ({
            address,
            enabled,
            rpcUrls,
            supported,
            connected,
            validAddress,
            hasAddress,
            hasRpcUrls,
            gasTopUpEnabled,
            asset,
            hasPostBridge,
        }) => {
            if (!enabled || rpcUrls === undefined) {
                log.info("Gas top-up auto-detect skipped", {
                    asset,
                    address,
                    gasTopUpEnabled,
                    supported,
                    connected,
                    validAddress,
                    hasAddress,
                    hasRpcUrls,
                    hasPostBridge,
                });
                setGetGasToken(false);
                return;
            }

            try {
                log.info("Gas top-up auto-detect started", {
                    asset,
                    address,
                    hasPostBridge,
                    rpcUrlCount: rpcUrls.length,
                });
                const balance = await getAssetNativeBalance(asset, address);
                const gasTokenCostWei = await getGasTopUpNativeAmount(asset);
                log.info("Gas top-up balance check", {
                    asset,
                    address,
                    balance: balance.toString(),
                    gasTokenCostWei: gasTokenCostWei.toString(),
                    connectedDestination: connectedDestination(),
                });
                if (balance < gasTokenCostWei && connectedDestination()) {
                    if (
                        hasPostBridge &&
                        !(await pair().canPostBridgeNativeDrop(address))
                    ) {
                        log.info(
                            "Gas top-up disabled because post-bridge native drop is unavailable",
                            {
                                asset,
                                address,
                            },
                        );
                        setGetGasToken(false);
                        return;
                    }

                    log.info("Gas top-up enabled", {
                        asset,
                        address,
                    });
                    setGetGasToken(true);
                    return;
                }
            } catch (error) {
                log.warn("Gas top-up auto-detect failed", {
                    asset,
                    address,
                    error,
                });
                setGetGasToken(false);
                return;
            }

            log.info("Gas top-up disabled because balance is sufficient", {
                asset,
                address,
            });
            setGetGasToken(false);
            return;
        },
        { initialValue: undefined },
    );

    const clearQuoteDebounce = () => {
        if (quoteDebounceTimeout !== undefined) {
            window.clearTimeout(quoteDebounceTimeout);
            quoteDebounceTimeout = undefined;
        }
    };

    const loadingGuard = (fn: (isCurrent: () => boolean) => Promise<void>) => {
        if (!pair().needsNetworkForQuote) {
            ++quoteRequestId;
            clearQuoteDebounce();
            setQuoteLoading(false);
            const id = quoteRequestId;
            void fn(() => id === quoteRequestId);
            return;
        }

        const requestId = ++quoteRequestId;
        setQuoteLoading(true);
        clearQuoteDebounce();

        quoteDebounceTimeout = window.setTimeout(() => {
            quoteDebounceTimeout = undefined;
            void (async () => {
                try {
                    await fn(() => requestId === quoteRequestId);
                } finally {
                    if (requestId === quoteRequestId) {
                        setQuoteLoading(false);
                    }
                }
            })();
        }, 500);
    };

    onCleanup(() => {
        clearQuoteDebounce();
        setQuoteLoading(false);
    });

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

    const clearStaleInvoice = () => {
        const currentInvoice = invoice();
        if (
            currentInvoice === "" ||
            isLnurl(currentInvoice) ||
            isBolt12Offer(currentInvoice)
        ) {
            return;
        }
        const hasFixedAmount = () => {
            try {
                return decodeInvoice(currentInvoice).satoshis !== 0;
            } catch {
                return true;
            }
        };
        if (!hasFixedAmount()) {
            return;
        }
        setInvoice("");
        setInvoiceValid(false);
        setInvoiceError(undefined);
        notify("success", t("invoice_cleared_amount_changed"));
    };

    const changeReceiveAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value
            .trim()
            .replaceAll(" ", "")
            .replaceAll(",", ".");

        setAmountChanged(Side.Receive);
        clearStaleInvoice();

        if (isEmptyAmount(amount)) {
            ++quoteRequestId;
            clearQuoteDebounce();
            setQuoteLoading(false);
            resetAmounts();
            validateAmount();
            return;
        }

        changeDenomination(amount);
        const satAmount = convertAmount(
            pair().toAsset,
            BigNumber(amount),
            denomination(),
        );

        setReceiveAmount(satAmount);
        loadingGuard(async (isCurrent) => {
            if (satAmount.isZero()) {
                setAmountChanged(Side.Receive);
                resetAmounts();
                validateAmount();
                return;
            }
            const sendAmount = await pair().calculateSendAmount(
                satAmount,
                minerFee(),
                getGasToken(),
                onchainAddress(),
            );
            if (!isCurrent()) {
                return;
            }
            setSendAmount(sendAmount);
            validateAmount();
        });
    };

    const changeSendAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value
            .trim()
            .replaceAll(" ", "")
            .replaceAll(",", ".");

        setAmountChanged(Side.Send);
        clearStaleInvoice();

        if (isEmptyAmount(amount)) {
            ++quoteRequestId;
            clearQuoteDebounce();
            setQuoteLoading(false);
            resetAmounts();
            validateAmount();
            return;
        }

        changeDenomination(amount);
        const satAmount = convertAmount(
            pair().fromAsset,
            BigNumber(amount),
            denomination(),
        );

        setSendAmount(satAmount);
        loadingGuard(async (isCurrent) => {
            const newReceiveAmount = await pair().calculateReceiveAmount(
                satAmount,
                minerFee(),
                undefined,
                getGasToken(),
                onchainAddress(),
            );
            if (!isCurrent()) {
                return;
            }
            setReceiveAmount(newReceiveAmount);
            validateAmount();
        });
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
        const clipboardData =
            evt.clipboardData ||
            (globalThis as unknown as { clipboardData: DataTransfer })
                .clipboardData;
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
                if (ref === undefined) {
                    return;
                }
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
        if (pair().canZeroAmount && amount === 0) {
            setAmountValid(true);
            return;
        }

        if (amount > 0 && receiveAmount().isZero()) {
            setCustomValidity(t("error_zero_quote"), false);
            setAmountValid(false);
            return;
        }

        const lessThanMin = amount === 0 || amount < minimum();

        if (lessThanMin || amount > maximum()) {
            const params = {
                amount: formatAmount(
                    BigNumber(lessThanMin ? minimum() : maximum()),
                    denomination(),
                    separator(),
                    pair().fromAsset,
                ),
                denomination: formatDenomination(
                    denomination(),
                    pair().fromAsset,
                ),
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
        setAmountChanged(Side.Send);
        clearStaleInvoice();
        loadingGuard(async (isCurrent) => {
            setSendAmount(BigNumber(amount));
            const newReceiveAmount = await pair().calculateReceiveAmount(
                BigNumber(amount),
                minerFee(),
                undefined,
                getGasToken(),
                onchainAddress(),
            );
            if (!isCurrent()) {
                return;
            }
            setReceiveAmount(newReceiveAmount);
            validateAmount();
            sendAmountRef?.focus();
        });
    };

    const setMaxAmount = async () => {
        const selectedPair = pair();
        let connectedMaximum: BigNumber | undefined;

        try {
            connectedMaximum = await getConnectedMaximum({
                fromAsset: selectedPair.fromAsset,
                connectedWallet: connectedWallet(),
                signer: signer(),
            });
        } catch (error) {
            log.warn("failed to resolve connected wallet max amount", {
                asset: selectedPair.fromAsset,
                error,
            });
        }

        if (pair() !== selectedPair) {
            return;
        }

        const limit = maximum();
        const selectedAmount =
            connectedMaximum === undefined ||
            !connectedMaximum.isGreaterThan(0) ||
            (limit > 0 && connectedMaximum.isGreaterThan(limit))
                ? limit
                : connectedMaximum.toNumber();
        setAmount(selectedAmount);
    };

    const clearCommittedAmounts = () => {
        if (!invoiceInputDisabled()) {
            return;
        }

        ++quoteRequestId;
        clearQuoteDebounce();
        setQuoteLoading(false);
        resetAmounts();
        setAmountValid(false);
        setAmountChanged(Side.Send);
    };

    onMount(() => {
        sendAmountRef?.focus();
    });

    createEffect(
        on([boltzFee, minerFee, pair, getGasToken, onchainAddress], () => {
            loadingGuard(async (isCurrent) => {
                if (amountChanged() === Side.Receive) {
                    if (receiveAmount().isZero()) {
                        setSendAmount(BigNumber(0));
                    } else {
                        const result = await pair().calculateSendAmount(
                            receiveAmount(),
                            minerFee(),
                            getGasToken(),
                            onchainAddress(),
                        );
                        if (!isCurrent()) {
                            return;
                        }
                        setSendAmount(result);
                    }
                } else {
                    const result = await pair().calculateReceiveAmount(
                        sendAmount(),
                        minerFee(),
                        undefined,
                        getGasToken(),
                        onchainAddress(),
                    );
                    if (!isCurrent()) {
                        return;
                    }
                    setReceiveAmount(result);
                }

                validateAmount();
            });
        }),
    );

    createEffect(() => {
        if (assetSelection() !== null) {
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
                    pair().toAsset,
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
                    pair().fromAsset,
                ).toString(),
            );
        } else {
            setSendAmountFormatted("");
        }
    });

    createEffect(
        on(
            [() => searchParams.sendAsset, () => searchParams.receiveAsset],
            ([sendAsset, receiveAsset]) => {
                const nextSendAsset = Array.isArray(sendAsset)
                    ? sendAsset[0]
                    : sendAsset;
                const nextReceiveAsset = Array.isArray(receiveAsset)
                    ? receiveAsset[0]
                    : receiveAsset;

                if (!nextSendAsset && !nextReceiveAsset) return;

                setPair((current) => {
                    const fromAsset = nextSendAsset ?? current.fromAsset;
                    const toAsset = nextReceiveAsset ?? current.toAsset;

                    if (
                        fromAsset === current.fromAsset &&
                        toAsset === current.toAsset
                    ) {
                        return current;
                    }

                    return new Pair(current.pairs, fromAsset, toAsset);
                });
                setSearchParams(
                    { sendAsset: null, receiveAsset: null },
                    { replace: true },
                );
            },
        ),
    );

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

    // Re-validate when min/max change (they are set asynchronously)
    createEffect(
        on([minimum, maximum], () => {
            if (sendAmount().isGreaterThan(0)) {
                validateAmount();
            }
        }),
    );

    createEffect(() => {
        void fetchBtcPrice();
    });

    const InvoiceInputSlot = () => (
        <div class="invoice-input-slot">
            <Show when={webln() && !invoiceInputDisabled()}>
                <WeblnButton />
                <hr class="spacer" />
            </Show>
            <Show
                when={invoiceInputDisabled()}
                fallback={
                    <InvoiceInput
                        class="committed-invoice-input"
                        disabled={invoiceInputDisabled}
                    />
                }>
                <div
                    class="committed-invoice-row"
                    data-testid="committed-invoice-row">
                    <InvoiceInput
                        class="committed-invoice-input"
                        disabled={invoiceInputDisabled}
                        placeholder={() => t("commitment_invoice_deferred")}
                    />
                    <button
                        type="button"
                        class="btn-small invoice-slot-action"
                        data-testid="committed-invoice-clear"
                        onClick={clearCommittedAmounts}>
                        {t("clear_amount")}
                    </button>
                </div>
            </Show>
        </div>
    );

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div class="frame">
                <SettingsCog />
                <h2 class="frame-title" data-testid="create-swap-title">
                    {t("create_swap")}
                </h2>
                <Show
                    when={
                        config.isPro &&
                        pairs() &&
                        regularPairs() &&
                        !embeddedMode()
                    }>
                    <Accordion
                        title={t("swap_opportunities_accordion")}
                        isOpen={isAccordionOpen()}
                        onClick={() => setIsAccordionOpen(!isAccordionOpen())}>
                        <FeeComparisonTable
                            proPairs={pairs()!}
                            regularPairs={regularPairs()!}
                            onSelect={(opportunity) => {
                                if (
                                    pair().fromAsset !==
                                        opportunity.assetSend ||
                                    pair().toAsset !== opportunity.assetReceive
                                ) {
                                    setPair(
                                        new Pair(
                                            pair().pairs,
                                            opportunity.assetSend,
                                            opportunity.assetReceive,
                                        ),
                                    );
                                }
                                setIsAccordionOpen(false);
                            }}
                        />
                    </Accordion>
                </Show>
                <div class="icons">
                    <div>
                        <Asset
                            side={Side.Send}
                            signal={() => pair().fromAsset}
                        />
                        <div class="amount-field input-with-label">
                            <div class="amount-input-wrap">
                                <span class="amount-row-label">
                                    {t("send")}
                                </span>
                                <Show when={!destinationLocked()}>
                                    <SwapLimits
                                        maximum={maximum()}
                                        maxLabel={t("max")}
                                        loading={limitActionsLoading()}
                                        maximumEnabled={
                                            maximum() > 0 ||
                                            pair().canZeroAmount
                                        }
                                        onSelectAmount={setAmount}
                                        onSelectMaximum={setMaxAmount}
                                    />
                                </Show>
                                <Show when={sendAmountQuoteLoading()}>
                                    <div
                                        class="amount-value-skeleton"
                                        aria-hidden="true"
                                    />
                                </Show>
                                <input
                                    ref={sendAmountRef}
                                    autofocus
                                    required
                                    type="text"
                                    placeholder="0"
                                    maxlength={
                                        maximum() > 0
                                            ? calculateDigits(
                                                  maximum(),
                                                  denomination(),
                                              )
                                            : undefined
                                    }
                                    inputmode={
                                        denomination() == "btc"
                                            ? "decimal"
                                            : "numeric"
                                    }
                                    id="sendAmount"
                                    data-testid="sendAmount"
                                    autocomplete="off"
                                    disabled={
                                        sendAmountQuoteLoading() ||
                                        destinationLocked()
                                    }
                                    classList={{
                                        "amount-input--quote-pending":
                                            sendAmountQuoteLoading(),
                                    }}
                                    aria-busy={sendAmountQuoteLoading()}
                                    value={sendAmountFormatted()}
                                    onPaste={(e) => validatePaste(e)}
                                    onKeyPress={(e) => validateInput(e)}
                                    onInput={(e) => changeSendAmount(e)}
                                />
                            </div>
                            <FiatAmount
                                asset={() => pair().fromAsset}
                                amount={BigNumber(sendAmount()).toNumber()}
                                variant="label"
                                for="sendAmount"
                                loading={sendAmountQuoteLoading}
                            />
                        </div>
                    </div>
                    <Show when={!destinationLocked()}>
                        <Reverse />
                    </Show>
                    <div>
                        <Asset
                            side={Side.Receive}
                            signal={() => pair().toAsset}
                            disabled={destinationLocked()}
                        />
                        <div class="amount-field input-with-label">
                            <div class="amount-input-wrap">
                                <span class="amount-row-label">
                                    {t("receive")}
                                </span>
                                <Show when={receiveAmountQuoteLoading()}>
                                    <div
                                        class="amount-value-skeleton"
                                        aria-hidden="true"
                                    />
                                </Show>
                                <input
                                    ref={receiveAmountRef}
                                    required
                                    type="text"
                                    placeholder="0"
                                    maxlength={
                                        maximum() > 0
                                            ? calculateDigits(
                                                  maximum(),
                                                  denomination(),
                                              )
                                            : undefined
                                    }
                                    inputmode={
                                        denomination() == "btc"
                                            ? "decimal"
                                            : "numeric"
                                    }
                                    id="receiveAmount"
                                    data-testid="receiveAmount"
                                    autocomplete="off"
                                    disabled={
                                        receiveAmountQuoteLoading() ||
                                        destinationLocked()
                                    }
                                    classList={{
                                        "amount-input--quote-pending":
                                            receiveAmountQuoteLoading(),
                                    }}
                                    aria-busy={receiveAmountQuoteLoading()}
                                    value={receiveAmountFormatted()}
                                    onPaste={(e) => validatePaste(e)}
                                    onKeyPress={(e) => validateInput(e)}
                                    onInput={(e) => changeReceiveAmount(e)}
                                />
                            </div>
                            <FiatAmount
                                asset={() => pair().toAsset}
                                amount={BigNumber(receiveAmount()).toNumber()}
                                variant="label"
                                for="receiveAmount"
                                loading={receiveAmountQuoteLoading}
                            />
                        </div>
                    </div>
                </div>
                <Fees />
                <hr class="spacer" />
                <Show
                    when={
                        (pair().requiredInput === RequiredInput.Address ||
                            (pair().requiredInput === RequiredInput.Unknown &&
                                pair().toAsset !== LN)) &&
                        !isWalletConnectableAsset(pair().toAsset)
                    }>
                    <Show when={!destinationLocked()}>
                        <AddressInput />
                        <hr class="spacer" />
                    </Show>
                </Show>
                <Show when={showsInvoiceInputSlot()}>
                    <InvoiceInputSlot />
                    <hr class="spacer" />
                </Show>
                <Show
                    when={
                        isMobile() &&
                        !invoiceInputDisabled() &&
                        !destinationLocked() &&
                        (pair().toAsset === LN ||
                            config.assets?.[pair().toAsset]?.type ===
                                AssetKind.UTXO)
                    }>
                    <QrScan />
                    <hr class="spacer" />
                </Show>
                <Show when={showsWalletConnect()}>
                    {/* We have no gas abstraction for RBTC */}
                    <Show
                        when={
                            isWalletConnectableAsset(pair().toAsset) &&
                            pair().toAsset !== RBTC &&
                            !connectedDestination()
                        }>
                        <Show when={!destinationLocked()}>
                            <hr class="spacer" />
                            <AddressInput />
                        </Show>
                    </Show>
                    <ConnectWallet
                        asset={walletConnectAsset()}
                        syncAddress={isWalletConnectableAsset(pair().toAsset)}
                        hideWhenUnavailable={
                            walletConnectAsset() === pair().toAsset
                        }
                        disabled={() => !pair().isRoutable}
                    />
                    <hr class="spacer" />
                </Show>
                <CreateButton />
                <Show when={embeddedMode()}>
                    <div class="embedded-branding">
                        <a
                            href="https://boltz.exchange"
                            target="_blank"
                            rel="noopener noreferrer">
                            Powered by Boltz
                        </a>
                    </div>
                </Show>
                <AssetSelect />
                <NetworkSelect />
                <SettingsMenu />
            </div>
        </Show>
    );
};

export default Create;
