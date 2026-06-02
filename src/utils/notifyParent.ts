import { useGlobalContext } from "../context/Global";

export const useParentNotifier = () => {
    const { embeddedMode, parentOrigin } = useGlobalContext();

    const notifyParent = (message: unknown) => {
        const origin = parentOrigin();
        if (!embeddedMode() || !origin || window.parent === window) {
            return;
        }

        window.parent.postMessage(message, origin);
    };

    return { notifyParent };
};
