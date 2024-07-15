import { IoClose } from "solid-icons/io";
import { JSXElement } from "solid-js";
import { Show } from "solid-js/web";

import { config } from "../../config";
import { useGlobalContext } from "../../context/Global";
import "../../style/settings.scss";
import AudioNotificationSetting from "./AudioNotificationSetting";
import BlockExplorerSetting from "./BlockExplorerSetting";
import BroadcastSetting from "./BroadcastSetting";
import BrowserNotification from "./BrowserNotification";
import Denomination from "./Denomination";
import Logs from "./Logs";
import RecklessModeSetting from "./RecklessModeSetting";
import Separator from "./Separator";
import Tooltip from "./Tooltip";

const Entry = ({
    label,
    tooltipLabel,
    settingElement,
}: {
    label: string;
    tooltipLabel: string;
    settingElement: JSXElement;
}) => {
    const { t } = useGlobalContext();
    return (
        <span class="setting">
            <label>{t(label)}: </label>
            <Tooltip label={tooltipLabel} />
            <div class="spacer"></div>
            {settingElement}
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
                <Show when={config.network !== "mainnet"}>
                    <Entry
                        label={"reckless_mode_setting"}
                        tooltipLabel={"reckless_mode_setting_tooltip"}
                        settingElement={<RecklessModeSetting />}
                    />
                </Show>
                <Entry
                    label={"broadcast_setting"}
                    tooltipLabel={"broadcast_setting_tooltip"}
                    settingElement={<BroadcastSetting />}
                />
                <Entry
                    label={"blockexplorer_setting"}
                    tooltipLabel={"blockexplorer_setting_tooltip"}
                    settingElement={<BlockExplorerSetting />}
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
