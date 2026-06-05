import { prefix0x, stripHexPrefix } from "boltz-swaps/evm";

describe("prefix0x", () => {
    test.each`
        value           | expected
        ${"deadbeef"}   | ${"0xdeadbeef"}
        ${"0xdeadbeef"} | ${"0xdeadbeef"}
        ${"DEADBEEF"}   | ${"0xDEADBEEF"}
        ${""}           | ${"0x"}
    `("returns $expected for $value", ({ value, expected }) => {
        expect(prefix0x(value)).toBe(expected);
    });
});

describe("stripHexPrefix", () => {
    test.each`
        value           | expected
        ${"0xdeadbeef"} | ${"deadbeef"}
        ${"0Xdeadbeef"} | ${"deadbeef"}
        ${"deadbeef"}   | ${"deadbeef"}
        ${"0x"}         | ${""}
        ${""}           | ${""}
        ${"0x0xdead"}   | ${"0xdead"}
    `("returns $expected for $value", ({ value, expected }) => {
        expect(stripHexPrefix(value)).toBe(expected);
    });

    test("round-trips with prefix0x, normalizing an uppercase prefix", () => {
        expect(prefix0x(stripHexPrefix("0Xdeadbeef"))).toBe("0xdeadbeef");
        expect(stripHexPrefix(prefix0x("deadbeef"))).toBe("deadbeef");
    });
});
