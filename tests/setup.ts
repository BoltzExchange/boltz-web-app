import { TextEncoder } from "util";

import { setConfig } from "../src/config";
import regtest from "../src/configs/regtest.json";

regtest.loglevel = "error";
setConfig(regtest);

global.TextEncoder = TextEncoder;

globalThis.Notification = {
    requestPermission: jest.fn().mockResolvedValue(true),
    permission: "granted",
} as unknown as jest.Mocked<typeof Notification>;
