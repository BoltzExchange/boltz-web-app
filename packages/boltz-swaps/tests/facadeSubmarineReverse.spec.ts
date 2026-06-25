import { AssetKind, NetworkTransport, createBoltzClient } from "boltz-swaps";

import type * as ReverseModule from "../src/reverse.ts";
import type * as SubmarineModule from "../src/submarine.ts";

const {
    signSubmarineClaimMock,
    refundSubmarineUtxoMock,
    getSubmarineEvmRefundSignatureMock,
    executeReverseSwapMock,
} = vi.hoisted(() => ({
    signSubmarineClaimMock: vi.fn(),
    refundSubmarineUtxoMock: vi.fn(),
    getSubmarineEvmRefundSignatureMock: vi.fn(),
    executeReverseSwapMock: vi.fn(),
}));

vi.mock("../src/reverse.ts", async (importActual) => ({
    ...(await importActual<typeof ReverseModule>()),
    executeReverseSwap: executeReverseSwapMock,
}));

vi.mock("../src/submarine.ts", async (importActual) => ({
    ...(await importActual<typeof SubmarineModule>()),
    signSubmarineClaim: signSubmarineClaimMock,
    refundSubmarineUtxo: refundSubmarineUtxoMock,
    getSubmarineEvmRefundSignature: getSubmarineEvmRefundSignatureMock,
}));

const refundKeys = {
    privateKey: new Uint8Array(32).fill(1),
    publicKey: new Uint8Array(33).fill(2),
};

const makeClient = () =>
    createBoltzClient({
        boltzApiUrl: "https://test",
        network: "regtest",
        assets: {
            TBTC: {
                type: AssetKind.ERC20,
                network: {
                    chainName: "Arbitrum",
                    symbol: "TBTC",
                    gasToken: "ETH",
                    transport: NetworkTransport.Evm,
                    chainId: 42161,
                    rpcUrls: ["http://localhost"],
                },
                token: { address: "0xtbtc", decimals: 18 },
            },
            BTC: { type: AssetKind.UTXO },
        },
    } as never);

beforeEach(() => {
    signSubmarineClaimMock.mockReset();
    refundSubmarineUtxoMock.mockReset();
    getSubmarineEvmRefundSignatureMock.mockReset();
    executeReverseSwapMock.mockReset();
    signSubmarineClaimMock.mockResolvedValue(undefined);
    refundSubmarineUtxoMock.mockResolvedValue({
        transactionHex: "hex",
        transactionId: "id",
    });
    getSubmarineEvmRefundSignatureMock.mockResolvedValue({
        signature: "0xsig",
    });
    executeReverseSwapMock.mockResolvedValue({ claimTransactionId: "tx" });
});

describe("swap.submarine.signClaim EVM gate", () => {
    const claimArgs = (asset: string) => ({
        id: "sub-1",
        asset: asset as never,
        swapTree: {} as never,
        claimPublicKey: "02ab",
        refundKeys,
        invoice: "lnbcrt1example",
    });

    test("no-ops for an EVM source asset", async () => {
        await makeClient().swap.submarine.signClaim(claimArgs("TBTC"));
        expect(signSubmarineClaimMock).not.toHaveBeenCalled();
    });

    test("delegates to signSubmarineClaim for a UTXO source asset", async () => {
        await makeClient().swap.submarine.signClaim(claimArgs("BTC"));
        expect(signSubmarineClaimMock).toHaveBeenCalledTimes(1);
        expect(signSubmarineClaimMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: "sub-1", asset: "BTC" }),
        );
    });
});

describe("swap.submarine.refundUtxo", () => {
    test("defaults the network to the configured network", async () => {
        await makeClient().swap.submarine.refundUtxo({
            id: "sub-2",
            asset: "BTC",
            swapTree: {} as never,
            claimPublicKey: "02ab",
            refundKeys,
            lockupTxHex: "deadbeef",
            refundAddress: "bcrt1quser",
            feePerVbyte: 2,
            timeoutBlockHeight: 150,
        });

        expect(refundSubmarineUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: "sub-2", network: "regtest" }),
        );
    });

    test("respects an explicit network override", async () => {
        await makeClient().swap.submarine.refundUtxo({
            id: "sub-3",
            asset: "BTC",
            network: "testnet",
            swapTree: {} as never,
            claimPublicKey: "02ab",
            refundKeys,
            lockupTxHex: "deadbeef",
            refundAddress: "tb1quser",
            feePerVbyte: 2,
            timeoutBlockHeight: 150,
        });

        expect(refundSubmarineUtxoMock).toHaveBeenCalledWith(
            expect.objectContaining({ network: "testnet" }),
        );
    });
});

describe("swap.reverse.execute / swap.submarine.refundEvmSignature", () => {
    test("execute delegates to executeReverseSwap", async () => {
        const args = {
            createdSwap: {} as never,
            to: "BTC" as never,
            preimage: "0xpre",
            receiveAmount: 1_000,
            claimAddress: "bcrt1quser",
        };
        await makeClient().swap.reverse.execute(args);
        expect(executeReverseSwapMock).toHaveBeenCalledWith(args);
    });

    test("refundEvmSignature delegates to getSubmarineEvmRefundSignature", async () => {
        await makeClient().swap.submarine.refundEvmSignature("sub-4");
        expect(getSubmarineEvmRefundSignatureMock).toHaveBeenCalledWith(
            "sub-4",
        );
    });
});
