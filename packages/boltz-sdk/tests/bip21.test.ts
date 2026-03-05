import {
    bitcoinPrefix,
    extractBip21Address,
    extractBip21Amount,
    getAssetByBip21Prefix,
    invoicePrefix,
    isBip21,
    liquidPrefix,
    liquidTestnetPrefix,
} from "../src/bip21";

describe("bip21", () => {
    describe("isBip21", () => {
        test.each`
            result   | prefix
            ${true}  | ${"bitcoin:"}
            ${true}  | ${"BITCOIN:"}
            ${true}  | ${"liquidnetwork:"}
            ${true}  | ${"liquidtestnet:"}
            ${false} | ${"liquid:"}
            ${false} | ${"boltz:"}
            ${false} | ${"not-a-prefix"}
            ${false} | ${""}
        `("should detect $prefix as BIP21: $result", ({ result, prefix }) => {
            expect(isBip21(prefix)).toBe(result);
        });

        test("should return false for non-string input", () => {
            expect(isBip21(null)).toBe(false);
            expect(isBip21(undefined)).toBe(false);
        });
    });

    describe("extractBip21Address", () => {
        test.each`
            bip21                                                                                                                                                                                                                                                                    | address
            ${"bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday"}                                                                                                                          | ${"BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U"}
            ${"liquidnetwork:el1qq2hwpl8uvskkjrznyltjlamk86nh7r69amjmj2kvfwe7pxmfjxl5wjnhvd5am8s7mnv5rtnwflkcgfwesnz2gz8qau0ghppzehf4grt89szq8tex5keq?amount=0.00100135&label=Send%20to%20BTC%20lightning&assetid=5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225"} | ${"el1qq2hwpl8uvskkjrznyltjlamk86nh7r69amjmj2kvfwe7pxmfjxl5wjnhvd5am8s7mnv5rtnwflkcgfwesnz2gz8qau0ghppzehf4grt89szq8tex5keq"}
            ${"bitcoin:3G4bhXLN64wGN6efUd4MoHjmxBWrUNacPY?amount=0.00183723&label=Send%20to%20BTC%20lightning"}                                                                                                                                                                      | ${"3G4bhXLN64wGN6efUd4MoHjmxBWrUNacPY"}
            ${"liquidnetwork:VJL8BMWCv7HUq4dgCBJAQA1gHTWibWXPTjP1vXF92doTmpnD7a6b24t7epT3fXNi8nJfW2vYdLLf15vo"}                                                                                                                                                                      | ${"VJL8BMWCv7HUq4dgCBJAQA1gHTWibWXPTjP1vXF92doTmpnD7a6b24t7epT3fXNi8nJfW2vYdLLf15vo"}
        `("should extract address from BIP21: $bip21", ({ bip21, address }) => {
            expect(extractBip21Address(bip21)).toBe(address);
        });

        test("should return input as-is if not BIP21", () => {
            const nonBip21 = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
            expect(extractBip21Address(nonBip21)).toBe(nonBip21);
        });
    });

    describe("extractBip21Amount", () => {
        test("should extract amount from BIP21 URI", () => {
            const bip21 =
                "bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001";
            const amount = extractBip21Amount(bip21);
            expect(amount).not.toBeNull();
            expect(amount?.toString()).toBe("0.00001");
        });

        test("should return null for non-BIP21 input", () => {
            expect(
                extractBip21Amount(
                    "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
                ),
            ).toBeNull();
        });

        test("should return 0 if amount parameter is missing", () => {
            const bip21 = "bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U";
            const amount = extractBip21Amount(bip21);
            expect(amount).not.toBeNull();
            expect(amount?.toString()).toBe("0");
        });

        test("should handle empty amount parameter", () => {
            const bip21 =
                "bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=";
            const amount = extractBip21Amount(bip21);
            expect(amount).not.toBeNull();
            expect(amount?.toString()).toBe("0");
        });
    });

    describe("getAssetByBip21Prefix", () => {
        test.each`
            prefix                 | asset
            ${bitcoinPrefix}       | ${"BTC"}
            ${liquidPrefix}        | ${"L-BTC"}
            ${liquidTestnetPrefix} | ${"L-BTC"}
            ${invoicePrefix}       | ${"LN"}
            ${"unknown:"}          | ${""}
            ${""}                  | ${""}
        `("should return $asset for prefix $prefix", ({ prefix, asset }) => {
            expect(getAssetByBip21Prefix(prefix)).toBe(asset);
        });
    });
});
