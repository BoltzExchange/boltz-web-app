import { type LooseRouterCall, toRouterCalls } from "boltz-swaps/bridge";
import { encodeAbiParameters, keccak256 } from "viem";

describe("toRouterCalls", () => {
    test("returns an empty array for an empty input", () => {
        expect(toRouterCalls([])).toEqual([]);
    });

    test("checksums target, converts string value to bigint, brands callData", () => {
        const result = toRouterCalls([
            {
                target: "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
                value: "1000",
                callData: "0xdeadbeef",
            },
        ]);

        expect(result).toEqual([
            {
                target: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
                value: 1000n,
                callData: "0xdeadbeef",
            },
        ]);
    });

    test("accepts bigint value as-is", () => {
        const [call] = toRouterCalls([
            {
                target: "0x0000000000000000000000000000000000000001",
                value: 42n,
                callData: "0x00",
            },
        ]);

        expect(call.value).toBe(42n);
    });

    test("preserves order across multiple calls", () => {
        const result = toRouterCalls([
            {
                target: "0x0000000000000000000000000000000000000001",
                value: "1",
                callData: "0x01",
            },
            {
                target: "0x0000000000000000000000000000000000000002",
                value: 2n,
                callData: "0x02",
            },
            {
                target: "0x0000000000000000000000000000000000000003",
                value: "3",
                callData: "0x03",
            },
        ]);

        expect(result.map((call) => call.callData)).toEqual([
            "0x01",
            "0x02",
            "0x03",
        ]);
    });

    test("throws when target is not a valid address", () => {
        expect(() =>
            toRouterCalls([
                {
                    target: "not-an-address",
                    value: "0",
                    callData: "0x",
                },
            ]),
        ).toThrow();
    });

    // Permit2 signs over this exact ABI shape — drift breaks recovery.
    const routerCallTuple = {
        type: "tuple[]" as const,
        components: [
            { name: "target", type: "address" as const },
            { name: "value", type: "uint256" as const },
            { name: "callData", type: "bytes" as const },
        ],
    };

    test("ABI-encodes identically to the on-chain Router.Call[] tuple shape", () => {
        const loose: LooseRouterCall[] = [
            {
                target: "0x1111111111111111111111111111111111111111",
                value: "1000",
                callData: "0xdeadbeef",
            },
            {
                target: "0x2222222222222222222222222222222222222222",
                value: 0n,
                callData: "0x",
            },
        ];

        const calls = toRouterCalls(loose);
        const encoded = encodeAbiParameters([routerCallTuple], [calls]);

        expect(keccak256(encoded)).toBe(
            "0x4862b1961513f9ca2fc0c8b6d0841c5b416f1d8a2595a034c583d3ad1d30963c",
        );
    });

    test("returns the canonical key set in tuple-positional order", () => {
        const [call] = toRouterCalls([
            {
                target: "0x0000000000000000000000000000000000000001",
                value: 0n,
                callData: "0x",
            },
        ]);
        expect(Object.keys(call).sort()).toEqual(
            ["callData", "target", "value"].sort(),
        );
    });

    test("an additional logical call changes the encoded hash", () => {
        const oneCall: LooseRouterCall[] = [
            {
                target: "0x1111111111111111111111111111111111111111",
                value: 0n,
                callData: "0x",
            },
        ];
        const twoCalls: LooseRouterCall[] = [
            ...oneCall,
            {
                target: "0x2222222222222222222222222222222222222222",
                value: 0n,
                callData: "0x",
            },
        ];

        const encodeHash = (calls: LooseRouterCall[]) =>
            keccak256(
                encodeAbiParameters([routerCallTuple], [toRouterCalls(calls)]),
            );

        expect(encodeHash(oneCall)).not.toBe(encodeHash(twoCalls));
    });
});
