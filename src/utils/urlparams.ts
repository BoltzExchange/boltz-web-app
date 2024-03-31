const searchParams = new URLSearchParams(window.location.search);

export const detectEmbedParam = (): boolean => {
    const param = searchParams.get("embed");
    return param && param === "1";
};

export const detectUrlParam = (param: string): string => {
    const searchParam = searchParams.get(param);
    if (searchParam) {
        resetUrlParam(param);
    }
    return searchParam;
};

export const resetUrlParam = (param: string) => {
    searchParams.delete(param);
    window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}?${searchParams.toString()}`,
    );
};
