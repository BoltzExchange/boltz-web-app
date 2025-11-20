import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import InvoiceInput from "../../src/components/InvoiceInput";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { extractInvoice, invoicePrefix } from "../../src/utils/invoice";
import { TestComponent, contextWrapper, signals } from "../helper";

vi.mock("../../src/utils/invoice", async () => {
    const actual = await vi.importActual("../../src/utils/invoice");
    return {
        ...actual,
        isBolt12Offer: vi.fn((offer: string) => {
            return Promise.resolve(offer.startsWith("lno1"));
        }),
    };
});

vi.mock("../../src/utils/validation", async () => {
    const actual = await vi.importActual("../../src/utils/validation");
    return {
        ...actual,
        validateInvoice: vi.fn((inputValue: string) => {
            if (inputValue.startsWith("ln")) {
                return Promise.resolve(1000);
            }
            return Promise.reject(new Error("invalid_invoice"));
        }),
    };
});

vi.mock("../../src/utils/compat", async () => {
    const actual = await vi.importActual("../../src/utils/compat");
    return {
        ...actual,
        probeUserInput: vi.fn((expectedAsset: string, input: string) => {
            if (!input || input.length === 0) {
                return Promise.resolve(null);
            }
            if (
                input.startsWith("bc1") ||
                input.startsWith("bcrt1") ||
                input.startsWith("tb1")
            ) {
                return Promise.resolve(BTC);
            }
            if (
                input.startsWith("el1") ||
                input.startsWith("ert1") ||
                input.startsWith("ex1")
            ) {
                return Promise.resolve(LBTC);
            }
            if (
                expectedAsset !== "" &&
                expectedAsset === LN &&
                input.length > 0
            ) {
                return Promise.resolve(LN);
            }
            return Promise.resolve(null);
        }),
    };
});

describe("InvoiceInput", () => {
    test.each`
        expected | invoice
        ${false} | ${"m@some.domain"}
        ${false} | ${"lnurl1dp68gurn8ghj7mrww4exctndd93ksct9dscnqvf39eshgtmpwp5j7mrww4excuqgy84zh"}
        ${false} | ${"invalid"}
        ${false} | ${""}
    `("should validate invoice $invoice", async ({ invoice, expected }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);
        fireEvent.input(await screen.findByTestId("invoice"), {
            target: { value: invoice },
        });

        await waitFor(() => {
            expect(signals.invoiceValid()).toEqual(expected);
        });
    });

    test.each`
        lnurl
        ${"m@some.domain"}
        ${"lnurl1dp68gurn8ghj7mrww4exctndd93ksct9dscnqvf39eshgtmpwp5j7mrww4excuqgy84zh"}
    `("should not clear lnurl $lnurl on amount change", async ({ lnurl }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(input, {
            target: { value: lnurl },
        });

        await waitFor(() => {
            expect(signals.lnurl()).toEqual(lnurl.toLowerCase());
        });

        signals.setSendAmount(signals.sendAmount().plus(1));

        expect(input.value).toEqual(lnurl);
    });

    test.each`
        lnurl
        ${`${invoicePrefix}m@some.domain`}
        ${`${invoicePrefix}lnurl1dp68gurn8ghj7mrww4exctndd93ksct9dscnqvf39eshgtmpwp5j7mrww4excuqgy84zh`}
    `("should remove prefix of lnurl $lnurl", async ({ lnurl }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );
        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        const input = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(input, {
            target: { value: lnurl },
        });

        await waitFor(() => {
            expect(signals.lnurl()).toEqual(extractInvoice(lnurl));
        });
    });

    test.each`
        asset   | input
        ${BTC}  | ${"bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3"}
        ${LBTC} | ${"el1qq2yjqfz9evc3c5m0rzw0cdtfcdfl5kmcf9xsskpsgza34zhezxzq7y6y4dnldxhtd935k8dn63n8cywy3jlzuvftycsmytjmu"}
    `("should switch asset based on input $input", async ({ asset, input }) => {
        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );

        const invoiceInput = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(invoiceInput, {
            target: { value: input },
        });

        await waitFor(() => {
            expect(signals.assetSend()).toEqual(LN);
            expect(signals.assetReceive()).toEqual(asset);
        });
        expect(signals.onchainAddress()).toEqual(input);
    });

    test.each`
        parameter      | bip21Uri                                                                                                                                                                                                                                                                                                                                                                                                                          | expectedValue
        ${"lightning"} | ${"bitcoin:bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lightning=lnbcrt4294u1pjlmqy7pp5g9tj83k3k54ajzktdv8dq5nqsc8336j4f0v3wphq37x8hklntsxsdqqcqzzsxqyz5vqsp53qupg459fzdhajwjmzs8vd3elge0rmkzkmrmnpeuwy6kme47ns4q9qyyssqvncgzrmmghmtxu9m7wvw0yvtgckz4078xwam7exjpka2c89ga0y3jenhv6hhzuccj9hkl7a7f20nuslh3wqa4lfduq76ycxaf3w56zcq32d5fv"} | ${"lnbcrt4294u1pjlmqy7pp5g9tj83k3k54ajzktdv8dq5nqsc8336j4f0v3wphq37x8hklntsxsdqqcqzzsxqyz5vqsp53qupg459fzdhajwjmzs8vd3elge0rmkzkmrmnpeuwy6kme47ns4q9qyyssqvncgzrmmghmtxu9m7wvw0yvtgckz4078xwam7exjpka2c89ga0y3jenhv6hhzuccj9hkl7a7f20nuslh3wqa4lfduq76ycxaf3w56zcq32d5fv"}
        ${"lno"}       | ${"bitcoin:bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lno=lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c"}                                                                                                                                                      | ${"lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c"}
    `(
        "should extract $parameter from BIP21 URI",
        async ({ bip21Uri, expectedValue, parameter }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <InvoiceInput />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAssetSend(BTC);
            signals.setAssetReceive(LN);

            const invoiceInput = (await screen.findByTestId(
                "invoice",
            )) as HTMLTextAreaElement;

            fireEvent.input(invoiceInput, {
                target: { value: bip21Uri },
            });

            if (parameter === "lightning") {
                await waitFor(() => {
                    expect(signals.invoice()).toEqual(expectedValue);
                    expect(signals.invoiceValid()).toEqual(true);
                });
            } else {
                await waitFor(() => {
                    expect(signals.bolt12Offer()).toEqual(expectedValue);
                    expect(signals.invoice()).toEqual(expectedValue);
                });
            }
        },
    );

    test("should extract lno from BIP21 URI without address", async () => {
        const bip21Uri =
            "bitcoin:?lno=lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c";
        const expectedBolt12Offer =
            "lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c";

        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );

        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        const invoiceInput = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(invoiceInput, {
            target: { value: bip21Uri },
        });

        await waitFor(() => {
            expect(signals.bolt12Offer()).toEqual(expectedBolt12Offer);
            expect(signals.invoice()).toEqual(expectedBolt12Offer);
        });
    });

    test("should extract address from BIP21 URI and switch to on-chain", async () => {
        const bip21Uri = "bitcoin:bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm";
        const expectedAddress = "bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm";

        render(
            () => (
                <>
                    <TestComponent />
                    <InvoiceInput />
                </>
            ),
            { wrapper: contextWrapper },
        );

        signals.setAssetSend(BTC);
        signals.setAssetReceive(LN);

        const invoiceInput = (await screen.findByTestId(
            "invoice",
        )) as HTMLTextAreaElement;

        fireEvent.input(invoiceInput, {
            target: { value: bip21Uri },
        });

        await waitFor(() => {
            expect(signals.onchainAddress()).toEqual(expectedAddress);
            expect(signals.assetReceive()).toEqual(BTC);
        });
    });
});
