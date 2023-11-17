import { useNavigate } from "@solidjs/router";
import { crypto } from "bitcoinjs-lib";
import { randomBytes } from "crypto";
import log from "loglevel";
import { createEffect, createMemo, createSignal } from "solid-js";

import { getAddress, getNetwork } from "../compat";
import { ECPair } from "../ecpair/ecpair";
import { feeCheck, fetcher } from "../helper";
import t from "../i18n";
import {
    asset,
    buttonLabel,
    config,
    invoice,
    lnurl,
    onchainAddress,
    online,
    receiveAmount,
    reverse,
    sendAmount,
    setAddressValid,
    setButtonLabel,
    setInvoice,
    setInvoiceValid,
    setNotification,
    setNotificationType,
    setOnchainAddress,
    setSwaps,
    swaps,
    valid,
    wasmSupported,
} from "../signals";
import { fetchLnurl } from "../utils/invoice";
import { validateResponse } from "../utils/validation";

const CreateButton = ({ validateAddress }) => {
    const navigate = useNavigate();

    const [buttonDisable, setButtonDisable] = createSignal(true);
    const [buttonClass, setButtonClass] = createSignal("btn");

    createEffect(() => {
        setButtonDisable(!valid());
    });

    createMemo(() => {
        setButtonClass(
            !wasmSupported() || !online() ? "btn btn-danger" : "btn",
        );
    });

    createEffect(() => {
        if (valid()) {
            if (reverse()) {
                setButtonLabel(t("create_reverse_swap"));
            } else {
                if (lnurl()) {
                    setButtonLabel(t("fetch_lnurl"));
                } else {
                    setButtonLabel(t("create_swap"));
                }
            }
        }
        if (!online()) {
            setButtonLabel(t("api_offline"));
        }
        if (!wasmSupported()) {
            setButtonLabel(t("wasm_not_supported"));
        }
    });

    const create = async () => {
        if (!valid()) return;

        const assetName = asset();
        const isRsk = assetName === RBTC;

        const keyPair = !isRsk ? ECPair.makeRandom() : null;

        let params = null;
        let preimage = null;

        if (reverse()) {
            preimage = randomBytes(32);
            const preimageHash = crypto.sha256(preimage).toString("hex");

            params = {
                type: "reversesubmarine",
                pairId: assetName + "/BTC",
                orderSide: "buy",
                invoiceAmount: Number(sendAmount()),
                preimageHash: preimageHash,
            };

            if (isRsk) {
                params.claimAddress = onchainAddress();
            } else {
                params.claimPublicKey = keyPair.publicKey.toString("hex");
            }
        } else {
            if (lnurl()) {
                try {
                    const inv = await fetchLnurl(
                        lnurl(),
                        Number(receiveAmount()),
                    );
                    setInvoice(inv);
                    validateAddress();
                } catch (e) {
                    log.warn("fetch lnurl failed", e);
                }
                return true;
            }
            params = {
                type: "submarine",
                pairId: assetName + "/BTC",
                orderSide: "sell",
                invoice: invoice(),
            };

            if (!isRsk) {
                params.refundPublicKey = keyPair.publicKey.toString("hex");
            }
        }

        if (!(await feeCheck(t("feecheck")))) {
            return;
        }

        params.pairHash = config()[`${assetName}/BTC`]["hash"];

        await new Promise((resolve) => {
            fetcher(
                "/createswap",
                (data) => {
                    data.date = new Date().getTime();
                    data.reverse = reverse();
                    data.asset = asset();
                    data.receiveAmount = Number(receiveAmount());
                    data.sendAmount = Number(sendAmount());
                    data.onchainAddress = onchainAddress();

                    if (keyPair !== null) {
                        data.privateKey = keyPair.privateKey.toString("hex");
                    }

                    if (preimage !== null) {
                        data.preimage = preimage.toString("hex");
                    }

                    if (!data.reverse) {
                        data.invoice = invoice();
                    }

                    validateResponse(data, getEtherSwap).then((success) => {
                        if (!success) {
                            resolve();
                            navigate("/error/");
                            return;
                        }

                        setSwaps(swaps().concat(data));
                        setInvoice("");
                        setInvoiceValid(false);
                        setOnchainAddress("");
                        setAddressValid(false);
                        resolve();
                        if (reverse() || isRsk) {
                            navigate("/swap/" + data.id);
                        } else {
                            navigate("/swap/refund/" + data.id);
                        }
                    });
                },
                params,
                async (err) => {
                    const res = await err.json();
                    if (res.error === "invalid pair hash") {
                        await feeCheck(t("feecheck"));
                    } else {
                        setNotificationType("error");
                        setNotification(res.error);
                    }
                    resolve();
                },
            );
        });
    };

    const buttonClick = () => {
        setButtonDisable(true);
        create()
            .then((res) => !res && setButtonDisable(false))
            .catch((e) => {
                log.warn("create failed", e);
                setButtonDisable(false);
            });
    };

    return (
        <button
            id="create-swap"
            class={buttonClass()}
            disabled={buttonDisable() ? "disabled" : ""}
            onClick={buttonClick}>
            {buttonLabel()}
        </button>
    );
};

export default CreateButton;
