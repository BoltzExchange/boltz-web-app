import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";
import { createMemo, createRoot } from "solid-js";

import { defaultLanguage } from "../config";
import { i18n, i18nConfigured, setI18n } from "../signals";
import dict from "./i18n";

let dictLocale;
createRoot(() => {
    createMemo(() => setI18n(i18nConfigured()));
    dictLocale = createMemo(() => flatten(dict[i18n() || defaultLanguage]));
});

export default translator(dictLocale, resolveTemplate);
