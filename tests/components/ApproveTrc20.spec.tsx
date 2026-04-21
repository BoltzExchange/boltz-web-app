import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";

import ApproveTrc20 from "../../src/components/ApproveTrc20";
import { NetworkTransport } from "../../src/configs/base";
import * as globalContext from "../../src/context/Global";
import * as web3Context from "../../src/context/Web3";
import WalletConnectProvider from "../../src/utils/WalletConnectProvider";
import { sendTronTokenApproval } from "../../src/utils/oft/tron";

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
    sendTronTokenApproval: vi.fn(),
}));

describe("ApproveTrc20", () => {
    const approvalTarget = "TFG4wBaDQ8sHWWP1ACeSGnoNR6RRzevLPt";
    const walletAddress = "TPbDQJp5nxApwiNK6ixcN1fCU45W4GtiMy";
    const walletProvider = { chain: "tron" };

    const mockSetNeedsApproval = vi.fn();

    const renderApprove = (
        props?: Partial<Parameters<typeof ApproveTrc20>[0]>,
    ) => {
        render(() => (
            <ApproveTrc20
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

    it("submits a single approval by default", async () => {
        const finalTx = {
            hash: "tron-approve",
            wait: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(sendTronTokenApproval).mockResolvedValue(finalTx as never);

        renderApprove();
        fireEvent.click(screen.getByRole("button", { name: "approve" }));

        await waitFor(() => {
            expect(sendTronTokenApproval).toHaveBeenCalledWith({
                sourceAsset: "USDT0-TRON",
                ownerAddress: walletAddress,
                spenderAddress: approvalTarget,
                amount: 42n,
                walletProvider,
            });
        });
        expect(finalTx.wait).toHaveBeenCalledWith(1);
        await waitFor(() => {
            expect(mockSetNeedsApproval).toHaveBeenCalledWith(false);
        });
    });
});
