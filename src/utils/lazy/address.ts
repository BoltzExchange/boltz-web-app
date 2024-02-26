import { Network, address, networks } from "bitcoinjs-lib";
import {
    address as LiquidAddress,
    networks as LiquidNetworks,
} from "liquidjs-lib";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";

import { config } from "../../config";
import { LBTC } from "../../consts";

type DecodedAddress = { script: Buffer; blindingKey?: Buffer };

const getAddress = (asset: string): typeof address | typeof LiquidAddress => {
    if (asset === LBTC) {
        return LiquidAddress;
    } else {
        return address;
    }
};
const getNetwork = (asset: string): Network | LiquidNetwork => {
    const network = config().network;
    if (asset === LBTC) {
        const liquidNet = network === "main" ? "liquid" : network;
        return LiquidNetworks[liquidNet];
    } else {
        return networks[network];
    }
};

const decodeAddress = (asset: string, addr: string): DecodedAddress => {
    const address = getAddress(asset);

    // We always do this to validate the network
    const script = address.toOutputScript(
        addr,
        getNetwork(asset) as LiquidNetwork,
    );

    if (asset === LBTC) {
        // This throws for unconfidential addresses -> fallback to output script decoding
        try {
            const decoded = (address as typeof LiquidAddress).fromConfidential(
                addr,
            );

            return {
                script,
                blindingKey: decoded.blindingKey,
            };
        } catch (e) {}
    }

    return {
        script,
    };
};

export { getAddress, getNetwork, decodeAddress, DecodedAddress };
