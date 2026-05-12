export interface Logger {
    trace: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    log: (...args: unknown[]) => void;
}

const noop: Logger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    log: () => {},
};

let active: Logger = noop;

export const setLogger = (logger: Logger): void => {
    active = logger;
};

export const getLogger = (): Logger => active;
