import { IoClose } from "solid-icons/io";

import { useGlobalContext } from "../context/Global";
import "../style/settings.scss";
import Denominaton from "./Denomination";
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
            <h2>{t("settings")}</h2>
            <span class="close" onClick={() => setSettingsMenu(false)}>
                <IoClose />
            </span>
            <hr />
            <span class="setting">
                <label>Denominaton: </label>
                <Tooltip label="denomination_tooltip" />
                <div class="spacer"></div>
                <Denominaton />
            </span>
            <span class="setting">
                <label>Decimal Separator: </label>
                <Tooltip label="decimal_tooltip" />
                <div class="spacer"></div>
                <Separator />
            </span>
        </div>
    );
};

export default SettingsMenu;
