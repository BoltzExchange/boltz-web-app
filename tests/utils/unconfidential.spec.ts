import { SwapType } from "boltz-swaps/types";
import { liquidUnconfidentialClaimExtra } from "boltz-swaps/utxo";

import { BTC, LBTC } from "../../src/consts/Assets";
import type { SomeSwap } from "../../src/utils/swapCreator";
import {
    claimSurchargeForAddress,
    claimSurchargeForSwap,
} from "../../src/utils/unconfidential";

const unconfidential = "ert1q0k9g02evldg5eylnd8lrch0awd05u89p9len8l";
const confidential =
    "el1qqgept38a77emd94r554av0ptj4eelxnx5z9wekxmynd2qe4wvunhylv2s74je763fjflx60783wl6u6lfcw2zjc5pm5n3gq32";

describe("claimSurchargeForAddress", () => {
    test.each`
        asset   | address             | expected
        ${LBTC} | ${unconfidential}   | ${liquidUnconfidentialClaimExtra}
        ${LBTC} | ${confidential}     | ${0}
        ${LBTC} | ${undefined}        | ${0}
        ${LBTC} | ${""}               | ${0}
        ${LBTC} | ${"not-an-address"} | ${0}
        ${BTC}  | ${"bcrt1qxyz"}      | ${0}
    `(
        "is $expected for $asset and $address",
        ({ asset, address, expected }) => {
            expect(claimSurchargeForAddress(asset, address)).toEqual(expected);
        },
    );
});

describe("claimSurchargeForSwap", () => {
    const swap = (extra: Record<string, unknown>) =>
        ({
            type: SwapType.Reverse,
            assetReceive: LBTC,
            claimAddress: unconfidential,
            blindingKey: "00".repeat(32),
            ...extra,
        }) as unknown as SomeSwap;

    test("charges an unconfidential destination", () => {
        expect(claimSurchargeForSwap(swap({}))).toEqual(
            liquidUnconfidentialClaimExtra,
        );
    });

    test("reads the lockup blinding key of a chain swap", () => {
        expect(
            claimSurchargeForSwap(
                swap({
                    type: SwapType.Chain,
                    blindingKey: undefined,
                    claimDetails: { blindingKey: "00".repeat(32) },
                }),
            ),
        ).toEqual(liquidUnconfidentialClaimExtra);
    });

    // No blinded input means boltz-core adds no OP_RETURN
    test("does not charge without a lockup blinding key", () => {
        expect(claimSurchargeForSwap(swap({ blindingKey: undefined }))).toEqual(
            0,
        );
    });

    test("does not charge a submarine swap", () => {
        expect(
            claimSurchargeForSwap(swap({ type: SwapType.Submarine })),
        ).toEqual(0);
    });
});
