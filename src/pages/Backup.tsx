import { useNavigate } from "@solidjs/router";
import type { Accessor } from "solid-js";

import Warning from "../components/Warning";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { downloadJson } from "../utils/download";
import { isMobile } from "../utils/helper";
import type { RescueFile } from "../utils/rescueFile";

const rescueFileName = "boltz-rescue-key-DO-NOT-DELETE";

export const downloadRescueFile = (rescueFile: Accessor<RescueFile>) => {
    downloadJson(rescueFileName, rescueFile());
};

const Backup = () => {
    const navigate = useNavigate();
    const { t, rescueFile } = useGlobalContext();
    const { hasBrowserWallet } = useWeb3Signer();

    const isMobileEvmBrowser = () => isMobile() && hasBrowserWallet();

    return (
        <div class="frame">
            <h2>{t("download_boltz_rescue_key")}</h2>
            <h4>{t("download_boltz_rescue_key_subline")}</h4>
            <p>{t("download_boltz_rescue_key_subline_second")}</p>
            <Warning />
            <p>{t("download_boltz_rescue_key_subline_third")}</p>
            <div class="btns">
                <button
                    class="btn"
                    onClick={() => {
                        if (isMobileEvmBrowser()) {
                            navigate("/backup/mnemonic");
                            return;
                        }

                        downloadRescueFile(rescueFile);
                        navigate("/backup/verify");
                    }}>
                    {isMobileEvmBrowser()
                        ? t("generate_key")
                        : t("download_new_key")}
                </button>
            </div>
        </div>
    );
};

export default Backup;
