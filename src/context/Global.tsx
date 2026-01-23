/* @refresh skip */
import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";
import { makePersisted } from "@solid-primitives/storage";
import type { ECPairInterface } from "ecpair";
import localforage from "localforage";
import log from "loglevel";
import {
    createContext,
    createEffect,
    createMemo,
    createSignal,
    useContext,
} from "solid-js";
import type { Accessor, JSX, Setter } from "solid-js";
import { getBtcPriceFailover } from "src/utils/fiat";

import { config } from "../config";
import { type AssetType, LBTC, RBTC } from "../consts/Assets";
import { Denomination, UrlParam } from "../consts/Enums";
import { referralIdKey } from "../consts/LocalStorage";
import { detectLanguage } from "../i18n/detect";
import type { DictKey } from "../i18n/i18n";
import dict from "../i18n/i18n";
import type { Pairs } from "../utils/boltzClient";
import { getPairs } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { formatError } from "../utils/errors";
import { isMobile } from "../utils/helper";
import { deleteOldLogs, injectLogWriter } from "../utils/logs";
import { migrateStorage } from "../utils/migration";
import type { RescueFile } from "../utils/rescueFile";
import { deriveKey, generateRescueFile, getXpub } from "../utils/rescueFile";
import type { SomeSwap } from "../utils/swapCreator";
import { getUrlParam, resetUrlParam } from "../utils/urlParams";
import { checkWasmSupported } from "../utils/wasmSupport";
import { detectWebLNProvider } from "../utils/webln";

export const liquidUncooperativeExtra = 3;
const proReferral = "pro";

type NotificationType = "success" | "error";
export type deriveKeyFn = (index: number, asset: AssetType) => ECPairInterface;
export type newKeyFn = (asset: AssetType) => {
    index: number;
    key: ECPairInterface;
};
export type tFn = (key: DictKey, values?: Record<string, unknown>) => string;
export type notifyFn = (type: NotificationType, message: string) => void;

export type GlobalContextType = {
    online: Accessor<boolean>;
    setOnline: Setter<boolean>;
    pairs: Accessor<Pairs | undefined>;
    setPairs: Setter<Pairs | undefined>;
    regularPairs: Accessor<Pairs | undefined>;
    setRegularPairs: Setter<Pairs | undefined>;
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
    separator: Accessor<string>;
    setSeparator: Setter<string>;
    settingsMenu: Accessor<boolean>;
    setSettingsMenu: Setter<boolean>;
    privacyMode: Accessor<boolean>;
    setPrivacyMode: Setter<boolean>;
    zeroConf: Accessor<boolean>;
    setZeroConf: Setter<boolean>;
    showFiatAmount: Accessor<boolean>;
    setShowFiatAmount: Setter<boolean>;
    btcPrice: Accessor<BigNumber | Error | null>;
    fetchBtcPrice: () => Promise<void>;
    // functions
    t: tFn;
    notify: notifyFn;
    fetchPairs: () => Promise<void>;
    fetchRegularPairs: () => Promise<void>;

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
    getRdnsAll: () => Promise<{ address: string; rdns: string }[]>;
    getRdnsForAddress: (address: string) => Promise<string | null>;

    newKey: newKeyFn;
    deriveKey: deriveKeyFn;
    getXpub: () => string;
    setLastUsedKey: Setter<number>;
    lastUsedRskKey: Accessor<number>;
    setLastUsedRskKey: Setter<number>;
    rescueFile: Accessor<RescueFile | null>;
    setRescueFile: Setter<RescueFile | null>;
    rescueFileBackupDone: Accessor<boolean>;
    setRescueFileBackupDone: Setter<boolean>;

    // UNIX timestamp when a backup file was last imported
    // Used to prevent auto-claiming swaps that were created before the backup
    backupImportTimestamp: Accessor<number | undefined>;
    setBackupImportTimestamp: Setter<number | undefined>;
};

const regularReferral = () =>
    isMobile() ? "boltz_webapp_mobile" : "boltz_webapp_desktop";

const defaultReferral = () => {
    if (config.isPro) {
        return proReferral;
    }

    return regularReferral();
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
    const [regularPairs, setRegularPairs] = createSignal<Pairs | undefined>(
        undefined,
    );

    const [wasmSupported, setWasmSupported] = createSignal<boolean>(true);
    const [refundAddress, setRefundAddress] = createSignal<string | null>(null);

    const [transactionToRefund, setTransactionToRefund] = createSignal<
        string | null
    >(null);

    const [i18n, setI18n] = createSignal<string | null>(null);

    const [notification, setNotification] = createSignal<string>("");
    const [notificationType, setNotificationType] = createSignal<string>("");

    const [webln, setWebln] = createSignal<boolean>(false);

    const [hideHero, setHideHero] = createSignal<boolean>(false);

    const [btcPrice, setBtcPrice] = createSignal<BigNumber | Error | null>(
        null,
    );
    const [lastPriceFetch, setLastPriceFetch] = createSignal<number>(0);

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

    const [lastUsedRskKey, setLastUsedRskKey] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<number>(0),
        {
            name: "lastUsedRskKey",
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

    const deriveKeyWrapper = (index: number, asset: AssetType) => {
        return ECPair.fromPrivateKey(
            Buffer.from(deriveKey(rescueFile(), index, asset).privateKey),
        );
    };

    const newKey = (asset: AssetType) => {
        if (asset === RBTC) {
            const index = lastUsedRskKey();
            setLastUsedRskKey(index + 1);
            return {
                index,
                key: deriveKeyWrapper(index, asset),
            };
        }

        const index = lastUsedKey();
        setLastUsedKey(index + 1);
        return { index, key: deriveKeyWrapper(index, asset) };
    };

    const getXpubWrapper = () => {
        return getXpub(rescueFile());
    };

    const notify = (type: NotificationType, message: unknown) => {
        const messageStr = formatError(message);

        setNotificationType(type);
        setNotification(messageStr);
    };

    const addUncooperativeExtra = (pairs: Pairs) => {
        Object.values(pairs.chain).forEach((assetPairs) => {
            if (assetPairs[LBTC]) {
                assetPairs[LBTC].fees.minerFees.user.claim +=
                    liquidUncooperativeExtra;
            }
        });

        Object.values(pairs.reverse).forEach((assetPairs) => {
            if (assetPairs[LBTC]) {
                assetPairs[LBTC].fees.minerFees.claim +=
                    liquidUncooperativeExtra;
            }
        });
    };

    const fetchPairs = async () => {
        try {
            const data = await getPairs();

            addUncooperativeExtra(data);

            log.debug("getpairs", data);
            setOnline(true);
            setPairs(data);
        } catch (error) {
            log.error("Error fetching pairs", error);
            setOnline(false);
            throw formatError(error);
        }
    };

    const fetchRegularPairs = async () => {
        try {
            const data = await getPairs({
                headers: {
                    referral: regularReferral(),
                },
            });

            addUncooperativeExtra(data);

            log.debug("Regular pairs", data);
            setRegularPairs(data);
        } catch (error) {
            log.error("Error fetching regular pairs", error);
            throw formatError(error);
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

    const deleteSwap = async (id: string) => await swapsForage.removeItem(id);

    const getSwap = <T = SomeSwap,>(id: string) => swapsForage.getItem<T>(id);

    const getSwaps = async <T = SomeSwap,>(): Promise<T[]> => {
        const swaps: T[] = [];

        await swapsForage.iterate<T, unknown>((swap) => {
            swaps.push(swap);
        });

        return swaps;
    };

    const updateSwapStatus = async (id: string, newStatus: string) => {
        const swap = await getSwap<SomeSwap & { status: string }>(id);

        if (swap === undefined || swap === null) {
            log.warn(`cannot update swap ${id} status: not found`);
            return false;
        }

        if (swap.status !== newStatus) {
            swap.status = newStatus;
            await setSwapStorage(swap);
            return true;
        }

        return false;
    };

    const clearSwaps = async () => {
        await swapsForage.clear();
        setBackupImportTimestamp(undefined);
    };

    const rdnsForage = localforage.createInstance({
        name: "rdns",
    });

    const setRdns = (address: string, rdns: string) =>
        rdnsForage.setItem(address.toLowerCase(), rdns);

    const getRdnsAll = async () => {
        const result: { address: string; rdns: string }[] = [];

        await rdnsForage.iterate<string, unknown>((rdns, address) => {
            result.push({ address, rdns });
        });

        return result;
    };

    const getRdnsForAddress = (address: string) =>
        rdnsForage.getItem<string>(address.toLowerCase());

    setI18n(detectLanguage(i18nConfigured(), i18nUrl(), setI18nUrl));
    void detectWebLNProvider().then((state: boolean) => setWebln(state));
    setWasmSupported(checkWasmSupported());

    const fetchBtcPrice = async () => {
        try {
            const fetchedRecently =
                Date.now() - lastPriceFetch() < 1000 * 60 * 5; // 5 minutes
            if (!showFiatAmount() || fetchedRecently) {
                return;
            }
            const btcPrice = await getBtcPriceFailover();

            setBtcPrice(btcPrice);
            setLastPriceFetch(Date.now());
        } catch {
            setBtcPrice(
                new Error("Failed to fetch BTC price from all providers"),
            );
        }
    };

    if (!config.isPro) {
        // Get the referral from the URL parameters if this is not pro
        const refParam = getUrlParam(UrlParam.Ref);
        if (refParam && refParam !== "") {
            setRef(refParam);
            resetUrlParam(UrlParam.Ref);
        }
    } else {
        setRef(proReferral);
    }

    const [privacyMode, setPrivacyMode] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(false),
        {
            name: "privacyMode",
        },
    );

    const [zeroConf, setZeroConf] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(true),
        {
            name: "zeroConf",
        },
    );

    const [showFiatAmount, setShowFiatAmount] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<boolean>(true),
        {
            name: "showFiatAmount",
        },
    );

    const [hardwareDerivationPath, setHardwareDerivationPath] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<string>(""),
        {
            name: "hardwareDerivationPath",
        },
    );

    const [backupImportTimestamp, setBackupImportTimestamp] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal<number>(),
        {
            name: "backupImportTimestamp",
        },
    );

    createEffect(() => {
        if (isMobile()) {
            setZeroConf(true);
        }
    });

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

    return (
        <GlobalContext.Provider
            value={{
                online,
                setOnline,
                pairs,
                setPairs,
                regularPairs,
                setRegularPairs,
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
                separator,
                setSeparator,
                settingsMenu,
                setSettingsMenu,
                privacyMode,
                setPrivacyMode,
                zeroConf,
                setZeroConf,
                showFiatAmount,
                setShowFiatAmount,
                btcPrice,
                fetchBtcPrice,
                // functions
                t,
                notify,
                fetchPairs,
                fetchRegularPairs,
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
                getRdnsAll,
                hardwareDerivationPath,
                setHardwareDerivationPath,

                newKey,
                rescueFile,
                setRescueFile,
                setLastUsedKey,
                lastUsedRskKey,
                setLastUsedRskKey,
                getXpub: getXpubWrapper,
                deriveKey: deriveKeyWrapper,

                rescueFileBackupDone,
                setRescueFileBackupDone,

                backupImportTimestamp,
                setBackupImportTimestamp,
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
