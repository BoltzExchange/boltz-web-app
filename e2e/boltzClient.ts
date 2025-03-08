import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import axios from "axios";
import fs from "fs";

import { RescuableSwap } from "../src/utils/boltzClient";

const boltzEndpoint = "http://localhost:9001";

export const getRescuableSwaps = async (rescueFile: string) => {
    const mnemonic = JSON.parse(fs.readFileSync(rescueFile, "utf8")).mnemonic;
    const seed = mnemonicToSeedSync(mnemonic);

    return (
        await axios.post<RescuableSwap[]>(`${boltzEndpoint}/v2/swap/rescue`, {
            xpub: HDKey.fromMasterSeed(seed).publicExtendedKey,
        })
    ).data;
};
