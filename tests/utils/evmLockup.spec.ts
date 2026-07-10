import {
    type Log,
    encodeAbiParameters,
    encodeEventTopics,
    erc20Abi,
    getAddress,
} from "viem";
import { vi } from "vitest";

import {
    findLockupTokenFunder,
    getNativeEvmLockupSpendableBalance,
    resolveLockupTokenFunder,
} from "../../src/utils/evmLockup";

const tokenIn = "0x0000000000000000000000000000000000000010";
const tokenOut = "0x0000000000000000000000000000000000000011";
const router = "0x0000000000000000000000000000000000000020";
const funder = "0x0000000000000000000000000000000000000030";
const pool = "0x0000000000000000000000000000000000000040";
const lockupTxHash =
    "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const { mockGetTransactionReceipt } = vi.hoisted(() => ({
    mockGetTransactionReceipt: vi.fn(),
}));

vi.mock("boltz-swaps/evm", async () => {
    const actual = await vi.importActual("boltz-swaps/evm");
    return {
        ...actual,
        createAssetProvider: () => ({
            getTransactionReceipt: mockGetTransactionReceipt,
        }),
    };
});

vi.mock("../../src/consts/Assets", async () => {
    const actual = await vi.importActual("../../src/consts/Assets");
    return {
        ...actual,
        requireRouterAddress: () =>
            "0x0000000000000000000000000000000000000020",
    };
});

const transferLog = (token: string, from: string, to: string): Log =>
    ({
        address: token,
        topics: encodeEventTopics({
            abi: erc20Abi,
            eventName: "Transfer",
            args: {
                from: from as `0x${string}`,
                to: to as `0x${string}`,
            },
        }),
        data: encodeAbiParameters([{ type: "uint256" }], [1_000n]),
    }) as unknown as Log;

describe("getNativeEvmLockupSpendableBalance", () => {
    test("reserves lockup gas from the native balance", () => {
        expect(getNativeEvmLockupSpendableBalance(100_000n, 2n)).toBe(8_000n);
    });

    test("returns zero when the gas reserve exceeds the balance", () => {
        expect(getNativeEvmLockupSpendableBalance(10_000n, 2n)).toBe(0n);
    });
});

describe("findLockupTokenFunder", () => {
    test("returns the sender of the Permit2 pull into the router", () => {
        const logs = [
            transferLog(tokenIn, funder, router),
            transferLog(tokenIn, router, pool),
            transferLog(tokenOut, pool, router),
        ];

        expect(findLockupTokenFunder(logs, tokenIn, router)).toBe(
            getAddress(funder),
        );
    });

    test("ignores transfers of other tokens into the router", () => {
        const logs = [
            transferLog(tokenOut, pool, router),
            transferLog(tokenIn, router, pool),
        ];

        expect(findLockupTokenFunder(logs, tokenIn, router)).toBeUndefined();
    });

    test("returns undefined when the receipt has no transfers", () => {
        expect(findLockupTokenFunder([], tokenIn, router)).toBeUndefined();
    });
});

describe("resolveLockupTokenFunder", () => {
    beforeEach(() => {
        mockGetTransactionReceipt.mockReset();
    });

    test("returns undefined when the receipt is missing", async () => {
        mockGetTransactionReceipt.mockResolvedValue(null);

        expect(
            await resolveLockupTokenFunder("TBTC", tokenIn, lockupTxHash),
        ).toBeUndefined();
        expect(mockGetTransactionReceipt).toHaveBeenCalledWith({
            hash: lockupTxHash,
        });
    });

    test("resolves the funder from the receipt logs", async () => {
        mockGetTransactionReceipt.mockResolvedValue({
            logs: [transferLog(tokenIn, funder, router)],
        });

        expect(
            await resolveLockupTokenFunder("TBTC", tokenIn, lockupTxHash),
        ).toBe(getAddress(funder));
    });
});
