import { useGlobalContext } from "../../context/Global";

const BitcoinOnly = () => {
    const { bitcoinOnly, setBitcoinOnly, t } = useGlobalContext();

    const toggle = (evt: MouseEvent) => {
        setBitcoinOnly(!bitcoinOnly());
        evt.stopPropagation();
    };

    return (
        <div
            class="toggle"
            data-testid="bitcoin-only-toggle"
            title={t("bitcoin_only_tooltip")}
            onClick={toggle}>
            <span class={bitcoinOnly() ? "active" : ""}>{t("on")}</span>
            <span class={!bitcoinOnly() ? "active" : ""}>{t("off")}</span>
        </div>
    );
};

export default BitcoinOnly;
