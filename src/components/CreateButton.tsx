import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import { createEffect, createSignal, on } from "solid-js";

import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { ButtonLabelParams } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { customDerivationPathRdns, useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim, getSmartWalletAddress } from "../rif/Signer";
import { fetchBolt12Invoice, getPairs } from "../utils/boltzClient";
import { formatAmount } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { HardwareSigner } from "../utils/hardware/HadwareSigner";
import { coalesceLn, isMobile } from "../utils/helper";
import { fetchBip353, fetchLnurl } from "../utils/invoice";
import {
    SomeSwap,
    createChain,
    createReverse,
    createSubmarine,
} from "../utils/swapCreator";
import { validateResponse } from "../utils/validation";

export const CreateButton = () => {
    const navigate = useNavigate();
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
    } = useGlobalContext();
    const {
        invoice,
        lnurl,
        assetSend,
        assetReceive,
        onchainAddress,
        receiveAmount,
        swapType,
        sendAmount,
        amountValid,
        pairValid,
        setInvoice,
        setInvoiceValid,
        setLnurl,
        setOnchainAddress,
        valid,
        addressValid,
        setAddressValid,
        minimum,
        maximum,
        invoiceValid,
        invoiceError,
        bolt12Offer,
        setBolt12Offer,
    } = useCreateContext();
    const { getEtherSwap, signer, providers, hasBrowserWallet } =
        useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(false);
    const [buttonClass, setButtonClass] = createSignal("btn");
    const [buttonLabel, setButtonLabel] = createSignal<ButtonLabelParams>({
        key: "create_swap",
    });

    const validWayToFetchInvoice = () => {
        return (
            swapType() === SwapType.Submarine &&
            (lnurl() !== "" || bolt12Offer() !== undefined) &&
            amountValid() &&
            sendAmount().isGreaterThan(0)
        );
    };

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
                pairValid,
                swapType,
                lnurl,
                online,
                minimum,
                assetReceive,
                bolt12Offer,
            ],
            () => {
                if (!online()) {
                    setButtonLabel({ key: "api_offline" });
                    return;
                }
                if (!pairValid()) {
                    setButtonLabel({ key: "invalid_pair" });
                    return;
                }
                if (
                    !amountValid() &&
                    // Chain swaps with 0-amount that do not have RBTC as sending asset
                    // can skip this check
                    !(
                        swapType() === SwapType.Chain &&
                        assetSend() !== RBTC &&
                        sendAmount().isZero()
                    )
                ) {
                    const lessThanMin = Number(sendAmount()) < minimum();
                    setButtonLabel({
                        key: lessThanMin ? "minimum_amount" : "maximum_amount",
                        params: {
                            amount: formatAmount(
                                BigNumber(lessThanMin ? minimum() : maximum()),
                                denomination(),
                                separator(),
                            ),
                            denomination: denomination(),
                        },
                    });
                    return;
                }
                if (assetReceive() === RBTC && !addressValid()) {
                    setButtonLabel({ key: "please_connect_wallet" });
                    return;
                }
                if (swapType() !== SwapType.Submarine) {
                    if (!addressValid()) {
                        setButtonLabel({
                            key: "invalid_address",
                            params: { asset: assetReceive() },
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

    const create = async () => {
        if (validWayToFetchInvoice()) {
            if (lnurl() !== undefined && lnurl() !== "") {
                log.info("Fetching invoice from LNURL or BIP-353", lnurl());

                const fetchResults = await Promise.allSettled([
                    (() => {
                        return new Promise<string>(async (resolve, reject) => {
                            const timeout = setTimeout(
                                () => reject(new Error(t("timeout"))),
                                5_000,
                            );

                            try {
                                const res = await fetchLnurl(
                                    lnurl(),
                                    Number(receiveAmount()),
                                );
                                resolve(res);
                            } catch (e) {
                                log.warn(
                                    "Fetching invoice for LNURL failed:",
                                    e,
                                );
                                reject(new Error(formatError(e)));
                            } finally {
                                clearTimeout(timeout);
                            }
                        });
                    })(),
                    (() => {
                        return new Promise<string>(async (resolve, reject) => {
                            const timeout = setTimeout(
                                () => reject(new Error(t("timeout"))),
                                15_000,
                            );

                            try {
                                const res = await fetchBip353(
                                    lnurl(),
                                    Number(receiveAmount()),
                                );
                                resolve(res);
                            } catch (e) {
                                log.warn(
                                    "Fetching invoice from BIP-353 failed:",
                                    e,
                                );
                                reject(new Error(formatError(e)));
                            } finally {
                                clearTimeout(timeout);
                            }
                        });
                    })(),
                ]);

                const fetched = fetchResults.find(
                    (res) => res.status === "fulfilled",
                );
                if (fetched !== undefined) {
                    setInvoice(fetched.value);
                    setLnurl("");
                    setInvoiceValid(true);
                } else {
                    // All failed, so we can safely cast the first one
                    notify(
                        "error",
                        (fetchResults[0] as PromiseRejectedResult).reason,
                    );
                    return;
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
                    log.warn("Fetching invoice from bol12 failed", e);
                    return;
                }
            }
        }

        if (!valid()) return;

        let claimAddress = onchainAddress();

        try {
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
                    claimAddress = (await getSmartWalletAddress(signer()))
                        .address;
                    log.info("Using RIF smart wallet as claim address");
                } else {
                    log.info("RIF smart wallet not needed");
                }
            }

            const useRif = onchainAddress() !== claimAddress;

            let data: SomeSwap;
            switch (swapType()) {
                case SwapType.Submarine:
                    data = await createSubmarine(
                        pairs(),
                        coalesceLn(assetSend()),
                        coalesceLn(assetReceive()),
                        sendAmount(),
                        receiveAmount(),
                        invoice(),
                        ref(),
                        useRif,
                        newKey,
                    );
                    break;

                case SwapType.Reverse:
                    data = await createReverse(
                        pairs(),
                        coalesceLn(assetSend()),
                        coalesceLn(assetReceive()),
                        sendAmount(),
                        receiveAmount(),
                        claimAddress,
                        ref(),
                        useRif,
                        newKey,
                    );
                    break;

                case SwapType.Chain:
                    data = await createChain(
                        pairs(),
                        assetSend(),
                        assetReceive(),
                        sendAmount(),
                        receiveAmount(),
                        claimAddress,
                        ref(),
                        useRif,
                        newKey,
                    );
                    break;
            }

            if (!(await validateResponse(data, deriveKey, getEtherSwap))) {
                navigate("/error");
                return;
            }

            await setSwapStorage({
                ...data,
                signer:
                    // We do not have to commit to a signer when creating submarine swaps
                    swapType() !== SwapType.Submarine
                        ? signer()?.address
                        : undefined,
                derivationPath:
                    swapType() !== SwapType.Submarine &&
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

            // Mobile EVM browsers struggle with downloading files
            const isMobileEvmBrowser = () => isMobile() && hasBrowserWallet();

            if (
                rescueFileBackupDone() ||
                swapType() === SwapType.Reverse ||
                assetSend() === RBTC ||
                // Only disable refund files on mobile EVM browsers when one side is RSK
                (assetReceive() === RBTC && isMobileEvmBrowser())
            ) {
                navigate("/swap/" + data.id);
            } else {
                navigate("/backup/" + data.id);
            }
        } catch (err) {
            if (err === "invalid pair hash") {
                setPairs(await getPairs());
                notify("error", t("feecheck"));
            } else {
                notify("error", err);
            }
        }
    };

    const buttonClick = async () => {
        setButtonDisable(true);
        try {
            await create();
        } finally {
            setButtonDisable(false);
        }
    };

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
                buttonDisable()
            }
            onClick={buttonClick}>
            {getButtonLabel(buttonLabel())}
        </button>
    );
};

export default CreateButton;
