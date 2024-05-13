import btcSvg from "../assets/btc.svg";
import satSvg from "../assets/sat.svg";
import { Denomination as D } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";

const Denomination = () => {
    const { denomination, setDenomination, t } = useGlobalContext();

    const toggleDenomination = () => {
        setDenomination(denomination() === D.Btc ? D.Sat : D.Btc);
    };

    return (
        <div
            class="denomination toggle"
            title={t("denomination_tooltip")}
            onClick={toggleDenomination}>
            <img
                src={btcSvg}
                class={denomination() == D.Btc ? "active" : ""}
                alt="denominator"
            />
            <img
                src={satSvg}
                class={denomination() == D.Sat ? "active" : ""}
                alt="denominator"
            />
        </div>
    );
};

export default Denomination;
