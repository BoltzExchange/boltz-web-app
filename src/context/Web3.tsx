import { abi as EtherSwapAbi } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import { EtherSwap } from "boltz-core/typechain/EtherSwap";
import { BrowserProvider, Contract, JsonRpcSigner } from "ethers";
import { Setter, createContext, createSignal, useContext } from "solid-js";

import { RBTC } from "../consts";
import { getApiUrl } from "../helper";

// TODO: check network and add option to add RSK as network
// TODO: handle network and account change events

const ethereumInitEvent = "ethereum#initialized";

const detectInjection = (setProvider: Setter<BrowserProvider>) => {
    const handleEthereum = () => {
        window.removeEventListener(ethereumInitEvent, handleEthereum);
        setProvider(new BrowserProvider((window as any).ethereum));
    };

    if ((window as any).ethereum) {
        handleEthereum();
    } else {
        window.addEventListener(ethereumInitEvent, handleEthereum);
    }
};

const Web3SignerContext = createContext<{
    getSigner: () => Promise<JsonRpcSigner>;
    getEtherSwap: () => Promise<EtherSwap>;
}>();

const Web3SignerProvider = (props) => {
    const [provider, setProvider] = createSignal<BrowserProvider | undefined>();
    const [signer, setSigner] = createSignal<JsonRpcSigner | undefined>();

    detectInjection(setProvider);

    const getContracts = new Promise(async (resolve) => {
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
            }}>
            {props.children}
        </Web3SignerContext.Provider>
    );
};

const useWeb3Signer = () => useContext(Web3SignerContext);

export { useWeb3Signer, Web3SignerProvider };
