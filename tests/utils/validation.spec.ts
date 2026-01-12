import type { Contract } from "ethers";
import log from "loglevel";

import { BTC, LBTC, LN } from "../../src/consts/Assets";
import { SwapType } from "../../src/consts/Enums";
import { decodeAddress } from "../../src/utils/compat";
import { ECPair } from "../../src/utils/ecpair";
import { validateResponse } from "../../src/utils/validation";

describe("validate responses", () => {
    const getEtherSwap = (code: string): (() => Contract) => {
        const getDeployedCode = vi.fn().mockResolvedValue(code);
        return vi.fn(() => ({
            getDeployedCode,
        })) as unknown as () => Contract;
    };

    beforeAll(() => {
        log.disableAll();
    });

    describe("normal swap", () => {
        const swapBtc = {
            assetSend: BTC,
            assetReceive: LN,
            type: SwapType.Submarine,
            sendAmount: 100540,
            expectedAmount: 100540,
            invoice:
                "lnbcrt1m1pjek2zzpp52j2wjxuvnrrxc0wxlr0fhzvumsp6r34pf9gqsnawh4rnj6uk6rksdqqcqzzsxqyz5vqsp5cav7v3r4jf04ek0rs2e68kmtfnaww0f49j5vjdk4vrhkh9dcu4ns9qyyssqrtpxz8a8f07zkmf3g4dq3l8qfje55jkvl6pv7xlvs96kagcx0yzhjgy5navzztc8knksyf4sk2hp0eg33legnjfdcptp5ajcmhjg0ugqv88q6c",
            refundPrivateKey:
                "0c3b158328907b428b26da5587365289f2d7db694a2551ca5cc181334b34f4bf",
            bip21: "bitcoin:bcrt1pp7enx7jean5tp79satht9lz7dn76kcvfmw636d3a62sr2gepj0nqtupeyc?amount=0.0010054&label=Send%20to%20BTC%20lightning",
            address:
                "bcrt1pp7enx7jean5tp79satht9lz7dn76kcvfmw636d3a62sr2gepj0nqtupeyc",
            swapTree: {
                claimLeaf: {
                    version: 192,
                    output: "a91437890f1e6054af6b288db22f5cc15a2e0af0b5ae8820cdcc8fdcd40f6f78ce600bdbec4b45b320d0d6a3331b61d1bbe986638738fb51ac",
                },
                refundLeaf: {
                    version: 192,
                    output: "206718c390c8b02d6974090ab773432f62eb3ff32f7d5f2980883d9f98cd5cf9e4ad028204b1",
                },
            },
            claimPublicKey:
                "02cdcc8fdcd40f6f78ce600bdbec4b45b320d0d6a3331b61d1bbe986638738fb51",
            acceptZeroConf: false,
            timeoutBlockHeight: 1154,
        };

        const swapLbtc = {
            assetSend: LBTC,
            assetReceive: LN,
            type: SwapType.Submarine,
            sendAmount: 100247,
            expectedAmount: 100247,
            invoice:
                "lnbcrt1m1pjek2kfpp53mcq2uav0x24smmjsn3a327jr2jt5680a7rl08w4pj2fd9j2vcssdqqcqzzsxqyz5vqsp533qwuga37e6trz45c24a98jxsusw4yw8z6zyyta5fzuhyc3w9mvs9qyyssqgjk73dqqd8u4ye9dra3ay77lhqahjvpaqp58vh9a5a8duaxge9mq2kzyfxpn2tzm3le5d83e0yqsmag9kjfugc09wr2drtddwgh00aqp7ydahu",
            refundPrivateKey:
                "e43545c13ab575b198d192ee822a83aa488a9f13a6abd352557d56fb2bf03705",
            bip21: "liquidnetwork:el1pqvc0p7zfx3m8muk93z6nz8za8mukrqf2euh0mc3fj7f4c9570tmf50kxsn8rz4u5rhngsutp9wc6umz260v9vzgh04q9u7c4l6d8xzzjr8kp8aan03qy?amount=0.00100247&label=Send%20to%20BTC%20lightning&assetid=5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225",
            address:
                "el1pqvc0p7zfx3m8muk93z6nz8za8mukrqf2euh0mc3fj7f4c9570tmf50kxsn8rz4u5rhngsutp9wc6umz260v9vzgh04q9u7c4l6d8xzzjr8kp8aan03qy",
            blindingKey:
                "39e158403dba77882d7811c7e4b24f3968910a8d01e631e10baf8edb25c603b9",
            claimPublicKey:
                "030d1e8aa07feed26486587314fea12968b9188a85d11f6886c30c3fddc2193ada",
            swapTree: {
                claimLeaf: {
                    version: 196,
                    output: "a91448ef2109c8e7c492b30cdfe4aa2a9de3415a353088200d1e8aa07feed26486587314fea12968b9188a85d11f6886c30c3fddc2193adaac",
                },
                refundLeaf: {
                    version: 196,
                    output: "2069b9b0bf0599dfe437dc9d1df926f0b83cbf02d84225ed09a676410b65ecd45dad02c727b1",
                },
            },
            acceptZeroConf: false,
            timeoutBlockHeight: 10183,
        };

        test.each`
            desc                                   | valid    | contractCode | swap
            ${"BTC invalid send amount"}           | ${false} | ${""}        | ${{ ...swapBtc, sendAmount: 12313123 }}
            ${"BTC invalid refund key"}            | ${false} | ${""}        | ${{ ...swapBtc, refundPrivateKey: "6321bb238f0678fb4c971024193f650eebe69fb891788e1af70184b2dd5d1d5f" }}
            ${"BTC invalid swap tree"}             | ${false} | ${""}        | ${{ ...swapBtc, swapTree: { claimLeaf: { version: 192, output: "a91437890f1e6054af6b288db22f5cc15a2e0af0b5ae8820cdcc8fdcd40f6f78ce600bdbec4b45b320d0d6a3331b61d1bbe986638738fb51ac" }, refundLeaf: { version: 192, output: "207718c390c8b02d6974090ab773432f62eb3ff32f7d5f2980883d9f98cd5cf9e4ad028204b1" } } }}
            ${"BTC invalid swap tree version"}     | ${false} | ${""}        | ${{ ...swapBtc, swapTree: { claimLeaf: { version: 196, output: "a91437890f1e6054af6b288db22f5cc15a2e0af0b5ae8820cdcc8fdcd40f6f78ce600bdbec4b45b320d0d6a3331b61d1bbe986638738fb51ac" }, refundLeaf: { version: 192, output: "207718c390c8b02d6974090ab773432f62eb3ff32f7d5f2980883d9f98cd5cf9e4ad028204b1" } } }}
            ${"BTC invalid claimPublicKey"}        | ${false} | ${""}        | ${{ ...swapBtc, claimPublicKey: "0256845c09bbf978cf8564e996036bfb96fc8deb49b9c83f362b5b20ca5a1c28cc" }}
            ${"BTC invalid invoice preimage hash"} | ${false} | ${""}        | ${{ ...swapBtc, invoice: "lnbcrt1m1pj87krqpp508n5tj4ur4em04k9r0lg2nwm6jy0tvta6h3zrhvtypz8srhzapgqdqqcqzzsxqyz5vqsp5admanudc6jgftclpxh0wt8tzcd3qumhjhlnnhgmw57nagygrvjas9qyyssqfpaxy85h53v4cv4merj3fequfpfy3pry5tpazupv8v2wmcnh2vu463m44pgw3zlhyj3z6mkgnuat8eyrsr0p9zgq2w6fc0gacytgsmgpr8wa3v" }}
            ${"BTC invalid invalid address"}       | ${false} | ${""}        | ${{ ...swapBtc, address: "2NGVzk8fgA8zHRkLBwkAgZKnBn3aYG6wwSx" }}
            ${"BTC invalid BIP21 amount"}          | ${false} | ${""}        | ${{ ...swapBtc, bip21: "bitcoin:bcrt1pp7enx7jean5tp79satht9lz7dn76kcvfmw636d3a62sr2gepj0nqtupeyc?amount=0.0210054&label=Send%20to%20BTC%20lightning" }}
            ${"BTC invalid BIP21 address"}         | ${false} | ${""}        | ${{ ...swapBtc, bip21: "bitcoin:bcrt1pn67yl0hqj6g2unq943y6yyheyg3pk0hn23snrq3tpz6vqz2exfsqggkv9y?amount=0.0010054&label=Send%20to%20BTC%20lightning" }}
            ${"L-BTC invalid blinding key"}        | ${false} | ${""}        | ${{ ...swapLbtc, blindingKey: "e5d35d6e263249d1defe206a41dc969df61b1b64347a655fb575421f0369b321" }}
        `(
            /*
            ${"RBTC valid"}                        | ${true}  | ${EtherSwapBytecode.object} | ${{ ...swapBtc, asset: RBTC }}
            ${"RBTC invalid send amount"}          | ${false} | ${""}                       | ${{ ...swapBtc, asset: RBTC, sendAmount: 12313123 }}
            ${"RBTC invalid contract code"}        | ${false} | ${"not correct"}            | ${{ ...swapBtc, asset: RBTC }}
        `*/
            "$desc",
            async ({ valid, contractCode, swap }) => {
                const promise = validateResponse(
                    swap,
                    () =>
                        ECPair.fromPrivateKey(
                            Buffer.from(swap.refundPrivateKey, "hex"),
                        ),
                    getEtherSwap(contractCode),
                    Buffer,
                );
                if (valid) {
                    await expect(promise).resolves.toBeUndefined();
                } else {
                    await expect(promise).rejects.toThrow();
                }
            },
        );
    });

    describe("reverse swap", () => {
        const reverseSwapBtc = {
            assetSend: LN,
            assetReceive: BTC,
            type: SwapType.Reverse,
            sendAmount: 100000,
            onchainAmount: 99295,
            receiveAmount: 99294,
            timeoutBlockHeight: 290,
            claimPrivateKey:
                "8febdccb245af0b98ea16331904db5eeec0a1e3960e310979b2f7b390917e9f6",
            preimage:
                "030487ee34943293978e8fc90e68934f6e8d5a6a9bfc78916fcf108d42a00307",
            swapTree: {
                claimLeaf: {
                    version: 192,
                    output: "82012088a91497f8b7e6d94bbc653dbe8f821fe86d9d6033ed7588208bc602b6ea0b51407bea00fc89a1fa5f115bec5ec488a8446b70fad753abafd3ac",
                },
                refundLeaf: {
                    version: 192,
                    output: "20c4360fec19c88d697622c0db14dc003e65787739e28278e39b937b9867eebdc3ad022201b1",
                },
            },
            refundPublicKey:
                "02c4360fec19c88d697622c0db14dc003e65787739e28278e39b937b9867eebdc3",
            lockupAddress:
                "bcrt1pj9serg8uxmtfgyccdx6tslcl7rev266lfjfq0rm4jr7pwyg9kp7qjjlz5l",
            invoice:
                "lnbcrt1m1pjektdwsp5j5c8cyxgvsxlff4t62kynqsxhzfap5fh4y484l5tf3t56y9c8ckqpp5tvq0q4q2nctc4hyskuu8eugce3u6jcrzrczfudfjv6nc50dkdhnsdql2djkuepqw3hjqsj5gvsxzerywfjhxucxqztfcqzyl9qxpqysgqquufuqd23c38m05kh6lrd9vdfyczfk0khvj2jkpq86d5thx6kgtx3yv8jve4u9cuwyv20dey0xsc037gq8ju47e6tnmzpm43fhafyesqn5kkjz",
        };

        const reverseSwapLbtc = {
            assetSend: LN,
            assetReceive: LBTC,
            type: SwapType.Reverse,
            sendAmount: 100000,
            onchainAmount: 99475,
            receiveAmount: 99474,
            timeoutBlockHeight: 1543,
            claimPrivateKey:
                "9ac8ebd63f3df499cd53d61eac6a09ea5f0bbc7189a9e59850fdcef5d5f4aee6",
            preimage:
                "5e6eb7f24087778773d8ed3646fde9f32d822b020c84443b0584a2a65f1d2e17",
            invoice:
                "lnbcrt1m1pjektkrsp54pffueq6u00pghx8h7r26y6k54c6ye4rhes9gt5wrds55cgyhgnspp59fmwp5ltfs7n70x2ucgz0ruch2qyh2sqdajl8wxanxkw2uqmf5pqdpz2djkuepqw3hjqnpdgf2yxgrpv3j8yetnwvxqyp2xqcqz959qxpqysgqf2v78ej87lvfwux3fn8qa5lkqfapyyrz53lj76cfnc3lf3lqpz9xrg40mugda95uweuuqftd9ycms6yx3hyl984v7zqax2auhh35wtqqg5899k",
            blindingKey:
                "16a980ee9c427345d1b9f38e7d28da12e864fc22278ca2e2da77ec431b015498",
            swapTree: {
                claimLeaf: {
                    version: 196,
                    output: "82012088a914d40658892db18c339140615b7bcdb7f5fdaedd378820e07aa2fa312fbf46bcf206c2e9b3111abee7747d79a0de0fd9a69d4fd005313cac",
                },
                refundLeaf: {
                    version: 196,
                    output: "20dc3cdf90ccd8839f9a55cdb1bfca27496fdb3724f40a1942b236bd099bdf5765ad020706b1",
                },
            },
            refundPublicKey:
                "02dc3cdf90ccd8839f9a55cdb1bfca27496fdb3724f40a1942b236bd099bdf5765",
            lockupAddress:
                "el1pq2fjp50e73xpzc6z66vwqxq087mg67gyk7fd9u7mh62k6hm0jwl0gxw0av29vjqfu8sf0s0n36vk6mrwt6usv7kmg3jn3pdaqms576avu069hpvfh7ta",
        };

        test.each`
            desc                                   | valid    | contractCode | swap
            ${"BTC invalid receive amount"}        | ${false} | ${""}        | ${{ ...reverseSwapBtc, onchainAmount: reverseSwapBtc.onchainAmount - 1 }}
            ${"BTC invalid invoice amount"}        | ${false} | ${""}        | ${{ ...reverseSwapBtc, invoice: "lnbcrt1000010n1pj8hjy9pp5ylcun2dmcl0jukwprey0sxpnm6kfurwngvqrglak8www5rm9thqqdqqcqzzsxqyz5vqsp5xas59ytzy77vr7nz3q20ekfp36pahnf7pyp5yu2q6j69s0gf2mzq9qyyssq98vhx0hwngawut2n240ye2j693qh4afptj3fx93kdxdgelhg8w4ntqj6za2txudm2t8ge649h5jcleqrrhk2ef4hymjtmly4mma07lgpru8e9j" }}
            ${"BTC invalid invoice preimage hash"} | ${false} | ${""}        | ${{ ...reverseSwapBtc, invoice: "lnbcrt1m1pj8hjyjpp53ge8f7m79de2q3e4j8amvq9jq3g0eag9vymzyd32gjw3cz3uhjfqdqqcqzzsxqyz5vqsp52vdnu0n3yh8m0sykqk4gl6h9v7l4r736z4qswm8tmahvjet6w7uq9qyyssqytl6pnuel293xmkgnu9hc5f4taekhgl023zceztzy0eugya6908p5y0txdx0p0q448uru6ecqhd78aarr0lkj95h4s7nwrymjvnkdwcq2ds4qy" }}
            ${"BTC invalid swap tree"}             | ${false} | ${""}        | ${{ ...reverseSwapBtc, swapTree: { claimLeaf: { version: 192, output: "82012088a91497f8b7e6d94bbc653dbf8f821fe86d9d6033ed7588208bc602b6ea0b51407bea00fc89a1fa5f115bec5ec488a8446b70fad753abafd3ac" }, refundLeaf: { version: 192, output: "20c4360fec19c88d697622c0db14dc003e65787739e28278e39b937b9867eebdc3ad022201b1" } } }}
            ${"BTC invalid lockupAddress"}         | ${false} | ${""}        | ${{ ...reverseSwapBtc, lockupAddress: "bcrt1qcqyj0mdse8ewusdxgm30ynsnqw4j5700vsdgm8xg0eft5rqdnpgs9ndhwx" }}
            ${"BTC invalid refundPublicKey"}       | ${false} | ${""}        | ${{ ...reverseSwapBtc, refundPublicKey: "02abfe68c69da9e1f3f3c07db115901157dfe865f5263b5b4a9d84edddb756ba2d" }}
            ${"L-BTC invalid blinding key"}        | ${false} | ${""}        | ${{ ...reverseSwapLbtc, blindingKey: "6aa614e75363a597e2fc093503856a5371ee198751a632305a434e9de72d800d" }}
        `(
            /*
            ${"RBTC valid"}                        | ${true}  | ${EtherSwapBytecode.object} | ${{ ...reverseSwapBtc, asset: RBTC }}
            ${"RBTC invalid contract code"}        | ${false} | ${"not correct"}            | ${{ ...reverseSwapBtc, asset: RBTC }}
        */
            "$desc",
            async ({ valid, contractCode, swap }) => {
                const contract = getEtherSwap(contractCode);
                const promise = validateResponse(
                    swap,
                    () =>
                        ECPair.fromPrivateKey(
                            Buffer.from(swap.claimPrivateKey, "hex"),
                        ),
                    contract,
                    Buffer,
                );
                if (valid) {
                    await expect(promise).resolves.toBeUndefined();
                } else {
                    await expect(promise).rejects.toThrow();
                }
            },
        );
    });
});

describe("validate onchain addresses", () => {
    test.each`
        asset   | address
        ${BTC}  | ${"moEsJRFF6y3d5oSjHj6GBocVPw2GEeQ6WY"}
        ${BTC}  | ${"bcrt1q78qtnjrt53gauk6h2w32wane62jjg2gvval6w5"}
        ${LBTC} | ${"XaGQJMVzMDn7DNwKtRA9fJVEVkxVE1FjgW"}
        ${LBTC} | ${"2dsdhiFYQADKEEkcdafMXcGtSL96HSmsr16"}
        ${LBTC} | ${"CTEr9psVs76yrPL9PNrcSNx3Es1tC4EyboR4rtXYJguB6oFZWAUy3Kw7jSLTLee3xoiZc3fjsCi93Kfg"}
        ${LBTC} | ${"AzpoeCb1nyd1D3SWHCvDJsbYDPtA6ith4uGRYz9RdjHttsDG7HhCrshphLYtApYBtzxy6rsXYZeS9h6a"}
        ${LBTC} | ${"ert1q4k67l66z0nwgcsgzw20638cpm75d6tpl4f4vyrp76fnnutn0ulvqwe7ahr"}
        ${LBTC} | ${"el1qqdmeywy40z2aasvaydsnmgqqqcgk92cvd9p9h4mpeh2x83dy79mhltd4al45ylxu33qsyu5l4z0srhagm5krl2n2cgxra5n88chxle7ctnpml5s983jr"}
    `("should validate $address", ({ asset, address }) => {
        decodeAddress(asset, address);
    });

    test.each`
        asset   | address
        ${LBTC} | ${"VJL8BMWCv7HUq4dgCBJAQA1gHTWibWXPTjP1vXF92doTmpnD7a6b24t7epT3fXNi8nJfW2vYdLLf15vo"}
        ${LBTC} | ${"ex1qdy58yy5vu4uq9yfwrnrhakhljnsx5zd4exs094"}
        ${LBTC} | ${"lq1qqwdhep7uhzuav78mteywmt6h4lqeu6mq952kj92jvm6t2j3jz2w9j6fgwgfgeetcq2gju8x80md0l98qdgym2cakgvj5qlgjh"}
    `("should throw $address", ({ asset, address }) => {
        expect(() => decodeAddress(asset, address)).toThrow();
    });
});
