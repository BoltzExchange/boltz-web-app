import { useGlobalContext } from "../../context/Global";

export const hiddenInformation = "xxxxxxxx";

const PrivacyMode = () => {
    const { privacyMode, setPrivacyMode, t } = useGlobalContext();

    const togglePrivacyMode = (evt: MouseEvent) => {
        setPrivacyMode(!privacyMode());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="toggle"
                title={t("hide_wallet_address_tooltip")}
                onClick={togglePrivacyMode}>
                <span class={privacyMode() ? "active" : ""}>{t("on")}</span>
                <span class={!privacyMode() ? "active" : ""}>{t("off")}</span>
            </div>
        </>
    );
};

export default PrivacyMode;
