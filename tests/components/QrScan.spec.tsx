import { render, screen } from "@solidjs/testing-library";
import { describe, expect, test } from "vitest";

import QrScan from "../../src/components/QrScan";
import { CreateProvider } from "../../src/context/Create";
import t from "../../src/i18n";
import { setCamera } from "../../src/signals";

describe("QrScan", () => {
    test("should render the QrScan component", async () => {
        render(() => (
            <CreateProvider>
                <QrScan />
            </CreateProvider>
        ));
        setCamera(true);
        const button = await screen.findByText(t("scan_qr_code"));
        expect(button).not.toBeUndefined();
    });
});
