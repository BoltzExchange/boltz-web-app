import { render, screen } from "@solidjs/testing-library";

import { BTC, LBTC, RBTC } from "../../src/consts";
import i18n from "../../src/i18n/i18n";
import TransactionClaimed from "../../src/status/TransactionClaimed";
import { getReverseTransaction } from "../../src/utils/boltzApi";
import { claim } from "../../src/utils/lazy/claim";
import { TestComponent, contextWrapper, swapContext } from "../helper";

let claimPromiseResolve: (() => void) | undefined = undefined;

jest.mock("../../src/utils/lazy/claim", () => ({
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
jest.mock("../../src/utils/boltzApi", () => ({
    getReverseTransaction: jest.fn().mockResolvedValue({
        hex: "txHex",
    }),
    getApiUrl: jest.fn().mockReturnValue("https://api.boltz.exchange"),
}));

describe("TransactionClaimed", () => {
    beforeEach(async () => {
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
        swapContext.setSwap(swap);

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

            swapContext.setSwaps([JSON.parse(JSON.stringify(swap))]);
            swapContext.setSwap(swap);

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

            expect(swapContext.swap().claimTx).toEqual("claimedTxId");
            expect(swapContext.swaps()[0].claimTx).toEqual("claimedTxId");
        },
    );
});
