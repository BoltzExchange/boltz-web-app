import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import ApproveTronErc20 from "../../src/components/ApproveTronErc20";
import { NetworkTransport } from "../../src/configs/base";
import * as globalContext from "../../src/context/Global";
import * as web3Context from "../../src/context/Web3";
import WalletConnectProvider from "../../src/utils/WalletConnectProvider";
import {
    getTronTokenAllowance,
    sendTronTokenApproval,
} from "../../src/utils/oft/tron";

vi.mock("../../src/components/ConnectWallet", () => ({
    default: () => <div data-testid="connect-wallet" />,
}));

vi.mock("../../src/components/ContractTransaction", () => ({
    default: (props: {
        onClick: () => Promise<unknown>;
        buttonText: string;
        promptText?: string;
    }) => (
        <>
            <p>{props.promptText}</p>
            <button onClick={() => void props.onClick()}>
                {props.buttonText}
            </button>
        </>
    ),
}));

vi.mock("../../src/utils/oft/tron", () => ({
    getTronTokenAllowance: vi.fn(),
    sendTronTokenApproval: vi.fn(),
}));

describe("ApproveTronErc20", () => {
    const approvalTarget = "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt";
    const walletAddress = "TPbDQJp5nxApwiNK6ixcN1fCU45W4GtiMy";
    const walletProvider = { chain: "tron" };

    const mockSetNeedsApproval = vi.fn();

    const renderApprove = (
        props?: Partial<Parameters<typeof ApproveTronErc20>[0]>,
    ) => {
        render(() => (
            <ApproveTronErc20
                asset="USDT0-TRON"
                value={() => 42n}
                setNeedsApproval={mockSetNeedsApproval}
                approvalTarget={approvalTarget}
                {...props}
            />
        ));
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();

        mockSetNeedsApproval.mockReset();
        vi.mocked(getTronTokenAllowance).mockReset();
        vi.mocked(getTronTokenAllowance).mockResolvedValue(0n);
        vi.mocked(sendTronTokenApproval).mockReset();

        vi.spyOn(globalContext, "useGlobalContext").mockReturnValue({
            t: (key: string) => key,
        } as unknown as ReturnType<typeof globalContext.useGlobalContext>);
        vi.spyOn(web3Context, "useWeb3Signer").mockReturnValue({
            connectedWallet: () => ({
                address: walletAddress,
                transport: NetworkTransport.Tron,
            }),
        } as unknown as ReturnType<typeof web3Context.useWeb3Signer>);
        vi.spyOn(WalletConnectProvider, "getTronProvider").mockReturnValue(
            walletProvider as never,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("submits a single approval by default", async () => {
        const finalTx = {
            hash: "tron-approve",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(sendTronTokenApproval).mockResolvedValue(finalTx as never);

        renderApprove();
        fireEvent.click(screen.getByRole("button", { name: "approve_erc20" }));

        await waitFor(() => {
            expect(sendTronTokenApproval).toHaveBeenCalledWith({
                sourceAsset: "USDT0-TRON",
                ownerAddress: walletAddress,
                spenderAddress: approvalTarget,
                amount: 42n,
                walletProvider,
            });
        });
        expect(getTronTokenAllowance).not.toHaveBeenCalled();
        expect(finalTx.wait).toHaveBeenCalledWith(1);
        await waitFor(() => {
            expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
        });
    });

    it("waits for the reset approval before sending the follow-up", async () => {
        const resetTx = {
            hash: "tron-reset",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        const finalTx = {
            hash: "tron-approve",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(getTronTokenAllowance).mockResolvedValue(5n);
        vi.mocked(sendTronTokenApproval)
            .mockResolvedValueOnce(resetTx as never)
            .mockResolvedValueOnce(finalTx as never);

        renderApprove({ resetAllowanceFirst: true });
        expect(screen.getByText("approve_erc20_reset_line")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "approve_erc20" }));

        await waitFor(() => {
            expect(getTronTokenAllowance).toHaveBeenCalledWith(
                "USDT0-TRON",
                walletAddress,
                approvalTarget,
            );
            expect(sendTronTokenApproval).toHaveBeenNthCalledWith(1, {
                sourceAsset: "USDT0-TRON",
                ownerAddress: walletAddress,
                spenderAddress: approvalTarget,
                amount: 0n,
                walletProvider,
            });
            expect(sendTronTokenApproval).toHaveBeenNthCalledWith(2, {
                sourceAsset: "USDT0-TRON",
                ownerAddress: walletAddress,
                spenderAddress: approvalTarget,
                amount: 42n,
                walletProvider,
            });
        });
        expect(resetTx.wait).toHaveBeenCalledWith(1);
        expect(finalTx.wait).toHaveBeenCalledWith(1);
        expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
    });
});
