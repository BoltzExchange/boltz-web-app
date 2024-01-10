import { render, screen } from "@solidjs/testing-library";
import { describe, expect, test } from "vitest";

import QrScan from "../../src/components/QrScan";
import { CreateProvider } from "../../src/context/Create";
import { GlobalProvider, useGlobalContext } from "../../src/context/Global";

describe("QrScan", () => {
    test("should render the QrScan component", async () => {
        let globalSignals: any;
        const TestComponent = () => {
            globalSignals = useGlobalContext();
            return "";
        };
        render(() => (
            <GlobalProvider>
                <CreateProvider>
                    <TestComponent />
                    <QrScan />
                </CreateProvider>
            </GlobalProvider>
        ));
        globalSignals.setCamera(true);
        const button = await screen.findByText(globalSignals.t("scan_qr_code"));
        expect(button).not.toBeUndefined();
    });
});
