import { networks } from "bitcoinjs-lib";
import { networks as LiquidNetworks } from "liquidjs-lib";

import { BTC, LBTC } from "../../src/consts";
import { getNetwork } from "../../src/utils/compat";

describe("parse network correctly", () => {
    test.each`
        asset   | network      | expected
        ${BTC}  | ${"mainnet"} | ${networks.bitcoin}
        ${BTC}  | ${"testnet"} | ${networks.testnet}
        ${BTC}  | ${"regtest"} | ${networks.regtest}
        ${LBTC} | ${"mainnet"} | ${LiquidNetworks.liquid}
        ${LBTC} | ${"testnet"} | ${LiquidNetworks.testnet}
        ${LBTC} | ${"regtest"} | ${LiquidNetworks.regtest}
    `("$asset $network", ({ asset, network, expected }) => {
        expect(getNetwork(asset, network)).toEqual(expected);
    });
});
