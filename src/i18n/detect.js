import log from "loglevel";
import locales from "./i18n";
import { i18nCached, setI18n } from "../signals";
import { defaultLanguage } from "../config";

export const getNavigatorLanguage = (language) => {
    if (language === undefined) {
        log.info(
            `navigator.language undefined, using default: ${defaultLanguage}`,
        );
        return defaultLanguage;
    }
    const lang = language.split("-")[0];
    if (!Object.keys(locales).includes(lang)) {
        log.info(`Locale not found: ${lang}, using default: ${detectLanguage}`);
        return defaultLanguage;
    }
    log.info("detected navigator.language", language, lang);
    return lang;
};

export const detectLanguage = () => {
    if (i18nCached() === null) {
        setI18n(getNavigatorLanguage(navigator.language));
    }
};
