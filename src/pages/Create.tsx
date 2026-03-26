import { useSearchParams } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
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
import { NetworkTransport } from "../configs/base";
import {
    AssetKind,
    LN,
    RBTC,
    getNetworkTransport,
    isWalletConnectableAsset,
} from "../consts/Assets";
import { Denomination, Side } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import Pair, { RequiredInput } from "../utils/Pair";
import {
    calculateDigits,
    convertAmount,
    formatAmount,
    formatDenomination,
    getValidationRegex,
} from "../utils/denomination";
import { isMobile } from "../utils/helper";
import { createAssetProvider, getRpcUrls } from "../utils/provider";
import { gasTopUpSupported, getGasTopUpNativeAmount } from "../utils/qouter";
import ErrorWasm from "./ErrorWasm";

// TODO: formatted amounts should be *instant* and not depend on quote being calculated

const Create = () => {
    let receiveAmountRef: HTMLInputElement | undefined;
    let sendAmountRef: HTMLInputElement | undefined;

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
        showFiatAmount,
        fetchBtcPrice,
        gasTopUp,
    } = useGlobalContext();
    const {
        pair,
        setPair,
        getGasToken,
        setGetGasToken,
        assetSelection,
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
        onchainAddress,
        setQuoteLoading,
    } = useCreateContext();
    const { connectedWallet } = useWeb3Signer();

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
            hasPostOft: pair().hasPostOft,
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
            hasPostOft,
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
                    hasPostOft,
                });
                setGetGasToken(false);
                return;
            }

            try {
                log.info("Gas top-up auto-detect started", {
                    asset,
                    address,
                    hasPostOft,
                    rpcUrlCount: rpcUrls.length,
                });
                const balance =
                    await createAssetProvider(asset).getBalance(address);
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
                        hasPostOft &&
                        !(await pair().canPostOftNativeDrop(address))
                    ) {
                        log.info(
                            "Gas top-up disabled because post-OFT native drop is unavailable",
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

    const loadingGuard = (fn: () => Promise<void>) => {
        if (!pair().needsNetworkForQuote) {
            ++quoteRequestId;
            clearQuoteDebounce();
            setQuoteLoading(false);
            void fn();
            return;
        }

        const requestId = ++quoteRequestId;
        setQuoteLoading(true);
        clearQuoteDebounce();

        quoteDebounceTimeout = window.setTimeout(() => {
            quoteDebounceTimeout = undefined;
            void (async () => {
                try {
                    await fn();
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

    const changeReceiveAmount = (evt: InputEvent) => {
        const target = evt.currentTarget as HTMLInputElement;
        const amount = target.value
            .trim()
            .replaceAll(" ", "")
            .replaceAll(",", ".");

        loadingGuard(async () => {
            if (isEmptyAmount(amount)) {
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
            const sendAmount = await pair().calculateSendAmount(
                satAmount,
                minerFee(),
                getGasToken(),
                onchainAddress(),
            );
            setAmountChanged(Side.Receive);
            setReceiveAmount(satAmount);
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

        loadingGuard(async () => {
            if (isEmptyAmount(amount)) {
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
            const receiveAmount = await pair().calculateReceiveAmount(
                satAmount,
                minerFee(),
                undefined,
                getGasToken(),
                onchainAddress(),
            );
            setAmountChanged(Side.Send);
            setSendAmount(satAmount);
            setReceiveAmount(receiveAmount);
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
        if (pair().canZeroAmount && amount === 0) {
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
        loadingGuard(async () => {
            setAmountChanged(Side.Send);
            setSendAmount(BigNumber(amount));
            const receiveAmount = await pair().calculateReceiveAmount(
                BigNumber(amount),
                minerFee(),
                undefined,
                getGasToken(),
                onchainAddress(),
            );
            setReceiveAmount(receiveAmount);
            validateAmount();
            sendAmountRef?.focus();
        });
    };

    onMount(() => {
        sendAmountRef?.focus();
    });

    createEffect(
        on([boltzFee, minerFee, pair, getGasToken, onchainAddress], () => {
            loadingGuard(async () => {
                if (amountChanged() === Side.Receive) {
                    setSendAmount(
                        await pair().calculateSendAmount(
                            receiveAmount(),
                            minerFee(),
                            getGasToken(),
                            onchainAddress(),
                        ),
                    );
                } else {
                    setReceiveAmount(
                        await pair().calculateReceiveAmount(
                            sendAmount(),
                            minerFee(),
                            undefined,
                            getGasToken(),
                            onchainAddress(),
                        ),
                    );
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
            },
            { defer: true },
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

    return (
        <Show when={wasmSupported()} fallback={<ErrorWasm />}>
            <div class="frame">
                <SettingsCog />
                <h2 data-testid="create-swap-title">{t("create_swap")}</h2>
                {t("create_swap_subline")} <br />
                <SwapLimits
                    asset={pair().fromAsset}
                    denomination={denomination()}
                    maximum={maximum()}
                    maximumLabel={t("max")}
                    minimum={minimum()}
                    minimumLabel={t("min")}
                    onSelectAmount={setAmount}
                    sendLabel={t("send")}
                    separator={separator()}
                />
                <Show when={config.isPro}>
                    <Accordion
                        title={t("swap_opportunities_accordion")}
                        isOpen={isAccordionOpen()}
                        onClick={() => setIsAccordionOpen(!isAccordionOpen())}>
                        <FeeComparisonTable
                            proPairs={pairs()}
                            regularPairs={regularPairs()}
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
                        <div
                            class={`${showFiatAmount() ? "input-with-label" : ""}`}>
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
                            <FiatAmount
                                asset={() => pair().fromAsset}
                                amount={BigNumber(sendAmount()).toNumber()}
                                variant="label"
                                for="sendAmount"
                            />
                        </div>
                    </div>
                    <Reverse />
                    <div>
                        <Asset
                            side={Side.Receive}
                            signal={() => pair().toAsset}
                        />
                        <div
                            class={`${showFiatAmount() ? "input-with-label" : ""}`}>
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
                            <FiatAmount
                                asset={() => pair().toAsset}
                                amount={BigNumber(receiveAmount()).toNumber()}
                                variant="label"
                                for="receiveAmount"
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
                    <AddressInput />
                </Show>
                <Show
                    when={
                        pair().requiredInput === RequiredInput.Invoice ||
                        (pair().requiredInput === RequiredInput.Unknown &&
                            pair().toAsset === LN)
                    }>
                    <Show when={webln()}>
                        <WeblnButton />
                        <hr class="spacer" />
                    </Show>
                    <InvoiceInput />
                </Show>
                <Show
                    when={
                        isMobile() &&
                        config.assets?.[pair().toAsset]?.type === AssetKind.UTXO
                    }>
                    <QrScan />
                </Show>
                <Show
                    when={[pair().fromAsset, pair().toAsset].some(
                        isWalletConnectableAsset,
                    )}>
                    <ConnectWallet
                        asset={
                            isWalletConnectableAsset(pair().fromAsset)
                                ? pair().fromAsset
                                : pair().toAsset
                        }
                        syncAddress={isWalletConnectableAsset(pair().toAsset)}
                        disabled={() => !pair().isRoutable}
                    />
                    {/* We have no gas abstraction for RBTC */}
                    <Show
                        when={
                            isWalletConnectableAsset(pair().toAsset) &&
                            pair().toAsset !== RBTC &&
                            !connectedDestination()
                        }>
                        <hr class="spacer" />
                        <AddressInput />
                    </Show>
                    <hr class="spacer" />
                </Show>
                <CreateButton />
                <AssetSelect />
                <NetworkSelect />
                <SettingsMenu />
            </div>
        </Show>
    );
};

export default Create;
