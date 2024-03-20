import btcSvg from "../assets/btc.svg";
import satSvg from "../assets/sat.svg";
import { useGlobalContext } from "../context/Global";
import { denominations } from "../utils/denomination";

const Denomination = () => {
    const { denomination, setDenomination, t } = useGlobalContext();
    const toggleDenomination = () => {
        setDenomination(
            denomination() === denominations.btc
                ? denominations.sat
                : denominations.btc,
        );
    };

    return (
        <div
            title={t("denomination")}
            class="denomination"
            onClick={() => toggleDenomination()}>
            <img
                src={btcSvg}
                class={denomination() == denominations.btc ? "active" : ""}
                alt={t("denomination")}
            />
            <img
                src={satSvg}
                class={denomination() == denominations.sat ? "active" : ""}
                alt={t("denomination")}
            />
        </div>
    );
};

export default Denomination;
