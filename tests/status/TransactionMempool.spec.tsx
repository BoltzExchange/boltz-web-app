import { render, screen, waitFor } from "@solidjs/testing-library";
import { SwapType } from "boltz-swaps/types";
import { createSignal } from "solid-js";

import { BTC, RBTC } from "../../src/consts/Assets";
import type * as PayContextModule from "../../src/context/Pay";
import i18n from "../../src/i18n/i18n";
import TransactionMempool from "../../src/status/TransactionMempool";
import type { SomeSwap } from "../../src/utils/swapCreator";
import { contextWrapper } from "../helper";

const payContextMock = vi.hoisted(
    (): { isSwapClaiming: (id: string) => boolean } => ({
        isSwapClaiming: () => false,
    }),
);

vi.mock("../../src/context/Pay", async () => {
    const actual = await vi.importActual<typeof PayContextModule>(
        "../../src/context/Pay",
    );
    return {
        ...actual,
        usePayContext: () => ({
            isSwapClaiming: (id: string) => payContextMock.isSwapClaiming(id),
        }),
    };
});

describe("TransactionMempool", () => {
    beforeEach(() => {
        payContextMock.isSwapClaiming = () => false;
    });

    test("renders without throwing when swap is null", () => {
        const [swap] = createSignal<SomeSwap | null>(null);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(screen.getByText(i18n.en.tx_in_mempool)).toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.tx_in_mempool_warning),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.broadcasting_claim),
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

    test("shows the broadcasting view while the swap is being claimed", () => {
        payContextMock.isSwapClaiming = (id) => id === "swap-claiming";
        const [swap] = createSignal<SomeSwap | null>({
            id: "swap-claiming",
            type: SwapType.Chain,
            assetReceive: RBTC,
        } as SomeSwap);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(
            screen.getByText(i18n.en.broadcasting_claim),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.tx_in_mempool),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.tx_in_mempool_warning),
        ).not.toBeInTheDocument();
    });

    test("shows the broadcasting view when the swap already has a claim transaction", () => {
        payContextMock.isSwapClaiming = () => false;
        const [swap] = createSignal<SomeSwap | null>({
            id: "swap-claimtx",
            type: SwapType.Reverse,
            assetReceive: BTC,
            claimTx: "claim-txid",
        } as unknown as SomeSwap);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(
            screen.getByText(i18n.en.broadcasting_claim),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.tx_in_mempool),
        ).not.toBeInTheDocument();
    });

    test("shows the mempool view when the swap is neither claiming nor claimed", () => {
        const [swap] = createSignal<SomeSwap | null>({
            id: "swap-waiting",
            type: SwapType.Reverse,
            assetReceive: BTC,
        } as SomeSwap);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(screen.getByText(i18n.en.tx_in_mempool)).toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.broadcasting_claim),
        ).not.toBeInTheDocument();
    });

    test("reactively switches from waiting to broadcasting when claiming begins", async () => {
        const [claiming, setClaiming] = createSignal(false);
        // eslint-disable-next-line solid/reactivity
        payContextMock.isSwapClaiming = () => claiming();

        const [swap] = createSignal<SomeSwap | null>({
            id: "swap-reactive",
            type: SwapType.Chain,
            assetReceive: RBTC,
        } as SomeSwap);

        render(() => <TransactionMempool swap={swap} />, {
            wrapper: contextWrapper,
        });

        expect(screen.getByText(i18n.en.tx_in_mempool)).toBeInTheDocument();
        expect(
            screen.queryByText(i18n.en.broadcasting_claim),
        ).not.toBeInTheDocument();

        setClaiming(true);

        await waitFor(() => {
            expect(
                screen.getByText(i18n.en.broadcasting_claim),
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByText(i18n.en.tx_in_mempool),
        ).not.toBeInTheDocument();
    });
});
