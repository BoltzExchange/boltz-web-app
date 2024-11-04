export const wait = (timeout: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, timeout));
