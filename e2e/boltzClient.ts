import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import axios from "axios";
import fs from "fs";

import type { RestorableSwap } from "../src/utils/boltzClient";

const boltzEndpoint = "http://localhost:9001";

export const getRestorableSwaps = async (rescueFile: string) => {
    const mnemonic = JSON.parse(fs.readFileSync(rescueFile, "utf8")).mnemonic;
    const seed = mnemonicToSeedSync(mnemonic);

    return (
        await axios.post<RestorableSwap[]>(`${boltzEndpoint}/v2/swap/restore`, {
            xpub: HDKey.fromMasterSeed(seed).publicExtendedKey,
        })
    ).data;
};
