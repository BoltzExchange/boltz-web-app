import { SwapType } from "../../src/consts/Enums";
import { Errors, validateBackupFile } from "../../src/pages/History";
import { latestStorageVersion } from "../../src/utils/migration";
import { SomeSwap } from "../../src/utils/swapCreator";

describe("History", () => {
    test.each`
        data
        ${[]}
        ${[{ id: "1" }]}
        ${[{ id: "1" }, { id: "2" }]}
    `("should validate legacy backup files", ({ data }) => {
        expect(validateBackupFile(data)).toEqual({
            version: 0,
            swaps: data,
        });
    });

    test.each`
        data
        ${{ version: 1, swaps: [] }}
        ${{ version: 1, swaps: [{ id: "taproot" }] }}
    `("should validate new backup files", ({ data }) => {
        expect(validateBackupFile(data)).toEqual(data);
    });

    test("should validate single swap refund files", () => {
        const file = { id: "asdf", type: SwapType.Chain };
        expect(validateBackupFile(file as SomeSwap)).toEqual({
            version: latestStorageVersion,
            swaps: [file],
        });
    });

    test.each`
        error                            | data
        ${Errors.InvalidBackupFile}      | ${{}}
        ${Errors.InvalidBackupFile}      | ${"test"}
        ${Errors.InvalidBackupFile}      | ${1}
        ${Errors.InvalidBackupFile}      | ${{ version: 1 }}
        ${Errors.InvalidBackupFile}      | ${{ swaps: [] }}
        ${Errors.InvalidBackupFile}      | ${{ id: "asdf" }}
        ${Errors.NotAllElementsHaveAnId} | ${{ version: 1, swaps: [{ id: null }] }}
        ${Errors.NotAllElementsHaveAnId} | ${[{}]}
        ${Errors.NotAllElementsHaveAnId} | ${[{ id: undefined }]}
        ${Errors.NotAllElementsHaveAnId} | ${[{ id: null }]}
        ${Errors.NotAllElementsHaveAnId} | ${[{ id: "1" }, { noId: "2" }]}
    `("should throw for invalid backup file: $data", ({ data, error }) => {
        expect(() => validateBackupFile(data)).toThrow(error);
    });
});
