import { Show } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { downloadRescueFile } from "../utils/backup";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import Warning from "./Warning";

type BackupDownloadContentProps = {
    onFileDownloaded: () => void;
    onMnemonicRequested: () => void;
};

const BackupDownloadContent = (props: BackupDownloadContentProps) => {
    const { t, rescueFile, notify } = useGlobalContext();
    const { hasBrowserWallet } = useWeb3Signer();

    const isMobileEvmBrowser = () => isMobile() && hasBrowserWallet();
    const downloadKey = () => {
        try {
            downloadRescueFile(rescueFile);
            props.onFileDownloaded();
        } catch (e) {
            notify("error", formatError(e));
        }
    };

    return (
        <>
            <h2>{t("download_boltz_rescue_key")}</h2>
            <h4>{t("download_boltz_rescue_key_subline")}</h4>
            <p>{t("download_boltz_rescue_key_subline_second")}</p>
            <Warning />
            <p>{t("download_boltz_rescue_key_subline_third")}</p>
            <div class="btns">
                <button class="btn" onClick={downloadKey}>
                    {t("download_new_key")}
                </button>
            </div>
            <Show when={isMobileEvmBrowser()}>
                <button
                    class="btn btn-light"
                    data-testid="show-mnemonic-backup"
                    onClick={() => props.onMnemonicRequested()}>
                    {t("show_rescue_key_instead")}
                </button>
            </Show>
        </>
    );
};

export default BackupDownloadContent;
