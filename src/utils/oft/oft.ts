import { oft } from "@layerzerolabs/oft-v2-solana-sdk";
import {
    EndpointProgram,
    SimpleMessageLibProgram,
    UlnProgram,
    simulateWeb3JsTransaction,
} from "@layerzerolabs/lz-solana-sdk-v2/umi";
import {
    fetchAddressLookupTable,
    mplToolbox,
    setComputeUnitLimit,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey, transactionBuilder } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromWalletAdapter, walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, hex } from "@scure/base";
import type { Provider as SolanaWalletProvider } from "@reown/appkit-utils/solana";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    Connection as SolanaConnection,
    PublicKey as SolanaPublicKey,
    ComputeBudgetProgram,
    type AccountMeta as SolanaAccountMeta,
    TransactionInstruction as SolanaTransactionInstruction,
} from "@solana/web3.js";
import {
    Contract,
    type ContractRunner,
    Interface,
    type Log,
    type TransactionReceipt,
    ZeroAddress,
    concat,
    getBytes,
    solidityPacked,
    zeroPadValue,
} from "ethers";
import log from "loglevel";
import { getNetworkTransport, getUsdt0MeshKind } from "src/consts/Assets";

import type { AlchemyCall } from "../../alchemy/Alchemy";
import { config } from "../../config";
import { NetworkTransport, Usdt0MeshKind } from "../../configs/base";
import { formatError } from "../errors";
import {
    type Provider,
    createAssetProvider,
    requireRpcUrls,
} from "../provider";

// TODO: review quote methods

type OftContract = {
    name: string;
    address: string;
    explorer: string;
};

export type OftResolvedContract = OftContract & {
    transport: NetworkTransport;
};

type OftChain = {
    name: string;
    chainId?: number;
    lzEid?: string;
    isSource?: boolean;
    contracts: OftContract[];
};

type OftTokenConfig = {
    native: OftChain[];
    legacyMesh: OftChain[];
};

type OftRegistry = Record<string, OftTokenConfig>;

const oftDeploymentsEndpoint = "https://docs.usdt0.to/api/deployments";
const defaultOftName = "usdt0";
const providerCache = new Map<string, Provider>();
const solanaConnectionCache = new Map<string, SolanaConnection>();
const executorNativeAmountExceedsCapSelector = "0x0084ce02";
const solanaMainnetLookupTableAddress =
    "AokBxha6VMLLgf97B5VYHEtqztamWmYERBmmFvjuTzJB";
const solanaTestnetLookupTableAddress =
    "9thqPdbR27A1yLWw2spwJLySemiGMXxPnEvfmXVk4KuK";
const solanaMainnetRpcFallback = "https://api.mainnet-beta.solana.com";
const solanaTestnetRpcFallback = "https://api.testnet.solana.com";
const solanaOftSendComputeUnitLimit = 250_000;
const solanaLegacyQuoteComputeUnitLimit = 1_000_000;
const layerZeroScanApiBaseUrl = "https://scan.layerzero-api.com/v1";
const solanaStorePubkeyLength = 32;
const solanaStoreTokenMintOffset = 8;
const solanaStoreTokenEscrowOffset = 40;
const solanaStoreEndpointProgramOffset = 72;
const solanaStoreFeeBpsOffset = 241;
const solanaStoreAltOptionOffset = 243;
const solanaLegacyCreditsEntriesOffset = 9;
const solanaLegacyCreditsEntrySize = 12;
const solanaPeerAddressOffset = 8;
const solanaPeerAddressLength = 32;
const solanaLegacyBpsDenominator = 10_000n;
const solanaLegacyCreditsSeed = "Credits";
const solanaLegacyEventAuthoritySeed = "__event_authority";
const solanaLegacyPeerSeed = "Peer";
const solanaMaxU64 = (1n << 64n) - 1n;

const oftAbi = [
    "function quoteOFT(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)) view returns (tuple(uint256,uint256), tuple(int256,string)[], tuple(uint256,uint256))",
    "function quoteSend(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), bool) view returns (tuple(uint256,uint256))",
    "function approvalRequired() view returns (bool)",
    "function send(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), tuple(uint256,uint256), address) payable returns (tuple(bytes32,uint64,tuple(uint256,uint256)), tuple(uint256,uint256))",
    "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
    "event OFTReceived(bytes32 indexed guid, uint32 srcEid, address indexed toAddress, uint256 amountReceivedLD)",
] as const;

const oftEvmInterface = new Interface(oftAbi);

export type SendParam = [
    number,
    string,
    bigint,
    bigint,
    string,
    string,
    string,
];

export type MsgFee = [bigint, bigint];

export type OftNativeDrop = {
    amount: bigint;
    receiver: string;
};

export type OftQuoteOptions = {
    recipient?: string;
    nativeDrop?: OftNativeDrop;
    oftName?: string;
    meshKind?: Usdt0MeshKind;
};

type OftLimit = [bigint, bigint];
type OftFeeDetail = [bigint, string];
type OftReceipt = [bigint, bigint];

type OftEventName = "OFTSent" | "OFTReceived";

type OftTransaction = {
    hash: string;
    wait: (confirmations?: number) => Promise<unknown>;
};

export type OftSentEvent = {
    guid: string;
    dstEid: bigint;
    fromAddress: string;
    amountSentLD: bigint;
    amountReceivedLD: bigint;
    logIndex: number;
};

export type OftReceivedEvent = {
    guid: string;
    srcEid: bigint;
    toAddress: string;
    amountReceivedLD: bigint;
    logIndex: number;
};

const getErrorData = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null) {
        return undefined;
    }

    const candidate = error as {
        data?: unknown;
        error?: unknown;
        info?: {
            error?: unknown;
        };
    };

    if (typeof candidate.data === "string") {
        return candidate.data;
    }

    return getErrorData(candidate.error) ?? getErrorData(candidate.info?.error);
};

export const isExecutorNativeAmountExceedsCapError = (
    error: unknown,
): boolean =>
    getErrorData(error)?.startsWith(executorNativeAmountExceedsCapSelector) ??
    false;

export const decodeExecutorNativeAmountExceedsCapError = (
    error: unknown,
):
    | {
          amount: bigint;
          cap: bigint;
      }
    | undefined => {
    const data = getErrorData(error);
    if (
        data === undefined ||
        !data.startsWith(executorNativeAmountExceedsCapSelector) ||
        data.length < 138
    ) {
        return undefined;
    }

    return {
        amount: BigInt(`0x${data.slice(10, 74)}`),
        cap: BigInt(`0x${data.slice(74, 138)}`),
    };
};

export type OftCoreContract = {
    transport: NetworkTransport;
    quoteOFT: (
        sendParam: SendParam,
    ) => Promise<[OftLimit, OftFeeDetail[], OftReceipt]>;
    quoteSend: (
        sendParam: SendParam,
        payInLzToken: boolean,
    ) => Promise<MsgFee>;
    send: (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: {
            value?: bigint;
        },
    ) => Promise<OftTransaction>;
};

export type EvmOftContract = OftCoreContract & {
    interface: Contract["interface"];
    approvalRequired: () => Promise<boolean>;
};

type EvmOftAbiContract = {
    interface: Contract["interface"];
    quoteOFT: {
        staticCall: (
            sendParam: SendParam,
        ) => Promise<[OftLimit, OftFeeDetail[], OftReceipt]>;
    };
    quoteSend: {
        staticCall: (
            sendParam: SendParam,
            payInLzToken: boolean,
        ) => Promise<MsgFee>;
    };
    approvalRequired: () => Promise<boolean>;
    send: (
        sendParam: SendParam,
        msgFee: MsgFee,
        refundAddress: string,
        overrides?: {
            value?: bigint;
        },
    ) => Promise<OftTransaction>;
};

type SolanaWalletAdapter = {
    publicKey: SolanaPublicKey | null;
    signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
    signTransaction?: <T extends Parameters<SolanaWalletProvider["signTransaction"]>[0]>(
        transaction: T,
    ) => Promise<T>;
    signAllTransactions?: <
        T extends Parameters<SolanaWalletProvider["signAllTransactions"]>[0],
    >(
        transactions: T,
    ) => Promise<T>;
};

type SolanaOftContext = {
    connection: SolanaConnection;
    programId: string;
    oftStore: string;
    credits: string;
    tokenMint: string;
    tokenEscrow: string;
    endpointProgram: string;
    feeBps: number;
    quotePayer: string;
    addressLookupTable?: unknown;
    addressLookupTableAddress?: string;
    umi: ReturnType<typeof createUmi>;
    walletAdapter?: SolanaWalletAdapter;
};

let oftDeploymentsPromise: Promise<OftRegistry> | undefined;

export const resetOftStateForTests = () => {
    oftDeploymentsPromise = undefined;
    providerCache.clear();
    solanaConnectionCache.clear();
};

const type3Option = 3;
const executorWorkerId = 1;
const optionTypeNativeDrop = 2;

const fetchOftDeployments = async (): Promise<OftRegistry> => {
    const response = await fetch(oftDeploymentsEndpoint);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch OFT deployments: ${response.status} ${response.statusText}`,
        );
    }

    const data: unknown = await response.json();
    return data as OftRegistry;
};

const getOftDeployments = (): Promise<OftRegistry> => {
    if (!oftDeploymentsPromise) {
        oftDeploymentsPromise = fetchOftDeployments().catch(
            (error: unknown) => {
                log.error(
                    "Failed to fetch OFT deployments",
                    formatError(error),
                );
                oftDeploymentsPromise = undefined;
                throw error;
            },
        );
    }

    return oftDeploymentsPromise;
};

const getMeshRegistryKey = (meshKind: Usdt0MeshKind): keyof OftTokenConfig =>
    meshKind === Usdt0MeshKind.Legacy ? "legacyMesh" : "native";

const getOftChains = (
    tokenConfig: OftTokenConfig | undefined,
    meshKind: Usdt0MeshKind = Usdt0MeshKind.Native,
): OftChain[] => {
    if (!tokenConfig) {
        return [];
    }

    return tokenConfig[getMeshRegistryKey(meshKind)];
};

const normalizeChainName = (chainName: string | undefined) =>
    chainName?.toLowerCase().replace(/\s+/g, "");

const getConfiguredMeshKind = (
    asset: string,
    meshKind?: Usdt0MeshKind,
): Usdt0MeshKind =>
    meshKind ?? config.assets?.[asset]?.mesh?.kind ?? Usdt0MeshKind.Native;

const normalizeContractName = (name: string) => name.trim().toLowerCase();

const hasContractName = (contract: OftContract, names: string[]): boolean =>
    names.includes(normalizeContractName(contract.name));

const getPrimaryOftContractNames = (transport: NetworkTransport): string[] => {
    switch (transport) {
        case NetworkTransport.Evm:
            return ["oft adapter", "oft"];

        case NetworkTransport.Solana:
            return ["oft program", "oft store"];

        case NetworkTransport.Tron:
            return ["oft"];

        default: {
            const exhaustiveCheck: never = transport;
            return exhaustiveCheck;
        }
    }
};

const ignoredOftContractNames = [
    "token",
    "source token (xaut)",
    "composer",
    "multihop composer",
    "hypercore composer",
    "safe",
];

const inferOftTransportFromContracts = (
    contracts: OftContract[],
): NetworkTransport | undefined => {
    if (
        contracts.some((contract) =>
            hasContractName(contract, ["oft program", "oft store"]),
        )
    ) {
        return NetworkTransport.Solana;
    }

    if (
        contracts.every(
            (contract) =>
                !contract.address.startsWith("0x") &&
                contract.address.startsWith("T"),
        )
    ) {
        return NetworkTransport.Tron;
    }

    if (contracts.every((contract) => contract.address.startsWith("0x"))) {
        return NetworkTransport.Evm;
    }

    return undefined;
};

const getOftChainTransport = (
    target: number | string,
    chain: OftChain,
): NetworkTransport => {
    if (typeof target === "string") {
        const configuredTransport = getNetworkTransport(target);
        if (configuredTransport !== undefined) {
            return configuredTransport;
        }
    }

    return (
        inferOftTransportFromContracts(chain.contracts) ??
        (chain.chainId !== undefined
            ? NetworkTransport.Evm
            : NetworkTransport.Solana)
    );
};

const resolveOftContracts = (
    chain: OftChain,
    target: number | string,
): OftResolvedContract[] => {
    const transport = getOftChainTransport(target, chain);

    return chain.contracts.map((contract) => ({
        ...contract,
        transport,
    }));
};

const getOftChainForAsset = async (
    asset: string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<OftChain | undefined> => {
    const deployments = await getOftDeployments();
    const tokenConfig = deployments[oftName.toLowerCase()];
    const assetConfig = config.assets?.[asset];
    const resolvedMeshKind = getConfiguredMeshKind(asset, meshKind);
    const chains = getOftChains(tokenConfig, resolvedMeshKind);
    const configuredLzEid = assetConfig?.mesh?.lzEid;
    if (configuredLzEid) {
        return chains.find((chain) => chain.lzEid === configuredLzEid);
    }

    const configuredChainId = assetConfig?.network?.chainId;
    if (configuredChainId !== undefined) {
        return chains.find((chain) => chain.chainId === configuredChainId);
    }

    const normalizedChainName = normalizeChainName(
        assetConfig?.network?.chainName,
    );
    if (normalizedChainName !== undefined) {
        return chains.find(
            (chain) => normalizeChainName(chain.name) === normalizedChainName,
        );
    }

    return undefined;
};

const getOftChain = async (
    target: number | string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<OftChain | undefined> => {
    if (typeof target === "string") {
        return getOftChainForAsset(target, oftName, meshKind);
    }

    const deployments = await getOftDeployments();
    const tokenConfig = deployments[oftName.toLowerCase()];

    return getOftChains(tokenConfig, meshKind ?? Usdt0MeshKind.Native).find(
        (chain) => chain.chainId === target,
    );
};

export const getOftProvider = (sourceAsset: string): Provider => {
    const rpcUrls = requireRpcUrls(sourceAsset);
    const cacheKey = `${sourceAsset}:${rpcUrls.join(",")}`;
    const cached = providerCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const provider = createAssetProvider(sourceAsset);
    providerCache.set(cacheKey, provider);
    log.debug("Created OFT provider", {
        sourceAsset,
        rpcUrlCount: rpcUrls.length,
    });
    return provider;
};

export const getQuotedOftContract = async (
    sourceAsset: string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<OftCoreContract> => {
    const oftContract = await getOftContract(sourceAsset, oftName, meshKind);
    if (!oftContract) {
        throw new Error(
            `Missing OFT contract for asset ${sourceAsset} and OFT ${oftName}`,
        );
    }

    return createOftContract(
        sourceAsset,
        oftContract,
        oftContract.transport === NetworkTransport.Evm
            ? getOftProvider(sourceAsset)
            : undefined,
    );
};

export const getOftLzEid = async (
    target: number | string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<string | undefined> => {
    const chain = await getOftChain(target, oftName, meshKind);
    return chain?.lzEid;
};

export const getOftContracts = async (
    target: number | string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<OftResolvedContract[]> => {
    const chain = await getOftChain(target, oftName, meshKind);
    if (chain === undefined) {
        return [];
    }

    return resolveOftContracts(chain, target);
};

export const getOftContract = async (
    target: number | string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<OftResolvedContract | undefined> => {
    const contracts = await getOftContracts(target, oftName, meshKind);
    const transport = contracts[0]?.transport;
    if (transport === undefined) {
        return undefined;
    }

    for (const preferredName of getPrimaryOftContractNames(transport)) {
        const contract = contracts.find(
            (candidate) => normalizeContractName(candidate.name) === preferredName,
        );
        if (contract !== undefined) {
            return contract;
        }
    }

    return contracts.find(
        (contract) =>
            !hasContractName(contract, ignoredOftContractNames),
    );
};

const getOftContractByNames = (
    contracts: OftResolvedContract[],
    names: string[],
): OftResolvedContract | undefined =>
    contracts.find((contract) => hasContractName(contract, names));

const getOftStoreContract = async (
    target: number | string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<OftResolvedContract | undefined> =>
    getOftContractByNames(await getOftContracts(target, oftName, meshKind), [
        "oft store",
    ]);

const getSolanaRpcUrls = (sourceAsset: string): string[] => {
    const urls = [...requireRpcUrls(sourceAsset)];

    switch (config.network) {
        case "mainnet":
            urls.push(solanaMainnetRpcFallback);
            break;

        case "testnet":
            urls.push(solanaTestnetRpcFallback);
            break;

        default:
            break;
    }

    return [...new Set(urls)];
};

const getSolanaConnection = (sourceAsset: string): SolanaConnection => {
    const rpcUrl = getSolanaRpcUrls(sourceAsset)[0];
    const cached = solanaConnectionCache.get(rpcUrl);
    if (cached !== undefined) {
        return cached;
    }

    const connection = new SolanaConnection(rpcUrl, "confirmed");
    solanaConnectionCache.set(rpcUrl, connection);
    return connection;
};

export const getSolanaOftConnection = (sourceAsset: string): SolanaConnection =>
    getSolanaConnection(sourceAsset);

type SolanaLegacyStoreInfo = {
    tokenMint: string;
    tokenEscrow: string;
    endpointProgram: string;
    feeBps: number;
    addressLookupTableAddress?: string;
};

const getSolanaDataView = (data: Uint8Array): DataView =>
    new DataView(data.buffer, data.byteOffset, data.byteLength);

const parseSolanaStorePubkey = (
    data: Uint8Array,
    offset: number,
): string => {
    const bytes = data.subarray(offset, offset + solanaStorePubkeyLength);
    if (bytes.length !== solanaStorePubkeyLength) {
        throw new Error(
            `Invalid Solana OFT store layout: missing pubkey at offset ${offset}`,
        );
    }

    return base58.encode(bytes);
};

const parseSolanaStoreOptionPubkey = (
    data: Uint8Array,
    offset: number,
): string | undefined => {
    if (data[offset] === 0) {
        return undefined;
    }

    return parseSolanaStorePubkey(data, offset + 1);
};

const parseSolanaLegacyStoreAccount = (
    data: Uint8Array,
): SolanaLegacyStoreInfo => {
    const view = getSolanaDataView(data);

    return {
        tokenMint: parseSolanaStorePubkey(data, solanaStoreTokenMintOffset),
        tokenEscrow: parseSolanaStorePubkey(data, solanaStoreTokenEscrowOffset),
        endpointProgram: parseSolanaStorePubkey(
            data,
            solanaStoreEndpointProgramOffset,
        ),
        feeBps: view.getUint16(solanaStoreFeeBpsOffset, true),
        addressLookupTableAddress: parseSolanaStoreOptionPubkey(
            data,
            solanaStoreAltOptionOffset,
        ),
    };
};

const parseSolanaLegacyCreditsAccount = (data: Uint8Array): Map<number, bigint> => {
    const view = getSolanaDataView(data);
    const entriesLength = view.getUint32(solanaLegacyCreditsEntriesOffset, true);
    const entries = new Map<number, bigint>();

    let offset = solanaLegacyCreditsEntriesOffset + 4;
    for (let index = 0; index < entriesLength; index += 1) {
        const eid = view.getUint32(offset, true);
        const amount = view.getBigUint64(offset + 4, true);
        entries.set(eid, amount);
        offset += solanaLegacyCreditsEntrySize;
    }

    return entries;
};

const parseSolanaLegacyPeerAddress = (data: Uint8Array): Uint8Array => {
    const peerAddress = data.subarray(
        solanaPeerAddressOffset,
        solanaPeerAddressOffset + solanaPeerAddressLength,
    );
    if (peerAddress.length !== solanaPeerAddressLength) {
        throw new Error("Invalid Solana peer account layout");
    }

    return peerAddress;
};

const concatBytes = (...chunks: Uint8Array[]): Uint8Array => {
    const result = new Uint8Array(
        chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
};

const encodeSolanaU32 = (value: number, littleEndian = true): Uint8Array => {
    const bytes = new Uint8Array(4);
    getSolanaDataView(bytes).setUint32(0, value, littleEndian);
    return bytes;
};

const encodeSolanaU64 = (value: bigint): Uint8Array => {
    if (value < 0n || value > solanaMaxU64) {
        throw new Error(`Solana OFT amount exceeds u64 range: ${value.toString()}`);
    }

    const bytes = new Uint8Array(8);
    getSolanaDataView(bytes).setBigUint64(0, value, true);
    return bytes;
};

const encodeSolanaBytesVec = (value: Uint8Array): Uint8Array =>
    concatBytes(encodeSolanaU32(value.length), value);

const encodeSolanaOptionBytesVec = (
    value: Uint8Array | undefined,
): Uint8Array =>
    value === undefined
        ? Uint8Array.of(0)
        : concatBytes(Uint8Array.of(1), encodeSolanaBytesVec(value));

const getSolanaAnchorDiscriminator = (instructionName: string): Uint8Array =>
    sha256(new TextEncoder().encode(`global:${instructionName}`)).subarray(0, 8);

const deriveSolanaLegacyPda = (
    programId: string,
    ...seeds: Uint8Array[]
): SolanaPublicKey =>
    SolanaPublicKey.findProgramAddressSync(
        seeds.map((seed) => Buffer.from(seed)),
        new SolanaPublicKey(programId),
    )[0];

const deriveSolanaLegacyCreditsAddress = (programId: string): SolanaPublicKey =>
    deriveSolanaLegacyPda(
        programId,
        new TextEncoder().encode(solanaLegacyCreditsSeed),
    );

const deriveSolanaLegacyPeerAddress = (
    programId: string,
    dstEid: number,
): SolanaPublicKey =>
    deriveSolanaLegacyPda(
        programId,
        new TextEncoder().encode(solanaLegacyPeerSeed),
        encodeSolanaU32(dstEid, false),
    );

const deriveSolanaLegacyEventAuthorityAddress = (
    programId: string,
): SolanaPublicKey =>
    deriveSolanaLegacyPda(
        programId,
        new TextEncoder().encode(solanaLegacyEventAuthoritySeed),
    );

const toSolanaAccountMeta = ({
    pubkey,
    isSigner,
    isWritable,
}: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
}): SolanaAccountMeta => ({
    pubkey: new SolanaPublicKey(pubkey),
    isSigner,
    isWritable,
});

const getSolanaLookupTableAddress = (): string | undefined => {
    switch (config.network) {
        case "mainnet":
            return solanaMainnetLookupTableAddress;

        case "testnet":
            return solanaTestnetLookupTableAddress;

        default:
            return undefined;
    }
};

const getSolanaWalletAddress = async (
    walletProvider: SolanaWalletProvider,
): Promise<string | undefined> =>
    walletProvider.publicKey?.toBase58() ??
    (await walletProvider.getAccounts())[0]?.address;

const createSolanaWalletAdapter = async (
    walletProvider: SolanaWalletProvider,
): Promise<SolanaWalletAdapter> => {
    const walletAddress = await getSolanaWalletAddress(walletProvider);

    return {
        publicKey:
            walletProvider.publicKey ??
            (walletAddress !== undefined
                ? new SolanaPublicKey(walletAddress)
                : null),
        signMessage: walletProvider.signMessage,
        signTransaction: walletProvider.signTransaction,
        signAllTransactions: walletProvider.signAllTransactions,
    };
};

const getRecentSolanaStoreSigner = async (
    connection: SolanaConnection,
    storeAddress: string,
): Promise<string | undefined> => {
    const [signature] = await connection.getSignaturesForAddress(
        new SolanaPublicKey(storeAddress),
        {
            limit: 1,
        },
        "confirmed",
    );
    if (signature === undefined) {
        return undefined;
    }

    const transaction = await connection.getParsedTransaction(signature.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
    });
    const signer = transaction?.transaction.message.accountKeys.find(
        (account) => account.signer,
    )?.pubkey;

    return typeof signer === "string" ? signer : signer?.toBase58();
};

const getSolanaQuotePayer = async (
    connection: SolanaConnection,
    storeAddress: string,
    walletProvider: SolanaWalletProvider | undefined,
): Promise<string> => {
    const walletAddress =
        walletProvider === undefined
            ? undefined
            : await getSolanaWalletAddress(walletProvider);

    if (walletAddress !== undefined) {
        return walletAddress;
    }

    const recentSigner = await getRecentSolanaStoreSigner(connection, storeAddress);
    if (recentSigner !== undefined) {
        return recentSigner;
    }

    throw new Error(
        `Could not determine a valid Solana quote payer for OFT store ${storeAddress}`,
    );
};

const createSolanaUmi = async (
    connection: SolanaConnection,
    walletProvider?: SolanaWalletProvider,
): Promise<{
    umi: ReturnType<typeof createUmi>;
    walletAdapter?: SolanaWalletAdapter;
}> => {
    const umi = createUmi(connection).use(mplToolbox());
    if (walletProvider === undefined) {
        return { umi };
    }

    const walletAdapter = await createSolanaWalletAdapter(walletProvider);
    umi.use(walletAdapterIdentity(walletAdapter, true));

    return { umi, walletAdapter };
};

const getSolanaOftContext = async (
    sourceAsset: string,
    contract: OftResolvedContract,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
    walletProvider?: SolanaWalletProvider,
): Promise<SolanaOftContext> => {
    const storeContract = await getOftStoreContract(sourceAsset, oftName, meshKind);
    if (storeContract === undefined) {
        throw new Error(
            `Missing OFT store contract for asset ${sourceAsset} and OFT ${oftName}`,
        );
    }

    const oftStore = storeContract.address;
    let lastError: unknown;

    for (const rpcUrl of getSolanaRpcUrls(sourceAsset)) {
        try {
            const connection =
                solanaConnectionCache.get(rpcUrl) ??
                new SolanaConnection(rpcUrl, "confirmed");
            solanaConnectionCache.set(rpcUrl, connection);
            const accountInfo = await connection.getAccountInfo(
                new SolanaPublicKey(oftStore),
                "confirmed",
            );
            if (accountInfo === null) {
                throw new Error(`missing Solana OFT store account ${oftStore}`);
            }

            const { umi, walletAdapter } = await createSolanaUmi(
                connection,
                walletProvider,
            );
            const storeInfo = parseSolanaLegacyStoreAccount(accountInfo.data);
            const addressLookupTableAddress =
                storeInfo.addressLookupTableAddress ?? getSolanaLookupTableAddress();
            const addressLookupTable =
                addressLookupTableAddress === undefined
                    ? undefined
                    : await fetchAddressLookupTable(
                          umi,
                          publicKey(addressLookupTableAddress),
                      ).catch((error: unknown) => {
                          log.warn(
                              "Failed to fetch Solana OFT lookup table",
                              formatError(error),
                          );
                          return undefined;
                      });

            return {
                connection,
                umi,
                walletAdapter,
                programId: contract.address,
                oftStore,
                credits: deriveSolanaLegacyCreditsAddress(contract.address).toBase58(),
                tokenMint: storeInfo.tokenMint,
                tokenEscrow: storeInfo.tokenEscrow,
                endpointProgram: storeInfo.endpointProgram,
                feeBps: storeInfo.feeBps,
                quotePayer: await getSolanaQuotePayer(
                    connection,
                    storeContract.address,
                    walletProvider,
                ),
                addressLookupTable,
                addressLookupTableAddress:
                    addressLookupTableAddress === undefined
                        ? undefined
                        : addressLookupTableAddress,
            };
        } catch (error) {
            lastError = error;
            log.warn(
                "Failed to initialize Solana OFT context on RPC",
                rpcUrl,
                formatError(error),
            );
        }
    }

    throw new Error(
        `Failed to initialize Solana OFT context for ${sourceAsset}: ${formatError(lastError)}`,
    );
};

export const createEvmOftContract = (
    address: string,
    runner: ContractRunner,
): EvmOftContract => {
    const contract = new Contract(
        address,
        oftAbi,
        runner,
    ) as unknown as EvmOftAbiContract;

    return {
        transport: NetworkTransport.Evm,
        interface: contract.interface,
        quoteOFT: (sendParam) => contract.quoteOFT.staticCall(sendParam),
        quoteSend: (sendParam, payInLzToken) =>
            contract.quoteSend.staticCall(sendParam, payInLzToken),
        approvalRequired: () => contract.approvalRequired(),
        send: (sendParam, msgFee, refundAddress, overrides) =>
            contract.send(sendParam, msgFee, refundAddress, overrides),
    };
};

const getSolanaOptionBytes = (value: string): Uint8Array | undefined =>
    value === "0x" ? undefined : getBytes(value);

const getSolanaComposeMsg = (sendParam: SendParam): Uint8Array | undefined =>
    getSolanaOptionBytes(sendParam[5]);

const getSolanaTokenSource = (
    tokenMint: string,
    walletPublicKey: SolanaPublicKey,
): string =>
    getAssociatedTokenAddressSync(
        new SolanaPublicKey(tokenMint),
        walletPublicKey,
        false,
        TOKEN_PROGRAM_ID,
    ).toBase58();

const createSolanaLegacyQuoteSendInstruction = (
    context: SolanaOftContext,
    sendParam: SendParam,
    payInLzToken: boolean,
    remainingAccounts: SolanaAccountMeta[],
): SolanaTransactionInstruction =>
    new SolanaTransactionInstruction({
        programId: new SolanaPublicKey(context.programId),
        keys: [
            {
                pubkey: new SolanaPublicKey(context.oftStore),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: new SolanaPublicKey(context.credits),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: deriveSolanaLegacyPeerAddress(context.programId, sendParam[0]),
                isSigner: false,
                isWritable: false,
            },
            ...remainingAccounts,
        ],
        data: Buffer.from(
            concatBytes(
                getSolanaAnchorDiscriminator("quote_send"),
                encodeSolanaU32(sendParam[0]),
                getBytes(sendParam[1]),
                encodeSolanaU64(sendParam[2]),
                encodeSolanaU64(sendParam[3]),
                encodeSolanaBytesVec(
                    getSolanaOptionBytes(sendParam[4]) ?? new Uint8Array(),
                ),
                encodeSolanaOptionBytesVec(getSolanaComposeMsg(sendParam)),
                Uint8Array.of(payInLzToken ? 1 : 0),
            ),
        ),
    });

const createSolanaLegacySendInstruction = (
    context: SolanaOftContext,
    sendParam: SendParam,
    msgFee: MsgFee,
    signer: SolanaPublicKey,
    remainingAccounts: SolanaAccountMeta[],
): SolanaTransactionInstruction =>
    new SolanaTransactionInstruction({
        programId: new SolanaPublicKey(context.programId),
        keys: [
            {
                pubkey: signer,
                isSigner: true,
                isWritable: false,
            },
            {
                pubkey: deriveSolanaLegacyPeerAddress(context.programId, sendParam[0]),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: new SolanaPublicKey(context.oftStore),
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: new SolanaPublicKey(context.credits),
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: new SolanaPublicKey(
                    getSolanaTokenSource(context.tokenMint, signer),
                ),
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: new SolanaPublicKey(context.tokenEscrow),
                isSigner: false,
                isWritable: true,
            },
            {
                pubkey: new SolanaPublicKey(context.tokenMint),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: TOKEN_PROGRAM_ID,
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: deriveSolanaLegacyEventAuthorityAddress(context.programId),
                isSigner: false,
                isWritable: false,
            },
            {
                pubkey: new SolanaPublicKey(context.programId),
                isSigner: false,
                isWritable: false,
            },
            ...remainingAccounts,
        ],
        data: Buffer.from(
            concatBytes(
                getSolanaAnchorDiscriminator("send"),
                encodeSolanaU32(sendParam[0]),
                getBytes(sendParam[1]),
                encodeSolanaU64(sendParam[2]),
                encodeSolanaU64(sendParam[3]),
                encodeSolanaBytesVec(
                    getSolanaOptionBytes(sendParam[4]) ?? new Uint8Array(),
                ),
                encodeSolanaOptionBytesVec(getSolanaComposeMsg(sendParam)),
                encodeSolanaU64(msgFee[0]),
                encodeSolanaU64(msgFee[1]),
            ),
        ),
    });

const getSolanaLegacyMessageLibProgram = async (
    context: SolanaOftContext,
    payer: string,
    dstEid: number,
) => {
    const endpoint = new EndpointProgram.Endpoint(
        publicKey(context.endpointProgram) as never,
    );
    const sendLibrary = await endpoint.getSendLibrary(
        context.umi.rpc as never,
        publicKey(context.oftStore) as never,
        dstEid,
    );
    if (!sendLibrary.programId) {
        throw new Error("Send library not initialized for Solana legacy mesh");
    }

    const messageLibVersion = await endpoint.getMessageLibVersion(
        context.umi.rpc as never,
        publicKey(payer) as never,
        sendLibrary.programId,
    );
    if (
        messageLibVersion.major.toString() === "0" &&
        messageLibVersion.minor === 0 &&
        messageLibVersion.endpointVersion === 2
    ) {
        return {
            endpoint,
            messageLibProgram: new SimpleMessageLibProgram.SimpleMessageLib(
                sendLibrary.programId,
            ),
        };
    }
    if (
        messageLibVersion.major.toString() === "3" &&
        messageLibVersion.minor === 0 &&
        messageLibVersion.endpointVersion === 2
    ) {
        return {
            endpoint,
            messageLibProgram: new UlnProgram.Uln(sendLibrary.programId),
        };
    }

    throw new Error(
        `Unsupported Solana message library version ${messageLibVersion.major.toString()}.${messageLibVersion.minor} for endpoint ${messageLibVersion.endpointVersion}`,
    );
};

const getSolanaLegacyPeerReceiver = async (
    context: SolanaOftContext,
    dstEid: number,
): Promise<Uint8Array> => {
    const peerAddress = deriveSolanaLegacyPeerAddress(context.programId, dstEid);
    const peerInfo = await context.connection.getAccountInfo(peerAddress, "confirmed");
    if (peerInfo === null) {
        throw new Error(
            `Missing Solana legacy peer account ${peerAddress.toBase58()} for ${dstEid}`,
        );
    }

    return parseSolanaLegacyPeerAddress(peerInfo.data);
};

const getSolanaLegacyRemainingAccounts = async (
    kind: "quote" | "send",
    context: SolanaOftContext,
    payer: string,
    dstEid: number,
    receiver: Uint8Array,
): Promise<SolanaAccountMeta[]> => {
    const { endpoint, messageLibProgram } = await getSolanaLegacyMessageLibProgram(
        context,
        payer,
        dstEid,
    );
    const metas =
        kind === "quote"
            ? await endpoint.getQuoteIXAccountMetaForCPI(
                  context.umi.rpc as never,
                  publicKey(payer) as never,
                  {
                      path: {
                          sender: publicKey(context.oftStore) as never,
                          dstEid,
                          receiver,
                      },
                      msgLibProgram: messageLibProgram,
                  },
              )
            : await endpoint.getSendIXAccountMetaForCPI(
                  context.umi.rpc as never,
                  publicKey(payer) as never,
                  {
                      path: {
                          sender: publicKey(context.oftStore) as never,
                          dstEid,
                          receiver,
                      },
                      msgLibProgram: messageLibProgram,
                  },
              );

    return metas.map((meta) =>
        toSolanaAccountMeta({
            pubkey: String(meta.pubkey),
            isSigner: meta.isSigner,
            isWritable: meta.isWritable,
        }),
    );
};

const quoteSolanaLegacyOft = async (
    context: SolanaOftContext,
    sendParam: SendParam,
): Promise<[OftLimit, OftFeeDetail[], OftReceipt]> => {
    const creditsInfo = await context.connection.getAccountInfo(
        new SolanaPublicKey(context.credits),
        "confirmed",
    );
    if (creditsInfo === null) {
        throw new Error(`Missing Solana legacy credits account ${context.credits}`);
    }

    const credits = parseSolanaLegacyCreditsAccount(creditsInfo.data);
    const amountSentLd = sendParam[2];
    const amountReceivedLd =
        amountSentLd -
        (amountSentLd * BigInt(context.feeBps)) / solanaLegacyBpsDenominator;

    if (amountReceivedLd < sendParam[3]) {
        throw new Error("Solana OFT quote failed: slippage exceeded");
    }

    return [
        [0n, credits.get(sendParam[0]) ?? 0n],
        [],
        [amountSentLd, amountReceivedLd],
    ];
};

const quoteSolanaLegacySend = async (
    context: SolanaOftContext,
    sendParam: SendParam,
    payInLzToken: boolean,
): Promise<MsgFee> => {
    const receiver = await getSolanaLegacyPeerReceiver(context, sendParam[0]);
    const remainingAccounts = await getSolanaLegacyRemainingAccounts(
        "quote",
        context,
        context.quotePayer,
        sendParam[0],
        receiver,
    );
    const instruction = createSolanaLegacyQuoteSendInstruction(
        context,
        sendParam,
        payInLzToken,
        remainingAccounts,
    );
    const result = await simulateWeb3JsTransaction(
        context.umi.rpc as never,
        [
            ComputeBudgetProgram.setComputeUnitLimit({
                units: solanaLegacyQuoteComputeUnitLimit,
            }),
            instruction,
        ],
        instruction.programId,
        new SolanaPublicKey(context.quotePayer),
        oft.types.getMessagingFeeSerializer(),
        "confirmed",
        undefined,
        context.addressLookupTableAddress === undefined
            ? undefined
            : new SolanaPublicKey(context.addressLookupTableAddress),
    );

    return [result.nativeFee, result.lzTokenFee];
};

const sendSolanaLegacy = async (
    sourceAsset: string,
    context: SolanaOftContext,
    sendParam: SendParam,
    msgFee: MsgFee,
): Promise<OftTransaction> => {
    if (context.walletAdapter?.publicKey == null) {
        throw new Error(
            `Missing connected Solana wallet for OFT send from ${sourceAsset}`,
        );
    }

    const payer = context.walletAdapter.publicKey.toBase58();
    const receiver = await getSolanaLegacyPeerReceiver(context, sendParam[0]);
    const remainingAccounts = await getSolanaLegacyRemainingAccounts(
        "send",
        context,
        payer,
        sendParam[0],
        receiver,
    );
    const instruction = createSolanaLegacySendInstruction(
        context,
        sendParam,
        msgFee,
        context.walletAdapter.publicKey,
        remainingAccounts,
    );

    let txBuilder = transactionBuilder()
        .useV0()
        .add(
            setComputeUnitLimit(context.umi, {
                units: solanaOftSendComputeUnitLimit,
            }),
        )
        .add({
            instruction: fromWeb3JsInstruction(instruction),
            signers: [],
            bytesCreatedOnChain: 0,
        });

    if (context.addressLookupTable !== undefined) {
        txBuilder = txBuilder.setAddressLookupTables([
            context.addressLookupTable as never,
        ]);
    }

    const { signature, result } = await txBuilder.sendAndConfirm(context.umi);
    return {
        hash: base58.encode(signature),
        wait: () => Promise.resolve(result),
    };
};

const createSolanaOftContract = (
    sourceAsset: string,
    contract: OftResolvedContract,
    walletProvider?: SolanaWalletProvider,
): OftCoreContract => {
    const isLegacyMeshSource =
        getConfiguredMeshKind(sourceAsset) === Usdt0MeshKind.Legacy;
    const contextPromise = getSolanaOftContext(
        sourceAsset,
        contract,
        defaultOftName,
        undefined,
        walletProvider,
    );

    return {
        transport: NetworkTransport.Solana,
        quoteOFT: async (sendParam) => {
            const context = await contextPromise;
            if (isLegacyMeshSource) {
                return quoteSolanaLegacyOft(context, sendParam);
            }

            const result = await oft.quoteOft(
                context.umi.rpc as never,
                {
                    payer: publicKey(context.quotePayer) as never,
                    tokenMint: publicKey(context.tokenMint) as never,
                    tokenEscrow: publicKey(context.tokenEscrow) as never,
                },
                {
                    dstEid: sendParam[0],
                    to: getBytes(sendParam[1]),
                    amountLd: sendParam[2],
                    minAmountLd: sendParam[3],
                    options: getSolanaOptionBytes(sendParam[4]),
                    composeMsg: getSolanaOptionBytes(sendParam[5]),
                },
                publicKey(context.programId) as never,
            );

            return [
                [
                    result.oftLimits.minAmountLd,
                    result.oftLimits.maxAmountLd,
                ],
                result.oftFeeDetails.map((detail) => [
                    detail.feeAmountLd,
                    detail.description,
                ]),
                [
                    result.oftReceipt.amountSentLd,
                    result.oftReceipt.amountReceivedLd,
                ],
            ];
        },
        quoteSend: async (sendParam, payInLzToken) => {
            const context = await contextPromise;
            if (isLegacyMeshSource) {
                return quoteSolanaLegacySend(context, sendParam, payInLzToken);
            }

            const result = await oft.quote(
                context.umi.rpc as never,
                {
                    payer: publicKey(context.quotePayer) as never,
                    tokenMint: publicKey(context.tokenMint) as never,
                    tokenEscrow: publicKey(context.tokenEscrow) as never,
                },
                {
                    dstEid: sendParam[0],
                    to: getBytes(sendParam[1]),
                    amountLd: sendParam[2],
                    minAmountLd: sendParam[3],
                    options: getSolanaOptionBytes(sendParam[4]),
                    payInLzToken,
                    composeMsg: getSolanaComposeMsg(sendParam),
                },
                { oft: publicKey(context.programId) as never },
                undefined,
                context.addressLookupTableAddress === undefined
                    ? undefined
                    : (publicKey(context.addressLookupTableAddress) as never),
            );

            return [result.nativeFee, result.lzTokenFee];
        },
        send: async (sendParam, msgFee, refundAddress) => {
            void refundAddress;

            const context = await contextPromise;
            if (isLegacyMeshSource) {
                return sendSolanaLegacy(sourceAsset, context, sendParam, msgFee);
            }

            if (context.walletAdapter?.publicKey == null) {
                throw new Error(
                    `Missing connected Solana wallet for OFT send from ${sourceAsset}`,
                );
            }

            const payer = createSignerFromWalletAdapter(context.walletAdapter);
            const instruction = await oft.send(
                context.umi.rpc as never,
                {
                    payer: payer as never,
                    tokenMint: publicKey(context.tokenMint) as never,
                    tokenEscrow: publicKey(context.tokenEscrow) as never,
                    tokenSource: publicKey(
                        getSolanaTokenSource(
                            context.tokenMint,
                            context.walletAdapter.publicKey,
                        ),
                    ) as never,
                },
                {
                    dstEid: sendParam[0],
                    to: getBytes(sendParam[1]),
                    amountLd: sendParam[2],
                    minAmountLd: sendParam[3],
                    options: getSolanaOptionBytes(sendParam[4]),
                    nativeFee: msgFee[0],
                    lzTokenFee: msgFee[1],
                    composeMsg: getSolanaComposeMsg(sendParam),
                },
                {
                    oft: publicKey(context.programId) as never,
                },
            );

            let txBuilder = transactionBuilder()
                .useV0()
                .add(setComputeUnitLimit(context.umi, {
                    units: solanaOftSendComputeUnitLimit,
                }))
                .add(instruction as never);
            if (context.addressLookupTable !== undefined) {
                txBuilder = txBuilder.setAddressLookupTables([
                    context.addressLookupTable as never,
                ]);
            }

            const { signature, result } = await txBuilder.sendAndConfirm(
                context.umi,
            );
            const txHash = base58.encode(signature);

            return {
                hash: txHash,
                wait: () => Promise.resolve(result),
            };
        },
    };
};

const createUnsupportedOftContract = (
    transport: NetworkTransport,
): OftCoreContract => ({
    transport,
    quoteOFT: (...args) => {
        void args;
        return Promise.reject(
            new Error(`OFT quoteOFT is not implemented for ${transport}`),
        );
    },
    quoteSend: (...args) => {
        void args;
        return Promise.reject(
            new Error(`OFT quoteSend is not implemented for ${transport}`),
        );
    },
    send: (...args) => {
        void args;
        return Promise.reject(
            new Error(`OFT send is not implemented for ${transport}`),
        );
    },
});

export const createOftContract = (
    sourceAsset: string,
    contract: OftResolvedContract,
    runner: unknown,
): OftCoreContract => {
    switch (contract.transport) {
        case NetworkTransport.Evm:
            return createEvmOftContract(contract.address, runner as ContractRunner);

        case NetworkTransport.Solana:
            return createSolanaOftContract(
                sourceAsset,
                contract,
                runner as SolanaWalletProvider | undefined,
            );

        case NetworkTransport.Tron:
            return createUnsupportedOftContract(contract.transport);

        default: {
            const exhaustiveCheck: never = contract.transport;
            return exhaustiveCheck;
        }
    }
};

export const getSolanaOftTokenBalance = async (
    sourceAsset: string,
    ownerAddress: string,
    oftName = defaultOftName,
    meshKind?: Usdt0MeshKind,
): Promise<bigint> => {
    const contract = await getOftContract(sourceAsset, oftName, meshKind);
    if (contract?.transport !== NetworkTransport.Solana) {
        throw new Error(
            `Solana OFT token balance is only supported for Solana assets, got ${contract?.transport ?? "unknown"}`,
        );
    }

    const context = await getSolanaOftContext(
        sourceAsset,
        contract,
        oftName,
        meshKind,
    );
    const tokenSource = getSolanaTokenSource(
        context.tokenMint,
        new SolanaPublicKey(ownerAddress),
    );

    try {
        const balance = await context.connection.getTokenAccountBalance(
            new SolanaPublicKey(tokenSource),
        );
        return BigInt(balance.value.amount);
    } catch {
        return 0n;
    }
};

export const getSolanaOftNativeBalance = async (
    sourceAsset: string,
    ownerAddress: string,
): Promise<bigint> =>
    BigInt(
        await getSolanaConnection(sourceAsset).getBalance(
            new SolanaPublicKey(ownerAddress),
        ),
    );

export const getOftTransactionSender = async (
    sourceAsset: string,
    txHash: string,
): Promise<string | undefined> => {
    switch (getNetworkTransport(sourceAsset) ?? NetworkTransport.Evm) {
        case NetworkTransport.Evm:
            return (await getOftProvider(sourceAsset).getTransaction(txHash))?.from;

        case NetworkTransport.Solana: {
            const tx = await getSolanaConnection(sourceAsset).getParsedTransaction(
                txHash,
                {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0,
                },
            );
            const signerAccount = tx?.transaction.message.accountKeys.find(
                (account) => account.signer,
            );
            const signerPubkey = signerAccount?.pubkey;
            return typeof signerPubkey === "string"
                ? signerPubkey
                : signerPubkey?.toBase58();
        }

        case NetworkTransport.Tron:
            return undefined;

        default:
            return undefined;
    }
};

const getLayerZeroMessages = (payload: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(payload)) {
        return payload.filter(
            (item): item is Record<string, unknown> =>
                typeof item === "object" && item !== null,
        );
    }

    if (typeof payload !== "object" || payload === null) {
        return [];
    }

    const candidate = payload as {
        data?: unknown;
        messages?: unknown;
    };

    return [
        ...getLayerZeroMessages(candidate.data),
        ...getLayerZeroMessages(candidate.messages),
    ];
};

export const getLayerZeroMessageGuidByTxHash = async (
    txHash: string,
): Promise<string | undefined> => {
    const response = await fetch(`${layerZeroScanApiBaseUrl}/messages/tx/${txHash}`);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch LayerZero message for transaction ${txHash}: ${response.status} ${response.statusText}`,
        );
    }

    const payload: unknown = await response.json();
    return getLayerZeroMessages(payload).find(
        (message) => typeof message.guid === "string",
    )?.guid as string | undefined;
};

const getOftEventLog = (
    contract: Pick<EvmOftContract, "interface">,
    receipt: Pick<TransactionReceipt, "logs">,
    contractAddress: string,
    eventName: OftEventName,
) => {
    const oftLog = receipt.logs.find((eventLog) => {
        if (eventLog.address.toLowerCase() !== contractAddress.toLowerCase()) {
            return false;
        }

        try {
            const parsedLog = contract.interface.parseLog({
                data: eventLog.data,
                topics: eventLog.topics,
            });
            return parsedLog?.name === eventName;
        } catch {
            return false;
        }
    });

    if (oftLog === undefined) {
        throw new Error(`could not find ${eventName} event`);
    }

    return oftLog;
};

const parseOftReceivedLog = (
    contract: Pick<EvmOftContract, "interface">,
    oftReceivedLog: Log,
) => {
    const parsedOftReceived = contract.interface.parseLog({
        data: oftReceivedLog.data,
        topics: oftReceivedLog.topics,
    });
    if (parsedOftReceived?.name !== "OFTReceived") {
        throw new Error("could not parse OFTReceived event");
    }

    const { guid, srcEid, toAddress, amountReceivedLD } =
        parsedOftReceived.args;

    return {
        guid,
        srcEid,
        toAddress,
        amountReceivedLD,
        logIndex: oftReceivedLog.index,
    };
};

export const getOftSentEvent = (
    contract: Pick<EvmOftContract, "interface">,
    receipt: TransactionReceipt,
    contractAddress: string,
): OftSentEvent => {
    const oftSentLog = getOftEventLog(
        contract,
        receipt,
        contractAddress,
        "OFTSent",
    );
    const parsedOftSent = contract.interface.parseLog({
        data: oftSentLog.data,
        topics: oftSentLog.topics,
    });
    if (parsedOftSent?.name !== "OFTSent") {
        throw new Error("could not parse OFTSent event");
    }

    const { guid, dstEid, fromAddress, amountSentLD, amountReceivedLD } =
        parsedOftSent.args;

    const event = {
        guid,
        dstEid,
        fromAddress,
        amountSentLD,
        amountReceivedLD,
        logIndex: oftSentLog.index,
    };

    log.debug("Parsed OFTSent event", {
        contractAddress,
        guid,
        dstEid: dstEid.toString(),
        fromAddress,
        amountSentLD: amountSentLD.toString(),
        amountReceivedLD: amountReceivedLD.toString(),
        logIndex: oftSentLog.index,
    });

    return event;
};

export const getOftReceivedEvent = (
    contract: Pick<EvmOftContract, "interface">,
    receipt: TransactionReceipt,
    contractAddress: string,
): OftReceivedEvent => {
    const oftReceivedLog = getOftEventLog(
        contract,
        receipt,
        contractAddress,
        "OFTReceived",
    );
    const event = parseOftReceivedLog(contract, oftReceivedLog);

    log.debug("Parsed OFTReceived event", {
        contractAddress,
        guid: event.guid,
        srcEid: event.srcEid.toString(),
        toAddress: event.toAddress,
        amountReceivedLD: event.amountReceivedLD.toString(),
        logIndex: event.logIndex,
    });

    return event;
};

export const getOftSentGuid = (
    contract: Pick<EvmOftContract, "interface">,
    receipt: TransactionReceipt,
    contractAddress: string,
): string => getOftSentEvent(contract, receipt, contractAddress).guid;

export const getOftReceivedGuid = (
    contract: Pick<EvmOftContract, "interface">,
    receipt: TransactionReceipt,
    contractAddress: string,
): string => getOftReceivedEvent(contract, receipt, contractAddress).guid;

export const getOftReceivedEventByGuid = async (
    contract: Pick<EvmOftContract, "interface">,
    provider: Pick<Provider, "getLogs">,
    contractAddress: string,
    guid: string,
): Promise<OftReceivedEvent | undefined> => {
    const [eventTopic, guidTopic] = contract.interface.encodeFilterTopics(
        "OFTReceived",
        [guid],
    );
    const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: 0,
        toBlock: "latest",
        topics: [eventTopic, guidTopic],
    });
    const receivedLog = logs.find((eventLog) => {
        try {
            const parsedLog = contract.interface.parseLog({
                data: eventLog.data,
                topics: eventLog.topics,
            });
            return parsedLog?.name === "OFTReceived";
        } catch {
            return false;
        }
    });

    if (receivedLog === undefined) {
        return undefined;
    }

    const event = parseOftReceivedLog(contract, receivedLog);
    log.debug("Found OFTReceived event by guid", {
        contractAddress,
        guid: event.guid,
        srcEid: event.srcEid.toString(),
        toAddress: event.toAddress,
        amountReceivedLD: event.amountReceivedLD.toString(),
        logIndex: event.logIndex,
    });

    return event;
};

const newOptions = (): string => solidityPacked(["uint16"], [type3Option]);

const equalsBytes = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length && a.every((byte, index) => byte === b[index]);

const encodeSolanaRecipient = (recipient: string): string => {
    if (recipient.startsWith("0x")) {
        return recipient;
    }

    const decoded = base58.decode(recipient);
    if (decoded.length !== 32) {
        throw new Error(`Invalid Solana recipient address: ${recipient}`);
    }

    return `0x${hex.encode(decoded)}`;
};

const decodeTronBase58Address = (recipient: string): Uint8Array => {
    const decoded = base58.decode(recipient);
    if (decoded.length !== 25) {
        throw new Error(`Invalid Tron recipient address: ${recipient}`);
    }

    const payload = decoded.subarray(0, 21);
    const checksum = decoded.subarray(21);
    const expectedChecksum = sha256(sha256(payload)).slice(0, 4);
    if (!equalsBytes(checksum, expectedChecksum)) {
        throw new Error(`Invalid Tron recipient checksum: ${recipient}`);
    }

    if (payload[0] !== 0x41) {
        throw new Error(`Invalid Tron recipient prefix: ${recipient}`);
    }

    return payload.subarray(1);
};

const encodeTronRecipient = (recipient: string): string =>
    zeroPadValue(`0x${hex.encode(decodeTronBase58Address(recipient))}`, 32);

const encodeEvmRecipient = (recipient: string): string =>
    zeroPadValue(recipient, 32);

const encodeOftRecipient = (
    destination: number | string,
    recipient: string,
): string => {
    if (typeof destination !== "string") {
        return encodeEvmRecipient(recipient);
    }
    if (recipient === ZeroAddress) {
        return encodeEvmRecipient(recipient);
    }

    const recipientFormat =
        config.assets?.[destination]?.mesh?.recipientFormat ??
        config.assets?.[destination]?.network?.transport ??
        NetworkTransport.Evm;

    switch (recipientFormat) {
        case NetworkTransport.Solana:
            return encodeSolanaRecipient(recipient);

        case NetworkTransport.Tron:
            return encodeTronRecipient(recipient);

        case NetworkTransport.Evm:
        default:
            return encodeEvmRecipient(recipient);
    }
};

const addExecutorOption = (
    options: string,
    optionType: number,
    option: string,
): string => {
    const optionSize = getBytes(option).length + 1;

    return concat([
        options,
        solidityPacked(["uint8"], [executorWorkerId]),
        solidityPacked(["uint16"], [optionSize]),
        solidityPacked(["uint8"], [optionType]),
        option,
    ]);
};

const buildOftExtraOptions = (nativeDrop?: OftNativeDrop): string => {
    if (nativeDrop === undefined || nativeDrop.amount <= 0n) {
        return "0x";
    }

    const option = solidityPacked(
        ["uint128", "bytes32"],
        [nativeDrop.amount, zeroPadValue(nativeDrop.receiver, 32)],
    );

    return addExecutorOption(newOptions(), optionTypeNativeDrop, option);
};

const createOftSendParam = async (
    destination: number | string,
    recipient: string,
    amount: bigint,
    {
        oftName = defaultOftName,
        extraOptions = "0x",
    }: {
        oftName?: string;
        extraOptions?: string;
    } = {},
): Promise<SendParam> => {
    const lzEid = await getOftLzEid(destination, oftName);
    if (!lzEid) {
        throw new Error(
            `Missing LayerZero endpoint id for destination ${String(destination)} and OFT ${oftName}`,
        );
    }

    return [
        Number(lzEid),
        encodeOftRecipient(destination, recipient),
        amount,
        0n,
        extraOptions,
        "0x",
        "0x",
    ];
};

export const quoteOftSend = async (
    oft: OftCoreContract,
    destination: number | string,
    recipient: string,
    amount: bigint,
    { oftName = defaultOftName, nativeDrop }: OftQuoteOptions = {},
): Promise<{
    sendParam: SendParam;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
}> => {
    const sendParam = await createOftSendParam(destination, recipient, amount, {
        oftName,
        extraOptions: buildOftExtraOptions(nativeDrop),
    });
    const [oftLimit, oftFeeDetails, oftReceipt] = await oft.quoteOFT(sendParam);
    const quotedSendParam: SendParam = [...sendParam];
    quotedSendParam[3] = oftReceipt[1];

    const quotedMsgFee = await oft.quoteSend(quotedSendParam, false);
    const msgFee: MsgFee = [quotedMsgFee[0], quotedMsgFee[1]];

    return {
        sendParam: quotedSendParam,
        msgFee,
        oftLimit,
        oftFeeDetails,
        oftReceipt,
    };
};

export const buildOftSendAlchemyCall = async ({
    sourceAsset,
    destinationAsset,
    recipient,
    amount,
    refundAddress,
    oftName = defaultOftName,
}: {
    sourceAsset: string;
    destinationAsset: string;
    recipient: string;
    amount: bigint;
    refundAddress: string;
    oftName?: string;
}): Promise<AlchemyCall> => {
    const oftContract = await getOftContract(sourceAsset, oftName);
    if (oftContract === undefined) {
        throw new Error(
            `missing OFT contract for asset ${sourceAsset} and OFT ${oftName}`,
        );
    }
    if (oftContract.transport !== NetworkTransport.Evm) {
        throw new Error(
            `Alchemy OFT calldata is only supported for EVM assets, got ${oftContract.transport}`,
        );
    }

    const quotedOft = await getQuotedOftContract(
        sourceAsset,
        oftName,
        getUsdt0MeshKind(sourceAsset, destinationAsset),
    );
    const { sendParam, msgFee } = await quoteOftSend(
        quotedOft,
        destinationAsset,
        recipient ?? ZeroAddress,
        amount,
        { oftName },
    );

    return {
        to: oftContract.address,
        data: oftEvmInterface.encodeFunctionData("send", [
            sendParam,
            msgFee,
            refundAddress,
        ]),
        value: msgFee[0].toString(),
    };
};

export const quoteOftReceiveAmount = async (
    sourceAsset: string,
    destination: number | string,
    amount: bigint,
    options: OftQuoteOptions = {},
): Promise<{
    amountIn: bigint;
    amountOut: bigint;
    msgFee: MsgFee;
    oftLimit: OftLimit;
    oftFeeDetails: OftFeeDetail[];
    oftReceipt: OftReceipt;
}> => {
    if (amount === 0n) {
        return {
            amountIn: 0n,
            amountOut: 0n,
            msgFee: [0n, 0n],
            oftLimit: [0n, 0n],
            oftFeeDetails: [],
            oftReceipt: [0n, 0n],
        };
    }

    const oft = await getQuotedOftContract(
        sourceAsset,
        options.oftName,
        getUsdt0MeshKind(sourceAsset, String(destination)),
    );
    const { msgFee, oftLimit, oftFeeDetails, oftReceipt } = await quoteOftSend(
        oft,
        destination,
        options.recipient ?? ZeroAddress,
        amount,
        options,
    );

    return {
        amountIn: amount,
        amountOut: oftReceipt[1],
        msgFee,
        oftLimit,
        oftFeeDetails,
        oftReceipt,
    };
};

export const quoteOftAmountInForAmountOut = async (
    sourceAsset: string,
    destination: number | string,
    amountOut: bigint,
    options: OftQuoteOptions = {},
): Promise<bigint> => {
    if (amountOut === 0n) {
        return 0n;
    }

    let low = amountOut;
    let high = amountOut;
    let quote = await quoteOftReceiveAmount(
        sourceAsset,
        destination,
        high,
        options,
    );

    let attempts = 0;
    while (quote.amountOut < amountOut) {
        low = high + 1n;
        high *= 2n;
        quote = await quoteOftReceiveAmount(
            sourceAsset,
            destination,
            high,
            options,
        );
        attempts += 1;

        if (attempts > 32) {
            throw new Error(
                `Could not quote OFT amount for ${sourceAsset} to ${String(destination)}`,
            );
        }
    }

    while (low < high) {
        const mid = low + (high - low) / 2n;
        const midQuote = await quoteOftReceiveAmount(
            sourceAsset,
            destination,
            mid,
            options,
        );

        if (midQuote.amountOut >= amountOut) {
            high = mid;
        } else {
            low = mid + 1n;
        }
    }

    return low;
};
