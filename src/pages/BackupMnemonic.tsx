import { useNavigate } from "@solidjs/router";
import { For } from "solid-js";

import CopyButton from "../components/CopyButton";
import { useGlobalContext } from "../context/Global";

export const BackupMnemonic = () => {
    const navigate = useNavigate();
    const { t, rescueFile } = useGlobalContext();

    return (
        <div class="frame">
            <h2>{t("backup_boltz_rescue_key")}</h2>
            <h4>{t("download_boltz_rescue_key_subline")}</h4>
            <p>{t("backup_boltz_rescue_key_subline_second")}</p>
            <div class="backup-mnemonic-container">
                <div class="mnemonic-wordlist">
                    <For each={rescueFile().mnemonic.split(" ")}>
                        {(word, i) => (
                            <div class="mnemonic-item">
                                <span class="mnemonic-number">#{i() + 1}</span>
                                <span class="text-bold">{word}</span>
                            </div>
                        )}
                    </For>
                </div>
            </div>
            <p class="text-bold">
                {t("backup_boltz_rescue_key_reminder").toUpperCase()}
            </p>
            <p>{t("backup_boltz_rescue_key_subline_third")}</p>
            <CopyButton
                label="copy_rescue_key"
                btnClass="btn btn-light"
                data={rescueFile().mnemonic}
                removeSpaces={false}
            />
            <hr />
            <button
                class="btn btn-yellow"
                onClick={() => {
                    navigate("/backup/mnemonic/verify");
                }}>
                {t("user_saved_key")}
            </button>
        </div>
    );
};
