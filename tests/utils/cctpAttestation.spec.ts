import { config } from "../../src/config";
import {
    getCctpAttestation,
    getCctpForwardTxHash,
} from "../../src/utils/cctp/attestation";

describe("cctpAttestation", () => {
    const originalFeeApiUrl = config.cctpApiUrl;

    beforeEach(() => {
        config.cctpApiUrl = "https://iris-api.circle.com";
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        config.cctpApiUrl = originalFeeApiUrl;
    });

    test("getCctpForwardTxHash returns the forwardTxHash when present", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [
                        {
                            status: "complete",
                            forwardTxHash: "0xdeadbeef",
                        },
                    ],
                }),
        } as Response);

        await expect(getCctpForwardTxHash(3, "0xburn")).resolves.toBe(
            "0xdeadbeef",
        );
        expect(fetchSpy).toHaveBeenCalledWith(
            "https://iris-api.circle.com/v2/messages/3?transactionHash=0xburn",
            expect.any(Object),
        );
    });

    test("getCctpForwardTxHash returns undefined while the message is still pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [{ status: "pending_confirmations" }],
                }),
        } as Response);

        await expect(
            getCctpForwardTxHash(3, "0xburn"),
        ).resolves.toBeUndefined();
    });

    test("getCctpForwardTxHash treats 404 as pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 404,
        } as Response);

        await expect(
            getCctpForwardTxHash(3, "0xburn"),
        ).resolves.toBeUndefined();
    });

    test("getCctpForwardTxHash treats nullable pending fields as pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [
                        {
                            status: "pending_confirmations",
                            forwardTxHash: null,
                        },
                    ],
                }),
        } as Response);

        await expect(
            getCctpForwardTxHash(3, "0xburn"),
        ).resolves.toBeUndefined();
    });

    test("getCctpAttestation returns message and attestation when complete", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [
                        {
                            status: "complete",
                            message: "0xmessage",
                            attestation: "0xattestation",
                        },
                    ],
                }),
        } as Response);

        await expect(getCctpAttestation(3, "0xburn")).resolves.toEqual({
            status: "complete",
            message: "0xmessage",
            attestation: "0xattestation",
        });
    });

    test("getCctpAttestation returns undefined while attestation is pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [
                        {
                            status: "pending_confirmations",
                            message: "0x",
                            attestation: "PENDING",
                        },
                    ],
                }),
        } as Response);

        await expect(getCctpAttestation(3, "0xburn")).resolves.toBeUndefined();
    });

    test("getCctpAttestation treats 404 as pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 404,
        } as Response);

        await expect(getCctpAttestation(3, "0xburn")).resolves.toBeUndefined();
    });

    test("getCctpAttestation treats nullable pending fields as pending", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [
                        {
                            status: "pending_confirmations",
                            message: null,
                            attestation: null,
                        },
                    ],
                }),
        } as Response);

        await expect(getCctpAttestation(3, "0xburn")).resolves.toBeUndefined();
    });

    test("throws on malformed messages response", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ messages: {} }),
        } as Response);

        await expect(getCctpForwardTxHash(3, "0xburn")).rejects.toThrow(
            /messages response/,
        );
    });

    test("throws on malformed message entry fields", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    messages: [{ forwardTxHash: 123 }],
                }),
        } as Response);

        await expect(getCctpForwardTxHash(3, "0xburn")).rejects.toThrow(
            /forwardTxHash/,
        );
    });
});
