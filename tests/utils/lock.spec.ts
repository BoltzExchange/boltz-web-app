import Lock from "../../src/utils/lock";

describe("Lock", () => {
    test("should run promises sequentially", async () => {
        const lock = new Lock();

        let value = 0;

        let firstResolve: (() => void) | undefined;
        const first = () =>
            new Promise<void>((resolve) => {
                value = 1;
                firstResolve = resolve;
            });

        const firstAcquire = lock.acquire(first);

        expect(value).toEqual(1);
        expect(lock["locked"]).toEqual(true);

        const second = vi.fn().mockResolvedValue(undefined);
        const secondResolve = lock.acquire(second);

        expect(second).toHaveBeenCalledTimes(0);
        firstResolve();
        await expect(firstAcquire).resolves.toEqual(undefined);

        expect(second).toHaveBeenCalledTimes(1);
        await expect(secondResolve).resolves.toEqual(undefined);
    });
});
