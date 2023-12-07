import { render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";

import QrScan from "../../src/components/QrScan";
import t from "../../src/i18n";
import * as signals from "../../src/signals";

describe("QrScan", () => {
    test("should render the QrScan component", async () => {
        render(() => <QrScan />);
        signals.setCamera(true);
        const button = await screen.findByText(t("scan_qr_code"));
        expect(button).not.toBeUndefined();
    });
});
