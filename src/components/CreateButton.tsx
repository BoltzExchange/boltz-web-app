import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { randomBytes } from "crypto";
import log from "loglevel";
import { createEffect, createMemo, createSignal, on } from "solid-js";

import { BTC, RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { ButtonLabelParams } from "../types";
import { getPairs } from "../utils/boltzClient";
import { formatAmount } from "../utils/denomination";
import { ECPair } from "../utils/ecpair";
import { fetcher, getPair } from "../utils/helper";
import { extractAddress, fetchLnurl } from "../utils/invoice";
import { validateResponse } from "../utils/validation";

export const CreateButton = () => {
    const navigate = useNavigate();
    const {
        denomination,
        pairs,
        setPairs,
        online,
        swaps,
        setSwaps,
        notify,
        ref,
        t,
    } = useGlobalContext();
    const {
        asset,
        invoice,
        lnurl,
        onchainAddress,
        receiveAmount,
        reverse,
        sendAmount,
        amountValid,
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
    const { getEtherSwap } = useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(true);
    const [buttonClass, setButtonClass] = createSignal("btn");
    const [buttonLabel, setButtonLabel] = createSignal<ButtonLabelParams>({
        key: "create_swap",
    });

    const validLnurl = () => {
        return (
            !reverse() &&
            lnurl() !== "" &&
            amountValid() &&
            sendAmount().isGreaterThan(0)
        );
    };

    createEffect(() => {
        setButtonDisable(!online() || !(valid() || validLnurl()));
    });

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
                reverse,
                lnurl,
                online,
                minimum,
                asset,
            ],
            () => {
                if (!online()) {
                    setButtonLabel({ key: "api_offline" });
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
                            ),
                            denomination: denomination(),
                        },
                    });
                    return;
                }
                if (asset() === RBTC && !addressValid()) {
                    setButtonLabel({ key: "connect_metamask" });
                    return;
                }
                if (reverse()) {
                    if (!addressValid()) {
                        setButtonLabel({
                            key: "invalid_address",
                            params: { asset: asset() },
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
                            key:
                                invoiceError() === ""
                                    ? "invalid_invoice"
                                    : invoiceError(),
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

        const assetName = asset();
        const isRsk = assetName === RBTC;

        const keyPair = !isRsk ? ECPair.makeRandom() : null;

        let params: any;
        let preimage: Buffer | null = null;

        if (reverse()) {
            preimage = randomBytes(32);
            const preimageHash = crypto.sha256(preimage).toString("hex");

            params = {
                invoiceAmount: Number(sendAmount()),
                preimageHash: preimageHash,
            };

            if (isRsk) {
                params.claimAddress = onchainAddress();
            } else {
                params.claimPublicKey = keyPair.publicKey.toString("hex");
            }
        } else {
            params = {
                invoice: invoice(),
            };

            if (!isRsk) {
                params.refundPublicKey = keyPair.publicKey.toString("hex");
            }
        }

        params.pairHash = getPair(pairs(), assetName, reverse()).hash;
        params.referralId = ref();

        if (reverse()) {
            params.to = assetName;
            params.from = BTC;
        } else {
            params.to = BTC;
            params.from = assetName;
        }

        // create swap
        try {
            const data = await fetcher(
                `/v2/swap/${reverse() ? "reverse" : "submarine"}`,
                assetName,
                params,
            );

            if (!isRsk) {
                data.version = OutputType.Taproot;
            }

            data.date = new Date().getTime();
            data.reverse = reverse();
            data.asset = asset();
            data.receiveAmount = Number(receiveAmount());
            data.sendAmount = Number(sendAmount());

            if (keyPair !== null) {
                data.privateKey = keyPair.privateKey.toString("hex");
            }

            if (preimage !== null) {
                data.preimage = preimage.toString("hex");
            }

            if (data.reverse) {
                const addr = onchainAddress();
                if (addr) {
                    data.onchainAddress = extractAddress(addr);
                }
            } else {
                data.invoice = invoice();
            }

            // validate response
            const success = await validateResponse(data, getEtherSwap);

            if (!success) {
                navigate("/error/");
                return;
            }
            setSwaps(swaps().concat(data));
            setInvoice("");
            setInvoiceValid(false);
            setOnchainAddress("");
            setAddressValid(false);
            if (reverse() || isRsk) {
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
                setPairs(await getPairs(assetName));
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
            disabled={buttonDisable()}
            onClick={buttonClick}>
            {getButtonLabel(buttonLabel())}
        </button>
    );
};

export default CreateButton;
