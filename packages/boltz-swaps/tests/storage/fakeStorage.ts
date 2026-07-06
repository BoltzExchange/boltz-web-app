// Minimal Map-backed `Storage` so localStorage-based stores can be tested
// without a browser (Node/jsdom-free). Each call returns an isolated instance.
export const createFakeStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear() {
            map.clear();
        },
        getItem: (key: string) => map.get(String(key)) ?? null,
        key: (index: number) => [...map.keys()][index] ?? null,
        removeItem: (key: string) => {
            map.delete(String(key));
        },
        // Real Web Storage coerces both args to strings; mirror that so the
        // double doesn't hide coercion bugs (e.g. an accidental `undefined`).
        setItem: (key: string, value: string) => {
            map.set(String(key), String(value));
        },
    } as Storage;
};
