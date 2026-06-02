import log from "loglevel";

import { useGlobalContext } from "../context/Global";
import { formatError } from "../utils/errors";

export const useParentNotifier = () => {
    const { embeddedMode, parentOrigin } = useGlobalContext();

    const notifyParent = (message: unknown) => {
        const origin = parentOrigin();
        if (
            !embeddedMode() ||
            !origin ||
            origin === "*" ||
            window.parent === window
        ) {
            return;
        }

        try {
            window.parent.postMessage(message, origin);
        } catch (e) {
            log.error("failed to notify parent window", formatError(e));
        }
    };

    return { notifyParent };
};
