import { render } from "@solidjs/testing-library";

import { BTC, LBTC, LN } from "../../src/consts/Assets";
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
});
