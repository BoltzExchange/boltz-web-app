import { UrlParam } from "../consts/Enums";

export const detectEmbedded = () => {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);

    return (
        searchParams.has(UrlParam.Embed) &&
        searchParams.get(UrlParam.Embed) === "1"
    );
};
