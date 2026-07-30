import { BigNumber } from "bignumber.js";
import type { ChainPairTypeTaproot } from "boltz-swaps/client";
import { SwapType } from "boltz-swaps/types";
import { liquidUnconfidentialClaimExtra } from "boltz-swaps/utxo";

import { BTC, LBTC } from "../../src/consts/Assets";
import { calculateSendAmount } from "../../src/utils/calculate";
import { magicRoutingHintAmounts } from "../../src/utils/magicRoutingHint";

const unconfidential = "ert1q0k9g02evldg5eylnd8lrch0awd05u89p9len8l";
const confidential =
    "el1qqgept38a77emd94r554av0ptj4eelxnx5z9wekxmynd2qe4wvunhylv2s74je763fjflx60783wl6u6lfcw2zjc5pm5n3gq32";

const chainPair = {
    fees: {
        percentage: 0.1,
        minerFees: { server: 150, user: { claim: 143, lockup: 152 } },
    },
} as ChainPairTypeTaproot;

const bip21AmountSats = BigNumber(100_000);

const expectedSendAmount = (receiveAmount: BigNumber) =>
    calculateSendAmount(
        receiveAmount,
        chainPair.fees.percentage,
        chainPair.fees.minerFees.server + chainPair.fees.minerFees.user.claim,
        SwapType.Chain,
    );

describe("magicRoutingHintAmounts", () => {
    test("requests the surcharge on top of the invoiced amount", () => {
        const amounts = magicRoutingHintAmounts(
            chainPair,
            bip21AmountSats,
            LBTC,
            unconfidential,
        );

        expect(amounts.surcharge).toEqual(liquidUnconfidentialClaimExtra);
        expect(amounts.receiveAmount).toEqual(
            bip21AmountSats.plus(liquidUnconfidentialClaimExtra),
        );
        expect(amounts.sendAmount).toEqual(
            expectedSendAmount(amounts.receiveAmount),
        );
    });

    test.each`
        name               | asset   | address
        ${"confidential"}  | ${LBTC} | ${confidential}
        ${"a BTC address"} | ${BTC}  | ${"bcrt1qxyz"}
    `("charges nothing for $name", ({ asset, address }) => {
        const amounts = magicRoutingHintAmounts(
            chainPair,
            bip21AmountSats,
            asset,
            address,
        );

        expect(amounts.surcharge).toEqual(0);
        expect(amounts.receiveAmount).toEqual(bip21AmountSats);
        expect(amounts.sendAmount).toEqual(expectedSendAmount(bip21AmountSats));
    });
});
