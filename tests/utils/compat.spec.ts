import { BTC, LBTC } from "../../src/consts";
import { probeAddress } from "../../src/utils/compat";

describe("compat", () => {
    test.each`
        address                                  | asset
        ${"bcrt1asda"}                           | ${BTC}
        ${"bc1asda"}                             | ${BTC}
        ${"tb1asda"}                             | ${BTC}
        ${"lq1asda"}                             | ${LBTC}
        ${"ex1asda"}                             | ${LBTC}
        ${"tlq1asd"}                             | ${LBTC}
        ${"tex1asd"}                             | ${LBTC}
        ${"el1asda"}                             | ${LBTC}
        ${"ert1asda"}                            | ${LBTC}
        ${"2N17VNGbi4yUHtkD7vhrc8cpi9JGVmC8scn"} | ${BTC}
        ${"XUWfSHgUE1G72X9oGHXfecgzgf1N5A7WD2"}  | ${LBTC}
    `("should probe $address as $asset", ({ address, asset }) => {
        const result = probeAddress(address);
        expect(result).toBe(asset);
    });
});
