import type { ECPairInterface } from "ecpair";
import type { Accessor, JSX, Setter } from "solid-js";
import { createContext, createSignal, useContext } from "solid-js";

import type { RestorableSwap } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import { type RescueFile, deriveKey } from "../utils/rescueFile";

export type RescueContextType = {
    rescueFile: Accessor<RescueFile>;
    setRescueFile: Setter<RescueFile>;

    rescuableSwaps: Accessor<RestorableSwap[]>;
    setRescuableSwaps: Setter<RestorableSwap[]>;

    deriveKey: (index: number) => ECPairInterface;
};

const RescueContext = createContext<RescueContextType>();

export const RescueProvider = (props: { children: JSX.Element }) => {
    const [rescueFile, setRescueFile] = createSignal<RescueFile>();
    const [rescuableSwaps, setRescuableSwaps] = createSignal<RestorableSwap[]>(
        [],
    );

    const deriveKeyWrapper = (index: number) => {
        return ECPair.fromPrivateKey(
            Buffer.from(deriveKey(rescueFile(), index).privateKey),
        );
    };

    return (
        <RescueContext.Provider
            value={{
                rescueFile,
                setRescueFile,
                rescuableSwaps,
                setRescuableSwaps,
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
