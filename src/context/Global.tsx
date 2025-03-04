/* @refresh skip */
import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";
import { makePersisted } from "@solid-primitives/storage";
import { ECPairInterface } from "ecpair";
import localforage from "localforage";
import log from "loglevel";
import {
    Accessor,
    Setter,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    useContext,
} from "solid-js";
import type { JSX } from "solid-js";

import { config } from "../config";
import { Denomination } from "../consts/Enums";
import { referralIdKey } from "../consts/LocalStorage";
import { swapStatusFinal } from "../consts/SwapStatus";
import { detectLanguage } from "../i18n/detect";
import dict, { DictKey } from "../i18n/i18n";
import { Pairs, getPairs } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import { deleteOldLogs, injectLogWriter } from "../utils/logs";
import { migrateStorage } from "../utils/migration";
import {
    RescueFile,
    deriveKey,
    generateRescueFile,
    getXpub,
} from "../utils/rescueFile";
import { SomeSwap, SubmarineSwap } from "../utils/swapCreator";
import { getUrlParam, isEmbed } from "../utils/urlParams";
import { checkWasmSupported } from "../utils/wasmSupport";
import { detectWebLNProvider } from "../utils/webln";

const proReferral = "pro";

export type deriveKeyFn = (index: number) => ECPairInterface;
export type newKeyFn = () => { index: number; key: ECPairInterface };

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
    ref: Accessor<string>;
    setRef: Setter<string>;
    i18nConfigured: Accessor<string | null>;
    setI18nConfigured: Setter<string | null>;
    denomination: Accessor<Denomination>;
    setDenomination: Setter<Denomination>;
    hideHero: Accessor<boolean>;
    setHideHero: Setter<boolean>;
    embedded: Accessor<boolean>;
    setEmbedded: Setter<boolean>;
    separator: Accessor<string>;
    setSeparator: Setter<string>;
    settingsMenu: Accessor<boolean>;
    setSettingsMenu: Setter<boolean>;
    audioNotification: Accessor<boolean>;
    setAudioNotification: Setter<boolean>;
    browserNotification: Accessor<boolean>;
    setBrowserNotification: Setter<boolean>;
    // functions
    t: (key: DictKey, values?: Record<string, unknown>) => string;
    notify: (
        type: string,
        message: string,
        browser?: boolean,
        audio?: boolean,
    ) => void;
    playNotificationSound: () => void;
    fetchPairs: () => Promise<void>;

    getLogs: () => Promise<Record<string, string[]>>;
    clearLogs: () => Promise<void>;

    setSwapStorage: (swap: SomeSwap) => Promise<void>;
    getSwap: <T = SomeSwap>(id: string) => Promise<T>;
    getSwaps: <T = SomeSwap>() => Promise<T[]>;
    deleteSwap: (id: string) => Promise<void>;
    clearSwaps: () => Promise<void>;
    updateSwapStatus: (id: string, newStatus: string) => Promise<boolean>;

    hardwareDerivationPath: Accessor<string>;
    setHardwareDerivationPath: Setter<string>;

    setRdns: (address: string, rdns: string) => Promise<string>;
    getRdnsForAddress: (address: string) => Promise<string | null>;

    externalBroadcast: Accessor<boolean>;
    setExternalBroadcast: Setter<boolean>;

    newKey: newKeyFn;
    deriveKey: deriveKeyFn;
    getXpub: () => string;
    rescueFile: Accessor<RescueFile | null>;
    setRescueFile: Setter<RescueFile | null>;
    rescueFileBackupDone: Accessor<boolean>;
    setRescueFileBackupDone: Setter<boolean>;
};

const defaultReferral = () => {
    if (config.isPro) {
        return proReferral;
    }

    return isMobile() ? "boltz_webapp_mobile" : "boltz_webapp_desktop";
};

// Local storage serializer to support the values created by the deprecated "createStorageSignal"
const stringSerializer = {
    serialize: (value: never) => value,
    deserialize: (value: never) => value,
};

const GlobalContext = createContext<GlobalContextType>();

const GlobalProvider = (props: { children: JSX.Element }) => {
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

    const [embedded, setEmbedded] = createSignal<boolean>(false);

    const [hideHero, setHideHero] = createSignal<boolean>(false);

    const [ref, setRef] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal(defaultReferral()),
        {
            name: referralIdKey,
            ...stringSerializer,
        },
    );

    const [i18nConfigured, setI18nConfigured] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal(null),
        {
            name: "i18n",
            ...stringSerializer,
        },
    );
    const [i18nUrl, setI18nUrl] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<string | null>(null),
        {
            name: "i18nUrl",
            ...stringSerializer,
        },
    );

    const [denomination, setDenomination] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<Denomination>(Denomination.Sat),
        {
            name: "denomination",
            ...stringSerializer,
        },
    );

    const [settingsMenu, setSettingsMenu] = createSignal<boolean>(false);

    const [audioNotification, setAudioNotification] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(false),
        {
            name: "audioNotification",
        },
    );

    const localeSeparator = (0.1).toLocaleString().charAt(1);
    const [separator, setSeparator] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal(localeSeparator),
        {
            name: "separator",
        },
    );

    const [rescueFile, setRescueFile] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<RescueFile>(null),
        {
            name: "rescueFile",
        },
    );

    const [lastUsedKey, setLastUsedKey] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<number>(0),
        {
            name: "lastUsedKey",
        },
    );

    const [rescueFileBackupDone, setRescueFileBackupDone] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(false),
        {
            name: "rescueFileBackupDone",
        },
    );

    createEffect(() => {
        if (rescueFile() === null) {
            log.debug("Generating rescue file");
            setRescueFile(generateRescueFile());
        }
    });

    const deriveKeyWrapper = (index: number) => {
        return ECPair.fromPrivateKey(
            Buffer.from(deriveKey(rescueFile(), index).privateKey),
        );
    };

    const newKey = () => {
        const index = lastUsedKey();
        setLastUsedKey(index + 1);
        return { index, key: deriveKeyWrapper(index) };
    };

    const getXpubWrapper = () => {
        return getXpub(rescueFile());
    };

    const notify = (
        type: string,
        message: unknown,
        browser: boolean = false,
        audio: boolean = false,
    ) => {
        const messageStr = formatError(message);

        setNotificationType(type);
        setNotification(messageStr);
        if (audio && audioNotification()) playNotificationSound();
        if (browser && browserNotification()) {
            new Notification(t("notification_header"), {
                body: messageStr,
                icon: "/boltz-icon.svg",
            });
        }
    };

    const playNotificationSound = () => {
        const audio = new Audio("/notification.mp3");
        audio.volume = 0.3;
        void audio.play();
    };

    const fetchPairs = async () => {
        try {
            const data = await getPairs();
            log.debug("getpairs", data);
            setOnline(true);
            setPairs(data);
        } catch (error) {
            log.debug(error);
            setOnline(false);
        }
    };

    // Use IndexedDB if available; fallback to LocalStorage
    localforage.config({
        driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
    });

    const logsForage = localforage.createInstance({
        name: "logs",
    });

    injectLogWriter(logsForage);

    createEffect(() => deleteOldLogs(logsForage));

    const getLogs = async () => {
        const logs: Record<string, string[]> = {};

        await logsForage.iterate<string[], unknown>((logArray, date) => {
            logs[date] = logArray;
        });

        return logs;
    };

    const clearLogs = () => logsForage.clear();

    const paramsForage = localforage.createInstance({
        name: "params",
    });
    const swapsForage = localforage.createInstance({
        name: "swaps",
    });

    migrateStorage(paramsForage, swapsForage).catch((e) =>
        log.error("Storage migration failed:", e),
    );

    const setSwapStorage = async (swap: SomeSwap) => {
        await swapsForage.setItem(swap.id, swap);
    };

    const deleteSwap = (id: string) => swapsForage.removeItem(id);

    const getSwap = <T = SomeSwap,>(id: string) => swapsForage.getItem<T>(id);

    const getSwaps = async <T = SomeSwap,>(): Promise<T[]> => {
        const swaps: T[] = [];

        await swapsForage.iterate<T, unknown>((swap) => {
            swaps.push(swap);
        });

        return swaps;
    };

    const updateSwapStatus = async (id: string, newStatus: string) => {
        if (swapStatusFinal.includes(newStatus)) {
            const swap = await getSwap<SubmarineSwap & { status: string }>(id);

            if (swap.status !== newStatus) {
                swap.status = newStatus;
                await setSwapStorage(swap);
                return true;
            }
        }

        return false;
    };

    const clearSwaps = () => swapsForage.clear();

    const rdnsForage = localforage.createInstance({
        name: "rdns",
    });

    const setRdns = (address: string, rdns: string) =>
        rdnsForage.setItem(address.toLowerCase(), rdns);

    const getRdnsForAddress = (address: string) =>
        rdnsForage.getItem<string>(address.toLowerCase());

    setI18n(detectLanguage(i18nConfigured(), i18nUrl(), setI18nUrl));
    void detectWebLNProvider().then((state: boolean) => setWebln(state));
    setWasmSupported(checkWasmSupported());

    if (!config.isPro) {
        // Get the referral from the URL parameters if this is not pro
        const refParam = getUrlParam("ref");
        if (refParam && refParam !== "") {
            setRef(refParam);
        }
    } else {
        setRef(proReferral);
    }

    if (isEmbed()) {
        setEmbedded(true);
        setHideHero(true);
    }

    const [browserNotification, setBrowserNotification] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(false),
        {
            name: "browserNotification",
        },
    );

    const [hardwareDerivationPath, setHardwareDerivationPath] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<string>(""),
        {
            name: "hardwareDerivationPath",
        },
    );

    // i18n
    createEffect(() => {
        setI18n(detectLanguage(i18nConfigured() || i18nUrl()));
    });
    const dictLocale = createMemo(
        () => flatten(dict[i18n() || config.defaultLanguage]) as never,
    );

    // eslint-disable-next-line solid/reactivity
    const t = translator(dictLocale, resolveTemplate) as (
        key: DictKey,
        values?: Record<string, unknown>,
    ) => string;

    const [externalBroadcast, setExternalBroadcast] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(false),
        {
            name: "externalBroadcast",
        },
    );

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
                audioNotification,
                setAudioNotification,
                browserNotification,
                setBrowserNotification,
                // functions
                t,
                notify,
                playNotificationSound,
                fetchPairs,
                getLogs,
                clearLogs,
                updateSwapStatus,
                setSwapStorage,
                getSwap,
                deleteSwap,
                getSwaps,
                clearSwaps,

                setRdns,
                getRdnsForAddress,
                hardwareDerivationPath,
                setHardwareDerivationPath,

                externalBroadcast,
                setExternalBroadcast,

                newKey,
                rescueFile,
                setRescueFile,
                deriveKey: deriveKeyWrapper,
                getXpub: getXpubWrapper,

                rescueFileBackupDone,
                setRescueFileBackupDone,
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

export { useGlobalContext, GlobalProvider, defaultReferral };
