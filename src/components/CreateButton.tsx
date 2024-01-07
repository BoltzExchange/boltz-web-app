import { useNavigate } from "@solidjs/router";
import { crypto } from "bitcoinjs-lib";
import { randomBytes } from "crypto";
import log from "loglevel";
import { createEffect, createMemo, createSignal } from "solid-js";

import { RBTC } from "../consts";
import { useWeb3Signer } from "../context/Web3";
import t from "../i18n";
import {
    asset,
    config,
    invoice,
    lnurl,
    onchainAddress,
    online,
    receiveAmount,
    reverse,
    sendAmount,
    sendAmountValid,
    setAddressValid,
    setInvoice,
    setInvoiceValid,
    setLnurl,
    setNotification,
    setNotificationType,
    setOnchainAddress,
    setSwaps,
    swaps,
    valid,
    wasmSupported,
} from "../signals";
import { ECPair } from "../utils/ecpair";
import { feeCheck, fetcher } from "../utils/helper";
import { extractAddress, fetchLnurl } from "../utils/invoice";
import { validateResponse } from "../utils/validation";

type buttonLabelParams = {
    key: string;
    params?: Record<string, string>;
};

export const [buttonLabel, setButtonLabel] = createSignal<buttonLabelParams>({
    key: "create_swap",
});

export const CreateButton = () => {
    const navigate = useNavigate();
    const { getEtherSwap } = useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(true);
    const [buttonClass, setButtonClass] = createSignal("btn");

    const validateButtonDisable = () => {
        return !valid() && !(lnurl() !== "" && sendAmountValid());
    };

    createEffect(() => {
        setButtonDisable(validateButtonDisable());
    });

    createMemo(() => {
        setButtonClass(
            !wasmSupported() || !online() ? "btn btn-danger" : "btn",
        );
    });

    createEffect(() => {
        if (valid()) {
            if (reverse() && lnurl()) {
                setButtonLabel({ key: "fetch_lnurl" });
            } else {
                setButtonLabel({ key: "create_swap" });
            }
        }
        if (!online()) {
            setButtonLabel({ key: "api_offline" });
        }
        if (!wasmSupported()) {
            setButtonLabel({ key: "wasm_not_supported" });
        }
    });

    const create = async () => {
        if (sendAmountValid() && !reverse() && lnurl() !== "") {
            try {
                const inv = await fetchLnurl(lnurl(), Number(receiveAmount()));
                setInvoice(inv);
                setLnurl("");
            } catch (e) {
                setNotificationType("error");
                setNotification(e);
                log.warn("fetch lnurl failed", e);
            }
            return;
        }

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

                    validateResponse(data, getEtherSwap).then((success) => {
                        if (!success) {
                            resolve(false);
                            navigate("/error/");
                            return;
                        }

                        setSwaps(swaps().concat(data));
                        setInvoice("");
                        setInvoiceValid(false);
                        setOnchainAddress("");
                        setAddressValid(false);
                        resolve(true);
                        if (reverse() || isRsk) {
                            navigate("/swap/" + data.id);
                        } else {
                            navigate("/swap/refund/" + data.id);
                        }
                    });
                },
                params,
                async (err: Response) => {
                    const res = await err.json();
                    if (res.error === "invalid pair hash") {
                        await feeCheck(t("feecheck"));
                    } else {
                        setNotificationType("error");
                        setNotification(res.error);
                    }
                    resolve(false);
                },
            );
        });
    };

    const buttonClick = () => {
        setButtonDisable(true);
        create()
            .catch((e) => {
                log.warn("create failed", e);
            })
            .then(() => {
                setButtonDisable(validateButtonDisable());
            });
    };

    const getButtonLabel = (label: buttonLabelParams) => {
        return t(label.key, label.params);
    };

    return (
        <button
            id="create-swap-button"
            class={buttonClass()}
            disabled={buttonDisable()}
            onClick={buttonClick}>
            {getButtonLabel(buttonLabel())}
        </button>
    );
};

export default CreateButton;
