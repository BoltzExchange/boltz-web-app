import log from "loglevel";
import { Setter } from "solid-js";

import { config } from "../config";
import { getUrlParam } from "../utils/urlParams";
import locales from "./i18n";

const isValidLang = (lang: string) => Object.keys(locales).includes(lang);

export const getNavigatorLanguage = (language: string): string => {
    const defaultLanguage = config.defaultLanguage;
    if (language === undefined) {
        log.info(
            `browser language undefined; using default: ${defaultLanguage}`,
        );
        return defaultLanguage;
    }

    const lang = language.split("-")[0];
    if (!isValidLang(lang)) {
        log.info(
            `browser language "${lang}" not found; using default: ${defaultLanguage}`,
        );
        return defaultLanguage;
    }

    log.info(`detected browser language ${lang}`);
    return lang;
};

export const detectLanguage = (
    i18nConfigured: string | null,
    i18nUrl?: string | null,
    setI18nUrl?: Setter<string>,
): string => {
    if (i18nConfigured !== null) {
        return i18nConfigured;
    }

    if (i18nUrl !== undefined) {
        const urlParam = getUrlParam("lang");
        if (urlParam) {
            if (isValidLang(urlParam)) {
                log.info("Using language URL parameter:", urlParam);
                setI18nUrl(urlParam);
                return urlParam;
            } else {
                log.warn("Invalid language URL parameter:", urlParam);
            }
        }

        if (i18nUrl !== null && i18nUrl !== undefined) {
            return i18nUrl;
        }
    }

    return getNavigatorLanguage(navigator.language);
};
