import btcSvg from "../../assets/btc.svg";
import satSvg from "../../assets/sat.svg";
import { Denomination as Denoms } from "../../consts/Enums";
import { useGlobalContext } from "../../context/Global";

const Denomination = () => {
    const { denomination, setDenomination, t } = useGlobalContext();

    const toggleDenomination = () => {
        setDenomination(
            denomination() === Denoms.Btc ? Denoms.Sat : Denoms.Btc,
        );
    };

    return (
        <div
            class="denomination toggle"
            title={t("denomination_tooltip")}
            onClick={toggleDenomination}>
            <img
                src={btcSvg}
                class={denomination() == Denoms.Btc ? "active" : ""}
                alt="denominator"
            />
            <img
                src={satSvg}
                class={denomination() == Denoms.Sat ? "active" : ""}
                alt="denominator"
            />
        </div>
    );
};

export default Denomination;
