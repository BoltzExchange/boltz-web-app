import type { JSX } from "solid-js";
import {
    Accessor,
    Setter,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

import type { RecoverableSwap } from "../utils/boltzClient";
import { RecoveryFile } from "../utils/recoveryFile";

export type RecoveryContextType = {
    xpriv: Accessor<RecoveryFile>;
    setXpriv: Setter<RecoveryFile>;

    recoverableSwaps: Accessor<RecoverableSwap[]>;
    setRecoverableSwaps: Setter<RecoverableSwap[]>;
};

const RecoveryContext = createContext<RecoveryContextType>();

export const RecoveryProvider = (props: { children: JSX.Element }) => {
    const [xpriv, setXpriv] = createSignal<RecoveryFile>();
    const [recoverableSwaps, setRecoverableSwaps] = createSignal<
        RecoverableSwap[]
    >([]);

    return (
        <RecoveryContext.Provider
            value={{ xpriv, setXpriv, recoverableSwaps, setRecoverableSwaps }}>
            {props.children}
        </RecoveryContext.Provider>
    );
};

export const useRecoveryContext = () => {
    const context = useContext(RecoveryContext);
    if (!context) {
        throw new Error("useRecoveryContext: cannot find a RecoveryContext");
    }
    return context;
};
