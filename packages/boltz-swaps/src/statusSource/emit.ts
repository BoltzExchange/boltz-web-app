import { toError } from "../errors.ts";
import { getLogger } from "../logger.ts";
import type {
    StatusErrorHandler,
    StatusUpdateHandler,
    SwapUpdate,
} from "./types.ts";

export const safeEmit = (
    handler: StatusUpdateHandler,
    update: SwapUpdate,
): void => {
    try {
        handler(update);
    } catch (e) {
        getLogger().warn("status subscriber threw", e);
    }
};

export const safeEmitError = (
    handlers: Iterable<StatusErrorHandler>,
    error: unknown,
    id: string,
): void => {
    const normalized = toError(error);
    for (const handler of handlers) {
        try {
            handler(normalized, id);
        } catch (e) {
            getLogger().warn("status error subscriber threw", e);
        }
    }
};
