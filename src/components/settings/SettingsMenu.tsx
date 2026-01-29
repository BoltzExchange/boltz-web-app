import { BiSolidHelpCircle } from "solid-icons/bi";
import { BsCardText } from "solid-icons/bs";
import { ImDisplay } from "solid-icons/im";
import { IoClose, IoShield } from "solid-icons/io";
import { type JSXElement, Show, onCleanup, onMount } from "solid-js";

import { useGlobalContext } from "../../context/Global";
import type { DictKey } from "../../i18n/i18n";
import "../../style/settings.scss";
import { isMobile } from "../../utils/helper";
import Denomination from "./Denomination";
import FiatAmountSetting from "./FiatAmountSetting";
import Logs from "./Logs";
import PrivacyMode from "./PrivacyMode";
import RescueFile from "./RescueKey";
import Separator from "./Separator";
import Tooltip from "./Tooltip";
import ZeroConf from "./ZeroConf";

const Section = (props: {
    title: string;
    icon: JSXElement;
    children: JSXElement;
}) => {
    return (
        <div class="section-container">
            <h3 class="section-title">
                {props.icon}
                <span>{props.title}</span>
            </h3>
            {props.children}
        </div>
    );
};

const Entry = (props: {
    label: DictKey;
    tooltipLabel: DictKey;
    settingElement: JSXElement;
}) => {
    const { t } = useGlobalContext();

    return (
        <span class="setting">
            <label>
                {t(props.label)}:
                <Tooltip label={{ key: props.tooltipLabel }}>
                    <BiSolidHelpCircle size={18} opacity={0.5} />
                </Tooltip>
            </label>
            <div class="spacer" />
            {props.settingElement}
        </span>
    );
};

const SettingsMenuContent = () => {
    const { t, settingsMenu, setSettingsMenu } = useGlobalContext();

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && settingsMenu()) {
            setSettingsMenu(false);
        }
    };

    onMount(() => {
        document.addEventListener("keydown", handleKeyDown);
    });

    onCleanup(() => {
        document.removeEventListener("keydown", handleKeyDown);
    });

    return (
        <div
            id="settings-menu"
            class="frame assets-select"
            onClick={() => setSettingsMenu(false)}>
            <div onClick={(e) => e.stopPropagation()}>
                <h2>{t("settings")}</h2>
                <span class="close" onClick={() => setSettingsMenu(false)}>
                    <IoClose />
                </span>
                <hr class="spacer" />
                <Section title={t("display")} icon={<ImDisplay size={20} />}>
                    <Entry
                        label={"denomination"}
                        tooltipLabel={"denomination_tooltip"}
                        settingElement={<Denomination />}
                    />
                    <Entry
                        label={"show_fiat_rate"}
                        tooltipLabel={"show_fiat_rate_tooltip"}
                        settingElement={<FiatAmountSetting />}
                    />
                    <Entry
                        label={"decimal_separator"}
                        tooltipLabel={"decimal_tooltip"}
                        settingElement={<Separator />}
                    />
                </Section>

                <Section title={t("security")} icon={<IoShield size={20} />}>
                    <Entry
                        label={"hide_wallet_address"}
                        tooltipLabel={"hide_wallet_address_tooltip"}
                        settingElement={<PrivacyMode />}
                    />
                    <Show when={!isMobile()}>
                        <Entry
                            label={"zero_conf"}
                            tooltipLabel={"zero_conf_tooltip"}
                            settingElement={<ZeroConf />}
                        />
                    </Show>
                    <Entry
                        label={"rescue_key"}
                        tooltipLabel={"download_boltz_rescue_key"}
                        settingElement={<RescueFile />}
                    />
                </Section>

                <Section title={t("support")} icon={<BsCardText size={20} />}>
                    <Entry
                        label={"logs"}
                        tooltipLabel={"logs_tooltip"}
                        settingElement={<Logs />}
                    />
                </Section>
            </div>
        </div>
    );
};

const SettingsMenu = () => {
    const { settingsMenu } = useGlobalContext();

    return (
        <Show when={settingsMenu()}>
            <SettingsMenuContent />
        </Show>
    );
};

export default SettingsMenu;
