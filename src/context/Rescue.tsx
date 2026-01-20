import type { ECPairInterface } from "ecpair";
import type { Accessor, JSX, Setter } from "solid-js";
import { createContext, createSignal, useContext } from "solid-js";

import { type AssetType } from "../consts/Assets";
import type { RestorableSwap } from "../utils/boltzClient";
import type { LogRefundData } from "../utils/contractLogs";
import { ECPair } from "../utils/ecpair";
import { type RescueFile, deriveKey } from "../utils/rescueFile";

export type RescueContextType = {
    rescueFile: Accessor<RescueFile>;
    setRescueFile: Setter<RescueFile>;

    rescuableSwaps: Accessor<RestorableSwap[]>;
    setRescuableSwaps: Setter<RestorableSwap[]>;

    rskRescuableSwaps: Accessor<LogRefundData[]>;
    setRskRescuableSwaps: Setter<LogRefundData[]>;

    deriveKey: (index: number, asset: AssetType) => ECPairInterface;
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

    const deriveKeyWrapper = (index: number, asset: AssetType) => {
        return ECPair.fromPrivateKey(
            Buffer.from(deriveKey(rescueFile(), index, asset).privateKey),
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
