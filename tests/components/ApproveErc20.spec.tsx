import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import * as contractsModule from "../../packages/boltz-swaps/src/evm/contracts.ts";
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
        address: approvalTarget,
    }));
    const mockSigner = {
        address: walletAddress,
        provider: {
            waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
        },
    };
    const mockContract = {
        read: {
            allowance: vi.fn(),
        },
        write: {
            approve: vi.fn(),
        },
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
        mockSigner.provider.waitForTransactionReceipt.mockReset();
        mockSigner.provider.waitForTransactionReceipt.mockResolvedValue({});
        mockContract.read.allowance.mockReset();
        mockContract.read.allowance.mockResolvedValue(0n);
        mockContract.write.approve.mockReset();

        vi.spyOn(globalContext, "useGlobalContext").mockReturnValue({
            t: (key: string) => key,
        } as unknown as ReturnType<typeof globalContext.useGlobalContext>);
        vi.spyOn(web3Context, "useWeb3Signer").mockReturnValue({
            signer: () => mockSigner,
            getErc20Swap: mockGetErc20Swap,
        } as unknown as ReturnType<typeof web3Context.useWeb3Signer>);
        vi.spyOn(contractsModule, "createTokenContract").mockReturnValue(
            mockContract as unknown as ReturnType<
                typeof contractsModule.createTokenContract
            >,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("submits a single approval by default", async () => {
        mockContract.write.approve.mockResolvedValue("0xfinal");

        renderApprove();
        fireEvent.click(screen.getByRole("button", { name: "approve" }));

        await waitFor(() => {
            expect(mockContract.write.approve).toHaveBeenCalledWith(
                [approvalTarget, 42n],
                expect.any(Object),
            );
        });
        expect(mockContract.read.allowance).not.toHaveBeenCalled();
        expect(
            mockSigner.provider.waitForTransactionReceipt,
        ).toHaveBeenCalledWith({
            confirmations: 1,
            hash: "0xfinal",
            timeout: undefined,
        });
        await waitFor(() => {
            expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
        });
    });

    it("waits for the reset approval before sending the follow-up", async () => {
        mockContract.read.allowance.mockResolvedValue(5n);
        mockContract.write.approve
            .mockResolvedValueOnce("0xreset")
            .mockResolvedValueOnce("0xfinal");

        renderApprove({ resetAllowanceFirst: true });
        expect(screen.getByText("approve_allowance_reset_line")).toBeDefined();

        fireEvent.click(screen.getByRole("button", { name: "approve" }));

        await waitFor(() => {
            expect(mockContract.read.allowance).toHaveBeenCalledWith([
                walletAddress,
                approvalTarget,
            ]);
            expect(mockContract.write.approve).toHaveBeenNthCalledWith(
                1,
                [approvalTarget, 0n],
                expect.any(Object),
            );
            expect(mockContract.write.approve).toHaveBeenNthCalledWith(
                2,
                [approvalTarget, 42n],
                expect.any(Object),
            );
        });
        expect(
            mockSigner.provider.waitForTransactionReceipt,
        ).toHaveBeenNthCalledWith(1, {
            confirmations: 1,
            hash: "0xreset",
            timeout: undefined,
        });
        expect(
            mockSigner.provider.waitForTransactionReceipt,
        ).toHaveBeenNthCalledWith(2, {
            confirmations: 1,
            hash: "0xfinal",
            timeout: undefined,
        });
        expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
    });

    it("skips the reset transaction when allowance is already zero", async () => {
        mockContract.read.allowance.mockResolvedValue(0n);
        mockContract.write.approve.mockResolvedValue("0xfinal");

        renderApprove({ resetAllowanceFirst: true });
        fireEvent.click(screen.getByRole("button", { name: "approve" }));

        await waitFor(() => {
            expect(mockContract.write.approve).toHaveBeenCalledWith(
                [approvalTarget, 42n],
                expect.any(Object),
            );
        });
        expect(
            mockSigner.provider.waitForTransactionReceipt,
        ).toHaveBeenCalledWith({
            confirmations: 1,
            hash: "0xfinal",
            timeout: undefined,
        });
        await waitFor(() => {
            expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
        });
    });
});
