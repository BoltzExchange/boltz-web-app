import { useGlobalContext } from "../../context/Global";

const FiatAmountSetting = () => {
    const { showFiatAmount, setShowFiatAmount, t } = useGlobalContext();

    const toggleFiatAmount = (evt: MouseEvent) => {
        setShowFiatAmount(!showFiatAmount());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="fiat-rate toggle"
                title={t("show_fiat_rate_tooltip")}
                onClick={toggleFiatAmount}>
                <span class={showFiatAmount() ? "active" : ""}>{t("on")}</span>
                <span class={!showFiatAmount() ? "active" : ""}>
                    {t("off")}
                </span>
            </div>
        </>
    );
};

export default FiatAmountSetting;
