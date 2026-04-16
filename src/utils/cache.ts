type CacheOptions<T> = {
    shouldRetain?: (value: T) => boolean;
};

const entries = new Map<string, unknown>();

const cacheAsyncValue = async <T>(
    key: string,
    value: Promise<T>,
    { shouldRetain }: CacheOptions<T>,
): Promise<T> => {
    try {
        const resolved = await value;
        if (shouldRetain?.(resolved) === false) {
            entries.delete(key);
        }

        return resolved;
    } catch (error: unknown) {
        entries.delete(key);
        throw error;
    }
};

export function getCachedValue<T>(
    prefix: string,
    key: string,
    create: () => T,
    options?: CacheOptions<T>,
): T;
export function getCachedValue<T>(
    prefix: string,
    key: string,
    create: () => T | Promise<T>,
    options: CacheOptions<T> = {},
): T | Promise<T> {
    const entryKey = `${prefix}${key}`;

    if (entries.has(entryKey)) {
        return entries.get(entryKey) as T | Promise<T>;
    }

    const created = create();
    if (created instanceof Promise) {
        const cached = cacheAsyncValue(entryKey, created, options);
        entries.set(entryKey, cached);

        return cached;
    }

    if (options.shouldRetain?.(created) === false) {
        return created;
    }

    entries.set(entryKey, created);

    return created;
}

export const clearCache = () => {
    entries.clear();
};
