import log from "loglevel";
import type { Accessor, JSXElement, Setter } from "solid-js";
import {
    createContext,
    createResource,
    createSignal,
    onMount,
    untrack,
    useContext,
} from "solid-js";
import {
    type Account,
    type Address,
    type Hex,
    type PublicClient,
    type Transport,
    type TypedDataDomain,
    type WalletClient,
    createPublicClient,
    createWalletClient,
    custom,
    getAddress,
    getContract,
    getTypesForEIP712Domain,
    stringify,
} from "viem";

import LedgerIcon from "../assets/ledger.svg";
import TrezorIcon from "../assets/trezor.svg";
import WalletConnectIcon from "../assets/wallet-connect.svg";
import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import {
    getNetworkTransport,
    hasEvmAssets,
    isEvmAsset,
} from "../consts/Assets";
import type { EIP1193Provider, EIP6963ProviderDetail } from "../consts/Types";
import erc20SwapAbiV5 from "../consts/abis/v5/ERC20Swap.json";
import etherSwapAbiV5 from "../consts/abis/v5/EtherSwap.json";
import { erc20SwapAbi, etherSwapAbi } from "../generated/evm-abis";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import type { ContractAddresses, Contracts } from "../utils/boltzClient";
import { getContracts } from "../utils/boltzClient";
import { prefix0x } from "../utils/evmTransaction";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import LedgerSigner from "../utils/hardware/LedgerSigner";
import TrezorSigner from "../utils/hardware/TrezorSigner";
import { isIos } from "../utils/helper";
import {
    createAssetProvider,
    createProviderTransport,
    getRpcUrls,
    requireRpcUrls,
} from "../utils/provider";
import { evmAccountFromPrivateKey } from "../utils/rescueDerivation";
import { type RescueFile } from "../utils/rescueFile";
import { useGlobalContext } from "./Global";
import type {
    Erc20SwapContract,
    EtherSwapContract,
    ReadOnlyClient,
    SignerClient,
} from "./contracts";

declare global {
    interface WindowEventMap {
        "eip6963:announceProvider": CustomEvent;
    }

    interface Navigator {
        hid: object;
    }

    interface Window {
        ethereum?: EIP1193Provider;
        tron?: unknown;
        tronLink?: unknown;
        tronWeb?: unknown;
    }
}

type EIP6963AnnounceProviderEvent = {
    detail: EIP6963ProviderDetail;
};

export type Signer = WalletClient<Transport, undefined, Account> & {
    address: Address;
    provider: PublicClient;
    rdns: string;
};

export type ConnectedWallet = {
    address: string;
    rdns: string;
    transport: NetworkTransport;
    chainId?: number;
    signer?: Signer;
};

export type ConnectProviderOptions = {
    asset?: string;
    derivationPath?: string;
};

type AddEthereumChainParams = {
    chainId: string;
    chainName: string;
    rpcUrls: readonly string[];
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrls?: string[];
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

const Web3SignerContext = createContext<{
    providers: Accessor<Record<string, EIP6963ProviderDetail>>;
    browserWalletTransports: Accessor<Set<NetworkTransport>>;

    connectProvider: (
        rdns: string,
        options?: ConnectProviderOptions,
    ) => Promise<void>;
    connectProviderForAddress: (
        address: string,
        derivationPath?: string,
        asset?: string,
    ) => Promise<void>;

    signer: Accessor<Signer | undefined>;
    connectedWallet: Accessor<ConnectedWallet | undefined>;
    clearSigner: () => void;

    switchNetwork: (asset: string) => Promise<void>;

    getContractsForAsset: (asset: string) => Contracts | undefined;
    getEtherSwap: (asset: string) => EtherSwapContract;
    getErc20Swap: (asset: string) => Erc20SwapContract;

    openWalletConnectModal: Accessor<boolean>;
    setOpenWalletConnectModal: Setter<boolean>;

    walletConnected: Accessor<boolean>;
    setWalletConnected: Setter<boolean>;

    getGasAbstractionSigner: (asset: string, rescueFile?: RescueFile) => Signer;
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
    const [connectedWallet, setConnectedWallet] = createSignal<
        ConnectedWallet | undefined
    >(undefined);
    const signer = () => connectedWallet()?.signer;
    const [rawProvider, setRawProvider] = createSignal<
        EIP1193Provider | undefined
    >(undefined);
    const [browserWalletTransports, setBrowserWalletTransports] = createSignal<
        Set<NetworkTransport>
    >(new Set());
    const addBrowserWalletTransport = (transport: NetworkTransport) => {
        setBrowserWalletTransports((prev) => {
            if (prev.has(transport)) {
                return prev;
            }
            return new Set(prev).add(transport);
        });
    };
    const [openWalletConnectModal, setOpenWalletConnectModal] =
        createSignal<boolean>(false);
    const [walletConnected, setWalletConnected] = createSignal<boolean>(false);

    const getGasAbstractionSigner = (
        asset: string,
        rescueFile?: RescueFile,
    ): Signer => {
        const assetConfig = config.assets?.[asset];
        const chainId = assetConfig?.network?.chainId;
        const rpcUrls = getRpcUrls(asset);

        if (chainId === undefined || rpcUrls === undefined) {
            throw new Error(`missing network config for asset: ${asset}`);
        }

        const account = evmAccountFromPrivateKey(
            deriveKeyGasAbstraction(chainId, rescueFile).privateKey,
        );
        const transport = createProviderTransport(rpcUrls);
        const walletClient = createWalletClient({ account, transport });

        return Object.assign(walletClient, {
            address: account.address,
            provider: createPublicClient({ transport }),
            rdns: "gas-abstraction",
        });
    };

    WalletConnectProvider.initialize(t, setOpenWalletConnectModal);

    onMount(() => {
        if (window.ethereum !== undefined) {
            addBrowserWalletTransport(NetworkTransport.Evm);
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

        if (
            window.tron !== undefined ||
            window.tronLink !== undefined ||
            window.tronWeb !== undefined
        ) {
            addBrowserWalletTransport(NetworkTransport.Tron);
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
                addBrowserWalletTransport(NetworkTransport.Evm);

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
        const chainId = assetConfig?.network?.chainId;
        if (chainId === undefined) {
            return undefined;
        }

        return Object.values(contracts).find(
            (chainContracts) => chainContracts.network.chainId === chainId,
        );
    };

    const connectProviderForAddress = async (
        address: string,
        derivationPath?: string,
        asset?: string,
    ) => {
        const rdns = await getRdnsForAddress(address);
        if (rdns === null) {
            throw new Error(`missing wallet provider for address: ${address}`);
        }
        await connectProvider(rdns, { asset, derivationPath });
    };

    const configureHardwareProvider = (
        rdns: string,
        options?: ConnectProviderOptions,
    ) => {
        if (options === undefined || !customDerivationPathRdns.includes(rdns)) {
            return;
        }

        const prov = providers()[rdns].provider as unknown as HardwareSigner;

        if (options.asset !== undefined) {
            prov.setNetworkAsset(options.asset);
        }

        if (options.derivationPath !== undefined) {
            log.debug(
                `Setting derivation path (${options.derivationPath}) for signer:`,
                rdns,
            );
            prov.setDerivationPath(options.derivationPath);
        }
    };

    const requireSwapAddress = (
        asset: string,
        contractType: keyof ContractAddresses,
    ): Address => {
        const address =
            getContractsForAsset(asset)?.swapContracts[contractType];
        if (address === undefined) {
            throw new Error(`missing ${contractType} contract for ${asset}`);
        }
        return getAddress(address);
    };

    const getSwapContractVersion = (
        asset: string,
        contractType: keyof ContractAddresses,
    ): number => {
        const assetContracts = getContractsForAsset(asset);
        if (assetContracts === undefined) {
            return 5;
        }
        const address = assetContracts.swapContracts[contractType];
        return Number(
            Object.keys(assetContracts.supportedContracts).find(
                (key) =>
                    assetContracts.supportedContracts[key][contractType] ===
                    address,
            ) ?? 5,
        );
    };

    const swapClient = (asset: string): SignerClient | ReadOnlyClient => {
        const connectedSigner = signer();
        // Reads must hit the asset's chain — `connectedSigner.provider` talks
        // to whichever chain the wallet happens to be on, which breaks
        // cross-chain claims (e.g. wallet on Polygon, Erc20Swap on Arbitrum).
        const publicClient = createAssetProvider(asset);
        return connectedSigner === undefined
            ? { public: publicClient }
            : { public: publicClient, wallet: connectedSigner };
    };

    const getEtherSwap = (asset: string): EtherSwapContract => {
        const version = getSwapContractVersion(asset, "EtherSwap");
        const abi = (
            version <= 5 ? etherSwapAbiV5 : etherSwapAbi
        ) as typeof etherSwapAbi;
        return getContract({
            address: requireSwapAddress(asset, "EtherSwap"),
            abi,
            client: swapClient(asset),
        });
    };

    const getErc20Swap = (asset: string): Erc20SwapContract => {
        const version = getSwapContractVersion(asset, "ERC20Swap");
        const abi = (
            version <= 5 ? erc20SwapAbiV5 : erc20SwapAbi
        ) as typeof erc20SwapAbi;
        return getContract({
            address: requireSwapAddress(asset, "ERC20Swap"),
            abi,
            client: swapClient(asset),
        });
    };

    const createConnectedSigner = (
        provider: EIP1193Provider,
        address: string,
        rdns: string,
    ) => {
        const account = getAddress(address);
        const transport = custom(provider);
        const nextSigner: Signer = Object.assign(
            createWalletClient({ account, transport }),
            {
                address: account,
                provider: createPublicClient({ transport }),
                rdns,
            },
        );

        if (
            rdns === walletConnectRdns &&
            isIos() &&
            WalletConnectProvider.isTrustWallet()
        ) {
            nextSigner.signTypedData = async (parameters) => {
                const domain: TypedDataDomain =
                    typeof parameters.domain !== "object" ||
                    parameters.domain === null
                        ? {}
                        : { ...parameters.domain };
                const chainIdValue = domain.chainId;
                const chainId =
                    chainIdValue === null || chainIdValue === undefined
                        ? undefined
                        : Number(chainIdValue);
                const normalizedChainId =
                    chainId !== undefined && Number.isFinite(chainId)
                        ? chainId
                        : undefined;
                if (normalizedChainId !== undefined) {
                    domain.chainId = normalizedChainId;
                }
                const payload = {
                    domain,
                    types: {
                        EIP712Domain: getTypesForEIP712Domain({
                            domain,
                        }),
                        ...parameters.types,
                    },
                    primaryType: parameters.primaryType,
                    message: parameters.message,
                };

                return (await WalletConnectProvider.requestRawEvm(
                    {
                        method: "eth_signTypedData_v4",
                        params: [getAddress(address), stringify(payload)],
                    },
                    normalizedChainId,
                )) as Hex;
            };
        }

        return nextSigner;
    };

    const parseChainId = (chainId?: string | number) => {
        if (chainId === undefined) {
            return undefined;
        }

        return Number(chainId);
    };

    const logSignerNetwork = async (nextSigner: Signer) => {
        try {
            const chainId = await nextSigner.provider.getChainId();
            log.info(
                `Connected signer ${nextSigner.address} from ${nextSigner.rdns} is on chain ${String(chainId)}`,
            );
        } catch (error) {
            log.warn(
                `Failed to determine network for connected signer ${nextSigner.address} from ${nextSigner.rdns}`,
                error,
            );
        }
    };

    const setEvmWallet = async (
        provider: EIP1193Provider,
        address: string,
        rdns: string,
        chainId?: string,
    ) => {
        await setRdns(address, rdns);
        const signer = createConnectedSigner(provider, address, rdns);
        setConnectedWallet({
            address: signer.address,
            rdns,
            transport: NetworkTransport.Evm,
            chainId: parseChainId(chainId),
            signer,
        });
        setWalletConnected(true);
        void logSignerNetwork(signer);
    };

    const refreshConnectedSigner = async (
        provider: EIP1193Provider,
        rdns: string,
        chainId?: string,
    ) => {
        const currentAddress = untrack(() => connectedWallet()?.address);
        let nextAddress = currentAddress;

        try {
            const addresses = (await provider.request({
                method: "eth_accounts",
            })) as string[];
            if (addresses.length > 0) {
                nextAddress = addresses[0];
            }
        } catch (error) {
            log.warn(
                `Failed to fetch accounts after network switch to ${chainId ?? "unknown chain"}`,
                error,
            );
        }

        if (nextAddress === undefined) {
            log.warn(
                `Clearing signer after network switch to ${chainId ?? "unknown chain"} because no connected address is available`,
            );
            setWalletConnected(false);
            setConnectedWallet(undefined);
            return;
        }

        log.info(
            `Refreshing signer for ${rdns} after network switch to ${chainId ?? "unknown chain"} using ${nextAddress}`,
        );
        await setEvmWallet(provider, nextAddress, rdns, chainId);
    };

    const connectProvider = async (
        rdns: string,
        options?: ConnectProviderOptions,
    ) => {
        const wallet = providers()[rdns];
        if (wallet == undefined) {
            throw "wallet not found";
        }

        configureHardwareProvider(rdns, options);

        log.debug(`Using wallet ${wallet.info.rdns}: ${wallet.info.name}`);
        const transport = options?.asset
            ? (getNetworkTransport(options.asset) ?? NetworkTransport.Evm)
            : NetworkTransport.Evm;

        if (
            wallet.info.rdns === walletConnectRdns &&
            transport !== NetworkTransport.Evm
        ) {
            const account = await WalletConnectProvider.connect(transport);

            log.info(
                `Connected address from ${wallet.info.rdns} on ${transport}: ${account.address}`,
            );

            await setRdns(account.address, wallet.info.rdns);
            setWalletConnected(true);
            setConnectedWallet({
                address: account.address,
                rdns: wallet.info.rdns,
                transport: account.transport,
            });
            const previousRawProvider = rawProvider();
            if (previousRawProvider !== undefined) {
                previousRawProvider.removeAllListeners("chainChanged");
            }

            setRawProvider(undefined);
            return;
        }

        const addresses = (await wallet.provider.request({
            method: "eth_requestAccounts",
        })) as string[];
        if (addresses.length === 0) {
            throw "no address available";
        }

        log.info(`Connected address from ${wallet.info.rdns}: ${addresses[0]}`);

        wallet.provider.removeAllListeners("chainChanged");
        wallet.provider.on("chainChanged", (chainId) => {
            void refreshConnectedSigner(
                wallet.provider,
                wallet.info.rdns,
                chainId,
            ).catch((error) => {
                log.error(
                    `Failed to refresh signer for ${wallet.info.rdns} after network switch`,
                    error,
                );
            });
        });
        const previousRawProvider = rawProvider();
        if (
            previousRawProvider !== undefined &&
            previousRawProvider !== wallet.provider
        ) {
            previousRawProvider.removeAllListeners("chainChanged");
        }
        setRawProvider(wallet.provider);

        await setEvmWallet(wallet.provider, addresses[0], wallet.info.rdns);
    };

    const switchNetwork = async (asset: string) => {
        const currentRawProvider = rawProvider();
        if (currentRawProvider === undefined) {
            return;
        }

        const assetConfig = config.assets?.[asset];
        const network = assetConfig?.network;
        if (network === undefined || network.chainId === undefined) {
            log.warn(`No network config found for asset: ${asset}`);
            return;
        }

        const nativeCurrency = network.nativeCurrency;
        if (nativeCurrency === undefined) {
            log.warn(`No native currency config found for asset: ${asset}`);
            return;
        }

        const sanitizedChainId = prefix0x(network.chainId.toString(16));
        const activeSigner = signer();

        if (
            activeSigner !== undefined &&
            customDerivationPathRdns.includes(activeSigner.rdns)
        ) {
            const hardwareProvider = providers()[activeSigner.rdns]?.provider;
            if (hardwareProvider === undefined) {
                throw new Error(`missing provider for ${activeSigner.rdns}`);
            }
            configureHardwareProvider(activeSigner.rdns, { asset });
            await refreshConnectedSigner(
                hardwareProvider,
                activeSigner.rdns,
                sanitizedChainId,
            );
            return;
        }

        if (
            activeSigner?.rdns === walletConnectRdns &&
            WalletConnectProvider.isTrustWallet()
        ) {
            WalletConnectProvider.setEvmChainId(network.chainId);
            await refreshConnectedSigner(
                currentRawProvider,
                activeSigner.rdns,
                sanitizedChainId,
            );
            return;
        }

        try {
            await currentRawProvider.request({
                method: "wallet_switchEthereumChain",
                params: [
                    {
                        chainId: sanitizedChainId,
                    },
                ],
            });
        } catch (switchError) {
            const switchErrorCode =
                typeof switchError === "object" &&
                switchError !== null &&
                "code" in switchError
                    ? switchError.code
                    : undefined;
            const switchErrorMessage =
                typeof switchError === "object" &&
                switchError !== null &&
                "message" in switchError &&
                typeof switchError.message === "string"
                    ? switchError.message
                    : "";
            if (
                switchErrorCode === 4902 ||
                // Rabby does not set the correct error code
                switchErrorMessage.includes("Try adding the chain")
            ) {
                if (network.nativeCurrency === undefined) {
                    throw new Error(
                        `missing nativeCurrency config for asset ${asset}`,
                        { cause: switchError },
                    );
                }
                const addChainParams: AddEthereumChainParams = {
                    chainId: sanitizedChainId,
                    chainName: network.chainName,
                    rpcUrls: requireRpcUrls(asset),
                    nativeCurrency,
                };

                if (assetConfig?.blockExplorerUrl) {
                    addChainParams.blockExplorerUrls = [
                        assetConfig.blockExplorerUrl.normal,
                    ];
                }

                await currentRawProvider.request({
                    method: "wallet_addEthereumChain",
                    params: [addChainParams],
                });

                return;
            }

            throw switchError;
        }
    };

    return (
        <Web3SignerContext.Provider
            value={{
                signer,
                connectedWallet,
                providers,
                getEtherSwap,
                getErc20Swap,
                switchNetwork,
                connectProvider,
                browserWalletTransports,
                openWalletConnectModal,
                setOpenWalletConnectModal,
                walletConnected,
                setWalletConnected,
                connectProviderForAddress,
                getContractsForAsset,
                getGasAbstractionSigner,
                clearSigner: () => {
                    log.info(`Clearing connected signer`);
                    const currentRawProvider = rawProvider();
                    if (currentRawProvider !== undefined) {
                        currentRawProvider.removeAllListeners("chainChanged");
                    }

                    setWalletConnected(false);
                    setConnectedWallet(undefined);
                    setRawProvider(undefined);
                },
            }}>
            {props.children}
        </Web3SignerContext.Provider>
    );
};

const useWeb3Signer = () => {
    const context = useContext(Web3SignerContext);
    if (!context) {
        throw new Error("useWeb3Signer: cannot find a Web3SignerContext");
    }
    return context;
};

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

export const erc20SwapCodeHashes = () => {
    switch (config.network) {
        case "mainnet":
            return [
                "0xad0e83b3da99b6313c179f8b9cc9b629c567e89997c01ecd0d60f66c7dd841a0",
            ];

        default:
            return undefined;
    }
};

export {
    useWeb3Signer,
    Web3SignerProvider,
    etherSwapCodeHashes,
    customDerivationPathRdns,
};
