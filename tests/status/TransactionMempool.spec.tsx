import { render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import { BTC, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import i18n from "../../src/i18n/i18n";
import TransactionMempool from "../../src/status/TransactionMempool";
import type { SomeSwap } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

describe("TransactionMempool", () => {
    test("renders without throwing when swap is null", () => {
        const [swap] = createSignal<SomeSwap | null>(null);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(screen.getByText(i18n.en.tx_in_mempool)).toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.tx_in_mempool_warning),
        ).not.toBeInTheDocument();
    });

    test("renders the chain swap warning for chain swaps", () => {
        const [swap] = createSignal<SomeSwap | null>({
            type: SwapType.Chain,
            assetReceive: RBTC,
        } as SomeSwap);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(
            screen.getByText(i18n.en.tx_in_mempool_warning),
        ).toBeInTheDocument();
    });

    test("does not render the warning for non-chain swaps", () => {
        const [swap] = createSignal<SomeSwap | null>({
            type: SwapType.Reverse,
            assetReceive: BTC,
        } as SomeSwap);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(
            screen.queryByText(i18n.en.tx_in_mempool_warning),
        ).not.toBeInTheDocument();
    });
});
