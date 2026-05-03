import log from "loglevel";
// We have to use the server entry point because
// the client one does not work in Tor Browser
import QRCode from "qrcode/lib/server";
import { createResource, createSignal } from "solid-js";

import { getAssetDisplaySymbol } from "../consts/Assets";
import "../style/qrcode.scss";
import { formatError } from "../utils/errors";

interface QrCodeProps {
    data: string;
    asset?: string;
}

export const Qrcode = (params: QrCodeProps) => {
    const [dataUrl, setDataUrl] = createSignal("");
    const displayAsset = () =>
        params.asset === undefined
            ? undefined
            : getAssetDisplaySymbol(params.asset);

    createResource(async () => {
        try {
            setDataUrl(
                await QRCode.toDataURL(params.data, {
                    width: 300,
                }),
            );
        } catch (e) {
            log.error(`QR code generation failed: ${formatError(e)}`);
        }
    });

    return (
        <div
            data-asset={displayAsset()}
            id="qrcode"
            style={{ position: "relative" }}>
            <img src={dataUrl()} alt="Payment QR Code" />
            <span />
        </div>
    );
};

export default Qrcode;
