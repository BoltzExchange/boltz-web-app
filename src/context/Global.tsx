/* @refresh skip  */
import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";
import { makePersisted } from "@solid-primitives/storage";
import localforage from "localforage";
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
import { deleteOldLogs, injectLogWriter } from "../utils/logs";
import { swapStatusFinal } from "../utils/swapStatus";
import { checkWasmSupported } from "../utils/wasmSupport";
import { detectWebLNProvider } from "../utils/webln";

type SwapWithId = { id: string };

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
    hideHero: Accessor<boolean>;
    setHideHero: Setter<boolean>;
    embedded: Accessor<boolean>;
    setEmbedded: Setter<boolean>;
    separator: Accessor<string>;
    setSeparator: Setter<string>;
    settingsMenu: Accessor<boolean>;
    setSettingsMenu: Setter<boolean>;
    // functions
    t: (key: string, values?: Record<string, any>) => string;
    notify: (type: string, message: string) => void;
    fetchPairs: (asset?: string) => void;

    getLogs: () => Promise<Record<string, string[]>>;
    clearLogs: () => Promise<void>;

    setSwapStorage: (swap: SwapWithId) => Promise<any>;
    getSwap: <T = any>(id: string) => Promise<T>;
    getSwaps: <T = any>() => Promise<T[]>;
    deleteSwap: (id: string) => Promise<void>;
    clearSwaps: () => Promise<any>;
    updateSwapStatus: (id: string, newStatus: string) => Promise<boolean>;
};

// Local storage serializer to support the values created by the deprecated "createStorageSignal"
const stringSerializer = {
    serialize: (value: any) => value,
    deserialize: (value: any) => value,
};

const migrateSwapsFromLocalStorage = async () => {
    const [localStorageSwaps, setLocalStorageSwaps] = makePersisted(
        createSignal([], {
            // Because arrays are the same object when changed,
            // we have to override the equality checker
            equals: () => false,
        }),
        {
            name: "swaps",
        },
    );

    for (const swap of localStorageSwaps()) {
        await localforage.setItem(swap.id, swap);
    }

    const migratedSwapCount = localStorageSwaps().length;
    setLocalStorageSwaps([]);

    return migratedSwapCount;
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

    const [settingsMenu, setSettingsMenu] = createSignal<boolean>(false);

    const localeSeparator = (0.1).toLocaleString().charAt(1);
    const [separator, setSeparator] = makePersisted(
        createSignal(localeSeparator),
        {
            name: "separator",
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

    // Use IndexedDB if available; fallback to LocalStorage
    localforage.config({
        driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
    });

    const errorForage = localforage.createInstance({
        name: "errors",
    });

    injectLogWriter(errorForage);

    createMemo(() => deleteOldLogs(errorForage));

    const getLogs = async () => {
        const logs: Record<string, string[]> = {};

        await errorForage.iterate<string[], any>((logArray, date) => {
            logs[date] = logArray;
        });

        return logs;
    };

    const clearLogs = () => errorForage.clear();

    const swapsForage = localforage.createInstance({
        name: "swaps",
    });

    migrateSwapsFromLocalStorage()
        .then((migratedSwapCount) => {
            if (migratedSwapCount === 0) {
                return;
            }

            log.debug(
                `migrated ${migratedSwapCount} from local storage to localforage`,
            );
        })
        .catch((e) => {
            log.error(
                "could not migrate swaps from local storage to localforage",
                e,
            );
        });

    const setSwapStorage = (swap: SwapWithId) =>
        swapsForage.setItem(swap.id, swap);

    const deleteSwap = (id: string) => swapsForage.removeItem(id);

    const getSwap = <T = SwapWithId,>(id: string) => swapsForage.getItem<T>(id);

    const getSwaps = async <T = SwapWithId,>(): Promise<T[]> => {
        const swaps: T[] = [];

        await swapsForage.iterate<T, any>((swap) => {
            swaps.push(swap);
        });

        return swaps;
    };

    const updateSwapStatus = async (id: string, newStatus: string) => {
        if (swapStatusFinal.includes(newStatus)) {
            const swap = await getSwap<SwapWithId & { status: string }>(id);

            if (swap.status !== newStatus) {
                swap.status = newStatus;
                await setSwapStorage(swap);
                return true;
            }
        }

        return false;
    };

    const clearSwaps = () => swapsForage.clear();

    setI18n(detectLanguage(i18nConfigured()));
    detectWebLNProvider().then((state: boolean) => setWebln(state));
    setWasmSupported(checkWasmSupported());

    // check referral
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
                hideHero,
                setHideHero,
                embedded,
                setEmbedded,
                separator,
                setSeparator,
                settingsMenu,
                setSettingsMenu,
                // functions
                t,
                notify,
                fetchPairs,
                getLogs,
                clearLogs,
                updateSwapStatus,
                setSwapStorage,
                getSwap,
                deleteSwap,
                getSwaps,
                clearSwaps,
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
