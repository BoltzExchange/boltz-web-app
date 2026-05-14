/* @refresh skip */
import { makePersisted } from "@solid-primitives/storage";
import { BigNumber } from "bignumber.js";
import {
    type Accessor,
    type JSX,
    type Setter,
    createContext,
    createEffect,
    createSignal,
    on,
    useContext,
} from "solid-js";

import { Currency } from "../consts/Enums";
import { getBtcPriceFailover } from "../utils/fiat";
import { stringSerializer } from "../utils/persistence";

const fetchInterval = 1000 * 60 * 5; // 5 minutes

export type FiatContextType = {
    btcPrice: Accessor<BigNumber | Error | null>;
    usdToFiatRate: Accessor<BigNumber | null>;
    fetchBtcPrice: () => Promise<void>;
    fiatCurrency: Accessor<Currency>;
    setFiatCurrency: Setter<Currency>;
    showFiatAmount: Accessor<boolean>;
    setShowFiatAmount: Setter<boolean>;
};

const FiatContext = createContext<FiatContextType>();

const FiatProvider = (props: { children: JSX.Element }) => {
    const [btcPrice, setBtcPrice] = createSignal<BigNumber | Error | null>(
        null,
    );
    const [usdToFiatRate, setUsdToFiatRate] = createSignal<BigNumber | null>(
        null,
    );
    const [lastPriceFetch, setLastPriceFetch] = createSignal<number>(0);

    const [fiatCurrency, setFiatCurrency] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<Currency>(Currency.USD),
        {
            name: "fiatCurrency",
            ...stringSerializer,
        },
    );

    const [showFiatAmount, setShowFiatAmount] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(true),
        {
            name: "showFiatAmount",
        },
    );

    const fetchBtcPrice = async () => {
        const currency = fiatCurrency();

        try {
            const fetchedRecently =
                Date.now() - lastPriceFetch() < fetchInterval;
            const hasFiatRate =
                currency === Currency.USD ||
                BigNumber.isBigNumber(usdToFiatRate());
            if (
                fetchedRecently &&
                BigNumber.isBigNumber(btcPrice()) &&
                hasFiatRate
            ) {
                return;
            }
            const [btcPriceFetched, btcPriceUsd] = await Promise.all([
                getBtcPriceFailover(currency),
                currency === Currency.USD
                    ? Promise.resolve(null)
                    : getBtcPriceFailover(Currency.USD).catch(() => null),
            ]);

            if (currency !== fiatCurrency()) {
                return;
            }

            setBtcPrice(btcPriceFetched);
            setUsdToFiatRate(
                currency === Currency.USD
                    ? BigNumber(1)
                    : btcPriceUsd !== null
                      ? btcPriceFetched.div(btcPriceUsd)
                      : null,
            );
            setLastPriceFetch(Date.now());
        } catch {
            if (currency !== fiatCurrency()) {
                return;
            }

            setBtcPrice(
                new Error("Failed to fetch BTC price from all providers"),
            );
            setUsdToFiatRate(currency === Currency.USD ? BigNumber(1) : null);
        }
    };

    createEffect(
        on(
            fiatCurrency,
            () => {
                setBtcPrice(null);
                setUsdToFiatRate(null);
                setLastPriceFetch(0);
                void fetchBtcPrice();
            },
            { defer: true },
        ),
    );

    return (
        <FiatContext.Provider
            value={{
                btcPrice,
                usdToFiatRate,
                fetchBtcPrice,
                fiatCurrency,
                setFiatCurrency,
                showFiatAmount,
                setShowFiatAmount,
            }}>
            {props.children}
        </FiatContext.Provider>
    );
};

const useFiatContext = () => {
    const context = useContext(FiatContext);
    if (!context) {
        throw new Error("useFiatContext: cannot find a FiatContext");
    }
    return context;
};

export { useFiatContext, FiatProvider };
