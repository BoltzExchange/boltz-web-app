import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC, RBTC } from "../../src/consts";
import i18n from "../../src/i18n/i18n";
import TransactionClaimed from "../../src/status/TransactionClaimed";
import { getReverseTransaction } from "../../src/utils/boltzClient";
import { claim } from "../../src/utils/claim";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    payContext,
} from "../helper";

let claimPromiseResolve: (() => void) | undefined = undefined;

jest.mock("../../src/utils/claim", () => ({
    claim: jest.fn().mockImplementation(
        async (swap) =>
            new Promise<void>((resolve) => {
                claimPromiseResolve = () => {
                    swap.claimTx = "claimedTxId";
                    resolve(swap);
                };
            }),
    ),
}));
jest.mock("../../src/utils/boltzClient", () => ({
    getReverseTransaction: jest.fn().mockResolvedValue({
        hex: "txHex",
    }),
}));

describe("TransactionClaimed", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each`
        name                                                | swap
        ${"normal swaps"}                                   | ${{ reverse: false }}
        ${"reverse swaps to RBTC"} | ${{
    reverse: true,
    asset: RBTC,
}}
        ${"reverse swaps to BTC with claim transactions"}   | ${{ reverse: true, asset: BTC, claimTx: "txid" }}
        ${"reverse swaps to L-BTC with claim transactions"} | ${{ reverse: true, asset: LBTC, claimTx: "txid" }}
    `("should show success for $name", async ({ swap }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <TransactionClaimed />
                </>
            ),
            {
                wrapper: contextWrapper,
            },
        );
        payContext.setSwap(swap);

        await expect(
            screen.findByText(i18n.en.congrats),
        ).resolves.not.toBeUndefined();
    });

    test.each`
        symbol
        ${BTC}
        ${LBTC}
    `(
        "should trigger claim for reverse swaps to $symbol with no claim transaction",
        async ({ symbol }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <TransactionClaimed />
                    </>
                ),
                {
                    wrapper: contextWrapper,
                },
            );

            const swap = {
                id: "swapId",
                asset: symbol,
                reverse: true,
            };

            globalSignals.setSwaps([JSON.parse(JSON.stringify(swap))]);
            payContext.setSwap(swap);

            await expect(
                screen.findByText(i18n.en.broadcasting_claim),
            ).resolves.not.toBeUndefined();

            claimPromiseResolve();

            await expect(
                screen.findByText(i18n.en.congrats),
            ).resolves.not.toBeUndefined();

            expect(getReverseTransaction).toHaveBeenCalledTimes(1);
            expect(getReverseTransaction).toHaveBeenCalledWith(
                swap.asset,
                swap.id,
            );
            expect(claim).toHaveBeenCalledTimes(1);

            expect(payContext.swap().claimTx).toEqual("claimedTxId");
            expect(globalSignals.swaps()[0].claimTx).toEqual("claimedTxId");
        },
    );
});
