import log from "loglevel";
import { bech32, utf8 } from "@scure/base";
import { bolt11_prefix } from "../config";
import { checkResponse, errorHandler } from "../helper";

const invoicePrefix = "lightning:";

export function fetchLnurl(lnurl, amount_sat) {
    return new Promise((resolve, reject) => {
        let url = "";
        const amount = Math.round(amount_sat * 1000);
        if (lnurl.includes("@")) {
            // Lightning address
            const urlsplit = lnurl.split("@");
            url = `https://${urlsplit[1]}/.well-known/lnurlp/${urlsplit[0]}`;
        } else {
            // LNURL
            const { bytes } = bech32.decodeToBytes(lnurl);
            url = utf8.encode(bytes);
        }
        log.debug("fetching lnurl:", url);
        fetch(url)
            .then(checkResponse)
            .then((data) => {
                log.debug(
                    "amount check: (x, min, max)",
                    amount,
                    data.minSendable,
                    data.maxSendable,
                );
                if (amount < data.minSendable || amount > data.maxSendable) {
                    return reject("Amount not in LNURL range.");
                }
                log.debug(
                    "fetching invoice",
                    `${data.callback}?amount=${amount}`,
                );
                fetch(`${data.callback}?amount=${amount}`)
                    .then(checkResponse)
                    .then((data) => {
                        log.debug("fetched invoice", data);
                        resolve(data.pr);
                    })
                    .catch(errorHandler);
            })
            .catch(errorHandler);
    });
}

export function trimLightningPrefix(invoice) {
    if (invoice.toLowerCase().startsWith(invoicePrefix)) {
        return invoice.slice(invoicePrefix.length);
    }

    return invoice;
}

export function isInvoice(data) {
    return data.toLowerCase().startsWith(bolt11_prefix);
}

const isValidBech32 = (data) => {
    try {
        bech32.decodeToBytes(data);
        return true;
    } catch (e) {
        return false;
    }
};

export function isLnurl(data) {
    return (
        data.includes("@") ||
        (data.toLowerCase().startsWith("lnurl") && isValidBech32(data))
    );
}
