import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { config } from "../../src/config";
import { RBTC } from "../../src/consts/Assets";
import { estimate, getChainInfo, relay } from "../../src/rif/Relay";
import type { EnvelopingRequest } from "../../src/rif/types/TypedRequestData";

const enveloping = {} as EnvelopingRequest;
const metadata = { relayMaxNonce: 0, relayHubAddress: "0x" };

describe("rif/Relay", () => {
    let originalRifRelay: string | undefined;

    beforeEach(() => {
        originalRifRelay = config.assets?.[RBTC]?.rifRelay;
    });

    afterEach(() => {
        if (config.assets?.[RBTC] !== undefined) {
            config.assets[RBTC].rifRelay = originalRifRelay;
        }
        vi.restoreAllMocks();
    });

    test.each([
        ["getChainInfo", () => getChainInfo()],
        ["estimate", () => estimate(enveloping, metadata)],
        ["relay", () => relay(enveloping, metadata)],
    ])("%s throws when rifRelay is missing", (_name, call) => {
        if (config.assets?.[RBTC] !== undefined) {
            config.assets[RBTC].rifRelay = undefined;
        }

        expect(() => call()).toThrow("missing RIF relay URL for RBTC");
    });

    test.each([
        ["getChainInfo", () => getChainInfo()],
        ["estimate", () => estimate(enveloping, metadata)],
        ["relay", () => relay(enveloping, metadata)],
    ])("%s throws when rifRelay is empty string", (_name, call) => {
        if (config.assets?.[RBTC] !== undefined) {
            config.assets[RBTC].rifRelay = "";
        }

        expect(() => call()).toThrow("missing RIF relay URL for RBTC");
    });

    test("getChainInfo issues a fetch against the configured base URL", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(
                new Response(JSON.stringify({ ready: true }), { status: 200 }),
            );

        if (config.assets?.[RBTC] !== undefined) {
            config.assets[RBTC].rifRelay = "https://relay.example";
        }

        await getChainInfo();

        expect(fetchMock).toHaveBeenCalledWith(
            "https://relay.example/chain-info",
        );
    });
});
