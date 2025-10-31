import { useNavigate } from "@solidjs/router";
import log from "loglevel";
import { BiRegularRefresh } from "solid-icons/bi";

import { useCreateContext } from "../../context/Create";
import { useGlobalContext } from "../../context/Global";
import { generateRescueFile } from "../../utils/rescueFile";

const ResetRescueKey = () => {
    const iconSize = 16;
    const navigate = useNavigate();

    const {
        t,
        setRescueFile,
        clearSwaps,
        setRescueFileBackupDone,
        setSettingsMenu,
        notify,
    } = useGlobalContext();
    const { setSendAmount, setReceiveAmount } = useCreateContext();

    const handleReset = async () => {
        const confirmText = window.prompt(t("reset_rescue_key_prompt"));

        if (confirmText === null) {
            // User clicked Cancel
            return;
        }

        if (confirmText.toLowerCase() !== "confirm") {
            alert(t("reset_rescue_key_invalid_confirmation"));
            return;
        }

        try {
            await clearSwaps();
            const newRescueFile = generateRescueFile();
            setRescueFile(newRescueFile);
            setRescueFileBackupDone(false);
            setSettingsMenu(false);
            setSendAmount(BigNumber(0));
            setReceiveAmount(BigNumber(0));
            navigate("/");
            log.info("Rescue key reset successfully");
            notify("success", "Successfully generated new Rescue Key");
        } catch (error) {
            alert(t("reset_rescue_key_error", { error }));
            log.error("Failed to reset rescue key", error);
        }
    };

    return (
        <div class="flex" data-testid="reset-rescue-key">
            <span class="btn-small" onClick={handleReset}>
                <BiRegularRefresh size={iconSize} />
            </span>
        </div>
    );
};

export default ResetRescueKey;
