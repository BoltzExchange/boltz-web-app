import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { randomBytes } from "crypto";

import { BTC, RBTC } from "../../consts";
import { CreateContextType } from "../../context/Create";
import { GlobalContextType } from "../../context/Global";
import { fetcher, getPairs } from "../boltzApi";
import { getPair } from "../helper";
import { ECPair } from "./ecpair";
import { extractAddress } from "./invoice";
import { ContractGetter, validateResponse } from "./validation";

const createSwap = async (
    context: CreateContextType,
    global: GlobalContextType,
    getEtherSwap: ContractGetter,
) => {
    const { notify, t, ref, pairs, setPairs } = global;
    const {
        asset,
        reverse,
        invoice,
        sendAmount,
        onchainAddress,
        receiveAmount,
    } = context;
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

        return success ? data : null;
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
export default createSwap;
