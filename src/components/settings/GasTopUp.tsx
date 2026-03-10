import { useGlobalContext } from "../../context/Global";

const GasTopUp = () => {
    const { gasTopUp, setGasTopUp, t } = useGlobalContext();

    const toggle = (evt: MouseEvent) => {
        setGasTopUp(!gasTopUp());
        evt.stopPropagation();
    };

    return (
        <div
            class="toggle"
            data-testid="gas-topup-toggle"
            title={t("gas_topup_tooltip")}
            onClick={toggle}>
            <span class={gasTopUp() ? "active" : ""}>{t("on")}</span>
            <span class={!gasTopUp() ? "active" : ""}>{t("off")}</span>
        </div>
    );
};

export default GasTopUp;
