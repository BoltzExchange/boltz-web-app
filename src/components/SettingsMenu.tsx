import { IoClose } from "solid-icons/io";

import { useGlobalContext } from "../context/Global";
import "../style/settings.scss";
import Denominaton from "./Denomination";
import ErrorLog from "./ErrorLog";
import Separator from "./Separator";
import Tooltip from "./Tooltip";

const SettingsMenu = () => {
    const { t, settingsMenu, setSettingsMenu } = useGlobalContext();

    return (
        <div
            id="settings-menu"
            class="frame assets-select"
            onClick={() => setSettingsMenu(false)}
            style={settingsMenu() ? "display: block;" : "display: none;"}>
            <div onClick={(e) => e.stopPropagation()}>
                <h2>{t("settings")}</h2>
                <span class="close" onClick={() => setSettingsMenu(false)}>
                    <IoClose />
                </span>
                <hr class="spacer" />
                <span class="setting">
                    <label>{t("denomination")}: </label>
                    <Tooltip label="denomination_tooltip" />
                    <div class="spacer"></div>
                    <Denominaton />
                </span>
                <span class="setting">
                    <label>{t("decimal_separator")}: </label>
                    <Tooltip label="decimal_tooltip" />
                    <div class="spacer"></div>
                    <Separator />
                </span>
                <span class="setting">
                    <label>{t("error_log")}: </label>
                    <Tooltip label="error_log_tooltip" />
                    <div class="spacer"></div>
                    <ErrorLog />
                </span>
            </div>
        </div>
    );
};

export default SettingsMenu;
