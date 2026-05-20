import type * as ConfigModule from "../src/config";
import type * as HelperModule from "../src/utils/helper";

const { apiUrlState, getReferralMock, setBoltzSwapsConfigMock } = vi.hoisted(
    () => ({
        apiUrlState: {
            value: { normal: "https://api.initial" },
        },
        getReferralMock: vi.fn(),
        setBoltzSwapsConfigMock: vi.fn(),
    }),
);

vi.mock("boltz-swaps", () => ({
    setBoltzSwapsConfig: setBoltzSwapsConfigMock,
}));

vi.mock("../src/config", async () => {
    const actual = await vi.importActual<typeof ConfigModule>("../src/config");

    return {
        ...actual,
        config: new Proxy(actual.config as object, {
            get(target, prop) {
                if (prop === "apiUrl") {
                    return apiUrlState.value;
                }
                return target[prop as keyof typeof target];
            },
        }),
    };
});

vi.mock("../src/utils/helper", async () => {
    const actual = await vi.importActual<typeof HelperModule>(
        "../src/utils/helper",
    );

    return {
        ...actual,
        getReferral: getReferralMock,
    };
});

const { configureBoltzSwaps } = await import("../src/boltzSwapsConfig");

describe("configureBoltzSwaps", () => {
    beforeEach(() => {
        apiUrlState.value = { normal: "https://api.initial" };
        getReferralMock.mockReset();
        getReferralMock.mockReturnValue("ref-initial");
        setBoltzSwapsConfigMock.mockReset();
    });

    test("installs live Boltz API URL and referral getters", () => {
        configureBoltzSwaps();

        expect(setBoltzSwapsConfigMock).toHaveBeenCalledTimes(1);
        const installed = setBoltzSwapsConfigMock.mock.calls[0][0];
        expect(installed.boltzApiUrl).toBe("https://api.initial");
        expect(installed.referral).toBe("ref-initial");

        apiUrlState.value = { normal: "https://api.updated" };
        getReferralMock.mockReturnValue("ref-updated");

        expect(installed.boltzApiUrl).toBe("https://api.updated");
        expect(installed.referral).toBe("ref-updated");
    });
});
