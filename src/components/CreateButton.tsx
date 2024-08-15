import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import { createEffect, createMemo, createSignal, on } from "solid-js";

import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { ButtonLabelParams } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim, getSmartWalletAddress } from "../rif/Signer";
import { getPairs } from "../utils/boltzClient";
import { formatAmount } from "../utils/denomination";
import { coalesceLn } from "../utils/helper";
import { fetchLnurl } from "../utils/invoice";
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
        isRecklessMode,
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
    } = useCreateContext();
    const { getEtherSwap, signer } = useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(false);
    const [buttonClass, setButtonClass] = createSignal("btn");
    const [buttonLabel, setButtonLabel] = createSignal<ButtonLabelParams>({
        key: "create_swap",
    });

    const validLnurl = () => {
        return (
            swapType() === SwapType.Submarine &&
            lnurl() !== "" &&
            amountValid() &&
            sendAmount().isGreaterThan(0)
        );
    };

    createMemo(() => {
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
                if (!amountValid()) {
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
                    setButtonLabel({ key: "connect_wallet" });
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
                    if (validLnurl()) {
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
        if (validLnurl()) {
            try {
                const inv = await fetchLnurl(lnurl(), Number(receiveAmount()));
                setInvoice(inv);
                setLnurl("");
            } catch (e) {
                notify("error", e.message);
                log.warn("fetch lnurl failed", e);
                return;
            }
        }

        if (!valid()) return;

        let claimAddress = onchainAddress();

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
                claimAddress = (await getSmartWalletAddress(signer())).address;
                log.info("Using RIF smart wallet as claim address");
            }
        }

        const useRif = onchainAddress() !== claimAddress;

        try {
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
                    );
                    break;
            }

            if (!(await validateResponse(data, getEtherSwap))) {
                navigate("/error");
                return;
            }

            await setSwapStorage({
                ...data,
                signer: signer()?.address,
            });
            setInvoice("");
            setInvoiceValid(false);
            setOnchainAddress("");
            setAddressValid(false);

            // No backups needed for Reverse Swaps or when we send RBTC
            if (
                isRecklessMode() ||
                swapType() === SwapType.Reverse ||
                assetSend() === RBTC
            ) {
                navigate("/swap/" + data.id);
            } else {
                navigate("/swap/refund/" + data.id);
            }
        } catch (err) {
            let msg = err;

            if (typeof err.json === "function") {
                msg = (await err.json()).error;
            }

            if (msg === "invalid pair hash") {
                setPairs(await getPairs());
                notify("error", t("feecheck"));
            } else {
                notify("error", msg);
            }
        }
    };

    const buttonClick = async () => {
        setButtonDisable(true);
        await create();
        setButtonDisable(false);
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
                !online() || !(valid() || validLnurl()) || buttonDisable()
            }
            onClick={buttonClick}>
            {getButtonLabel(buttonLabel())}
        </button>
    );
};

export default CreateButton;
