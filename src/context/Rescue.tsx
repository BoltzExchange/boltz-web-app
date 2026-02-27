import type { Accessor, JSX, Setter } from "solid-js";
import { createContext, createSignal, useContext } from "solid-js";

import { type AssetType } from "../consts/Assets";
import type { RestorableSwap } from "../utils/boltzClient";
import type { LogRefundData } from "../utils/contractLogs";
import type { ECKeys } from "../utils/ecpair";
import { ECPair } from "../utils/ecpair";
import { type RescueFile, deriveKey } from "../utils/rescueFile";

export const mnemonicLength = 12;
export const rescueKeyMode = "rescue-key";

export type RescueContextType = {
    rescueFile: Accessor<RescueFile>;
    setRescueFile: Setter<RescueFile>;

    rescuableSwaps: Accessor<RestorableSwap[]>;
    setRescuableSwaps: Setter<RestorableSwap[]>;

    rskRescuableSwaps: Accessor<LogRefundData[]>;
    setRskRescuableSwaps: Setter<LogRefundData[]>;

    validRescueKey: Accessor<boolean>;
    setValidRescueKey: Setter<boolean>;

    resetRescueKey: () => void;

    deriveKey: (index: number, asset: AssetType) => ECKeys;
};

const RescueContext = createContext<RescueContextType>();

export const RescueProvider = (props: { children: JSX.Element }) => {
    const [rescueFile, setRescueFile] = createSignal<RescueFile>();
    const [rescuableSwaps, setRescuableSwaps] = createSignal<RestorableSwap[]>(
        [],
    );
    const [rskRescuableSwaps, setRskRescuableSwaps] = createSignal<
        LogRefundData[]
    >([]);
    const [validRescueKey, setValidRescueKey] = createSignal<boolean>(false);

    const resetRescueKey = () => {
        setValidRescueKey(false);
        setRescueFile(undefined);
    };

    const deriveKeyWrapper = (index: number, asset: AssetType) => {
        return ECPair.fromPrivateKey(
            new Uint8Array(deriveKey(rescueFile(), index, asset).privateKey),
        );
    };

    return (
        <RescueContext.Provider
            value={{
                rescueFile,
                setRescueFile,
                rescuableSwaps,
                setRescuableSwaps,
                rskRescuableSwaps,
                setRskRescuableSwaps,
                validRescueKey,
                setValidRescueKey,
                resetRescueKey,
                deriveKey: deriveKeyWrapper,
            }}>
            {props.children}
        </RescueContext.Provider>
    );
};

export const useRescueContext = () => {
    const context = useContext(RescueContext);
    if (!context) {
        throw new Error("useRescueContext: cannot find a RescueContext");
    }
    return context;
};
