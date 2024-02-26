import type { BrowserProvider, JsonRpcSigner } from "ethers";
import {
    Accessor,
    JSXElement,
    createContext,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";

import { config, configReady } from "../config";
import { RBTC } from "../consts";
import { getContracts } from "../utils/boltzApi";
import { isBoltzClient } from "../utils/helper";
import { ethers, moduleLoaded, rootstock } from "../utils/lazy";
import type { Contracts, EtherSwap } from "../utils/types";

// TODO: check network and add option to add RSK as network
// TODO: handle network and account change events

const initEvent = "ethereum#initialized";

const Web3SignerContext = createContext<{
    getSigner: () => Promise<JsonRpcSigner>;
    getEtherSwap: () => Promise<EtherSwap>;
    hasMetamask: Accessor<boolean>;
}>();

const Web3SignerProvider = (props: {
    children: JSXElement;
    noFetch?: boolean;
}) => {
    if (isBoltzClient()) {
        return props.children;
    }
    const [provider, setProvider] = createSignal<BrowserProvider | undefined>();
    const [signer, setSigner] = createSignal<JsonRpcSigner | undefined>();
    const [hasMetamask, setHasMetamask] = createSignal<boolean>(false);
    const hasRsk = () => configReady() && config().assets[RBTC] !== undefined;

    createEffect(() => {
        if (moduleLoaded(ethers)()) {
            if ((window as any).ethereum) {
                handleMetamask();
            } else {
                window.addEventListener(initEvent, handleMetamask);
            }
        }
    });

    const handleMetamask = () => {
        window.removeEventListener(initEvent, handleMetamask);
        if (hasRsk()) {
            console.log(ethers.BrowserProvider);
            setProvider(new ethers.BrowserProvider((window as any).ethereum));
        }
        setHasMetamask(true);
    };

    const fetchContracts = new Promise<Contracts | undefined>(
        // eslint-disable-next-line
        async (resolve) => {
            if (props.noFetch || !hasRsk()) {
                resolve(undefined);
                return;
            }

            const res = await getContracts(RBTC);
            resolve(res["rsk"]);
        },
    );

    const getSigner = async () => {
        const signer = await provider().getSigner();
        setSigner(signer);
        return signer;
    };

    const getEtherSwap = async () => {
        await getSigner();
        return new ethers.Contract(
            (await fetchContracts).swapContracts.EtherSwap,
            rootstock.EtherSwapAbi,
            signer(),
        ) as unknown as EtherSwap;
    };

    return (
        <Web3SignerContext.Provider
            // TODO: error handling of getSigner
            value={{
                getSigner,
                getEtherSwap,
                hasMetamask,
            }}>
            {props.children}
        </Web3SignerContext.Provider>
    );
};

const useWeb3Signer = () => useContext(Web3SignerContext);

export { useWeb3Signer, Web3SignerProvider };
