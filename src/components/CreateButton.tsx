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
import { ButtonLabelParams } from "../types";
import { getPairs } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { fetcher, getPair } from "../utils/helper";
import { extractAddress, fetchLnurl } from "../utils/invoice";
import { validateResponse } from "../utils/validation";

export const CreateButton = () => {
    const navigate = useNavigate();
    const { pairs, setPairs, online, swaps, setSwaps, notify, ref, t } =
        useGlobalContext();
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
        setAddressValid,
        buttonLabel,
        setButtonLabel,
    } = useCreateContext();
    const { getEtherSwap } = useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(true);
    const [buttonClass, setButtonClass] = createSignal("btn");

    const validateButtonDisable = () => {
        return !valid() && !(lnurl() !== "" && amountValid());
    };

    createEffect(() => {
        setButtonDisable(validateButtonDisable());
    });

    createMemo(() => {
        setButtonClass(!online() ? "btn btn-danger" : "btn");
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
    });

    const create = async () => {
        if (amountValid() && !reverse() && lnurl() !== "") {
            try {
                const inv = await fetchLnurl(lnurl(), Number(receiveAmount()));
                setInvoice(inv);
                setLnurl("");
            } catch (e) {
                notify("error", e.message);
                log.warn("fetch lnurl failed", e);
            }
            return;
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
        setButtonDisable(validateButtonDisable());
    };

    const getButtonLabel = (label: ButtonLabelParams) => {
        return t(label.key, label.params);
    };

    return (
        <button
            id="create-swap-button"
            data-testid="create-swap-button"
            class={buttonClass()}
            disabled={buttonDisable() || !online()}
            onClick={buttonClick}>
            {getButtonLabel(buttonLabel())}
        </button>
    );
};

export default CreateButton;
