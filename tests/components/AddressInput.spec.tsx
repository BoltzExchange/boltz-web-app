import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import AddressInput from "../../src/components/AddressInput";
import { BTC, LBTC, LN } from "../../src/consts/Assets";
import {
    TestComponent,
    contextWrapper,
    globalSignals,
    signals,
} from "../helper";

vi.mock("../../src/utils/invoice", async () => {
    const actual = await vi.importActual("../../src/utils/invoice");
    return {
        ...actual,
        isBolt12Offer: vi.fn((offer: string) => {
            return Promise.resolve(offer.startsWith("lno1"));
        }),
    };
});

describe("AddressInput", () => {
    test.each`
        valid    | network | address
        ${true}  | ${BTC}  | ${"mv5v8C3e1SySwqe6r2fq9Fh6DbZr8ddjsX"}
        ${true}  | ${BTC}  | ${"2N17VNGbi4yUHtkD7vhrc8cpi9JGVmC8scn"}
        ${true}  | ${BTC}  | ${"bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3"}
        ${false} | ${BTC}  | ${"02d96eadea3d780104449aca5c93461ce67c1564e2e1d73225fa67dd3b997a6018"}
        ${true}  | ${LBTC} | ${"CTEyTteD4cQg2NfF1yGWUU1rWSDC8sKHrj5BZJzr8kzyKFXwNCJ8VyDhi45Q98KdSf3jeTkbjJy18JkP"}
        ${true}  | ${LBTC} | ${"AzpjfmC41JpC6ieu3odwFBqtF4isFeY8RHv1e699EM2RgiyHd49og66a8qLLMDrhL8pCLeWAxJat1ebD"}
        ${true}  | ${LBTC} | ${"el1qqt7nl8pw6278yxv38fezzw8lmqh40prpusfurcvsh2xn3sl0pvnz3whllcapdnxcxn2u0wumpu7u2u6anh2juvmz7spx6snmn"}
        ${true}  | ${LBTC} | ${"2do9j7MdMJSVKWosUmcLzhoR8E5mhabtUju"}
        ${true}  | ${LBTC} | ${"XUWfSHgUE1G72X9oGHXfecgzgf1N5A7WD2"}
        ${true}  | ${LBTC} | ${"ert1qhtlluwskenvrf4w8hwds70w9wdwem4fwsd0pk8"}
    `(
        "should validate address $network $address -> $valid",
        async ({ valid, network, address }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <AddressInput />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAssetReceive(network);

            const input = (await screen.findByPlaceholderText(
                globalSignals.t("onchain_address", { asset: network }),
            )) as HTMLInputElement;

            fireEvent.input(input, {
                target: { value: address },
            });

            if (valid) {
                await waitFor(() => {
                    expect(signals.addressValid()).toBe(true);
                    expect(signals.onchainAddress()).toBeTruthy();
                });
                expect(signals.onchainAddress()).toEqual(address);
            } else {
                await waitFor(() => {
                    expect(signals.addressValid()).toBe(false);
                    expect(input.className).toContain("invalid");
                });
            }
        },
    );

    test.each`
        asset   | input
        ${BTC}  | ${"bcrt1q7vq47xpsg4t080205edaulc3sdsjpdxy9svhr3"}
        ${LBTC} | ${"el1qq2yjqfz9evc3c5m0rzw0cdtfcdfl5kmcf9xsskpsgza34zhezxzq7y6y4dnldxhtd935k8dn63n8cywy3jlzuvftycsmytjmu"}
        ${LN}   | ${"admin@bol.tz"}
    `(
        "should switch to $asset based on input $input",
        async ({ asset, input }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <AddressInput />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            const addressInput = (await screen.findByTestId(
                "onchainAddress",
            )) as HTMLInputElement;

            fireEvent.input(addressInput, {
                target: { value: input },
            });

            await waitFor(() => {
                expect(signals.assetReceive()).toEqual(asset);
            });

            if (asset === LN) {
                expect(signals.invoice()).toEqual(input);
            } else {
                await waitFor(() => {
                    expect(signals.addressValid()).toEqual(true);
                });
                expect(signals.onchainAddress()).toEqual(input);
            }
        },
    );

    test.each`
        asset   | bip21Uri                                                                                                                                               | expectedAddress
        ${BTC}  | ${"bitcoin:bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday"}      | ${"bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm"}
        ${LBTC} | ${"liquidnetwork:ert1qzdz2kelknt4kjc6trkeagenuz8zge03wc88dqw?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday"} | ${"ert1qzdz2kelknt4kjc6trkeagenuz8zge03wc88dqw"}
    `(
        "should extract address from BIP21 URI for $asset",
        async ({ asset, bip21Uri, expectedAddress }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <AddressInput />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAssetReceive(asset);

            const addressInput = (await screen.findByTestId(
                "onchainAddress",
            )) as HTMLInputElement;

            fireEvent.input(addressInput, {
                target: { value: bip21Uri },
            });

            await waitFor(() => {
                expect(signals.addressValid()).toEqual(true);
            });
            expect(signals.onchainAddress()).toEqual(expectedAddress);
            expect(signals.assetReceive()).toEqual(asset);
            expect(signals.receiveAmount().toNumber()).toEqual(1000);
        },
    );

    test.each`
        asset   | bip21Uri                                                                                                                                                                                                                                                                          | expectedInvoice
        ${BTC}  | ${"bitcoin:bcrt1q0zjymfy94ctjdegxascl8l253p0ppl5fzz46qm?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lno=lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c"}      | ${"lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c"}
        ${LBTC} | ${"liquidnetwork:ert1qzdz2kelknt4kjc6trkeagenuz8zge03wc88dqw?amount=0.00001&label=sbddesign%3A%20For%20lunch%20Tuesday&message=For%20lunch%20Tuesday&lno=lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c"} | ${"lno1qgsqvgnwgcg35z6ee2h3yczraddm72xrfua9uve2rlrm9deu7xyfzrc2qqtzzqcxyaupvt8xstdrl8vlun9ch2t28a94hq80agu6usv02rxvetfm3c"}
    `(
        "should prioritize lightning over address when both are present",
        async ({ asset, bip21Uri, expectedInvoice }) => {
            render(
                () => (
                    <>
                        <TestComponent />
                        <AddressInput />
                    </>
                ),
                { wrapper: contextWrapper },
            );

            signals.setAssetReceive(asset);

            const addressInput = (await screen.findByTestId(
                "onchainAddress",
            )) as HTMLInputElement;

            fireEvent.input(addressInput, {
                target: { value: bip21Uri },
            });

            await waitFor(() => {
                expect(signals.invoice()).toEqual(expectedInvoice);
                expect(signals.assetReceive()).toEqual(LN);
            });
        },
    );
});
