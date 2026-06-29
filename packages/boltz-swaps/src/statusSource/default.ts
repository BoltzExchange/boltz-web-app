import { createPollingStatusSource } from "./polling.ts";
import type { StatusSource } from "./types.ts";
import {
    type WebSocketStatusSourceOptions,
    createWebSocketStatusSource,
} from "./websocket.ts";

export type DefaultStatusSourceOptions = WebSocketStatusSourceOptions & {
    // Interval for the polling fallback, in milliseconds. Default 5000.
    pollIntervalMs?: number;
};

// The SDK's default StatusSource: a WebSocket stream backed by a REST polling
// fallback.
export const createDefaultStatusSource = (
    options: DefaultStatusSourceOptions = {},
): StatusSource => {
    const { pollIntervalMs, ...wsOptions } = options;
    return createWebSocketStatusSource({
        fallback: createPollingStatusSource({ intervalMs: pollIntervalMs }),
        ...wsOptions,
    });
};
