import { FetchStatus } from "../../src/consts/Enums";

describe("Enums", () => {
    test("exposes the fetch status values", () => {
        expect(FetchStatus.Ok).toBe("ok");
        expect(FetchStatus.Loading).toBe("loading");
        expect(FetchStatus.Error).toBe("error");
    });
});
