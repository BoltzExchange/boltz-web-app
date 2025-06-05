import btcSvg from "../../assets/btc.svg";
import satSvg from "../../assets/sat.svg";
import { BTC } from "../../consts/Assets";
import { Denomination as Denoms } from "../../consts/Enums";
import { useGlobalContext } from "../../context/Global";
import { formatDenomination } from "../../utils/denomination";

const Denomination = () => {
    const { denomination, setDenomination, t } = useGlobalContext();

    const toggleDenomination = () => {
        setDenomination(
            denomination() === Denoms.Btc ? Denoms.Sat : Denoms.Btc,
        );
    };

    const Desktop = () => (
        <div class="denomination-desktop" title={t("denomination_tooltip")}>
            <button
                data-testid="btc-denomination-button"
                class={denomination() == Denoms.Btc ? "active" : ""}
                onClick={() => setDenomination(Denoms.Btc)}>
                <span class="denominator" data-denominator={Denoms.Btc} />
                {formatDenomination(Denoms.Btc, BTC)}
            </button>
            <button
                data-testid="sats-denomination-button"
                class={denomination() == Denoms.Sat ? "active" : ""}
                onClick={() => setDenomination(Denoms.Sat)}>
                <span class="denominator" data-denominator={Denoms.Sat} />
                {formatDenomination(Denoms.Sat, Denoms.Sat)}
            </button>
        </div>
    );

    const Mobile = () => (
        <div
            class="denomination-mobile denomination toggle"
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

    return (
        <>
            <Mobile />
            <Desktop />
        </>
    );
};

export default Denomination;
