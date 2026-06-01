import { getNativeEvmLockupSpendableBalance } from "../../src/utils/evmLockup";

describe("getNativeEvmLockupSpendableBalance", () => {
    test("reserves lockup gas from the native balance", () => {
        expect(getNativeEvmLockupSpendableBalance(100_000n, 2n)).toBe(8_000n);
    });

    test("returns zero when the gas reserve exceeds the balance", () => {
        expect(getNativeEvmLockupSpendableBalance(10_000n, 2n)).toBe(0n);
    });
});
