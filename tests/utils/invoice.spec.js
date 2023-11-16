import { describe, expect } from "vitest";
import bolt11 from "bolt11";
import {
    getExpiryEtaHours,
    decodeInvoice,
    isLnurl,
    trimLightningPrefix,
    maxExpiryHours,
} from "../../src/utils/invoice";

describe("invoice", () => {
    test.each`
        data                                                                             | expected
        ${"m@lnurl.some.domain"}                                                         | ${true}
        ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"} | ${true}
        ${"lnurl.some.domain"}                                                           | ${false}
        ${"LNURL1DP6fasdklfjasdf"}                                                       | ${false}
    `(
        "should determine if $data is lnurl ($expected)",
        ({ data, expected }) => {
            expect(isLnurl(data)).toEqual(expected);
        },
    );

    test("should trim lightning: prefix of invoices", () => {
        const invoice = "lnbcrt4986620n1pjgkj07pp5zl";

        expect(trimLightningPrefix(invoice)).toEqual(invoice);
        expect(trimLightningPrefix(`lightning:${invoice}`)).toEqual(invoice);
        expect(trimLightningPrefix(`LIGHTNING:${invoice}`)).toEqual(invoice);
    });

    describe("decode invoices", () => {
        test.each`
            network      | invoice
            ${"regtest"} | ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
            ${"testnet"} | ${"lntb4573450n1pj8hfnmsp58erxc4m9u09frqkalhw5udgvghvm27wewl99d7z3hjftgwtt234qpp572p5y0tplt70txw35kzypsef4mg2pwp5u0ej9hx8tse6f2rcvrjsdq5g9kxy7fqd9h8vmmfvdjsxqyjw5qcqp2rzjq0cxp9fmaadhwlw80ez2lgu9n5pzlsd803238r0tyv4dwf27s6wqqfggesqqqfqqqyqqqqlgqqqqqqgq9q9qyysgqw4msvmfgakcmxkglwnj7qgp6hlupefstyzhkld0uxlx3gdncnzw385c5qy6ng2qh59rtttktjzy8l43gzv3n9u6du64z2xu0mdz377splwf2qy"}
            ${"mainnet"} | ${"lnbc678450n1pj8hf4kpp5kxh4x93kvxt43q0k0q6t3fp6gfhgusqxsajj6lcexsrg4lzm7rrqdq5g9kxy7fqd9h8vmmfvdjscqzzsxqyz5vqsp5n4rzwr2lzw68082ws4tjjerp2t5eluny75xx54jr530x073tvvzs9qyyssq3f43e2mzqx07zzt529ux480nj00908p3u5qdwhyuk3qrcepaqsjxqjhcnfde4ta74c3dkxkhwscxfhdm5v0y7qh7np22v9xc220taacqjanm3m"}
        `("should decode $network invoices", ({ invoice }) => {
            expect(decodeInvoice(invoice)).toMatchSnapshot();
        });
    });

    describe("Expiry Eta hours", () => {
        test.each`
            invoice
            ${"lnbcrt623210n1pj8hfdspp5mhcxq3qgzn779zs0c02na32henclzt55uga68kck6tknyw0y59qsdqqcqzzsxqyz5vqsp54wll9s5jphgcjqzpnamqeszvfdz937pjels2cqr84pltjsqv2asq9qyyssq49028nqec7uz5vk73peg5a4fkxhltw90kkmupfradjp0sus6g5zxs6njedk8ml3qgdls3dfjfvd7z3py5qgst9fnzz5pwcr5564sf6sqtrlfzz"}
        `("should decode eta time expired", ({ invoice }) => {
            expect(getExpiryEtaHours(invoice)).toEqual(0);
        });

        test("expiry eta in 12 hours", () => {
            const now = new Date() / 1000;
            const hours = 12;
            const hours_timestamp = hours * 60 * 60;
            var encoded = bolt11.encode({
                satoshis: 2000,
                timestamp: now,
                tags: [
                    {
                        tagName: "payment_hash",
                        data: "0001020304050607080900010203040506070809000102030405060708090102",
                    },
                    {
                        tagName: "expire_time",
                        data: hours_timestamp,
                    },
                ],
            });
            // sign takes the encoded object and the private key as arguments
            var privateKeyHex =
                "e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734";
            var signed = bolt11.sign(encoded, privateKeyHex);
            expect(getExpiryEtaHours(signed.paymentRequest)).toEqual(hours);
        });

        test("expiry eta greater than 24 hours", () => {
            const now = new Date() / 1000;
            const hours = 24;
            const hours_timestamp = hours * 60 * 60;
            var encoded = bolt11.encode({
                satoshis: 2000,
                timestamp: now,
                tags: [
                    {
                        tagName: "payment_hash",
                        data: "0001020304050607080900010203040506070809000102030405060708090102",
                    },
                    {
                        tagName: "expire_time",
                        data: hours_timestamp,
                    },
                ],
            });
            // sign takes the encoded object and the private key as arguments
            var privateKeyHex =
                "e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734";
            var signed = bolt11.sign(encoded, privateKeyHex);
            expect(getExpiryEtaHours(signed.paymentRequest)).toEqual(
                maxExpiryHours,
            );
        });
    });
});
