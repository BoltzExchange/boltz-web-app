import { createMemo } from "solid-js";
import { translator, flatten, resolveTemplate } from "@solid-primitives/i18n";
import dict from "./i18n";
import { defaultLanguage } from "../config";
import { i18n, i18nConfigured, setI18n } from "../signals";

createMemo(() => setI18n(i18nConfigured()));

const dictLocale = createMemo(() => flatten(dict[i18n() || defaultLanguage]));

export default translator(dictLocale, resolveTemplate);
