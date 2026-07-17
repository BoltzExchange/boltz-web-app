import {
    type ClaimEvmArgs,
    type PopulateRouterClaimBridgeArgs,
    type QuoteData,
    createBoltzClient,
} from "boltz-swaps";

import type * as RegistryModule from "../src/bridge/registry.ts";
import type * as ConfigModule from "../src/config.ts";
import type * as CommitmentModule from "../src/evm/commitment.ts";
import type * as TransactionModule from "../src/evm/transaction.ts";
import type * as FetcherModule from "../src/http/fetcher.ts";

const {
    fetcherMock,
    setBoltzSwapsConfigMock,
    claimAssetMock,
    postCommitmentSignatureForTransactionMock,
    getCommitmentRefundSignatureMock,
    fakeDriver,
    bridgeRegistryMock,
} = vi.hoisted(() => {
    const fakeDriver = {
        quoteSend: vi.fn(),
        quoteReceiveAmount: vi.fn(),
        quoteAmountInForAmountOut: vi.fn(),
        getQuotedContract: vi.fn(),
        populateRouterClaimBridgeTransaction: vi.fn(),
    };
    return {
        fetcherMock: vi.fn(),
        setBoltzSwapsConfigMock: vi.fn(),
        claimAssetMock: vi.fn(),
        postCommitmentSignatureForTransactionMock: vi.fn(),
        getCommitmentRefundSignatureMock: vi.fn(),
        fakeDriver,
        bridgeRegistryMock: {
            requireDriverForRoute: vi.fn(() => fakeDriver),
        },
    };
});

vi.mock("../src/http/fetcher.ts", async (importActual) => ({
    ...(await importActual<typeof FetcherModule>()),
    fetcher: fetcherMock,
}));

vi.mock("../src/config.ts", async (importActual) => ({
    ...(await importActual<typeof ConfigModule>()),
    setBoltzSwapsConfig: setBoltzSwapsConfigMock,
}));

vi.mock("../src/evm/transaction.ts", async (importActual) => ({
    ...(await importActual<typeof TransactionModule>()),
    claimAsset: claimAssetMock,
}));

vi.mock("../src/evm/commitment.ts", async (importActual) => ({
    ...(await importActual<typeof CommitmentModule>()),
    postCommitmentSignatureForTransaction:
        postCommitmentSignatureForTransactionMock,
    getCommitmentRefundSignature: getCommitmentRefundSignatureMock,
}));

vi.mock("../src/bridge/registry.ts", async (importActual) => ({
    ...(await importActual<typeof RegistryModule>()),
    bridgeRegistry: bridgeRegistryMock,
}));

beforeEach(() => {
    for (const mock of [
        fetcherMock,
        setBoltzSwapsConfigMock,
        claimAssetMock,
        postCommitmentSignatureForTransactionMock,
        getCommitmentRefundSignatureMock,
        fakeDriver.quoteSend,
        fakeDriver.quoteReceiveAmount,
        fakeDriver.quoteAmountInForAmountOut,
        fakeDriver.getQuotedContract,
        fakeDriver.populateRouterClaimBridgeTransaction,
        bridgeRegistryMock.requireDriverForRoute,
    ]) {
        mock.mockReset();
    }
    bridgeRegistryMock.requireDriverForRoute.mockImplementation(
        () => fakeDriver,
    );
});

const makeClient = () =>
    createBoltzClient({ boltzApiUrl: "https://test.boltz.exchange" });

describe("createBoltzClient: config", () => {
    test("installs the proxy via setBoltzSwapsConfig exactly once", () => {
        makeClient();
        expect(setBoltzSwapsConfigMock).toHaveBeenCalledTimes(1);
    });

    test("proxy reads object-literal config without indirection", () => {
        createBoltzClient({ boltzApiUrl: "https://a", referral: "x" });
        const proxy = setBoltzSwapsConfigMock.mock.calls[0][0];
        expect(proxy.boltzApiUrl).toBe("https://a");
        expect(proxy.referral).toBe("x");
    });

    test("proxy dispatches to thunk on every read (live updates)", () => {
        const source: { boltzApiUrl: string; solburnUrl: string } = {
            boltzApiUrl: "https://initial",
            solburnUrl: "https://solburn-initial",
        };
        createBoltzClient(() => source);
        const proxy = setBoltzSwapsConfigMock.mock.calls[0][0];
        expect(proxy.boltzApiUrl).toBe("https://initial");
        expect(proxy.solburnUrl).toBe("https://solburn-initial");

        source.boltzApiUrl = "https://updated";
        source.solburnUrl = "https://solburn-updated";
        expect(proxy.boltzApiUrl).toBe("https://updated");
        expect(proxy.solburnUrl).toBe("https://solburn-updated");
    });

    test("proxy exposes every known config key", () => {
        const literal = {
            assets: { BTC: { type: "utxo" } },
            cctpApiUrl: "https://api.circle.com",
            solburnUrl: "https://solburn",
            layerZeroExplorerUrl: "https://lz",
            cctpExplorerUrl: "https://cctp",
            oftDeploymentsUrl: "https://oft",
            boltzApiUrl: "https://boltz",
            referral: "ref",
            cooperativeDisabled: false,
        };
        createBoltzClient(literal as never);
        const proxy = setBoltzSwapsConfigMock.mock.calls[0][0];
        expect(proxy.assets).toEqual({ BTC: { type: "utxo" } });
        expect(proxy.cctpApiUrl).toBe("https://api.circle.com");
        expect(proxy.solburnUrl).toBe("https://solburn");
        expect(proxy.layerZeroExplorerUrl).toBe("https://lz");
        expect(proxy.cctpExplorerUrl).toBe("https://cctp");
        expect(proxy.oftDeploymentsUrl).toBe("https://oft");
        expect(proxy.boltzApiUrl).toBe("https://boltz");
        expect(proxy.referral).toBe("ref");
        expect(proxy.cooperativeDisabled).toBe(false);
    });
});

describe("createBoltzClient: dex", () => {
    test("quoteAmountIn calls fetcher with formed URL", async () => {
        const quotes: QuoteData[] = [{ quote: "100", data: {} }];
        fetcherMock.mockResolvedValue(quotes);

        const result = await makeClient().dex.quoteAmountIn({
            chain: "ETH",
            tokenIn: "0xa",
            tokenOut: "0xb",
            amountIn: 50n,
        });

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/quote/ETH/in?tokenIn=0xa&tokenOut=0xb&amountIn=50",
        );
        expect(result).toEqual(quotes);
    });

    test("quoteAmountOut calls fetcher with formed URL", async () => {
        fetcherMock.mockResolvedValue([]);

        await makeClient().dex.quoteAmountOut({
            chain: "ARB",
            tokenIn: "0xc",
            tokenOut: "0xd",
            amountOut: 7n,
        });

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/quote/ARB/out?tokenIn=0xc&tokenOut=0xd&amountOut=7",
        );
    });

    test("encode posts to /v2/quote/{chain}/encode with a stringified body", async () => {
        fetcherMock.mockResolvedValue({ calls: [] });

        await makeClient().dex.encode({
            chain: "BASE",
            recipient: "0xrec",
            amountIn: 1000n,
            amountOutMin: 990n,
            data: { route: "abc" },
        });

        expect(fetcherMock).toHaveBeenCalledWith("/v2/quote/BASE/encode", {
            recipient: "0xrec",
            amountIn: "1000",
            amountOutMin: "990",
            data: { route: "abc" },
        });
    });
});

describe("createBoltzClient: bridge", () => {
    const route = { sourceAsset: "USDC-BASE", destinationAsset: "USDC" };

    test("driver dispatches via bridgeRegistry.requireDriverForRoute", () => {
        const result = makeClient().bridge.driver(route);
        expect(bridgeRegistryMock.requireDriverForRoute).toHaveBeenCalledWith(
            route,
        );
        expect(result).toBe(fakeDriver);
    });

    test("quoteSend resolves a quoted contract then calls driver.quoteSend", async () => {
        const contract = Symbol("contract");
        const quote = {
            sendParam: [],
            msgFee: [10n, 0n],
            minAmount: 100n,
        };
        fakeDriver.getQuotedContract.mockResolvedValue(contract);
        fakeDriver.quoteSend.mockResolvedValue(quote);

        const result = await makeClient().bridge.quoteSend({
            route,
            recipient: "0xabc",
            amount: 200n,
            options: { recipient: "0xabc" },
        });

        expect(bridgeRegistryMock.requireDriverForRoute).toHaveBeenCalledWith(
            route,
        );
        expect(fakeDriver.getQuotedContract).toHaveBeenCalledWith(route);
        expect(fakeDriver.quoteSend).toHaveBeenCalledWith(
            contract,
            route,
            "0xabc",
            200n,
            { recipient: "0xabc" },
        );
        expect(result).toBe(quote);
    });

    test("quoteReceive delegates to driver.quoteReceiveAmount", async () => {
        const expected = { amountIn: 50n, amountOut: 49n };
        fakeDriver.quoteReceiveAmount.mockResolvedValue(expected);

        const result = await makeClient().bridge.quoteReceive({
            route,
            amount: 50n,
        });

        expect(fakeDriver.quoteReceiveAmount).toHaveBeenCalledWith(
            route,
            50n,
            undefined,
        );
        expect(result).toBe(expected);
    });

    test("quoteAmountIn delegates to driver.quoteAmountInForAmountOut", async () => {
        fakeDriver.quoteAmountInForAmountOut.mockResolvedValue(123n);

        const result = await makeClient().bridge.quoteAmountIn({
            route,
            amountOut: 100n,
        });

        expect(fakeDriver.quoteAmountInForAmountOut).toHaveBeenCalledWith(
            route,
            100n,
            undefined,
        );
        expect(result).toBe(123n);
    });

    test("toRouterCalls normalizes loose call shapes", () => {
        const normalized = makeClient().bridge.toRouterCalls([
            {
                target: "0x1234567890123456789012345678901234567890",
                value: "5",
                callData: "0xdead",
            },
        ]);
        expect(normalized).toEqual([
            {
                target: "0x1234567890123456789012345678901234567890",
                value: 5n,
                callData: "0xdead",
            },
        ]);
    });

    test("vFromSignature pulls v from a Signature", () => {
        expect(
            makeClient().bridge.vFromSignature({
                r: "0x0",
                s: "0x0",
                v: 28n,
            } as never),
        ).toBe(28);
        expect(
            makeClient().bridge.vFromSignature({
                r: "0x0",
                s: "0x0",
                yParity: 1,
            } as never),
        ).toBe(28);
    });
});

describe("createBoltzClient: swap.chain", () => {
    test("create posts to /v2/swap/chain with the mapped body", async () => {
        fetcherMock.mockResolvedValue({ id: "abc" });

        await makeClient().swap.chain.create({
            from: "BTC",
            to: "USDC-BASE",
            userLockAmount: 10000,
            preimageHash: "ph",
            pairHash: "hh",
            claimAddress: "0xdead",
        });

        expect(fetcherMock).toHaveBeenCalledWith("/v2/swap/chain", {
            from: "BTC",
            to: "USDC-BASE",
            preimageHash: "ph",
            claimPublicKey: undefined,
            refundPublicKey: undefined,
            claimAddress: "0xdead",
            pairHash: "hh",
            referralId: undefined,
            userLockAmount: 10000,
        });
    });

    test("transactions calls fetcher with the chain id path", async () => {
        fetcherMock.mockResolvedValue({});
        await makeClient().swap.chain.transactions("swap-1");
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/chain/swap-1/transactions",
        );
    });

    test("newQuote calls fetcher with the chain quote path", async () => {
        fetcherMock.mockResolvedValue({ amount: 42 });
        await makeClient().swap.chain.newQuote("swap-2");
        expect(fetcherMock).toHaveBeenCalledWith("/v2/swap/chain/swap-2/quote");
    });

    test("acceptNewQuote posts to chain quote path with amount", async () => {
        fetcherMock.mockResolvedValue({});
        await makeClient().swap.chain.acceptNewQuote("swap-3", 99);
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/chain/swap-3/quote",
            { amount: 99 },
        );
    });
});

describe("createBoltzClient: swap.submarine", () => {
    test("create posts to /v2/swap/submarine with the mapped body", async () => {
        fetcherMock.mockResolvedValue({ id: "sub" });

        await makeClient().swap.submarine.create({
            from: "BTC",
            to: "LN",
            invoice: "lnbcrt1",
            pairHash: "ph",
            refundPublicKey: "02ab",
        });

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/submarine",
            expect.objectContaining({
                from: "BTC",
                to: "LN",
                invoice: "lnbcrt1",
                refundPublicKey: "02ab",
                pairHash: "ph",
            }),
        );
    });

    test("claimDetails GETs /v2/swap/submarine/{id}/claim", async () => {
        fetcherMock.mockResolvedValue({
            pubNonce: "01",
            preimage: "02",
            transactionHash: "03",
        });
        await makeClient().swap.submarine.claimDetails("sub-1");
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/submarine/sub-1/claim",
        );
    });

    test("preimage GETs /v2/swap/submarine/{id}/preimage", async () => {
        fetcherMock.mockResolvedValue({ preimage: "ab" });
        await makeClient().swap.submarine.preimage("sub-2");
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/submarine/sub-2/preimage",
        );
    });

    test("refundEvmSignature GETs the submarine refund path", async () => {
        fetcherMock.mockResolvedValue({ signature: "0xsig" });
        await makeClient().swap.submarine.refundEvmSignature("sub-3");
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/submarine/sub-3/refund",
        );
    });
});

describe("createBoltzClient: swap.reverse", () => {
    test("create posts to /v2/swap/reverse with the mapped body", async () => {
        fetcherMock.mockResolvedValue({ id: "rev" });

        await makeClient().swap.reverse.create({
            from: "LN",
            to: "BTC",
            invoiceAmount: 100_000,
            preimageHash: "ph",
            pairHash: "hh",
            claimPublicKey: "02ab",
            claimAddress: "bcrt1quser",
        });

        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/reverse",
            expect.objectContaining({
                from: "LN",
                to: "BTC",
                invoiceAmount: 100_000,
                preimageHash: "ph",
                pairHash: "hh",
                claimPublicKey: "02ab",
                claimAddress: "bcrt1quser",
            }),
        );
    });

    test("transaction GETs /v2/swap/reverse/{id}/transaction", async () => {
        fetcherMock.mockResolvedValue({
            id: "lock",
            hex: "deadbeef",
            timeoutBlockHeight: 1,
        });
        await makeClient().swap.reverse.transaction("rev-1");
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/reverse/rev-1/transaction",
        );
    });
});

describe("createBoltzClient: swap.lock", () => {
    test("commitmentDetails GETs /v2/commitment/{currency}/details", async () => {
        fetcherMock.mockResolvedValue({
            contract: "0x1",
            claimAddress: "0x2",
            timelock: 100,
        });
        await makeClient().swap.lock.commitmentDetails("USDC-BASE");
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/commitment/USDC-BASE/details",
        );
    });

    test("confirmCommitment delegates to postCommitmentSignatureForTransaction", async () => {
        const args = {
            asset: "USDC-BASE",
            commitmentAsset: "USDC",
            swapId: "swap-1",
            preimageHash: "0xph",
            commitmentTxHash: "0xtx" as `0x${string}`,
            erc20Swap: { address: "0xabc" } as never,
            signer: {} as never,
        };
        postCommitmentSignatureForTransactionMock.mockResolvedValue(undefined);

        await makeClient().swap.lock.confirmCommitment(args);

        expect(postCommitmentSignatureForTransactionMock).toHaveBeenCalledWith(
            args,
        );
    });

    test("postRefundSignature delegates to getCommitmentRefundSignature", async () => {
        const args = {
            chainSymbol: "ETH",
            transactionHash: "0xtx",
            logIndex: 4,
            signer: {} as never,
        };
        getCommitmentRefundSignatureMock.mockResolvedValue("0xsig");

        const result = await makeClient().swap.lock.postRefundSignature(args);

        expect(getCommitmentRefundSignatureMock).toHaveBeenCalledWith(args);
        expect(result).toBe("0xsig");
    });

    test("buildRefundAuthMessage formats the expected lines", () => {
        const message = makeClient().swap.lock.buildRefundAuthMessage({
            chainSymbol: "ETH",
            transactionHash: "0xdead",
            logIndex: 2,
        });
        expect(message).toBe(
            [
                "Boltz commitment refund authorization",
                "chain: ETH",
                "transactionHash: 0xdead",
                "logIndex: 2",
            ].join("\n"),
        );
    });
});

describe("createBoltzClient: swap.claim", () => {
    test("details GETs /v2/swap/chain/{id}/claim", async () => {
        fetcherMock.mockResolvedValue({
            pubNonce: "01",
            publicKey: "02",
            transactionHash: "03",
        });
        await makeClient().swap.claim.details("swap-1");
        expect(fetcherMock).toHaveBeenCalledWith("/v2/swap/chain/swap-1/claim");
    });

    test("submit posts to chain claim path with body", async () => {
        fetcherMock.mockResolvedValue({
            pubNonce: "01",
            partialSignature: "02",
        });
        await makeClient().swap.claim.submit("swap-2", {
            preimage: "0xpre",
            signature: { pubNonce: "01", partialSignature: "02" },
        });
        expect(fetcherMock).toHaveBeenCalledWith(
            "/v2/swap/chain/swap-2/claim",
            {
                preimage: "0xpre",
                signature: { pubNonce: "01", partialSignature: "02" },
                toSign: undefined,
            },
        );
    });

    test("executeEvm delegates to claimAsset with the claim args", async () => {
        claimAssetMock.mockResolvedValue({
            transactionHash: "0xhash",
            receiveAmount: 100n,
        });
        const getSigner = () => ({}) as never;
        const sendTransaction = vi.fn() as never;
        const etherSwap = { address: "0xe" } as never;
        const erc20Swap = { address: "0xr" } as never;
        const gasAbstractionSigner = { id: "abs" } as never;

        const args: ClaimEvmArgs = {
            gasAbstraction: "none" as never,
            asset: "USDC-BASE",
            preimage: "0xpreimage",
            amount: 100n,
            claimAddress: "0xclaim",
            refundAddress: "0xrefund",
            timeoutBlockHeight: 999,
            destination: "0xdest",
            getSigner,
            gasAbstractionSigner,
            etherSwap,
            erc20Swap,
            sendTransaction,
        };

        await makeClient().swap.claim.executeEvm(args);

        expect(claimAssetMock).toHaveBeenCalledWith(args);
    });

    test("executeBridgeRouterClaim delegates to driver", async () => {
        const args = {
            route: { sourceAsset: "USDC-BASE", destinationAsset: "USDC" },
        } as PopulateRouterClaimBridgeArgs;
        const result = {} as never;
        fakeDriver.populateRouterClaimBridgeTransaction.mockResolvedValue(
            result,
        );

        const out =
            await makeClient().swap.claim.executeBridgeRouterClaim(args);

        expect(bridgeRegistryMock.requireDriverForRoute).toHaveBeenCalledWith(
            args.route,
        );
        expect(
            fakeDriver.populateRouterClaimBridgeTransaction,
        ).toHaveBeenCalledWith(args);
        expect(out).toBe(result);
    });

    test("isEmptyPreimageHash recognizes the zero hash", () => {
        const boltz = makeClient();
        expect(
            boltz.swap.claim.isEmptyPreimageHash("0x" + "00".repeat(32)),
        ).toBe(true);
        expect(
            boltz.swap.claim.isEmptyPreimageHash("0x" + "11".repeat(32)),
        ).toBe(false);
        expect(boltz.swap.claim.isEmptyPreimageHash(undefined)).toBe(false);
    });
});

describe("createBoltzClient: deposit namespace", () => {
    test("client.deposit delegates to the real deposit namespace", () => {
        const boltz = makeClient();
        expect(
            boltz.deposit.derive({
                mnemonic:
                    "test test test test test test test test test test test junk",
            }),
        ).toEqual({
            index: 0,
            address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        });
        expect(typeof boltz.deposit.quote).toBe("function");
        expect(typeof boltz.deposit.createWatcher).toBe("function");
        expect(typeof boltz.deposit.resumeWatcher).toBe("function");
    });
});
