import log from "loglevel";

import { config } from "../config";
import locales from "./i18n";

export const getNavigatorLanguage = (language: string): string => {
    const defaultLanguage = config.defaultLanguage;
    if (language === undefined) {
        log.info(
            `browser language undefined; using default: ${defaultLanguage}`,
        );
        return defaultLanguage;
    }

    const lang = language.split("-")[0];
    if (!Object.keys(locales).includes(lang)) {
        log.info(
            `browser language "${lang}" not found; using default: ${defaultLanguage}`,
        );
        return defaultLanguage;
    }

    log.info(`detected browser language ${lang}`);
    return lang;
};

export const detectLanguage = (i18nConfigured: string | null): string => {
    if (i18nConfigured === null) {
        return getNavigatorLanguage(navigator.language);
    }
    return i18nConfigured;
};
