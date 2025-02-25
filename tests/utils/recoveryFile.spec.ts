import { ECPair } from "../../src/utils/ecpair";
import {
    deriveKey,
    generateRecoveryFile,
    getXpub,
} from "../../src/utils/recoveryFile";
import { RecoveryFile } from "../../src/utils/recoveryFile";

describe("recoveryFile", () => {
    const recoveryFile: RecoveryFile = {
        xpriv: "xprv9s21ZrQH143K4CEaPNdUFtd1NTKS3jrSkD8Wq431KG49RgsrCESErYyXrdM6yoghWpesYRirK3PTnLYWYCmWjAEMB2aDX9XmKqsNznUn7v9",
    };

    describe("getXpub", () => {
        test("should derive xpub from xpriv", () => {
            const xpub = getXpub(recoveryFile);

            expect(xpub).toEqual(
                "xpub661MyMwAqRbcGgK3VQAUd2ZjvV9vTCaJ7S47dSScsbb8JVCzjmkVQMJ1hsywDkGUEtnaVpBuM9Pijsh3391LR7j2JsF4npnzzjjCFTogrGN",
            );
        });

        test("should throw error if xpriv is invalid", () => {
            expect(() =>
                getXpub({
                    xpriv: "invalid",
                }),
            ).toThrow();
        });
    });

    describe("generateRecoveryFile", () => {
        test("should generate a valid recovery file", () => {
            const recoveryFile = generateRecoveryFile();

            expect(recoveryFile).toHaveProperty("xpriv");
            expect(typeof recoveryFile.xpriv).toBe("string");

            // Verify the xpriv is valid by deriving an xpub from it
            expect(() => getXpub(recoveryFile)).not.toThrow();
        });
    });

    describe("deriveKey", () => {
        test.each`
            index | expected
            ${0}  | ${"00042485889db2ef842eab44a3c24ea9f222e102e97b8b8df406259b70e76ea8"}
            ${1}  | ${"d57dde1dd1b283c0f233169e1ee05b68689cb425a5af2fcd920a65438fc58a38"}
            ${2}  | ${"9c429de0fdd96076dd5a6cbd881e568e8d12ecf6c7d415ff0c89381424a82819"}
        `("should derive a key at specified index", ({ index, expected }) => {
            const derivedKey = deriveKey(recoveryFile, index);

            expect(derivedKey).toBeDefined();
            expect(derivedKey.privateKey).toBeDefined();
            expect(
                ECPair.fromPrivateKey(
                    Buffer.from(derivedKey.privateKey),
                ).privateKey?.toString("hex"),
            ).toEqual(expected);
        });
    });
});
