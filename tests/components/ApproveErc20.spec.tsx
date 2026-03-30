import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import ApproveErc20 from "../../src/components/ApproveErc20";
import * as globalContext from "../../src/context/Global";
import * as web3Context from "../../src/context/Web3";

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

describe("ApproveErc20", () => {
    const approvalTarget = "0x2000000000000000000000000000000000000000";
    const walletAddress = "0x1000000000000000000000000000000000000000";

    const mockSetNeedsApproval = vi.fn();
    const mockGetAddress = vi.fn().mockResolvedValue(approvalTarget);
    const mockGetErc20Swap = vi.fn(() => ({
        getAddress: mockGetAddress,
    }));
    const mockSigner = {
        getAddress: vi.fn(),
        getNonce: vi.fn(),
    };
    const mockContract = {
        allowance: vi.fn(),
        approve: vi.fn(),
    };

    const renderApprove = (
        props?: Partial<Parameters<typeof ApproveErc20>[0]>,
    ) => {
        render(() => (
            <ApproveErc20
                asset="USDT0"
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
        mockGetAddress.mockClear();
        mockGetErc20Swap.mockClear();
        mockSigner.getAddress.mockReset();
        mockSigner.getAddress.mockResolvedValue(walletAddress);
        mockSigner.getNonce.mockReset();
        mockSigner.getNonce.mockResolvedValue(7);
        mockContract.allowance.mockReset();
        mockContract.allowance.mockResolvedValue(0n);
        mockContract.approve.mockReset();

        vi.spyOn(globalContext, "useGlobalContext").mockReturnValue({
            t: (key: string) => key,
        } as unknown as ReturnType<typeof globalContext.useGlobalContext>);
        vi.spyOn(web3Context, "useWeb3Signer").mockReturnValue({
            signer: () => mockSigner,
            getErc20Swap: mockGetErc20Swap,
        } as unknown as ReturnType<typeof web3Context.useWeb3Signer>);
        vi.spyOn(web3Context, "createTokenContract").mockReturnValue(
            mockContract as unknown as ReturnType<
                typeof web3Context.createTokenContract
            >,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("submits a single approval by default", async () => {
        const finalTx = {
            hash: "0xfinal",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        mockContract.approve.mockResolvedValue(finalTx);

        renderApprove();
        fireEvent.click(screen.getByRole("button", { name: "approve_erc20" }));

        await waitFor(() => {
            expect(mockContract.approve).toHaveBeenCalledWith(
                approvalTarget,
                42n,
            );
        });
        expect(mockContract.allowance).not.toHaveBeenCalled();
        expect(mockSigner.getNonce).not.toHaveBeenCalled();
        expect(finalTx.wait).toHaveBeenCalledWith(1);
        await waitFor(() => {
            expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
        });
    });

    it("waits for the reset approval before sending the follow-up", async () => {
        const resetTx = {
            hash: "0xreset",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        const finalTx = {
            hash: "0xfinal",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        mockContract.allowance.mockResolvedValue(5n);
        mockContract.approve
            .mockResolvedValueOnce(resetTx)
            .mockResolvedValueOnce(finalTx);

        renderApprove({ resetAllowanceFirst: true });
        expect(screen.getByText("approve_erc20_reset_line")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "approve_erc20" }));

        await waitFor(() => {
            expect(mockContract.allowance).toHaveBeenCalledWith(
                walletAddress,
                approvalTarget,
            );
            expect(mockContract.approve).toHaveBeenNthCalledWith(
                1,
                approvalTarget,
                0,
            );
            expect(mockContract.approve).toHaveBeenNthCalledWith(
                2,
                approvalTarget,
                42n,
            );
        });
        expect(mockSigner.getNonce).not.toHaveBeenCalled();
        expect(resetTx.wait).toHaveBeenCalledWith(1);
        expect(finalTx.wait).toHaveBeenCalledWith(1);
        expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
    });

    it("skips the reset transaction when allowance is already zero", async () => {
        const finalTx = {
            hash: "0xfinal",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        mockContract.allowance.mockResolvedValue(0n);
        mockContract.approve.mockResolvedValue(finalTx);

        renderApprove({ resetAllowanceFirst: true });
        fireEvent.click(screen.getByRole("button", { name: "approve_erc20" }));

        await waitFor(() => {
            expect(mockContract.approve).toHaveBeenCalledWith(
                approvalTarget,
                42n,
            );
        });
        expect(mockSigner.getNonce).not.toHaveBeenCalled();
        expect(finalTx.wait).toHaveBeenCalledWith(1);
        await waitFor(() => {
            expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
        });
    });
});
