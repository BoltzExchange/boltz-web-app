import btcSvg from "../assets/btc.svg";
import satSvg from "../assets/sat.svg";
import { useGlobalContext } from "../context/Global";
import { denominations } from "../utils/denomination";

const Denomination = () => {
    const { denomination, setDenomination, t } = useGlobalContext();

    const toggleDenomination = (evt: MouseEvent) => {
        setDenomination(
            denomination() === denominations.btc
                ? denominations.sat
                : denominations.btc,
        );
        evt.stopPropagation();
    };

    return (
        <div
            class="denomination toggle"
            title={t("denomination_tooltip")}
            onClick={toggleDenomination}>
            <img
                src={btcSvg}
                class={denomination() == "btc" ? "active" : ""}
                alt="denominator"
            />
            <img
                src={satSvg}
                class={denomination() == "sat" ? "active" : ""}
                alt="denominator"
            />
        </div>
    );
};

export default Denomination;
