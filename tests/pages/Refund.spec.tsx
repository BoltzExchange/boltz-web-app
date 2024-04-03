import { render, screen } from "@solidjs/testing-library";
import { userEvent } from "@testing-library/user-event";

import i18n from "../../src/i18n/i18n";
import Refund from "../../src/pages/Refund";
import { TestComponent, contextWrapper, globalSignals } from "../helper";

describe("Refund", () => {
    test("should render WASM error", async () => {
        render(
            () => (
                <>
                    <TestComponent />
                    <Refund />
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

    test("should show refund button when file was uploaded", async () => {
        const user = userEvent.setup();
        render(
            () => (
                <>
                    <TestComponent />
                    <Refund />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        const refundFrame = (await screen.findByTestId(
            "refundFrame",
        )) as HTMLDivElement;
        expect(refundFrame.children.length).toEqual(4);

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

        expect(await screen.findAllByText(i18n.en.refund)).not.toBeUndefined();
    });

    test("should show invalid refund button when invalid file was uploaded", async () => {
        const user = userEvent.setup();
        render(
            () => (
                <>
                    <TestComponent />
                    <Refund />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        const refundFrame = (await screen.findByTestId(
            "refundFrame",
        )) as HTMLDivElement;
        expect(refundFrame.children.length).toEqual(4);

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

    test("should show open swap button when swap is in `swaps()`", async () => {
        const user = userEvent.setup();
        render(
            () => (
                <>
                    <TestComponent />
                    <Refund />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        const swap = {
            asset: "BTC",
            id: "123",
            privateKey: "",
        };
        await globalSignals.setSwapStorage(swap);
        const refundFrame = (await screen.findByTestId(
            "refundFrame",
        )) as HTMLDivElement;
        expect(refundFrame.children.length).toEqual(4);

        const uploadInput = await screen.findByTestId("refundUpload");
        const swapFile = new File(["{}"], "swap.json", {
            type: "application/json",
        });
        (swapFile as any).text = async () => JSON.stringify(swap);
        await user.upload(uploadInput, swapFile);

        expect(
            await screen.findAllByText(i18n.en.open_swap),
        ).not.toBeUndefined();
    });
});
