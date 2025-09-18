const searchParams = () => new URLSearchParams(window.location.search);

export const getUrlParam = (name: string): string => {
    const param = searchParams().get(name);
    return param;
};

export const urlParamIsSet = (param: string) => param && param !== "";

export const resetUrlParam = (name: string) => {
    const params = searchParams();
    params.delete(name);

    window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}?${params.toString()}`,
    );
};
