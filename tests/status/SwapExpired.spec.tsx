import { render, screen } from "@solidjs/testing-library";

import { BTC } from "../../src/consts/Assets";
import i18n from "../../src/i18n/i18n";
import SwapExpired from "../../src/status/SwapExpired";
import { TestComponent, contextWrapper, payContext } from "../helper";

jest.mock("../../src/utils/boltzClient", () => {
    const originalModule = jest.requireActual("../../src/utils/boltzClient");

    return {
        __esModule: true,
        ...originalModule,
        getLockupTransaction: jest.fn(() => {
            return { id: "txid" };
        }),
    };
});

describe("SwapExpired", () => {
    test("should show blockexplorer lockup transaction button", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <SwapExpired />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap({
            assetSend: BTC,
            id: "swapid",
        } as any);

        const type_label = i18n.en[`blockexplorer_lockup_tx`];
        const label = i18n.en.blockexplorer.replace(
            "{{ typeLabel }}",
            type_label,
        );

        const button = await screen.findByText(label);
        expect(button).not.toBeUndefined();
        expect(button.getAttribute("href")).toMatch("txid");
    });
});
