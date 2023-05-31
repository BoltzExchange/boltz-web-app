import { createI18nContext } from "@solid-primitives/i18n";
import dict from "./i18n";
import { i18n } from "../signals";

export default () => createI18nContext(dict, i18n());
