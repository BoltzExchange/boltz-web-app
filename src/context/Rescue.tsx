import type { JSX } from "solid-js";
import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

import type { RescuableSwap } from "../utils/boltzClient";
import { RescueFile } from "../utils/rescueFile";

export type RescueContextType = {
    xpriv: Accessor<RescueFile>;
    setXpriv: Setter<RescueFile>;

    rescuableSwaps: Accessor<RescuableSwap[]>;
    setRescuableSwaps: Setter<RescuableSwap[]>;
};

const RescueContext = createContext<RescueContextType>();

export const RescueProvider = (props: { children: JSX.Element }) => {
    const [xpriv, setXpriv] = createSignal<RescueFile>();
    const [rescuableSwaps, setRescuableSwaps] = createSignal<RescuableSwap[]>(
        [],
    );

    return (
        <RescueContext.Provider
            value={{ xpriv, setXpriv, rescuableSwaps, setRescuableSwaps }}>
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
