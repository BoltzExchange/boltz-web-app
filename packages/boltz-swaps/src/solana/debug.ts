import { hex } from "@scure/base";
import type {
    Connection,
    PublicKey,
    VersionedTransaction,
} from "@solana/web3.js";

type SolanaDebugMessage = {
    header: {
        numReadonlySignedAccounts: number;
        numReadonlyUnsignedAccounts: number;
        numRequiredSignatures: number;
    };
    staticAccountKeys: PublicKey[];
    recentBlockhash: string;
    compiledInstructions: Array<{
        accountKeyIndexes: Uint8Array | number[];
        data: Uint8Array;
        programIdIndex: number;
    }>;
    addressTableLookups?: Array<{
        accountKey: PublicKey;
        readonlyIndexes: Uint8Array | number[];
        writableIndexes: Uint8Array | number[];
    }>;
};

type SolanaTransactionDebugOptions =
    | boolean
    | {
          connection?: Connection;
          includeSerializedBase64?: boolean;
      };

type SolanaSimulationDebugResult = {
    err: unknown;
    logs?: string[] | null;
    returnData?: unknown;
    unitsConsumed?: number;
};

type PhantomSimulationWarningComplianceInput = {
    connection?: Connection;
    exactBlockhashSimulation?: SolanaSimulationDebugResult;
    exactBlockhashSimulationError?: string;
    localSignerPublicKeys?: string[];
    localSignaturesAppliedBeforeWallet: boolean;
    selectedSigningMethod: "signAndSendTransaction" | "signTransaction";
    simulation: SolanaSimulationDebugResult;
    transaction: VersionedTransaction;
    walletSignerAddress: string;
};

type ProviderRecord = Record<string, unknown>;
const solanaTransactionSizeLimitBytes = 1232;
const solanaTransactionNearSizeLimitBytes = 1100;

const toArray = (value: Uint8Array | number[]): number[] => Array.from(value);

const isRecord = (value: unknown): value is ProviderRecord =>
    typeof value === "object" && value !== null;

const getString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

const getBase58 = (value: unknown): string | undefined => {
    if (isRecord(value) && typeof value.toBase58 === "function") {
        return String(value.toBase58());
    }
    return undefined;
};

const getConstructorName = (value: unknown): string | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }
    const constructor = value.constructor;
    return isRecord(constructor) || typeof constructor === "function"
        ? getString(Reflect.get(constructor, "name"))
        : undefined;
};

const getMethodPresence = (provider: ProviderRecord): Record<string, boolean> =>
    Object.fromEntries(
        [
            "connect",
            "disconnect",
            "getAccounts",
            "request",
            "sendTransaction",
            "setDefaultChain",
            "signAllTransactions",
            "signAndSendTransaction",
            "signMessage",
            "signTransaction",
        ].map((method) => [method, typeof provider[method] === "function"]),
    );

const getSessionDebugInfo = (session: unknown) => {
    if (!isRecord(session)) {
        return undefined;
    }

    const namespaces = isRecord(session.namespaces)
        ? session.namespaces
        : undefined;
    const solanaNamespace = isRecord(namespaces?.solana)
        ? namespaces.solana
        : undefined;
    const peer = isRecord(session.peer) ? session.peer : undefined;
    const metadata = isRecord(peer?.metadata) ? peer.metadata : undefined;

    return {
        solanaAccounts: Array.isArray(solanaNamespace?.accounts)
            ? solanaNamespace.accounts
            : undefined,
        solanaChains: Array.isArray(solanaNamespace?.chains)
            ? solanaNamespace.chains
            : undefined,
        solanaMethods: Array.isArray(solanaNamespace?.methods)
            ? solanaNamespace.methods
            : undefined,
        peerMetadata: metadata
            ? {
                  name: getString(metadata.name),
                  url: getString(metadata.url),
                  description: getString(metadata.description),
              }
            : undefined,
    };
};

export const getSolanaWalletProviderDebugInfo = (provider: unknown) => {
    if (!isRecord(provider)) {
        return {
            type: typeof provider,
        };
    }

    const chains = Reflect.get(provider, "chains");

    return {
        constructorName: getConstructorName(provider),
        chain: getString(provider.chain),
        id: getString(provider.id),
        name: getString(provider.name),
        providerType: getString(provider.type),
        publicKey: getBase58(provider.publicKey),
        methods: getMethodPresence(provider),
        chains: Array.isArray(chains)
            ? chains.map((chain: unknown) =>
                  isRecord(chain)
                      ? {
                            id: chain.id,
                            caipNetworkId: chain.caipNetworkId,
                            name: chain.name,
                        }
                      : chain,
              )
            : undefined,
        session: getSessionDebugInfo(provider.session),
    };
};

const sha256Hex = async (bytes: Uint8Array): Promise<string | undefined> => {
    if (globalThis.crypto?.subtle === undefined) {
        return undefined;
    }

    const digestInput = new Uint8Array(bytes);
    const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        digestInput.buffer,
    );
    return hex.encode(new Uint8Array(digest));
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    if (typeof globalThis.btoa === "function") {
        let binary = "";
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }

        return globalThis.btoa(binary);
    }

    return Buffer.from(bytes).toString("base64");
};

const normalizeOptions = (
    options: SolanaTransactionDebugOptions = false,
): { connection?: Connection; includeSerializedBase64: boolean } => {
    if (typeof options === "boolean") {
        return {
            includeSerializedBase64: options,
        };
    }

    return {
        connection: options.connection,
        includeSerializedBase64: options.includeSerializedBase64 ?? false,
    };
};

const formatDebugError = (error: unknown): string =>
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const getStaticAccountRole = (
    message: SolanaDebugMessage,
    accountIndex: number,
) => {
    const { header, staticAccountKeys } = message;
    const signedWritableCount =
        header.numRequiredSignatures - header.numReadonlySignedAccounts;
    const unsignedWritableCount =
        staticAccountKeys.length -
        header.numRequiredSignatures -
        header.numReadonlyUnsignedAccounts;
    const isSigner = accountIndex < header.numRequiredSignatures;
    const isWritable = isSigner
        ? accountIndex < signedWritableCount
        : accountIndex < header.numRequiredSignatures + unsignedWritableCount;

    return {
        isSigner,
        isWritable,
        isReadonly: !isWritable,
    };
};

const getAddressTableLookupDebugInfo = async (
    message: SolanaDebugMessage,
    connection?: Connection,
) => {
    const lookups = message.addressTableLookups ?? [];

    return await Promise.all(
        lookups.map(async (lookup, lookupIndex) => {
            const writableIndexes = toArray(lookup.writableIndexes);
            const readonlyIndexes = toArray(lookup.readonlyIndexes);
            let tableAddresses: string[] | undefined;
            let resolutionError: string | undefined;

            if (connection !== undefined) {
                try {
                    const result = await connection.getAddressLookupTable(
                        lookup.accountKey,
                    );
                    tableAddresses = result.value?.state.addresses.map(
                        (address) => address.toBase58(),
                    );
                    if (result.value === null) {
                        resolutionError = "lookup table account not found";
                    }
                } catch (error) {
                    resolutionError = formatDebugError(error);
                }
            }

            return {
                index: lookupIndex,
                accountKey: lookup.accountKey.toBase58(),
                writableIndexes,
                readonlyIndexes,
                writableAddresses: writableIndexes.map((addressIndex) => ({
                    addressIndex,
                    publicKey: tableAddresses?.[addressIndex],
                })),
                readonlyAddresses: readonlyIndexes.map((addressIndex) => ({
                    addressIndex,
                    publicKey: tableAddresses?.[addressIndex],
                })),
                resolutionError,
            };
        }),
    );
};

export const getSolanaVersionedTransactionDebugInfo = async (
    transaction: VersionedTransaction,
    options: SolanaTransactionDebugOptions = false,
) => {
    const { connection, includeSerializedBase64 } = normalizeOptions(options);
    const message = transaction.message as SolanaDebugMessage;
    const serialized = transaction.serialize();
    const staticAccountKeys = message.staticAccountKeys.map((key) =>
        key.toBase58(),
    );
    const requiredSignatures = message.header.numRequiredSignatures;
    const addressTableLookups = await getAddressTableLookupDebugInfo(
        message,
        connection,
    );
    const staticAccounts = staticAccountKeys.map((publicKey, index) => ({
        index,
        publicKey,
        source: "static",
        ...getStaticAccountRole(message, index),
    }));
    const loadedWritableAccounts = addressTableLookups.flatMap((lookup) =>
        lookup.writableAddresses.map((address) => ({
            lookupTable: lookup.accountKey,
            lookupTableAccountIndex: address.addressIndex,
            publicKey: address.publicKey,
            source: "addressLookupTableWritable",
            isSigner: false,
            isWritable: true,
            isReadonly: false,
        })),
    );
    const loadedReadonlyAccounts = addressTableLookups.flatMap((lookup) =>
        lookup.readonlyAddresses.map((address) => ({
            lookupTable: lookup.accountKey,
            lookupTableAccountIndex: address.addressIndex,
            publicKey: address.publicKey,
            source: "addressLookupTableReadonly",
            isSigner: false,
            isWritable: false,
            isReadonly: true,
        })),
    );
    const resolvedAccountKeys = [
        ...staticAccounts,
        ...loadedWritableAccounts.map((account, offset) => ({
            index: staticAccounts.length + offset,
            ...account,
        })),
        ...loadedReadonlyAccounts.map((account, offset) => ({
            index:
                staticAccounts.length + loadedWritableAccounts.length + offset,
            ...account,
        })),
    ];
    const getResolvedAccount = (accountIndex: number) =>
        resolvedAccountKeys[accountIndex] ?? {
            index: accountIndex,
            publicKey: undefined,
            source: "unresolved",
            isSigner: false,
            isWritable: false,
            isReadonly: false,
        };

    return {
        messageHeader: message.header,
        recentBlockhash: message.recentBlockhash,
        requiredSignatures,
        signerPublicKeys: staticAccountKeys.slice(0, requiredSignatures),
        signatures: transaction.signatures.map((signature, index) => ({
            index,
            publicKey: staticAccountKeys[index],
            present: signature.some((byte) => byte !== 0),
        })),
        staticAccountKeyCount: staticAccountKeys.length,
        staticAccountKeys,
        resolvedAccountKeyCount: resolvedAccountKeys.length,
        resolvedAccountKeys,
        addressTableLookupCount: addressTableLookups.length,
        addressTableLookups,
        instructionCount: message.compiledInstructions.length,
        instructions: message.compiledInstructions.map(
            (instruction, index) => ({
                index,
                programIdIndex: instruction.programIdIndex,
                programId: getResolvedAccount(instruction.programIdIndex)
                    .publicKey,
                program: getResolvedAccount(instruction.programIdIndex),
                accounts: toArray(instruction.accountKeyIndexes).map(
                    (accountIndex, accountPosition) => ({
                        accountPosition,
                        accountIndex,
                        ...getResolvedAccount(accountIndex),
                    }),
                ),
                dataLength: instruction.data.length,
                dataHex: hex.encode(instruction.data),
                dataBase64: bytesToBase64(instruction.data),
            }),
        ),
        serializedLength: serialized.length,
        serializedSha256: await sha256Hex(serialized),
        serializedBase64: includeSerializedBase64
            ? bytesToBase64(serialized)
            : undefined,
    };
};

export const getSolanaVersionedTransactionSummaryDebugInfo = async (
    transaction: VersionedTransaction,
    options: SolanaTransactionDebugOptions = false,
) => {
    const { includeSerializedBase64 } = normalizeOptions(options);
    const message = transaction.message as SolanaDebugMessage;
    const serialized = transaction.serialize();
    const staticAccountKeys = message.staticAccountKeys.map((key) =>
        key.toBase58(),
    );
    const requiredSignatures = message.header.numRequiredSignatures;

    return {
        messageHeader: message.header,
        recentBlockhash: message.recentBlockhash,
        requiredSignatures,
        signerPublicKeys: staticAccountKeys.slice(0, requiredSignatures),
        signatures: transaction.signatures.map((signature, index) => ({
            index,
            publicKey: staticAccountKeys[index],
            present: signature.some((byte) => byte !== 0),
        })),
        staticAccountKeyCount: staticAccountKeys.length,
        addressTableLookupCount: message.addressTableLookups?.length ?? 0,
        addressTableLookups: (message.addressTableLookups ?? []).map(
            (lookup, index) => ({
                index,
                accountKey: lookup.accountKey.toBase58(),
                writableIndexes: toArray(lookup.writableIndexes),
                readonlyIndexes: toArray(lookup.readonlyIndexes),
            }),
        ),
        instructionCount: message.compiledInstructions.length,
        instructions: message.compiledInstructions.map(
            (instruction, index) => ({
                index,
                programIdIndex: instruction.programIdIndex,
                programId: staticAccountKeys[instruction.programIdIndex],
                accountCount: instruction.accountKeyIndexes.length,
                dataLength: instruction.data.length,
            }),
        ),
        serializedLength: serialized.length,
        serializedSha256: await sha256Hex(serialized),
        serializedBase64: includeSerializedBase64
            ? bytesToBase64(serialized)
            : undefined,
    };
};

export const getPhantomSimulationWarningComplianceDebugInfo = async ({
    connection,
    exactBlockhashSimulation,
    exactBlockhashSimulationError,
    localSignerPublicKeys = [],
    localSignaturesAppliedBeforeWallet,
    selectedSigningMethod,
    simulation,
    transaction,
    walletSignerAddress,
}: PhantomSimulationWarningComplianceInput) => {
    const transactionInfo = await getSolanaVersionedTransactionDebugInfo(
        transaction,
        { connection },
    );
    const signerPublicKeys = transactionInfo.signerPublicKeys;
    const requiredSignatures = transactionInfo.requiredSignatures;
    const serializedLength = transactionInfo.serializedLength;
    const walletSignerIndex = signerPublicKeys.indexOf(walletSignerAddress);
    const localSignerSignatureStates = localSignerPublicKeys.map(
        (publicKey) => {
            const signature = transactionInfo.signatures.find(
                (entry) => entry.publicKey === publicKey,
            );
            return {
                publicKey,
                requiredSigner: signerPublicKeys.includes(publicKey),
                signaturePresentBeforeWallet: signature?.present ?? false,
            };
        },
    );
    const nonWalletSignerPublicKeys = signerPublicKeys.filter(
        (publicKey) => publicKey !== walletSignerAddress,
    );
    const multipleSignerMitigationCompliant =
        requiredSignatures <= 1 ||
        (selectedSigningMethod === "signTransaction" &&
            !localSignaturesAppliedBeforeWallet);
    const nearSizeLimit =
        serializedLength >= solanaTransactionNearSizeLimitBytes;
    const usesAddressLookupTables = transactionInfo.addressTableLookupCount > 0;
    const sizeGuidanceStatus = nearSizeLimit
        ? usesAddressLookupTables
            ? "near_limit_with_address_lookup_tables"
            : "near_limit_without_address_lookup_tables_review_required"
        : "not_near_limit";
    const primarySimulationPassed = simulation.err === null;
    const exactBlockhashSimulationPassed =
        exactBlockhashSimulation?.err === null;

    return {
        docsUrl:
            "https://docs.phantom.com/developer-powertools/domain-and-transaction-warnings#transaction-simulation-warning",
        docsLastChecked: "2026-06-04",
        documentedChecks: {
            signerCount: {
                requiredSignatures,
                signerPublicKeys,
                walletSignerAddress,
                walletSignerIndex,
                singleSignerPreferredByDocs: requiredSignatures === 1,
            },
            multipleSignerFlow: {
                applicable: requiredSignatures > 1,
                selectedSigningMethod,
                localSignaturesAppliedBeforeWallet,
                localSignerPublicKeys,
                localSignerSignatureStates,
                nonWalletSignerPublicKeys,
                compliant:
                    requiredSignatures <= 1 ||
                    multipleSignerMitigationCompliant,
                requirement:
                    "For multi-signer transactions, Phantom should sign first using signTransaction, then the app should collect/apply other signatures.",
            },
            transactionSize: {
                serializedLength,
                solanaTransactionSizeLimitBytes,
                solanaTransactionNearSizeLimitBytes,
                nearSizeLimit,
                addressTableLookupCount:
                    transactionInfo.addressTableLookupCount,
                usesAddressLookupTables,
                status: sizeGuidanceStatus,
                withinSolanaSizeLimit:
                    serializedLength <= solanaTransactionSizeLimitBytes,
                note: "Phantom docs say to split requests or use ALTs if the transaction approaches Solana's size limit; they do not define an exact 'approaches' threshold.",
            },
            preSigningSimulation: {
                ranBeforeWalletPrompt: true,
                options: {
                    commitment: "confirmed",
                    replaceRecentBlockhash: true,
                    sigVerify: false,
                },
                passed: primarySimulationPassed,
                err: simulation.err,
                unitsConsumed: simulation.unitsConsumed,
                logCount: simulation.logs?.length,
            },
            exactBlockhashSimulation: {
                ranBeforeWalletPrompt:
                    exactBlockhashSimulation !== undefined ||
                    exactBlockhashSimulationError !== undefined,
                options: {
                    commitment: "confirmed",
                    replaceRecentBlockhash: false,
                    sigVerify: false,
                },
                passed: exactBlockhashSimulationPassed,
                err: exactBlockhashSimulation?.err,
                error: exactBlockhashSimulationError,
                unitsConsumed: exactBlockhashSimulation?.unitsConsumed,
                logCount: exactBlockhashSimulation?.logs?.length,
            },
        },
        appSideDocsCompliance: {
            signerGuidanceCompliant: multipleSignerMitigationCompliant,
            simulationGuidanceCompliant: primarySimulationPassed,
            sizeGuidanceStatus,
            allNonAmbiguousChecksPass:
                multipleSignerMitigationCompliant &&
                primarySimulationPassed &&
                serializedLength <= solanaTransactionSizeLimitBytes,
        },
    };
};
