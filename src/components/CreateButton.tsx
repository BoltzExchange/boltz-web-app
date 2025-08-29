import { useLocation, useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import type { Accessor } from "solid-js";
import { createEffect, createSignal, on, onMount } from "solid-js";

import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import type { ButtonLabelParams } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import type { Signer } from "../context/Web3";
import { customDerivationPathRdns, useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim, getSmartWalletAddress } from "../rif/Signer";
import type { ChainPairTypeTaproot } from "../utils/boltzClient";
import {
    fetchBip21Invoice,
    fetchBolt12Invoice,
    getPairs,
} from "../utils/boltzClient";
import { calculateSendAmount } from "../utils/calculate";
import {
    btcToSat,
    formatAmount,
    formatDenomination,
} from "../utils/denomination";
import { formatError } from "../utils/errors";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { coalesceLn, getPair } from "../utils/helper";
import {
    InvoiceType,
    decodeInvoice,
    fetchBip353,
    fetchLnurl,
    getAssetByBip21Prefix,
} from "../utils/invoice";
import { findMagicRoutingHint } from "../utils/magicRoutingHint";
import Pair, { RequiredInput } from "../utils/pair";
import { firstResolved, promiseWithTimeout } from "../utils/promise";
import type { SomeSwap } from "../utils/swapCreator";
import {
    createChain,
    createReverse,
    createSubmarine,
} from "../utils/swapCreator";
import { validateResponse } from "../utils/validation";
import LoadingSpinner from "./LoadingSpinner";
import { getMagicRoutingHintSavedFees } from "./OptimizedRoute";

// In milliseconds
const invoiceFetchTimeout = 25_000;

export const enum BackupDone {
    True = "true",
    False = "false",
}

export const getClaimAddress = async (
    assetReceive: Accessor<string>,
    signer: Accessor<Signer>,
    onchainAddress: Accessor<string>,
): Promise<{ useRif: boolean; gasPrice: bigint; claimAddress: string }> => {
    if (assetReceive() === RBTC) {
        const [balance, gasPrice] = await Promise.all([
            signer().provider.getBalance(await signer().getAddress()),
            signer()
                .provider.getFeeData()
                .then((data) => data.gasPrice),
        ]);
        log.debug("RSK balance", balance);

        const balanceNeeded = gasPrice * GasNeededToClaim;
        log.debug("RSK balance needed", balanceNeeded);

        if (balance <= balanceNeeded) {
            log.info("Using RIF smart wallet as claim address");
            return {
                gasPrice,
                useRif: true,
                claimAddress: (await getSmartWalletAddress(signer())).address,
            };
        } else {
            log.info("RIF smart wallet not needed");
        }
    }

    return {
        gasPrice: 0n,
        useRif: false,
        claimAddress: onchainAddress(),
    };
};

const CreateButton = () => {
    const navigate = useNavigate();
    const location = useLocation<{ backupDone?: string }>().state;
    const {
        separator,
        setSwapStorage,
        denomination,
        pairs,
        setPairs,
        online,
        notify,
        ref,
        t,
        newKey,
        deriveKey,
        rescueFileBackupDone,
        rescueFile,
    } = useGlobalContext();
    const {
        invoice,
        lnurl,
        onchainAddress,
        receiveAmount,
        sendAmount,
        amountValid,
        setInvoice,
        setInvoiceValid,
        setLnurl,
        setOnchainAddress,
        valid,
        addressValid,
        setAddressValid,
        pair,
        setPair,
        minimum,
        maximum,
        invoiceValid,
        invoiceError,
        bolt12Offer,
        setBolt12Offer,
        setSendAmount,
        setReceiveAmount,
    } = useCreateContext();
    const { getEtherSwap, signer, providers } = useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [buttonClass, setButtonClass] = createSignal("btn");
    const [buttonLabel, setButtonLabel] = createSignal<ButtonLabelParams>({
        key: "create_swap",
    });

    createEffect(() => {
        setButtonClass(!online() ? "btn btn-danger" : "btn");
    });

    createEffect(
        on(
            [
                valid,
                amountValid,
                addressValid,
                invoiceValid,
                invoiceError,
                pair,
                lnurl,
                online,
                minimum,
                bolt12Offer,
                denomination,
            ],
            () => {
                if (!online()) {
                    setButtonLabel({ key: "api_offline" });
                    return;
                }
                if (!pair().isRoutable) {
                    setButtonLabel({ key: "invalid_pair" });
                    return;
                }

                const isChainSwapWithZeroAmount = () =>
                    pair().canZeroAmount && sendAmount().isZero();

                const isSubmarineSwapInvoiceValid = () =>
                    pair().requiredInput === RequiredInput.Invoice &&
                    !invoiceError();

                const shouldShowAmountError = () =>
                    !amountValid() &&
                    // Chain swaps with 0-amount that do not have RBTC as sending asset
                    // can skip this check
                    !isChainSwapWithZeroAmount() &&
                    (isSubmarineSwapInvoiceValid() ||
                        pair().requiredInput !== RequiredInput.Invoice);

                if (shouldShowAmountError()) {
                    const lessThanMin = Number(sendAmount()) < minimum();
                    setButtonLabel({
                        key: lessThanMin ? "minimum_amount" : "maximum_amount",
                        params: {
                            amount: formatAmount(
                                pair().fromAsset,
                                BigNumber(lessThanMin ? minimum() : maximum()),
                                denomination(),
                                separator(),
                            ),
                            denomination: formatDenomination(
                                denomination(),
                                pair().fromAsset,
                            ),
                        },
                    });
                    return;
                }
                if (
                    pair().requiredInput === RequiredInput.Web3 &&
                    !addressValid()
                ) {
                    setButtonLabel({ key: "please_connect_wallet" });
                    return;
                }
                if (pair().requiredInput === RequiredInput.Address) {
                    if (!addressValid()) {
                        setButtonLabel({
                            key: "invalid_address",
                            params: { asset: pair().toAsset },
                        });
                        return;
                    }
                } else {
                    if (validWayToFetchInvoice()) {
                        setButtonLabel({ key: "create_swap" });
                        return;
                    }
                    if (!invoiceValid()) {
                        setButtonLabel({
                            key: invoiceError() || "invalid_invoice",
                        });
                        return;
                    }
                }
                setButtonLabel({ key: "create_swap" });
            },
        ),
    );

    const clearBackupDoneState = () => {
        if (location?.backupDone === BackupDone.True) {
            navigate("/swap", {
                replace: true,
                state: {
                    backupDone: BackupDone.False,
                },
            });
        }
    };

    const validWayToFetchInvoice = (): boolean => {
        return (
            pair().requiredInput === RequiredInput.Invoice &&
            (lnurl() !== "" || bolt12Offer() !== undefined) &&
            amountValid() &&
            sendAmount().isGreaterThan(0) &&
            pair().toAsset !== pair().fromAsset
        );
    };

    const fetchInvoice = async () => {
        if (lnurl() !== undefined && lnurl() !== "") {
            try {
                log.info("Fetching invoice from LNURL or BIP-353", lnurl());

                const fetched = await firstResolved(
                    [
                        (async () => {
                            try {
                                return await fetchLnurl(
                                    lnurl(),
                                    Number(receiveAmount()),
                                );
                            } catch (e) {
                                log.warn(
                                    "Fetching invoice for LNURL failed:",
                                    e,
                                );
                                throw formatError(e);
                            }
                        })(),
                        (async () => {
                            try {
                                return await fetchBip353(
                                    lnurl(),
                                    Number(receiveAmount()),
                                );
                            } catch (e) {
                                log.warn(
                                    "Fetching invoice from BIP-353 failed:",
                                    e,
                                );
                                throw formatError(e);
                            }
                        })(),
                    ].map((p) => promiseWithTimeout(p, invoiceFetchTimeout)),
                );

                setInvoice(fetched);
                setLnurl("");
                setInvoiceValid(true);
            } catch (e) {
                log.warn("Fetching invoice failed", e);
                notify("error", formatError(e));
            }
        } else {
            log.info("Fetching invoice from bolt12 offer", bolt12Offer());
            try {
                const res = await fetchBolt12Invoice(
                    bolt12Offer(),
                    Number(receiveAmount()),
                );
                setInvoice(res.invoice);
                setBolt12Offer(undefined);
                setInvoiceValid(true);
            } catch (e) {
                notify("error", formatError(e));
                log.warn("Fetching invoice from bolt12 offer failed", e);
                return;
            }
        }
    };

    const createSwap = async (
        claimAddress: string,
        useRif: boolean,
    ): Promise<boolean> => {
        if (!rescueFileBackupDone() && pair().needsBackup) {
            navigate("/backup");
            return false;
        }

        try {
            // TODO: swap creation with route
            let data: SomeSwap;

            const swapToCreate = pair().swapToCreate;
            switch (swapToCreate.type) {
                case SwapType.Submarine: {
                    const createSubmarineSwap = async () => {
                        data = await createSubmarine(
                            pairs(),
                            coalesceLn(pair().fromAsset),
                            coalesceLn(pair().toAsset),
                            sendAmount(),
                            receiveAmount(),
                            invoice(),
                            ref(),
                            useRif,
                            newKey,
                        );
                    };

                    const decodedInvoice = await decodeInvoice(invoice());
                    const isBolt12 = decodedInvoice.type === InvoiceType.Bolt12;

                    const magicRoutingHint = !isBolt12
                        ? findMagicRoutingHint(invoice())
                        : undefined;

                    const bip21 =
                        magicRoutingHint || isBolt12
                            ? (await fetchBip21Invoice(invoice()))?.bip21
                            : undefined;

                    const bip21Decoded = bip21 ? new URL(bip21) : undefined;

                    const bip21Asset = bip21Decoded
                        ? getAssetByBip21Prefix(bip21Decoded.protocol)
                        : undefined;

                    if (!bip21 || swapToCreate.from === bip21Asset) {
                        log.debug("Creating submarine swap");
                        await createSubmarineSwap();
                        break;
                    }

                    try {
                        // Create swap using its Magic Routing Hint (MRH)
                        log.debug("MRH detected. Preparing swap");
                        const chainAddress = bip21Decoded.pathname;
                        const bip21Amount = BigNumber(
                            bip21Decoded.searchParams.get("amount") ?? 0,
                        );

                        // If bip21Amount is less than the minimal for the new pair, don't use the MRH
                        const chainPair = getPair<ChainPairTypeTaproot>(
                            pairs(),
                            SwapType.Chain,
                            swapToCreate.from,
                            bip21Asset,
                        );
                        if (
                            !chainPair ||
                            btcToSat(bip21Amount).isLessThan(
                                chainPair.limits.minimal,
                            )
                        ) {
                            log.debug(
                                `BIP21 amount ${bip21Amount.toString()} is less than minimal ${chainPair.limits.minimal} for chain swap. Creating submarine swap.`,
                            );
                            await createSubmarineSwap();
                            break;
                        }

                        if (
                            btcToSat(bip21Amount).isGreaterThan(
                                decodedInvoice.satoshis,
                            )
                        ) {
                            throw new Error("invalid_bip21_amount");
                        }

                        const mrhSendAmount = calculateSendAmount(
                            btcToSat(bip21Amount),
                            chainPair.fees.percentage,
                            chainPair.fees.minerFees.server +
                                chainPair.fees.minerFees.user.claim,
                            SwapType.Chain,
                        );

                        const savedFees = getMagicRoutingHintSavedFees({
                            pairs,
                            assetSend: () => swapToCreate.from,
                            addressValid,
                            onchainAddress,
                            sendAmount: () => mrhSendAmount,
                            assetReceive: () => bip21Asset,
                        });

                        if (BigNumber(savedFees).isLessThanOrEqualTo(0)) {
                            log.debug(
                                "MRH is more expensive than submarine swap. Creating submarine swap",
                            );
                            await createSubmarineSwap();
                            break;
                        }

                        setPair(
                            new Pair(pairs(), swapToCreate.from, bip21Asset),
                        );
                        setOnchainAddress(chainAddress);
                        setReceiveAmount(btcToSat(bip21Amount));
                        setSendAmount(mrhSendAmount);

                        log.debug("Creating MRH swap");
                        const chainSwap = await createChain(
                            pairs(),
                            swapToCreate.from,
                            bip21Asset,
                            sendAmount(),
                            receiveAmount(),
                            onchainAddress(),
                            ref(),
                            useRif,
                            rescueFile(),
                            newKey,
                        );

                        data = {
                            ...chainSwap,
                            magicRoutingHintSavedFees: savedFees,
                        };

                        break;
                    } catch (e) {
                        log.error("Error creating MRH swap", e);
                        throw new Error(t("invalid_invoice"));
                    }
                }

                case SwapType.Reverse:
                    data = await createReverse(
                        pairs(),
                        coalesceLn(swapToCreate.from),
                        coalesceLn(swapToCreate.to),
                        sendAmount(),
                        receiveAmount(),
                        claimAddress,
                        ref(),
                        useRif,
                        rescueFile(),
                        newKey,
                    );
                    break;

                case SwapType.Chain:
                    data = await createChain(
                        pairs(),
                        swapToCreate.from,
                        swapToCreate.to,
                        sendAmount(),
                        receiveAmount(),
                        claimAddress,
                        ref(),
                        useRif,
                        rescueFile(),
                        newKey,
                    );
                    break;
            }

            if (!(await validateResponse(data, deriveKey, getEtherSwap))) {
                navigate("/error");
                return false;
            }

            await setSwapStorage({
                ...data,
                signer:
                    // We do not have to commit to a signer when creating submarine swaps
                    swapToCreate.type !== SwapType.Submarine
                        ? signer()?.address
                        : undefined,
                derivationPath:
                    swapToCreate.type !== SwapType.Submarine &&
                    signer() !== undefined &&
                    customDerivationPathRdns.includes(signer().rdns)
                        ? (
                              providers()[signer().rdns]
                                  .provider as unknown as HardwareSigner
                          ).getDerivationPath()
                        : undefined,
            });

            setInvoice("");
            setInvoiceValid(false);
            setOnchainAddress("");
            setAddressValid(false);

            clearBackupDoneState();

            navigate("/swap/" + data.id);

            return true;
        } catch (err) {
            if (err === "invalid pair hash") {
                setPairs(await getPairs());
                notify("error", t("feecheck"));
            } else {
                notify("error", err);
            }

            clearBackupDoneState();

            return false;
        }
    };

    const buttonClick = async () => {
        setButtonDisable(true);
        setLoading(true);
        try {
            if (validWayToFetchInvoice()) {
                await fetchInvoice();
            }

            const { useRif, claimAddress } = await getClaimAddress(
                () => pair().toAsset,
                signer,
                onchainAddress,
            );

            if (!valid()) return;

            await createSwap(claimAddress, useRif);
        } catch (e) {
            log.error("Error creating swap", e);
            notify("error", e);
        } finally {
            setButtonDisable(false);
            setLoading(false);
        }
    };

    onMount(() => {
        if (location?.backupDone === BackupDone.True) {
            void buttonClick();
            return;
        }
        clearBackupDoneState();
    });

    const getButtonLabel = (label: ButtonLabelParams) => {
        return t(label.key, label.params);
    };

    return (
        <button
            id="create-swap-button"
            data-testid="create-swap-button"
            class={buttonClass()}
            disabled={
                !online() ||
                !(valid() || validWayToFetchInvoice()) ||
                buttonDisable() ||
                (onchainAddress() === "" &&
                    invoice() === "" &&
                    bolt12Offer() === undefined &&
                    lnurl() === "")
            }
            onClick={buttonClick}>
            {loading() ? (
                <LoadingSpinner class="inner-spinner" />
            ) : (
                getButtonLabel(buttonLabel())
            )}
        </button>
    );
};

export default CreateButton;
