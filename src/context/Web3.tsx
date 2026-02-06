import { abi as ERC20Abi } from "boltz-core/out/ERC20.sol/ERC20.json";
import { abi as ERC20SwapAbi } from "boltz-core/out/ERC20Swap.sol/ERC20Swap.json";
import { abi as EtherSwapAbi } from "boltz-core/out/EtherSwap.sol/EtherSwap.json";
import type { ERC20 } from "boltz-core/typechain/ERC20";
import type { ERC20Swap } from "boltz-core/typechain/ERC20Swap";
import type { EtherSwap } from "boltz-core/typechain/EtherSwap";
import {
    BrowserProvider,
    Contract,
    type InterfaceAbi,
    JsonRpcSigner,
    Wallet,
} from "ethers";
import log from "loglevel";
import type { Accessor, JSXElement, Resource, Setter } from "solid-js";
import {
    createContext,
    createResource,
    createSignal,
    onMount,
    useContext,
} from "solid-js";

import LedgerIcon from "../assets/ledger.svg";
import TrezorIcon from "../assets/trezor.svg";
import WalletConnectIcon from "../assets/wallet-connect.svg";
import { config } from "../config";
import {
    hasEvmAssets,
    isEvmAsset,
    requireRouterAddress,
    requireTokenConfig,
} from "../consts/Assets";
import type { EIP1193Provider, EIP6963ProviderDetail } from "../consts/Types";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import type { Contracts } from "../utils/boltzClient";
import { getContracts } from "../utils/boltzClient";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import LedgerSigner from "../utils/hardware/LedgerSigner";
import TrezorSigner from "../utils/hardware/TrezorSigner";
import { createProvider } from "../utils/provider";
import { useGlobalContext } from "./Global";
// TODO: import from boltz-core after update
import type { Router } from "./Router";
// TODO: import from boltz-core after update
import { abi as RouterAbi } from "./Router.json";

declare global {
    interface WindowEventMap {
        "eip6963:announceProvider": CustomEvent;
    }

    interface Navigator {
        hid: object;
    }

    interface Window {
        ethereum?: EIP1193Provider;
    }
}

type EIP6963AnnounceProviderEvent = {
    detail: EIP6963ProviderDetail;
};

export type Signer = JsonRpcSigner & {
    rdns: string;
};

enum HardwareRdns {
    Ledger = "ledger",
    Trezor = "trezor",
}

const browserRdns = "browser";
const walletConnectRdns = "wallet-connect";

const customDerivationPathRdns: string[] = [
    HardwareRdns.Ledger,
    HardwareRdns.Trezor,
];

export const createTokenContract = (asset: string, signer: Signer) => {
    const tokenConfig = requireTokenConfig(asset);
    return new Contract(
        tokenConfig.address,
        ERC20Abi,
        signer,
    ) as unknown as ERC20;
};

export const createRouterContract = (
    asset: string,
    signer: Signer | Wallet,
) => {
    const routerAddress = requireRouterAddress(asset);
    return new Contract(routerAddress, RouterAbi, signer) as unknown as Router;
};

const Web3SignerContext = createContext<{
    providers: Accessor<Record<string, EIP6963ProviderDetail>>;
    hasBrowserWallet: Accessor<boolean>;

    connectProvider: (rdns: string) => Promise<void>;
    connectProviderForAddress: (
        address: string,
        derivationPath?: string,
    ) => Promise<void>;

    signer: Accessor<Signer | undefined>;
    clearSigner: () => void;

    switchNetwork: (asset: string) => Promise<void>;

    getContractsForAsset: (asset: string) => Contracts | undefined;
    getEtherSwap: (asset: string) => EtherSwap;
    getErc20Swap: (asset: string) => ERC20Swap;

    openWalletConnectModal: Accessor<boolean>;
    setOpenWalletConnectModal: Setter<boolean>;

    walletConnected: Accessor<boolean>;
    setWalletConnected: Setter<boolean>;

    gasAbstractionSigner: Resource<Wallet | undefined>;
}>();

const Web3SignerProvider = (props: {
    children: JSXElement;
    noFetch?: boolean;
}) => {
    const { setRdns, getRdnsForAddress, t, deriveKeyGasAbstraction } =
        useGlobalContext();

    const hasEvm = hasEvmAssets();

    const [providers, setProviders] = createSignal<
        Record<string, EIP6963ProviderDetail>
    >({
        [HardwareRdns.Ledger]: {
            provider: new LedgerSigner(t),
            info: {
                name: "Ledger",
                uuid: "ledger",
                icon: LedgerIcon,
                isHardware: true,
                rdns: HardwareRdns.Ledger,
                disabled: navigator.hid === undefined,
            },
        },
        [HardwareRdns.Trezor]: {
            provider: new TrezorSigner(),
            info: {
                name: "Trezor",
                uuid: "trezor",
                icon: TrezorIcon,
                isHardware: true,
                rdns: HardwareRdns.Trezor,
            },
        },
    });
    const [signer, setSigner] = createSignal<Signer | undefined>(undefined);
    const [rawProvider, setRawProvider] = createSignal<
        EIP1193Provider | undefined
    >(undefined);
    const [hasBrowserWallet, setHasBrowserWallet] =
        createSignal<boolean>(false);
    const [openWalletConnectModal, setOpenWalletConnectModal] =
        createSignal<boolean>(false);
    const [walletConnected, setWalletConnected] = createSignal<boolean>(false);

    const [gasAbstractionSigner] = createResource(signer, async (s) => {
        const chainId = Number((await s.provider.getNetwork()).chainId);

        return new Wallet(
            Buffer.from(deriveKeyGasAbstraction(chainId).privateKey).toString(
                "hex",
            ),
            s.provider,
        );
    });

    WalletConnectProvider.initialize(t, setOpenWalletConnectModal);

    onMount(() => {
        if (window.ethereum !== undefined) {
            setHasBrowserWallet(true);
            setProviders({
                ...providers(),
                [browserRdns]: {
                    provider: window.ethereum,
                    info: {
                        name: "Browser native",
                        uuid: browserRdns,
                        rdns: browserRdns,
                        disabled: window.ethereum === undefined,
                    },
                },
            });
        }

        if (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID !== undefined) {
            setProviders({
                ...providers(),
                [walletConnectRdns]: {
                    provider: new WalletConnectProvider(),
                    info: {
                        name: "WalletConnect",
                        uuid: "wallet-connect",
                        icon: WalletConnectIcon,
                        isHardware: false,
                        rdns: walletConnectRdns,
                    },
                },
            });
        }

        window.addEventListener(
            "eip6963:announceProvider",
            (event: EIP6963AnnounceProviderEvent) => {
                log.debug(
                    `Found EIP-6963 wallet: ${event.detail.info.rdns}: ${event.detail.info.name}`,
                );
                setHasBrowserWallet(true);

                const existingProviders = { ...providers() };

                // We should not show the browser provider when an EIP-6963 provider is found
                delete existingProviders[browserRdns];

                setProviders({
                    ...existingProviders,
                    [event.detail.info.rdns]: event.detail,
                });
            },
        );
        window.dispatchEvent(new Event("eip6963:requestProvider"));
    });

    const [allContracts] = createResource(async () => {
        if (props.noFetch || !hasEvm) {
            return undefined;
        }

        return await getContracts();
    });

    const getContractsForAsset = (asset: string): Contracts | undefined => {
        const contracts = allContracts();
        if (!contracts || !isEvmAsset(asset)) {
            return undefined;
        }

        const assetConfig = config.assets?.[asset];
        if (!assetConfig?.network?.chainId) {
            return undefined;
        }

        return Object.values(contracts).find(
            (chainContracts) =>
                chainContracts.network.chainId === assetConfig.network.chainId,
        );
    };

    const connectProviderForAddress = async (
        address: string,
        derivationPath?: string,
    ) => {
        const rdns = await getRdnsForAddress(address);

        if (derivationPath !== undefined) {
            log.debug(
                `Setting derivation path (${derivationPath}) for signer:`,
                rdns,
            );
            const prov = providers()[rdns]
                .provider as unknown as HardwareSigner;
            prov.setDerivationPath(derivationPath);
        }

        await connectProvider(rdns);
    };

    const getSwapContract = <T,>(
        asset: string,
        contractType: "EtherSwap" | "ERC20Swap",
        abi: InterfaceAbi,
    ) => {
        const assetContracts = getContractsForAsset(asset);
        const assetConfig = config.assets?.[asset];

        return new Contract(
            assetContracts?.swapContracts[contractType],
            abi,
            signer() || createProvider(assetConfig?.network?.rpcUrls),
        ) as unknown as T;
    };

    const getEtherSwap = (asset: string) =>
        getSwapContract<EtherSwap>(asset, "EtherSwap", EtherSwapAbi);

    const getErc20Swap = (asset: string) =>
        getSwapContract<ERC20Swap>(asset, "ERC20Swap", ERC20SwapAbi);

    const connectProvider = async (rdns: string) => {
        const wallet = providers()[rdns];
        if (wallet == undefined) {
            throw "wallet not found";
        }

        log.debug(`Using wallet ${wallet.info.rdns}: ${wallet.info.name}`);
        const addresses = (await wallet.provider.request({
            method: "eth_requestAccounts",
        })) as string[];
        if (addresses.length === 0) {
            throw "no address available";
        }

        log.info(`Connected address from ${wallet.info.rdns}: ${addresses[0]}`);

        wallet.provider.on("chainChanged", () => {
            window.location.reload();
        });
        setRawProvider(wallet.provider);

        const signer = new JsonRpcSigner(
            new BrowserProvider(wallet.provider),
            addresses[0],
        ) as unknown as Signer;
        signer.rdns = wallet.info.rdns;

        await setRdns(addresses[0], wallet.info.rdns);

        setSigner(signer);
    };

    const switchNetwork = async (asset: string) => {
        if (rawProvider() === undefined) {
            return;
        }

        const assetConfig = config.assets?.[asset];
        if (!assetConfig?.network) {
            log.warn(`No network config found for asset: ${asset}`);
            return;
        }

        const sanitizedChainId = `0x${assetConfig.network.chainId.toString(16)}`;

        try {
            await rawProvider().request({
                method: "wallet_switchEthereumChain",
                params: [
                    {
                        chainId: sanitizedChainId,
                    },
                ],
            });
        } catch (switchError) {
            if (
                switchError.code === 4902 ||
                // Rabby does not set the correct error code
                switchError.message.includes("Try adding the chain")
            ) {
                await rawProvider().request({
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            ...assetConfig.network,
                            blockExplorerUrls: assetConfig.blockExplorerUrl
                                ? [assetConfig.blockExplorerUrl.normal]
                                : [],
                            chainId: sanitizedChainId,
                        },
                    ],
                });
            }

            throw switchError;
        }
    };

    return (
        <Web3SignerContext.Provider
            value={{
                signer,
                providers,
                getEtherSwap,
                getErc20Swap,
                switchNetwork,
                connectProvider,
                hasBrowserWallet,
                openWalletConnectModal,
                setOpenWalletConnectModal,
                walletConnected,
                setWalletConnected,
                connectProviderForAddress,
                getContractsForAsset,
                gasAbstractionSigner,
                clearSigner: () => {
                    log.info(`Clearing connected signer`);
                    if (rawProvider()) {
                        rawProvider().removeAllListeners("chainChanged");
                    }

                    setWalletConnected(false);
                    setSigner(undefined);
                    setRawProvider(undefined);
                },
            }}>
            {props.children}
        </Web3SignerContext.Provider>
    );
};

const useWeb3Signer = () => useContext(Web3SignerContext);

const etherSwapCodeHashes = () => {
    switch (config.network) {
        case "mainnet":
            return [
                "0x4d6894da95269c76528b81c6d25425a2f6bba70156cfaf7725064f919647d955",
                "0x8fda06a72295779e211ad2dc1bcf3f9904d23fa617f42fe0c5fc1e89b17c1777",
                "0xef55e014479e0bf8231d9e3fa669a5279cf6d3b924d8db070ce2c66964477d6f",
            ];

        case "testnet":
            return [
                "0xd9a282305f30590b3df70c3c1f9338b042a97dff12736794e9de2cdabf8542c1",
                "0xb8f6205d7fecc5b7a577519c7ec40af594f929d150c05bf84e1f94b7472dd783",
            ];

        default:
            return undefined;
    }
};

export {
    ERC20SwapAbi,
    EtherSwapAbi,
    useWeb3Signer,
    Web3SignerProvider,
    etherSwapCodeHashes,
    customDerivationPathRdns,
};
