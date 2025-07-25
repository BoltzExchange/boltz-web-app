import { test } from "@playwright/test";
import fs from "fs";
import path from "path";

import { getXpub } from "../../src/utils/rescueFile";
import { createAndVerifySwap, generateLiquidBlock } from "../utils";

test.describe("Claim", () => {
    const refundFileJson = path.join(__dirname, "rescue.json");

    test.beforeEach(async () => {
        await generateLiquidBlock();
    });

    test.afterEach(() => {
        if (fs.existsSync(refundFileJson)) {
            fs.unlinkSync(refundFileJson);
        }
    });

    test("Claim pending chain swap via rescue key scan", async ({ page }) => {
        await createAndVerifySwap(page, refundFileJson);
    });
});
