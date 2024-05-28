export const detectEmbedded = () => {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);

    return searchParams.has("embed") && searchParams.get("embed") === "1";
};
