import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import type { Signer } from "../../src/context/Web3";

vi.mock("../../src/context/Global", () => ({
    useGlobalContext: () => ({
        slippage: () => 0.01,
        t: (key: string) => key,
    }),
}));

vi.mock("../../src/context/Web3", () => ({
    useWeb3Signer: () => ({
        getErc20Swap: vi.fn(),
        getEtherSwap: vi.fn(),
        getGasAbstractionSigner: vi.fn(),
        getSwapContractVersion: vi.fn(),
        signer: () => undefined,
    }),
}));

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <button data-testid="wallet-control">Connect wallet</button>,
}));

const { RefundEvm } = await import("../../src/components/RefundButton");

describe("RefundEvm", () => {
    test("shows a loader, then a retry action when reading the signer network fails", async () => {
        let rejectChainId!: (error: Error) => void;
        const getChainId = vi.fn().mockReturnValue(
            new Promise<number>((_, reject) => {
                rejectChainId = reject;
            }),
        );
        const transactionSigner = {
            address: "0x0000000000000000000000000000000000000001",
            provider: { getChainId },
        } as unknown as Signer;

        render(() => (
            <RefundEvm
                asset="TBTC"
                transactionSigner={transactionSigner}
                lockupTxHash={`0x${"1".repeat(64)}`}
                setRefundTxId={vi.fn()}
            />
        ));

        expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
        expect(screen.queryByTestId("wallet-control")).toBeNull();

        rejectChainId(new Error("could not read chain ID"));

        expect(
            await screen.findByText("could not read chain ID"),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("loading-spinner")).toBeNull();
        expect(screen.queryByTestId("wallet-control")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "retry" }));
        await waitFor(() => expect(getChainId).toHaveBeenCalledTimes(2));
    });
});
