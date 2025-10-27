import { BiRegularRefresh } from "solid-icons/bi";

import { useGlobalContext } from "../../context/Global";
import { generateRescueFile } from "../../utils/rescueFile";

const ResetRescueKey = () => {
    const iconSize = 16;

    const { t, setRescueFile, clearSwaps, setRescueFileBackupDone } =
        useGlobalContext();

    const handleReset = () => {
        const confirmText = window.prompt(t("reset_rescue_key_prompt"));

        if (confirmText === null) {
            // User clicked Cancel
            return;
        }

        if (confirmText.toLowerCase() !== "confirm") {
            alert(t("reset_rescue_key_invalid_confirmation"));
            return;
        }

        clearSwaps()
            .then(() => {
                const newRescueFile = generateRescueFile();
                setRescueFile(newRescueFile);
                setRescueFileBackupDone(false);

                window.location.reload();
            })
            .catch((error) => {
                alert(t("reset_rescue_key_error", { error }));
            });
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
