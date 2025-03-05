import { render, screen } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";

import i18n from "../../src/i18n/i18n";
import RefundExternal, { RefundBtcLike } from "../../src/pages/RefundExternal";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

/* eslint-disable  require-await,@typescript-eslint/require-await,@typescript-eslint/no-explicit-any */

vi.mock("../../src/utils/boltzClient", () => {
    return {
        getLockupTransaction: vi.fn(() => {
            return { timeoutBlockHeight: 10, timeoutEta: 10 };
        }),
    };
});

describe("RefundExternal", () => {
    test("should render WASM error", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <RefundExternal />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        globalSignals.setWasmSupported(false);
        expect(
            await screen.findAllByText(i18n.en.error_wasm),
        ).not.toBeUndefined();
    });

    describe("BtcLike", () => {
        test("should show refund button when file was uploaded", async () => {
            const user = userEvent.setup();
            render(
                () => (
                    <>
                        <TestComponent />
                        <RefundBtcLike />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            const uploadInput = await screen.findByTestId("refundUpload");
            const swapFile = new File(["{}"], "swap.json", {
                type: "application/json",
            });
            (swapFile as any).text = async () =>
                JSON.stringify({
                    asset: "BTC",
                    id: "",
                    privateKey: "",
                });
            await user.upload(uploadInput, swapFile);

            expect(
                await screen.findAllByText(i18n.en.refund),
            ).not.toBeUndefined();
        });

        test("should show invalid refund button when invalid file was uploaded", async () => {
            const user = userEvent.setup();
            render(
                () => (
                    <>
                        <TestComponent />
                        <RefundBtcLike />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );
            const uploadInput = await screen.findByTestId("refundUpload");
            const swapFile = new File(["{}"], "swap.json", {
                type: "application/json",
            });
            (swapFile as any).text = async () =>
                JSON.stringify({
                    asset: "BTC",
                });
            await user.upload(uploadInput, swapFile);

            expect(
                await screen.findAllByText(i18n.en.invalid_refund_file),
            ).not.toBeUndefined();
        });
    });
});
