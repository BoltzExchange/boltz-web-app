import log from "loglevel";

log.setLevel("error");

vi.mock("ethers", () => ({
    JsonRpcProvider: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
globalThis.Notification = {
    requestPermission: vi.fn().mockResolvedValue(true),
    permission: "granted",
} as unknown;
