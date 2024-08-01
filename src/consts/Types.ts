import type { DictKey } from "../i18n/i18n";

export type ButtonLabelParams = {
    key: DictKey;
    params?: Record<string, string>;
};
