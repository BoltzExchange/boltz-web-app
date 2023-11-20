import log from "loglevel";
import QRCode from "qrcode/lib/server";
import { createSignal } from "solid-js";

import "../style/qrcode.scss";

export const Qrcode = ({ data }) => {
    const [dataUrl, setDataUrl] = createSignal("");

    QRCode.toDataURL(data, { width: 300 })
        .then(setDataUrl)
        .catch((err: Error) => {
            log.error("qr code generation error", err);
        });

    return (
        <div id="qrcode" style="position: relative;">
            <img src={dataUrl()} alt="Payment QR Code" />
            <span></span>
        </div>
    );
};

export default Qrcode;
