import { fetchLnurlInvoice } from "../../src/utils/invoice";

describe("fetchLnurlInvoice", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ pr: "invoicePlaceholder" }),
                }),
            ),
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test.each([
        {
            callback: "https://example.com/lnurl",
            amount: 1000,
            expectedUrl: "https://example.com/lnurl?amount=1000",
        },
        {
            callback: "https://example.com/lnurl?",
            amount: 500,
            expectedUrl: "https://example.com/lnurl?amount=500",
        },
        {
            callback: "https://example.com/lnurl?a=1",
            amount: 250,
            expectedUrl: "https://example.com/lnurl?a=1&amount=250",
        },
    ])(
        "should correctly construct URL and fetch invoice for callback=$callback",
        async ({ callback, amount, expectedUrl }) => {
            const data = {
                callback,
                minSendable: 1,
                maxSendable: 1000000,
                tag: "payRequest",
            };
            const result = await fetchLnurlInvoice(amount, data);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(expectedUrl);
            expect(result).toEqual("invoicePlaceholder");
        },
    );
});
