import { abi as EtherSwapAbi } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { BrowserProvider, Contract, JsonRpcSigner } from "ethers";
import {
    Accessor,
    ResolvedChildren,
    createContext,
    createSignal,
    useContext,
} from "solid-js";

import { pairs } from "../config";
import { RBTC } from "../consts";
import { getApiUrl } from "../helper";

// TODO: check network and add option to add RSK as network
// TODO: handle network and account change events

const initEvent = "ethereum#initialized";

const Web3SignerContext = createContext<{
    getSigner: () => Promise<JsonRpcSigner>;
    getEtherSwap: () => Promise<EtherSwap>;
    hasMetamask: Accessor<boolean>;
}>();

const Web3SignerProvider = (props: {
    children: ResolvedChildren;
    noFetch?: boolean;
}) => {
    const [provider, setProvider] = createSignal<BrowserProvider | undefined>();
    const [signer, setSigner] = createSignal<JsonRpcSigner | undefined>();
    const [hasMetamask, setHasMetamask] = createSignal<boolean>(false);

    const handleMetamask = () => {
        window.removeEventListener(initEvent, handleMetamask);
        if (pairs[`${RBTC}/BTC`]) {
            setProvider(new BrowserProvider((window as any).ethereum));
            setHasMetamask(true);
        } else {
            setHasMetamask(false);
        }
    };

    if ((window as any).ethereum) {
        handleMetamask();
    } else {
        window.addEventListener(initEvent, handleMetamask);
    }

    const getContracts = new Promise(async (resolve) => {
        if (props.noFetch || !hasMetamask()) {
            return;
        }

        const res = await (
            await fetch(`${getApiUrl(RBTC)}/getcontracts`)
        ).json();
        resolve(res["rsk"]);
    });

    const getSigner = async () => {
        const signer = await provider().getSigner();
        setSigner(signer);
        return signer;
    };

    const getEtherSwap = async () => {
        await getSigner();
        return new Contract(
            (await getContracts)["swapContracts"]["EtherSwap"],
            EtherSwapAbi,
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
