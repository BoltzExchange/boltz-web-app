import log from "loglevel";
import QRCode from "qrcode/lib/server";
import { createResource, createSignal } from "solid-js";

import "../style/qrcode.scss";
import { formatError } from "../utils/errors";

interface QrCodeProps {
    data: string;
    asset?: string;
}

export const Qrcode = (params: QrCodeProps) => {
    const [dataUrl, setDataUrl] = createSignal("");

    createResource(async () => {
        try {
            setDataUrl(
                await (QRCode.toDataURL(params.data, {
                    width: 300,
                }) as Promise<string>),
            );
        } catch (e) {
            log.error(`QR code generation failed: ${formatError(e)}`);
        }
    });

    return (
        <div
            data-asset={params.asset}
            id="qrcode"
            style={{ position: "relative" }}>
            <img src={dataUrl()} alt="Payment QR Code" />
            <span />
        </div>
    );
};

export default Qrcode;
