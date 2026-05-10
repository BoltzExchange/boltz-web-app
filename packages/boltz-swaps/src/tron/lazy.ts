import type { TronWeb as TronWebClient } from "tronweb";

import Loader from "../lazy.ts";

type TronModules = {
    TronWeb: typeof TronWebClient;
};

export const tron: Loader<TronModules> = new Loader(
    "Tron",
    async (): Promise<TronModules> => {
        const tronweb = await import("tronweb");

        return {
            TronWeb: tronweb.TronWeb,
        };
    },
);
