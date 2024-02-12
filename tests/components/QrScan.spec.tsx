import { render, screen } from "@solidjs/testing-library";

import QrScan from "../../src/components/QrScan";
import { useGlobalContext } from "../../src/context/Global";
import { contextWrapper } from "../helper";

describe("QrScan", () => {
    test("should render the QrScan component", async () => {
        let globalSignals: any;
        const TestComponent = () => {
            globalSignals = useGlobalContext();
            return "";
        };
        render(
            () => (
                <>
                    <TestComponent />
                    <QrScan />
                </>
            ),
            { wrapper: contextWrapper },
        );
        globalSignals.setCamera(true);
        const button = await screen.findByText(globalSignals.t("scan_qr_code"));
        expect(button).not.toBeUndefined();
    });
});
