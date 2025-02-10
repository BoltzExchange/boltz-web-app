import { migrateSwapToChainSwapFormat } from "../../src/utils/migration";
import {
    validateRecoveryFile,
    validateRefundFile,
} from "../../src/utils/refundFile";

describe("refundFile", () => {
    test.each`
        data
        ${{}}
        ${{ not: "valid" }}
    `("should throw for invalid refund files", ({ data }) => {
        expect(() => validateRefundFile(data)).toThrow("invalid refund file");
    });

    test("should accept chain swap format of refund files", () => {
        const data = {
            id: "vEtptZZKPHLS",
            bip21: "bitcoin:bcrt1pf2vm5s99zyvljzj94u8vfkezt5dhl5upmu8gktyaw4hmqesg5a6qukqnx5?amount=0.00054047&label=Send%20to%20BTC%20lightning",
            address:
                "bcrt1pf2vm5s99zyvljzj94u8vfkezt5dhl5upmu8gktyaw4hmqesg5a6qukqnx5",
            swapTree: {
                claimLeaf: {
                    version: 192,
                    output: "a9145b7b19647829c7f35a3dae9341b0748df9deb5518820482a2db89ce575fb8e6cae372abdbba22e3a4d84c4dea7f923486dcb085318eeac",
                },
                refundLeaf: {
                    version: 192,
                    output: "20ea45594a484aa75fad517b89cbdfa80e805c3e703e01a3b67dbedc96b896faf9ad028104b1",
                },
            },
            acceptZeroConf: false,
            expectedAmount: 54047,
            claimPublicKey:
                "02482a2db89ce575fb8e6cae372abdbba22e3a4d84c4dea7f923486dcb085318ee",
            timeoutBlockHeight: 1153,
            type: "submarine",
            assetSend: "BTC",
            assetReceive: "BTC",
            date: 1716899886587,
            version: 3,
            sendAmount: 54047,
            receiveAmount: 52432,
            invoice:
                "lnbcrt524320n1pn9t5pdpp5g0ncs2naeuwlcv67lpjh47apapx04rw5cq2grasz00wn90pdgasqdq5g9kxy7fqd9h8vmmfvdjscqzzsxqyz5vqsp5jgv5gtcscec294dthygen846neew82rvgalzz4xhzyq3qh3nkg6s9qyyssqtsvzq6cnvyfzlfcunc7k3ks09jmz7l8ehel2v9hryng3al8dpkljs7zh8yc88n6xq0t9u477l563j35fyznwxrk2vmhj7lffecu3ungpn4yhy4",
            refundPrivateKey:
                "096a66d99d5f12776040ccd3ac6150069275677a0af4fc358054b9084bc162f2",
        };

        expect(validateRefundFile(data)).toEqual(data);
    });

    test("should accept and migrate legacy refund files", () => {
        const data = {
            id: "uYZcNe",
            asset: "BTC",
            privateKey:
                "def0a13214538650fb84a7545c9b81128a639f55147cdd61c46d5ea0f70045a3",
            redeemScript:
                "a914dd28cc8e29bc4bcad9a23dec8002b11b7e5a99e687632103884ff511cc5061a90f07e553de127095df5d438b2bda23db4159c5f32df5e1f967022101b175210275c22382a4fb52536034e6630434b01fd94eee6b462df5cdc89901b5ef45ac2768ac",
            timeoutBlockHeight: 289,
        };

        expect(validateRefundFile(data)).toEqual({
            ...migrateSwapToChainSwapFormat(data),
            reverse: false,
        });
    });

    describe("validateRecoveryFile", () => {
        test("should accept valid recovery file", () => {
            const data = {
                xpriv: "xprv9s21ZrQH143K4CEaPNdUFtd1NTKS3jrSkD8Wq431KG49RgsrCESErYyXrdM6yoghWpesYRirK3PTnLYWYCmWjAEMB2aDX9XmKqsNznUn7v9",
            };

            expect(validateRecoveryFile(data)).toEqual(data);
        });

        test("should throw error for invalid recovery file", () => {
            const data = {
                id: "uYZcNe",
                asset: "BTC",
                privateKey:
                    "def0a13214538650fb84a7545c9b81128a639f55147cdd61c46d5ea0f70045a3",
            };

            expect(() => validateRecoveryFile(data)).toThrow(
                "invalid recovery file",
            );
        });

        test("should throw error if xpriv is invalid", () => {
            const data = {
                xpriv: "invalid",
            };

            expect(() => validateRecoveryFile(data)).toThrow();
        });
    });
});
