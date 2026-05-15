import { satoshiToWei } from "boltz-swaps/evm";

describe("rootstock", () => {
    test.each`
        satoshis       | wei
        ${0}           | ${0n}
        ${1}           | ${10_000_000_000n}
        ${10}          | ${100_000_000_000n}
        ${12}          | ${120_000_000_000n}
        ${234_903_147} | ${2_349_031_470_000_000_000n}
    `("should convert $satoshis sats to $wei wei", ({ satoshis, wei }) => {
        expect(satoshiToWei(satoshis)).toEqual(wei);
    });
});
