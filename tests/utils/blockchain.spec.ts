import { vi } from "vitest";

import { Explorer } from "../../src/configs/base";
import { config } from "../../src/configs/mainnet";
import { BTC, LBTC } from "../../src/consts/Assets";
import { getFeeEstimations } from "../../src/utils/blockchain";

vi.mock("../../src/utils/blockchain", () => ({
    getFeeEstimations: vi.fn(),
}));

const mockGetFeeEstimations = vi.mocked(getFeeEstimations);

describe("blockchain", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getFeeEstimations", () => {
        test.each`
            asset   | type
            ${BTC}  | ${Explorer.Mempool}
            ${LBTC} | ${Explorer.Mempool}
            ${BTC}  | ${Explorer.Esplora}
            ${LBTC} | ${Explorer.Esplora}
        `(
            "should get fee estimations for $asset from $type",
            async ({ asset, type }) => {
                mockGetFeeEstimations.mockResolvedValue(0.5);

                const feeEstimations = await getFeeEstimations(
                    config.assets[asset].blockExplorerApis.find(
                        (api) => api.id === type,
                    )!,
                );

                expect(feeEstimations).toBeDefined();
                expect(typeof feeEstimations).toBe("number");
                expect(feeEstimations).toBeGreaterThanOrEqual(0.099);
            },
        );

        test("should throw on unknown explorer type", async () => {
            mockGetFeeEstimations.mockRejectedValue(
                new Error(`unknown explorer type: ${Explorer.Blockscout}`),
            );

            await expect(
                getFeeEstimations({
                    id: Explorer.Blockscout,
                    normal: "https://example",
                }),
            ).rejects.toThrow(`unknown explorer type: ${Explorer.Blockscout}`);
        });
    });
});
