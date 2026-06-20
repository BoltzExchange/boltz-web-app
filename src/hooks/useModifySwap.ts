import type { Accessor, Setter } from "solid-js";

import { type GlobalContextType, useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import type { SomeSwap } from "../utils/swapCreator";

export const createSwapModifier =
    (
        modifySwapStorage: GlobalContextType["modifySwapStorage"],
        swap: Accessor<SomeSwap | null>,
        setSwap: Setter<SomeSwap | null>,
    ) =>
    async <T extends SomeSwap = SomeSwap>(
        id: string,
        mutator: (swap: T) => void | Promise<void>,
    ): Promise<T | null> => {
        const updated = await modifySwapStorage<T>(id, mutator);

        if (updated !== null && swap()?.id === updated.id) {
            setSwap(updated as SomeSwap);
        }

        return updated;
    };

export const useModifySwap = () => {
    const { modifySwapStorage } = useGlobalContext();
    const { swap, setSwap } = usePayContext();

    return createSwapModifier(modifySwapStorage, swap, setSwap);
};
