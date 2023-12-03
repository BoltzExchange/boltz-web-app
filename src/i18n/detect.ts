import log from "loglevel";

import { defaultLanguage } from "../config";
import { i18nConfigured, setI18n } from "../signals";
import locales from "./i18n";

export const getNavigatorLanguage = (language: string) => {
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

export const detectLanguage = () => {
    if (i18nConfigured() === null) {
        setI18n(getNavigatorLanguage(navigator.language));
    }
};
