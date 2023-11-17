import { useNavigate } from "@solidjs/router";
import { crypto } from "bitcoinjs-lib";
import { randomBytes } from "crypto";
import log from "loglevel";
import { Show, createMemo, createSignal } from "solid-js";

import { getAddress, getNetwork } from "../compat";
import { ECPair } from "../ecpair/ecpair";
import { feeCheck, fetchPairs, fetcher } from "../helper";
import t from "../i18n";
import {
    asset,
    config,
    invoice,
    invoiceValid,
    onchainAddress,
    online,
    receiveAmount,
    reverse,
    sendAmount,
    setAddressValid,
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
import { fetchLnurl, isLnurl } from "../utils/invoice";
import { validateResponse } from "../utils/validation";

const CreateButton = () => {
    const navigate = useNavigate();

    const [buttonDisable, setButtonDisable] = createSignal(true);

    createMemo(() => {
        setButtonDisable(!valid());
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
            if (isLnurl(invoice())) {
                setInvoice(
                    await fetchLnurl(invoice(), Number(receiveAmount())),
                );
            }
            validateAddress(invoiceInputRef);
            if (!invoiceValid()) {
                const msg = "invalid invoice";
                log.error(msg);
                setNotificationType("error");
                setNotification(msg);
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

    return (
        <>
            <Show when={online() && wasmSupported()}>
                <button
                    id="create-swap"
                    class="btn"
                    disabled={buttonDisable() ? "disabled" : ""}
                    onClick={() => {
                        setButtonDisable(true);
                        create()
                            .then((res) => !res && setButtonDisable(false))
                            .catch((e) => {
                                log.warn("create failed", e);
                                setButtonDisable(false);
                            });
                    }}>
                    {t("create_swap")}
                </button>
            </Show>
            <Show when={!online()}>
                <button
                    id="create-swap"
                    class="btn btn-danger"
                    onClick={fetchPairs}>
                    {t("api_offline")}
                </button>
            </Show>
            <Show when={!wasmSupported()}>
                <button
                    id="create-swap"
                    class="btn btn-danger"
                    onClick={fetchPairs}>
                    {t("wasm_not_supported")}
                </button>
            </Show>
        </>
    );
};

export default CreateButton;
