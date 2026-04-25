import { render } from "@solidjs/testing-library";

import { NetworkTransport } from "../../src/configs/base";
import { useWeb3Signer } from "../../src/context/Web3";
import { contextWrapper } from "../helper";

describe("Web3SignerProvider#browserWalletTransports", () => {
    let context: ReturnType<typeof useWeb3Signer>;

    const Probe = () => {
        context = useWeb3Signer();
        return null;
    };

    const renderProvider = () =>
        render(() => <Probe />, { wrapper: contextWrapper });

    afterEach(() => {
        Reflect.deleteProperty(window, "ethereum");
        Reflect.deleteProperty(window, "tron");
        Reflect.deleteProperty(window, "tronLink");
        Reflect.deleteProperty(window, "tronWeb");
    });

    test("starts empty when no provider is injected", () => {
        renderProvider();

        expect(Array.from(context.browserWalletTransports())).toEqual([]);
    });

    test("detects an injected EVM wallet via window.ethereum", () => {
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: { request: () => null },
        });

        renderProvider();

        expect(
            context.browserWalletTransports().has(NetworkTransport.Evm),
        ).toBe(true);
        expect(
            context.browserWalletTransports().has(NetworkTransport.Tron),
        ).toBe(false);
    });

    test.each([["tron"], ["tronLink"], ["tronWeb"]] as const)(
        "detects an injected Tron wallet via window.%s",
        (globalKey) => {
            Object.defineProperty(window, globalKey, {
                configurable: true,
                value: {},
            });

            renderProvider();

            expect(
                context.browserWalletTransports().has(NetworkTransport.Tron),
            ).toBe(true);
            expect(
                context.browserWalletTransports().has(NetworkTransport.Evm),
            ).toBe(false);
        },
    );

    test("reports both transports when EVM and Tron wallets coexist", () => {
        Object.defineProperty(window, "ethereum", {
            configurable: true,
            value: { request: () => null },
        });
        Object.defineProperty(window, "tronLink", {
            configurable: true,
            value: {},
        });

        renderProvider();

        const transports = context.browserWalletTransports();
        expect(transports.has(NetworkTransport.Evm)).toBe(true);
        expect(transports.has(NetworkTransport.Tron)).toBe(true);
        expect(transports.size).toBe(2);
    });

    test("deduplicates Tron when multiple Tron globals are injected", () => {
        Object.defineProperty(window, "tron", {
            configurable: true,
            value: {},
        });
        Object.defineProperty(window, "tronLink", {
            configurable: true,
            value: {},
        });
        Object.defineProperty(window, "tronWeb", {
            configurable: true,
            value: {},
        });

        renderProvider();

        const transports = context.browserWalletTransports();
        expect(Array.from(transports)).toEqual([NetworkTransport.Tron]);
    });
});
