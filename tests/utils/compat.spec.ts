import { Networks } from "boltz-core";
import { networks as LiquidNetworks } from "liquidjs-lib";

import { config as runtimeConfig } from "../../src/config";
import { config as mainnetConfig } from "../../src/configs/mainnet";
import { BTC, LBTC, LN, RBTC } from "../../src/consts/Assets";
import {
    getNetwork,
    isConfidentialAddress,
    probeUserInput,
} from "../../src/utils/compat";

const originalAssets = structuredClone(runtimeConfig.assets ?? {});

beforeAll(() => {
    runtimeConfig.assets = {
        ...runtimeConfig.assets,
        "USDC-SOL": structuredClone(mainnetConfig.assets!["USDC-SOL"]),
        "USDT0-TRON": structuredClone(mainnetConfig.assets!["USDT0-TRON"]),
    };
});

afterAll(() => {
    runtimeConfig.assets = originalAssets;
});

describe("parse network correctly", () => {
    test.each`
        asset   | network      | expected
        ${BTC}  | ${"mainnet"} | ${Networks.bitcoin}
        ${BTC}  | ${"testnet"} | ${Networks.testnet}
        ${BTC}  | ${"regtest"} | ${Networks.regtest}
        ${LBTC} | ${"mainnet"} | ${LiquidNetworks.liquid}
        ${LBTC} | ${"testnet"} | ${LiquidNetworks.testnet}
        ${LBTC} | ${"regtest"} | ${LiquidNetworks.regtest}
    `("$asset $network", ({ asset, network, expected }) => {
        expect(getNetwork(asset, network)).toEqual(expected);
    });

    test.each`
        asset   | input
        ${BTC}  | ${"bcrt1q6agtc4dnjvly869zcgad6u6q2caccvpx83n8ad"}
        ${BTC}  | ${"2NDkcnHAnugU1aQ5bv522MeZTgv6tQs2rt8"}
        ${BTC}  | ${"mpSn4rFm3zmDesvNi2N2Fp86ae3wSFAUG4"}
        ${LBTC} | ${"el1qq2yjqfz9evc3c5m0rzw0cdtfcdfl5kmcf9xsskpsgza34zhezxzq7y6y4dnldxhtd935k8dn63n8cywy3jlzuvftycsmytjmu"}
        ${LBTC} | ${"AzppAMAawpcRLuVGJVec1EmDQPubCprhC8wTrKvLeYC9s73W4jpGN1sDaKs76y5ndvJ1k8ZBcNm8gtxo"}
        ${LBTC} | ${"CTEwXiS8q9to1ES8GifsLYkiv2FKmuMKMeHAiiyumH5DJzowybcEaAUyYtENoG9EKzgapFP3FhoMpbHs"}
        ${LBTC} | ${"ert1qzdz2kelknt4kjc6trkeagenuz8zge03wc88dqw"}
        ${LBTC} | ${"XRPsyVYUGJpRhwoBLZAoqSdxLLqvdyoNN9"}
        ${LBTC} | ${"2ddhmWyNVftuDm6o23hL8pxvmmCQUH2pN96"}
        ${LN}   | ${"lnbcrt4294u1pjlmqy7pp5g9tj83k3k54ajzktdv8dq5nqsc8336j4f0v3wphq37x8hklntsxsdqqcqzzsxqyz5vqsp53qupg459fzdhajwjmzs8vd3elge0rmkzkmrmnpeuwy6kme47ns4q9qyyssqvncgzrmmghmtxu9m7wvw0yvtgckz4078xwam7exjpka2c89ga0y3jenhv6hhzuccj9hkl7a7f20nuslh3wqa4lfduq76ycxaf3w56zcq32d5fv"}
        ${LN}   | ${"LNURL1DP68GURN8GHJ7MRWW4EXCTNDD93KSCT9DSCNQVF39ESHGTMPWP5J7MRWW4EXCUQGY84ZH"}
        ${LN}   | ${"admin@bol.tz"}
    `("should probe user input for $input", ({ input, asset }) => {
        for (const expectedAsset of ["", BTC, LBTC, LN]) {
            expect(probeUserInput(expectedAsset, input)).toEqual(asset);
        }
    });

    test.each`
        asset           | input
        ${RBTC}         | ${"0xd8da6bf26964af9d7eed9e03e53415d37aa96045"}
        ${"USDC-SOL"}   | ${"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
        ${"USDT0-TRON"} | ${"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"}
    `(
        "should probe user input for $asset address $input",
        ({ asset, input }) => {
            expect(probeUserInput(asset, input)).toEqual(asset);
            for (const otherAsset of [BTC, LBTC, LN, ""]) {
                expect(probeUserInput(otherAsset, input)).toEqual(null);
            }
        },
    );

    test.each`
        asset           | input
        ${RBTC}         | ${"bcrt1q6agtc4dnjvly869zcgad6u6q2caccvpx83n8ad"}
        ${"USDC-SOL"}   | ${"bcrt1q6agtc4dnjvly869zcgad6u6q2caccvpx83n8ad"}
        ${"USDT0-TRON"} | ${"bcrt1q6agtc4dnjvly869zcgad6u6q2caccvpx83n8ad"}
    `(
        "should auto-detect BTC when $asset destination receives BTC address",
        ({ asset, input }) => {
            expect(probeUserInput(asset, input)).toEqual(BTC);
        },
    );

    test.each`
        addr                                                                                                       | expected
        ${"el1qqtwazfjrctweqy8lzg4k7as5y2c5ea3dqnvgqmrzd6s8yvmftn8v65cj0gl3pwrjmwex2vl7erry069tnl6l2u5junx22mnra"} | ${true}
        ${"ert1q2vf850cshpedhvn9x0lv33j8az4ela04afuzp0"}                                                           | ${false}
    `(
        "should detect if Liquid address $addr is confidential",
        ({ addr, expected }) => {
            expect(isConfidentialAddress(addr)).toEqual(expected);
        },
    );
});
