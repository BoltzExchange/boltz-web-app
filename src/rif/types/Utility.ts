type Modify<T, R> = Omit<T, keyof R> & R;

type Only<T, U> = {
    [P in keyof T]: T[P];
} & Omit<
    {
        [P in keyof U]?: never;
    },
    keyof T
>;

type Either<T, U> = Only<T, U> | Only<U, T>;

export { Modify, Only, Either };
