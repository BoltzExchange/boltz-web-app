import { setConfig } from "../src/config";
import regtest from "../src/configs/regtest.json";

regtest.loglevel = "error";
setConfig(regtest);
