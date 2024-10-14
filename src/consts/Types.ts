import type { DictKey } from "../i18n/i18n";

export type ButtonLabelParams = {
    key: DictKey;
    params?: Record<string, string>;
};

export type EIP6963ProviderInfo = {
    rdns: string;
    uuid: string;
    name: string;
    icon?: string;
    disabled?: boolean;
    isHardware?: boolean;
};

export type EIP1193Provider = {
    isStatus?: boolean;
    host?: string;
    path?: string;
    sendAsync?: (
        request: { method: string; params?: Array<unknown> },
        callback: (error: Error | null, response: unknown) => void,
    ) => void;
    send?: (
        request: { method: string; params?: Array<unknown> },
        callback: (error: Error | null, response: unknown) => void,
    ) => void;
    request: (request: {
        method: string;
        params?: Array<unknown>;
    }) => Promise<unknown>;
    on: (event: "chainChanged", cb: () => void) => void;
    removeAllListeners: (event: "chainChanged") => void;
};

export type EIP6963ProviderDetail = {
    info: EIP6963ProviderInfo;
    provider: EIP1193Provider;
};
