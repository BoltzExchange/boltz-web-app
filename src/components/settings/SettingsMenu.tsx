import { IoClose } from "solid-icons/io";
import type { JSXElement } from "solid-js";

import { useGlobalContext } from "../../context/Global";
import type { DictKey } from "../../i18n/i18n";
import "../../style/settings.scss";
import AudioNotificationSetting from "./AudioNotificationSetting";
import BroadcastSetting from "./BroadcastSetting";
import BrowserNotification from "./BrowserNotification";
import Denomination from "./Denomination";
import Logs from "./Logs";
import RescueFile from "./RescueKey";
import Separator from "./Separator";
import Tooltip from "./Tooltip";

const Entry = (props: {
    label: DictKey;
    tooltipLabel: DictKey;
    settingElement: JSXElement;
}) => {
    const { t } = useGlobalContext();
    return (
        <span class="setting">
            <label>{t(props.label)}: </label>
            <Tooltip label={props.tooltipLabel} />
            <div class="spacer" />
            {props.settingElement}
        </span>
    );
};

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
                <Entry
                    label={"denomination"}
                    tooltipLabel={"denomination_tooltip"}
                    settingElement={<Denomination />}
                />
                <Entry
                    label={"decimal_separator"}
                    tooltipLabel={"decimal_tooltip"}
                    settingElement={<Separator />}
                />
                <Entry
                    label={"enable_audio_notifications"}
                    tooltipLabel={"enable_audio_notifications_tooltip"}
                    settingElement={<AudioNotificationSetting />}
                />
                <Entry
                    label={"browsernotification"}
                    tooltipLabel={"browsernotification_tooltip"}
                    settingElement={<BrowserNotification />}
                />
                <Entry
                    label={"broadcast_setting"}
                    tooltipLabel={"broadcast_setting_tooltip"}
                    settingElement={<BroadcastSetting />}
                />
                <Entry
                    label={"rescue_key"}
                    tooltipLabel={"download_boltz_rescue_key"}
                    settingElement={<RescueFile />}
                />
                <Entry
                    label={"logs"}
                    tooltipLabel={"logs_tooltip"}
                    settingElement={<Logs />}
                />
            </div>
        </div>
    );
};

export default SettingsMenu;
