import { useNavigate } from "@solidjs/router";
import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { randomBytes } from "crypto";
import log from "loglevel";
import { createEffect, createMemo, createSignal } from "solid-js";

import { BTC, RBTC } from "../consts";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { getPairs } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { fetcher, getPair } from "../utils/helper";
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
    const {
        config,
        setConfig,
        online,
        wasmSupported,
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
        sendAmountValid,
        setInvoice,
        setInvoiceValid,
        setLnurl,
        setOnchainAddress,
        valid,
        setAddressValid,
    } = useCreateContext();
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
                notify("error", e);
                log.warn("fetch lnurl failed", e);
            }
            return;
        }

        if (!valid()) return;

        const assetName = asset();
        const isRsk = assetName === RBTC;

        const keyPair = !isRsk ? ECPair.makeRandom() : null;

        let params = null;
        let preimage: Buffer | null = null;

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

        params.pairHash = getPair(config(), assetName, reverse()).hash;
        params.refId = ref();

        if (!isRsk) {
            if (reverse()) {
                params.to = assetName;
                params.from = BTC;
            } else {
                params.to = BTC;
                params.from = assetName;
            }
        }

        // create swap
        try {
            const endpoint = isRsk
                ? "/createswap"
                : `/v2/swap/${reverse() ? "reverse" : "submarine"}`;
            const data = await fetcher(endpoint, assetName, params);

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
                setConfig(await getPairs(assetName));
                notify("error", t("feecheck"));
            } else {
                notify("error", msg);
            }
        }
    };

    const buttonClick = async () => {
        setButtonDisable(true);
        await create();
        setButtonDisable(validateButtonDisable());
    };

    const getButtonLabel = (label: buttonLabelParams) => {
        return t(label.key, label.params);
    };

    return (
        <button
            id="create-swap-button"
            class={buttonClass()}
            disabled={buttonDisable() || !wasmSupported() || !online()}
            onClick={buttonClick}>
            {getButtonLabel(buttonLabel())}
        </button>
    );
};

export default CreateButton;
