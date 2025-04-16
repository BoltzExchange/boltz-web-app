import { validateBackupFile } from "../../src/pages/History";
import { Errors } from "../../src/utils/rescueFile";

const mnemonic =
    "path follow autumn enough napkin manual warrior vote skate feel during humor";

describe("History", () => {
    test.each`
        data
        ${{ version: 1, swaps: [], mnemonic }}
        ${{ version: 1, swaps: [{ id: "taproot" }], mnemonic }}
    `("should validate new backup files", ({ data }) => {
        expect(validateBackupFile(data)).toEqual(data);
    });

    test.each`
        error                            | data
        ${Errors.InvalidFile}            | ${{}}
        ${Errors.InvalidFile}            | ${"test"}
        ${Errors.InvalidFile}            | ${1}
        ${Errors.InvalidFile}            | ${{ version: 1 }}
        ${Errors.InvalidFile}            | ${{ swaps: [] }}
        ${Errors.InvalidFile}            | ${{ id: "asdf" }}
        ${Errors.InvalidFile}            | ${[{}]}
        ${Errors.InvalidFile}            | ${{ version: 1, id: "asdf", swaps: [{ id: "asdf" }] }}
        ${Errors.NotAllElementsHaveAnId} | ${{ version: 1, swaps: [{ id: null }], mnemonic }}
        ${Errors.NotAllElementsHaveAnId} | ${{ version: 1, id: null, swaps: [{ id: null }], mnemonic }}
        ${Errors.NotAllElementsHaveAnId} | ${{ version: 1, id: undefined, swaps: [{ id: null }], mnemonic }}
        ${Errors.NotAllElementsHaveAnId} | ${{ version: 1, id: "", swaps: [{ id: null }], mnemonic }}
        ${Errors.InvalidMnemonic}        | ${{ version: 1, id: "asdf", swaps: [{ id: "asdf" }], mnemonic: "hello" }}
        ${Errors.InvalidMnemonic}        | ${{ version: 1, id: "asdf", swaps: [{ id: "asdf" }], mnemonic: "" }}
    `("should throw for invalid backup file: $data", ({ data, error }) => {
        expect(() => validateBackupFile(data)).toThrow(error);
    });
});
