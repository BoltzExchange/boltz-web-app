import {
    createContext,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";
import { BrowserProvider, Contract } from "ethers";
import EtherSwap from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import { RBTC } from "../consts.js";
import { getApiUrl } from "../helper.js";

// TODO: check network and add option to add RSK as network
// TODO: handle network and account change events

const ethereumInitEvent = "ethereum#initialized";

const detectInjection = (setSignerPromise) => {
    const handleEthereum = () => {
        window.removeEventListener(ethereumInitEvent, handleEthereum);
        setSignerPromise(new BrowserProvider(window.ethereum));
    };

    if (window.ethereum) {
        handleEthereum();
    } else {
        window.addEventListener(ethereumInitEvent, handleEthereum);
    }
};

const Web3SignerContext = createContext();

const Web3SignerProvider = (props) => {
    const [provider, setProvider] = createSignal(undefined);
    const [signer, setSigner] = createSignal();

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
            EtherSwap.abi,
            signer(),
        );
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
