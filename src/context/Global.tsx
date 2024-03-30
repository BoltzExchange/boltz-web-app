import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";
import { makePersisted } from "@solid-primitives/storage";
import log from "loglevel";
import {
    Accessor,
    Setter,
    createContext,
    createMemo,
    createSignal,
    useContext,
} from "solid-js";

import { config } from "../config";
import { BTC } from "../consts";
import { detectLanguage } from "../i18n/detect";
import dict from "../i18n/i18n";
import { Pairs, getPairs } from "../utils/boltzClient";
import { detectEmbedded } from "../utils/embed";
import { isMobile } from "../utils/helper";
import { swapStatusFinal } from "../utils/swapStatus";
import { checkWasmSupported } from "../utils/wasmSupport";
import { detectWebLNProvider } from "../utils/webln";

export type GlobalContextType = {
    online: Accessor<boolean>;
    setOnline: Setter<boolean>;
    pairs: Accessor<Pairs | undefined>;
    setPairs: Setter<Pairs | undefined>;
    wasmSupported: Accessor<boolean>;
    setWasmSupported: Setter<boolean>;
    refundAddress: Accessor<string | null>;
    setRefundAddress: Setter<string | null>;
    transactionToRefund: Accessor<string | null>;
    setTransactionToRefund: Setter<string | null>;
    i18n: Accessor<string | null>;
    setI18n: Setter<string | null>;
    notification: Accessor<string>;
    setNotification: Setter<string>;
    notificationType: Accessor<string>;
    setNotificationType: Setter<string>;
    webln: Accessor<boolean>;
    setWebln: Setter<boolean>;
    camera: Accessor<boolean>;
    setCamera: Setter<boolean>;
    ref: Accessor<string>;
    setRef: Setter<string>;
    i18nConfigured: Accessor<string | null>;
    setI18nConfigured: Setter<string | null>;
    denomination: Accessor<string>;
    setDenomination: Setter<string>;
    swaps: Accessor<any>;
    setSwaps: Setter<any>;
    hideHero: Accessor<boolean>;
    setHideHero: Setter<boolean>;
    embedded: Accessor<boolean>;
    setEmbedded: Setter<boolean>;
    separator: Accessor<string>;
    setSeparator: Setter<string>;
    // functions
    t: (key: string, values?: Record<string, any>) => string;
    notify: (type: string, message: string) => void;
    fetchPairs: (asset?: string) => void;
    updateSwapStatus: (id: string, newStatus: string) => boolean;
};

// Local storage serializer to support the values created by the deprecated "createStorageSignal"
const stringSerializer = {
    serialize: (value: any) => value,
    deserialize: (value: any) => value,
};

const GlobalContext = createContext<GlobalContextType>();

const GlobalProvider = (props: { children: any }) => {
    const [online, setOnline] = createSignal<boolean>(true);
    const [pairs, setPairs] = createSignal<Pairs | undefined>(undefined);

    const [wasmSupported, setWasmSupported] = createSignal<boolean>(true);
    const [refundAddress, setRefundAddress] = createSignal<string | null>(null);

    const [transactionToRefund, setTransactionToRefund] = createSignal<
        string | null
    >(null);

    const [i18n, setI18n] = createSignal<string | null>(null);

    const [notification, setNotification] = createSignal<string>("");
    const [notificationType, setNotificationType] = createSignal<string>("");

    const [webln, setWebln] = createSignal<boolean>(false);
    const [camera, setCamera] = createSignal<boolean>(false);

    const [embedded, setEmbedded] = createSignal<boolean>(false);

    const [hideHero, setHideHero] = createSignal<boolean>(false);

    const [ref, setRef] = makePersisted(
        createSignal(isMobile ? "boltz_webapp_mobile" : "boltz_webapp_desktop"),
        {
            name: "ref",
            ...stringSerializer,
        },
    );
    const [i18nConfigured, setI18nConfigured] = makePersisted(
        createSignal(null),
        {
            name: "i18n",
            ...stringSerializer,
        },
    );
    const [denomination, setDenomination] = makePersisted(createSignal("sat"), {
        name: "denomination",
        ...stringSerializer,
    });

    const localeSeparator = (0.1).toLocaleString().charAt(1);
    const [separator, setSeparator] = makePersisted(
        createSignal(localeSeparator),
        {
            name: "separator",
        },
    );

    const [swaps, setSwaps] = makePersisted(
        createSignal([], {
            // Because arrays are the same object when changed,
            // we have to override the equality checker
            equals: () => false,
        }),
        {
            name: "swaps",
        },
    );

    const notify = (type: string, message: string) => {
        setNotificationType(type);
        setNotification(message);
    };

    const fetchPairs = (asset: string = BTC) => {
        getPairs(asset)
            .then((data) => {
                log.debug("getpairs", data);
                setOnline(true);
                setPairs(data);
            })
            .catch((error) => {
                log.debug(error);
                setOnline(false);
            });
    };

    const updateSwapStatus = (id: string, newStatus: string) => {
        if (swapStatusFinal.includes(newStatus)) {
            const swapsTmp = swaps();
            const swap = swapsTmp.find((swap) => swap.id === id);

            if (swap.status !== newStatus) {
                swap.status = newStatus;
                setSwaps(swapsTmp);
                return true;
            }
        }
        return false;
    };

    setI18n(detectLanguage(i18nConfigured()));
    detectWebLNProvider().then((state: boolean) => setWebln(state));
    setWasmSupported(checkWasmSupported());

    // check referal
    const refParam = new URLSearchParams(window.location.search).get("ref");
    if (refParam && refParam !== "") {
        setRef(refParam);
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
        );
    }

    if (detectEmbedded()) {
        setEmbedded(true);
    }

    // i18n
    let dictLocale: any;
    createMemo(() => setI18n(i18nConfigured()));
    dictLocale = createMemo(() =>
        flatten(dict[i18n() || config.defaultLanguage]),
    );

    const t = translator(dictLocale, resolveTemplate) as (
        key: string,
        values?: Record<string, any>,
    ) => string;

    return (
        <GlobalContext.Provider
            value={{
                online,
                setOnline,
                pairs,
                setPairs,
                wasmSupported,
                setWasmSupported,
                refundAddress,
                setRefundAddress,
                transactionToRefund,
                setTransactionToRefund,
                i18n,
                setI18n,
                notification,
                setNotification,
                notificationType,
                setNotificationType,
                webln,
                setWebln,
                camera,
                setCamera,
                ref,
                setRef,
                i18nConfigured,
                setI18nConfigured,
                denomination,
                setDenomination,
                swaps,
                setSwaps,
                hideHero,
                setHideHero,
                embedded,
                setEmbedded,
                separator,
                setSeparator,
                // functions
                t,
                notify,
                fetchPairs,
                updateSwapStatus,
            }}>
            {props.children}
        </GlobalContext.Provider>
    );
};

const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error("useGlobalContext: cannot find a GlobalContext");
    }
    return context;
};

export { useGlobalContext, GlobalProvider };
