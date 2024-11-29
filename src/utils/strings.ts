export const trimPrefix = (str: string, prefix: string) => {
    if (str.startsWith(prefix)) {
        return str.slice(prefix.length);
    }

    return str;
};
