import { Show } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { type SwapIconAssets, SwapIcons } from "./SwapIcons";
import { hiddenInformation } from "./settings/PrivacyMode";
import SettingsCog from "./settings/SettingsCog";

const SwapHeader = (props: {
    id: string;
    status?: string;
    assets?: SwapIconAssets;
}) => {
    const { privacyMode, t } = useGlobalContext();

    return (
        <>
            <span class="frame-header">
                <h2>
                    {t("pay_invoice", {
                        id: privacyMode() ? hiddenInformation : props.id,
                    })}
                    <Show when={props.assets}>
                        {(assets) => <SwapIcons assets={assets()} />}
                    </Show>
                </h2>
                <SettingsCog />
            </span>
            <Show when={props.status}>
                <p class="swap-status">
                    {t("status")}: <span class="btn-small">{props.status}</span>
                </p>
            </Show>
            <hr />
        </>
    );
};

export default SwapHeader;
