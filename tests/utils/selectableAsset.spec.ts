import type * as ConfigModule from "../../src/config";
import { Side } from "../../src/consts/Enums";
import {
    canSelectAsset,
    canSendAsset,
    isAssetDisabled,
} from "../../src/utils/selectableAsset";

vi.mock("../../src/config", async () => {
    const actual =
        await vi.importActual<typeof ConfigModule>("../../src/config");

    return {
        ...actual,
        config: {
            ...actual.config,
            assets: {
                ...actual.config.assets,
                "ASSET-DISABLED": {
                    ...actual.config.assets.BTC,
                    disabled: true,
                },
                "ASSET-NO-SEND": {
                    ...actual.config.assets.BTC,
                    canSend: false,
                },
                "ASSET-DEFAULT": {
                    ...actual.config.assets.BTC,
                },
            },
        },
    };
});

describe("isAssetDisabled", () => {
    test("returns true for assets explicitly marked disabled", () => {
        expect(isAssetDisabled("ASSET-DISABLED")).toBe(true);
    });

    test("returns false when the disabled flag is absent", () => {
        expect(isAssetDisabled("ASSET-DEFAULT")).toBe(false);
    });

    test("returns false for unknown assets", () => {
        expect(isAssetDisabled("DOES-NOT-EXIST")).toBe(false);
    });
});

describe("canSendAsset", () => {
    test("returns false only when canSend is explicitly false", () => {
        expect(canSendAsset("ASSET-NO-SEND")).toBe(false);
        expect(canSendAsset("ASSET-DEFAULT")).toBe(true);
    });
});

describe("canSelectAsset", () => {
    test("blocks sending of canSend=false assets", () => {
        expect(canSelectAsset(Side.Send, "ASSET-NO-SEND")).toBe(false);
        expect(canSelectAsset(Side.Receive, "ASSET-NO-SEND")).toBe(true);
    });

    test("does not currently filter disabled assets — they are kept visible", () => {
        // Disabled assets remain in the rendered list (greyed out); the
        // disabled state is enforced by handlers and keyboard skipping.
        expect(canSelectAsset(Side.Send, "ASSET-DISABLED")).toBe(true);
    });
});
