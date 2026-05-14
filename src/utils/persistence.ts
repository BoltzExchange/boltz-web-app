// Storage serializer that preserves raw string values, matching the format
// written by the deprecated "createStorageSignal" used in earlier versions.
// Use with makePersisted when the persisted value is already a string and
// should not be wrapped in JSON quotes.
export const stringSerializer = {
    serialize: (value: unknown) => value as string,
    deserialize: (value: string) => value as never,
};
