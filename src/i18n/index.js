import { createMemo } from "solid-js";
import { translator, flatten, resolveTemplate } from "@solid-primitives/i18n";
import dict from "./i18n";
import { i18n, i18nCached, setI18n } from "../signals";
import { defaultLanguage } from "../config";

createMemo(() => setI18n(i18nCached()));

const dictLocale = createMemo(() =>
    i18n() ? flatten(dict[i18n()]) : flatten(dict[defaultLanguage]),
);

export default translator(dictLocale, resolveTemplate);
