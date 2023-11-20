export const detectEmbedded = () => {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    if (searchParams.has("embed") && searchParams.get("embed") === "1") {
        return true;
    }
    return false;
};
