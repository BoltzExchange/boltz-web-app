import { setConfig } from "../src/config";
import regtest from "../src/configs/regtest.json";

regtest.loglevel = "error";
setConfig(regtest as never);

vi.mock("ethers", () => ({
    JsonRpcProvider: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
globalThis.Notification = {
    requestPermission: vi.fn().mockResolvedValue(true),
    permission: "granted",
} as unknown;
