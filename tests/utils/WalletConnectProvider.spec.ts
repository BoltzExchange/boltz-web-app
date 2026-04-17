import { NetworkTransport } from "../../src/configs/base";

const { createProviderMock, isIosMock } = vi.hoisted(() => ({
    createProviderMock: vi.fn(),
    isIosMock: vi.fn(),
}));

vi.mock("../../src/config", () => ({
    config: {
        assets: {
            ARB: {
                network: {
                    chainId: 42161,
                    rpcUrls: ["https://arb.example"],
                },
            },
        },
    },
}));

vi.mock("../../src/utils/helper", () => ({
    isIos: isIosMock,
}));

vi.mock("../../src/utils/provider", () => ({
    createProvider: createProviderMock,
}));

const loadWalletConnectProvider = async () =>
    (await import("../../src/utils/WalletConnectProvider")).default;

const trustWalletMetadata = {
    peer: {
        metadata: {
            name: "Trust Wallet",
            url: "https://trustwallet.com",
        },
    },
};

describe("WalletConnectProvider", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        isIosMock.mockReturnValue(false);
    });

    test("routes read-only calls through direct RPC only for Trust Wallet iOS", async () => {
        const rpcSend = vi.fn().mockResolvedValue("0xrpc");
        createProviderMock.mockReturnValue({ send: rpcSend });
        isIosMock.mockReturnValue(true);

        const WalletConnectProvider = await loadWalletConnectProvider();
        const rawRequest = vi.fn().mockResolvedValue("0xraw");

        WalletConnectProvider.setRawEvmProvider({
            request: rawRequest,
            session: trustWalletMetadata,
        });
        WalletConnectProvider.setEvmChainId(42161);

        const response = await new WalletConnectProvider().request({
            method: "eth_call",
            params: ["0xpayload"],
        });

        expect(response).toBe("0xrpc");
        expect(createProviderMock).toHaveBeenCalledWith([
            "https://arb.example",
        ]);
        expect(rpcSend).toHaveBeenCalledWith("eth_call", ["0xpayload"]);
        expect(rawRequest).not.toHaveBeenCalled();
    });

    test("keeps read-only calls on wallet provider for non-iOS sessions", async () => {
        const rpcSend = vi.fn().mockResolvedValue("0xrpc");
        createProviderMock.mockReturnValue({ send: rpcSend });
        isIosMock.mockReturnValue(false);

        const WalletConnectProvider = await loadWalletConnectProvider();
        const rawRequest = vi.fn().mockResolvedValue("0xraw");

        WalletConnectProvider.setRawEvmProvider({
            request: rawRequest,
            session: trustWalletMetadata,
        });
        WalletConnectProvider.setEvmChainId(42161);

        const response = await new WalletConnectProvider().request({
            method: "eth_call",
            params: ["0xpayload"],
        });

        expect(response).toBe("0xraw");
        expect(rawRequest).toHaveBeenCalledWith({
            method: "eth_call",
            params: ["0xpayload"],
        });
        expect(rpcSend).not.toHaveBeenCalled();
    });

    test("rewrites Trust Wallet iOS sendTransaction payload and injects chainId", async () => {
        const rpcSend = vi.fn().mockResolvedValue("0xrpc");
        createProviderMock.mockReturnValue({ send: rpcSend });
        isIosMock.mockReturnValue(true);

        const WalletConnectProvider = await loadWalletConnectProvider();
        const rawRequest = vi.fn().mockResolvedValue("0xhash");

        WalletConnectProvider.setRawEvmProvider({
            request: rawRequest,
            session: trustWalletMetadata,
        });
        WalletConnectProvider.setEvmChainId(42161);

        await new WalletConnectProvider().request({
            method: "eth_sendTransaction",
            params: [
                {
                    from: "0x9792bdb7076ccb59cced347b6a6b24e4315d23dc",
                    to: "0xa6d0956216da39aa1989066a9b22b64c30924dcd",
                    gas: "0x1",
                    value: "0x0",
                },
            ],
        });

        const forwarded = rawRequest.mock.calls[0][0];
        expect(forwarded.method).toBe("eth_sendTransaction");
        expect(forwarded.params[0]).toMatchObject({
            from: "0x9792bdb7076ccb59cced347b6a6b24e4315d23dc",
            to: "0xa6d0956216da39aa1989066a9b22b64c30924dcd",
            data: "0x",
            gas: "0x01",
            value: "0x00",
            chainId: "0xa4b1",
        });
    });

    test("syncDefaultChain is idempotent for same provider/chain", async () => {
        const rpcSend = vi.fn().mockResolvedValue("0xrpc");
        createProviderMock.mockReturnValue({ send: rpcSend });
        isIosMock.mockReturnValue(true);

        const WalletConnectProvider = await loadWalletConnectProvider();
        const rawRequest = vi.fn().mockResolvedValue(["0xabc"]);
        const setDefaultChain = vi.fn();

        WalletConnectProvider.setRawEvmProvider({
            request: rawRequest,
            setDefaultChain,
            session: trustWalletMetadata,
        });
        WalletConnectProvider.setEvmChainId(42161);

        const wcProvider = new WalletConnectProvider();
        await wcProvider.request({ method: "eth_accounts", params: [] });
        await wcProvider.request({ method: "eth_accounts", params: [] });

        expect(setDefaultChain).toHaveBeenCalledTimes(1);
        expect(setDefaultChain).toHaveBeenCalledWith("eip155:42161");
    });

    test("syncDefaultChain is skipped for non Trust Wallet iOS sessions", async () => {
        const rpcSend = vi.fn().mockResolvedValue("0xrpc");
        createProviderMock.mockReturnValue({ send: rpcSend });
        isIosMock.mockReturnValue(false);

        const WalletConnectProvider = await loadWalletConnectProvider();
        const rawRequest = vi.fn().mockResolvedValue(["0xabc"]);
        const setDefaultChain = vi.fn();

        WalletConnectProvider.setRawEvmProvider({
            request: rawRequest,
            setDefaultChain,
            session: trustWalletMetadata,
        });
        WalletConnectProvider.setEvmChainId(42161);

        await new WalletConnectProvider().request({
            method: "eth_accounts",
            params: [],
        });

        expect(setDefaultChain).not.toHaveBeenCalled();
    });

    test("connect tracks requested transport and chain", async () => {
        const WalletConnectProvider = await loadWalletConnectProvider();
        const openModal = vi.fn();

        WalletConnectProvider.initialize(vi.fn() as never, openModal as never);
        const connectPromise = WalletConnectProvider.connect(
            NetworkTransport.Evm,
            42161,
        );

        expect(WalletConnectProvider.getRequestedTransport()).toBe(
            NetworkTransport.Evm,
        );
        expect(WalletConnectProvider.getRequestedEvmChainId()).toBe(42161);
        expect(openModal).toHaveBeenCalledWith(true);

        WalletConnectProvider.resolveClosePromise(
            NetworkTransport.Evm,
            { request: vi.fn() },
            "0x123",
        );
        await expect(connectPromise).resolves.toEqual({
            address: "0x123",
            transport: NetworkTransport.Evm,
        });
    });
});
