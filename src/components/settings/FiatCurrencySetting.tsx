import { Currency } from "../../consts/Enums";
import { useFiatContext } from "../../context/Fiat";
import { useGlobalContext } from "../../context/Global";
import Select from "../Select";

const FiatCurrencySetting = () => {
    const { t } = useGlobalContext();
    const { fiatCurrency, setFiatCurrency } = useFiatContext();

    return (
        <Select
            data-testid="fiat-currency-select"
            title={t("fiat_currency_tooltip")}
            value={fiatCurrency()}
            options={Object.values(Currency)}
            onChange={(value) => setFiatCurrency(value as Currency)}
        />
    );
};

export default FiatCurrencySetting;
