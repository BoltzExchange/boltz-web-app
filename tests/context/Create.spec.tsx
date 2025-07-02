import { render } from "@solidjs/testing-library";

import { BTC, LBTC, LN, RBTC } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import { TestComponent, contextWrapper, signals } from "../helper";

describe("signals", () => {
    test.each`
        assetSend | assetReceive | expected
        ${LN}     | ${BTC}       | ${SwapType.Reverse}
        ${LBTC}   | ${LN}        | ${SwapType.Submarine}
        ${BTC}    | ${LBTC}      | ${SwapType.Chain}
    `(
        "should set swap_type to $expected based on $assetSend > $assetReceive",
        ({ assetSend, assetReceive, expected }) => {
            render(() => <TestComponent />, { wrapper: contextWrapper });
            signals.setAssetSend(assetSend);
            signals.setAssetReceive(assetReceive);
            expect(signals.swapType()).toEqual(expected);
        },
    );

    test.each`
        assetSend | assetReceive | addressValid | invoiceValid | valid
        ${LN}     | ${BTC}       | ${true}      | ${false}     | ${true}
        ${BTC}    | ${LN}        | ${false}     | ${true}      | ${true}
        ${BTC}    | ${LN}        | ${false}     | ${false}     | ${false}
        ${BTC}    | ${LBTC}      | ${false}     | ${false}     | ${false}
        ${BTC}    | ${LBTC}      | ${true}      | ${false}     | ${true}
    `(
        "should set valid to $valid based on $assetSend > $assetReceive",
        ({ assetSend, assetReceive, addressValid, invoiceValid, valid }) => {
            render(() => <TestComponent />, { wrapper: contextWrapper });
            signals.setAmountValid(true);
            signals.setAddressValid(addressValid);
            signals.setInvoiceValid(invoiceValid);
            signals.setAssetSend(assetSend);
            signals.setAssetReceive(assetReceive);
            expect(signals.valid()).toEqual(valid);
        },
    );

    test.each`
        sendAsset | receiveAsset | amount
        ${BTC}    | ${LBTC}      | ${1000000}
        ${BTC}    | ${RBTC}      | ${0}
        ${LN}     | ${RBTC}      | ${1000000}
        ${LN}     | ${BTC}       | ${0}
        ${LBTC}   | ${LN}        | ${1000000}
        ${LBTC}   | ${BTC}       | ${0}
        ${RBTC}   | ${BTC}       | ${1000000}
        ${RBTC}   | ${LN}        | ${0}
    `(
        "should set assets $sendAsset > $receiveAsset based on urlParams",
        ({ sendAsset, receiveAsset, amount }) => {
            vi.spyOn(URLSearchParams.prototype, "get").mockImplementation(
                (key) => {
                    if (key === "sendAsset") return sendAsset as string;
                    if (key === "receiveAsset") return receiveAsset as string;
                    if (key === "sendAmount") return amount as string;
                    return null;
                },
            );

            render(() => <TestComponent />, { wrapper: contextWrapper });

            expect(signals.assetSend()).toEqual(sendAsset);
            expect(signals.assetReceive()).toEqual(receiveAsset);
            expect(Number(signals.sendAmount())).toEqual(amount);
        },
    );

    test.each`
        receiveAsset | destination                                                                                                | expectedReceiveAsset
        ${BTC}       | ${"test@lnurl.com"}                                                                                        | ${LN}
        ${LBTC}      | ${"bcrt1qgzzhsnvstqjd5nyr0u6fz706up6ap0jy4ajs3x"}                                                          | ${BTC}
        ${BTC}       | ${"el1qqd60krw3zqwdg97gs4skuqjf05lgf6jht3w8fsg0hyhtyv203yqnjuhnd96t0an6nz8e35n0ndqh0rvmaq5g7dj999pl26nwr"} | ${LBTC}
    `(
        "should have destination taking precedence over receiveAsset",
        ({ receiveAsset, destination, expectedReceiveAsset }) => {
            vi.spyOn(URLSearchParams.prototype, "get").mockImplementation(
                (key) => {
                    if (key === "receiveAsset") return receiveAsset as string;
                    if (key === "destination") return destination as string;
                    return null;
                },
            );

            render(() => <TestComponent />, { wrapper: contextWrapper });

            expect(signals.assetReceive()).toEqual(expectedReceiveAsset);
            if (expectedReceiveAsset === LN) {
                expect(signals.invoiceValid()).toEqual(true);
            } else {
                expect(signals.addressValid()).toEqual(true);
            }
        },
    );
});
