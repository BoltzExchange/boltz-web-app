import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, test, vi } from "vitest";

import AddressInput from "../../src/components/AddressInput";
import { BTC, LBTC } from "../../src/consts";
import t from "../../src/i18n";
import * as signals from "../../src/signals";

describe("AddressInput", () => {
    test.each`
        valid    | network | address
        ${true}  | ${BTC}  | ${"mv5v8C3e1SySwqe6r2fq9Fh6DbZr8ddjsX"}
        ${true}  | ${BTC}  | ${"2N17VNGbi4yUHtkD7vhrc8cpi9JGVmC8scn"}
        ${true}  | ${BTC}  | ${"bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3"}
        ${true}  | ${BTC}  | ${"bcrt1pjyk4csn4nd4apwqy8s2p5kj5kywtrwzejtjalz3sufeljsycxw3qgrstgd"}
        ${false} | ${BTC}  | ${"02d96eadea3d780104449aca5c93461ce67c1564e2e1d73225fa67dd3b997a6018"}
        ${false} | ${LBTC} | ${"bcrt1pjyk4csn4nd4apwqy8s2p5kj5kywtrwzejtjalz3sufeljsycxw3qgrstgd"}
        ${true}  | ${LBTC} | ${"CTEyTteD4cQg2NfF1yGWUU1rWSDC8sKHrj5BZJzr8kzyKFXwNCJ8VyDhi45Q98KdSf3jeTkbjJy18JkP"}
        ${true}  | ${LBTC} | ${"AzpjfmC41JpC6ieu3odwFBqtF4isFeY8RHv1e699EM2RgiyHd49og66a8qLLMDrhL8pCLeWAxJat1ebD"}
        ${true}  | ${LBTC} | ${"el1qqt7nl8pw6278yxv38fezzw8lmqh40prpusfurcvsh2xn3sl0pvnz3whllcapdnxcxn2u0wumpu7u2u6anh2juvmz7spx6snmn"}
        ${true}  | ${LBTC} | ${"2do9j7MdMJSVKWosUmcLzhoR8E5mhabtUju"}
        ${true}  | ${LBTC} | ${"XUWfSHgUE1G72X9oGHXfecgzgf1N5A7WD2"}
        ${true}  | ${LBTC} | ${"ert1qhtlluwskenvrf4w8hwds70w9wdwem4fwsd0pk8"}
    `(
        "should validate address $network $address -> $valid",
        async ({ valid, network, address }) => {
            const setAddressValid = vi.spyOn(signals, "setAddressValid");
            const setOnchainAddress = vi.spyOn(signals, "setOnchainAddress");

            signals.setAsset(network);

            render(() => <AddressInput />);

            const input = (await screen.findByPlaceholderText(
                t("onchain_address", { asset: network }),
            )) as HTMLInputElement;

            fireEvent.input(input, {
                target: { value: address },
            });

            expect(setAddressValid).toHaveBeenCalledWith(valid);

            if (valid) {
                expect(setOnchainAddress).toHaveBeenCalledWith(address);
            } else {
                expect(input.className).toEqual("invalid");
            }
        },
    );
});
