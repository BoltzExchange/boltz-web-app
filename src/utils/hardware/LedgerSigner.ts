import { requireRpcUrls } from "boltz-swaps/config";
import { createProvider, prefix0x } from "boltz-swaps/evm";
import log from "loglevel";
import {
    type Address,
    type EIP1193RequestFn,
    type Hex,
    type PublicClient,
    getAddress,
    hashDomain,
    hashStruct,
    serializeSignature,
    serializeTransaction,
} from "viem";

import type { EIP1193Provider } from "../../consts/Types";
import type { DictKey } from "../../i18n/i18n";
import ledgerLoader, { type Transport } from "../../lazy/ledger";
import { estimateFeesPerGas } from "../provider";
import { yParityFromV } from "../signature";
import {
    type DerivedAddress,
    type HardwareSigner,
    derivationPaths,
    getDefaultNetworkAsset,
} from "./HardwareSigner";
import {
    type HardwareTransactionLike,
    resolveHardwareTransaction,
    toBigInt,
} from "./evmTransaction";

class LedgerSigner implements EIP1193Provider, HardwareSigner {
    private static readonly supportedApps = ["Ethereum", "RSK", "RSK Test"];

    private readonly loader: typeof ledgerLoader;

    private transport?: Transport;
    private provider: PublicClient;
    private networkAsset: string;
    private derivationPath = derivationPaths.Ethereum;

    constructor(
        private readonly t: (
            key: DictKey,
            values?: Record<string, unknown>,
        ) => string,
    ) {
        this.loader = ledgerLoader;
        this.networkAsset = getDefaultNetworkAsset();
        this.provider = createProvider(requireRpcUrls(this.networkAsset));
    }

    public getProvider = (): PublicClient => this.provider;

    public setNetworkAsset = (asset: string) => {
        if (asset === this.networkAsset) {
            return;
        }

        this.networkAsset = asset;
        this.provider = createProvider(requireRpcUrls(asset));
    };

    public deriveAddresses = async (
        basePath: string,
        offset: number,
        limit: number,
    ): Promise<DerivedAddress[]> => {
        log.debug(
            `Deriving ${limit} Ledger addresses with offset ${offset} for base path: ${basePath}`,
        );

        const modules = await this.loader.get();
        const transport = await this.checkApp(modules);

        const eth = new modules.eth(transport);

        const addresses: DerivedAddress[] = [];
        for (let i = 0; i < limit; i++) {
            const path = `${basePath}/${offset + i}`;
            const { address } = await eth.getAddress(path);
            addresses.push({
                path,
                address: address.toLowerCase() as Address,
            });
        }

        return addresses;
    };

    public getDerivationPath = () => {
        return this.derivationPath;
    };

    public setDerivationPath = (path: string) => {
        this.derivationPath = path;
    };

    public request = async (request: {
        method: string;
        params?: Array<unknown>;
    }) => {
        switch (request.method) {
            case "eth_requestAccounts": {
                log.debug("Getting Ledger accounts");

                const modules = await this.loader.get();
                const transport = await this.checkApp(modules);

                const eth = new modules.eth(transport);
                const { address } = await eth.getAddress(this.derivationPath);

                return [address.toLowerCase()];
            }

            case "eth_sendTransaction": {
                log.debug("Signing transaction with Ledger");

                if (request.params === undefined) {
                    throw new Error("missing params for eth_sendTransaction");
                }
                const txParams = request.params[0] as HardwareTransactionLike;
                if (txParams.from === undefined) {
                    throw new Error("missing transaction sender");
                }

                const txGas = txParams.gasLimit ?? txParams.gas;
                const [nonce, chainId, feeData, fallbackGas] =
                    await Promise.all([
                        this.provider.getTransactionCount({
                            address: getAddress(txParams.from),
                        }),
                        this.provider.getChainId().then(BigInt),
                        estimateFeesPerGas(this.provider),
                        txGas !== undefined && txGas !== null
                            ? Promise.resolve(undefined)
                            : this.provider.estimateGas({
                                  account: txParams.from as Address,
                                  to: txParams.to ?? undefined,
                                  data: txParams.data,
                                  value: toBigInt(txParams.value),
                              }),
                    ]);

                const resolvedTx = resolveHardwareTransaction(
                    txParams,
                    chainId,
                    nonce,
                    feeData,
                    fallbackGas,
                );
                const transactionLike = {
                    chainId: Number(resolvedTx.chainId),
                    data: resolvedTx.data,
                    gas: resolvedTx.gasLimit,
                    nonce: resolvedTx.nonce,
                    to: resolvedTx.to ?? undefined,
                    value: resolvedTx.value,
                    ...(resolvedTx.type === 2
                        ? {
                              maxFeePerGas: resolvedTx.maxFeePerGas,
                              maxPriorityFeePerGas:
                                  resolvedTx.maxPriorityFeePerGas,
                              type: "eip1559" as const,
                          }
                        : {
                              gasPrice: resolvedTx.gasPrice,
                              type: "legacy" as const,
                          }),
                };

                log.debug("Broadcasting Ledger transaction", transactionLike);

                const unsignedSerialized =
                    serializeTransaction(transactionLike);

                const modules = await this.loader.get();
                const transport = await this.checkApp(modules);
                const eth = new modules.eth(transport);
                const signature = await eth.clearSignTransaction(
                    this.derivationPath,
                    unsignedSerialized.substring(2),
                    {},
                );

                const signedSerialized = serializeTransaction(
                    transactionLike,
                    this.normalizeSignature(signature),
                );
                return await this.provider.sendRawTransaction({
                    serializedTransaction: signedSerialized,
                });
            }

            case "eth_signTypedData_v4": {
                log.debug("Signing EIP-712 message with Ledger");

                const modules = await this.loader.get();
                const transport = await this.checkApp(modules);
                const eth = new modules.eth(transport);
                if (request.params === undefined) {
                    throw new Error("missing params for eth_signTypedData_v4");
                }
                const message = JSON.parse(request.params[1] as string);

                try {
                    const signature = await eth.signEIP712Message(
                        this.derivationPath,
                        message,
                    );
                    return this.serializeSignature(signature);
                } catch (e) {
                    // Compatibility with Ledger Nano S
                    log.warn("Clear signing EIP-712 message failed", e);

                    // hashDomain reads `types["EIP712Domain"]`; hashStruct
                    // for the user struct must not see it. Clone so the
                    // delete doesn't strip it from the caller's object —
                    // and so hashDomain still has it on `message.types`.
                    const types = { ...message.types };
                    delete types["EIP712Domain"];

                    const signature = await eth.signEIP712HashedMessage(
                        this.derivationPath,
                        hashDomain({
                            domain: message.domain,
                            types: message.types,
                        }),
                        hashStruct({
                            primaryType: message.primaryType,
                            types,
                            data: message.message,
                        }),
                    );
                    return this.serializeSignature(signature);
                }
            }
        }

        const forwardRequest = this.provider.request as EIP1193RequestFn;
        return await forwardRequest({
            method: request.method,
            params: request.params ?? [],
        });
    };

    public on = () => {};

    public removeAllListeners = () => {};

    private checkApp = async (
        modules: Awaited<ReturnType<typeof ledgerLoader.get>>,
    ): Promise<Transport> => {
        if (this.transport === undefined) {
            this.transport = await modules.webhid.create();
        }
        const transport = this.transport;

        const openApp = (await this.getApp()).name;
        log.debug(`Ledger has app open: ${openApp}`);
        if (!LedgerSigner.supportedApps.includes(openApp)) {
            log.warn(
                `Open Ledger app ${openApp} not in supported: ${LedgerSigner.supportedApps.join(", ")}`,
            );
            await transport.close();
            this.transport = undefined;
            throw this.t("ledger_open_app_prompt");
        }
        return transport;
    };

    private getApp = async (): Promise<{
        name: string;
        version: string;
        flags: number | Buffer;
    }> => {
        if (this.transport === undefined) {
            throw new Error("Ledger transport is not initialised");
        }
        const r = await this.transport.send(0xb0, 0x01, 0x00, 0x00);
        let i = 0;
        const format = r[i++];

        if (format !== 1) {
            throw "format not supported";
        }

        const nameLength = r[i++];
        const name = r.subarray(i, (i += nameLength)).toString("ascii");
        const versionLength = r[i++];
        const version = r.subarray(i, (i += versionLength)).toString("ascii");
        const flagLength = r[i++];
        const flags = r.subarray(i, i + flagLength);
        return {
            name,
            version,
            flags,
        };
    };

    private normalizeSignature = (signature: {
        v: number | string;
        r: string;
        s: string;
    }) => {
        const v = BigInt(
            typeof signature.v === "string" && !signature.v.startsWith("0x")
                ? prefix0x(signature.v)
                : signature.v,
        );

        return {
            v,
            yParity: yParityFromV(v),
            r: prefix0x(signature.r),
            s: prefix0x(signature.s),
        };
    };

    private serializeSignature = (signature: {
        v: number | string;
        r: string;
        s: string;
    }): Hex => {
        return serializeSignature(this.normalizeSignature(signature));
    };
}

export default LedgerSigner;
