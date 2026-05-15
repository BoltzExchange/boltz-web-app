import { requireRpcUrls } from "boltz-swaps/config";
import { createProvider, prefix0x } from "boltz-swaps/evm";
import log from "loglevel";
import {
    type EIP1193RequestFn,
    type PublicClient,
    type Address as ViemAddress,
    getAddress,
    hashDomain,
    hashStruct,
    serializeTransaction,
} from "viem";

import type { EIP1193Provider } from "../../consts/Types";
import trezorLoader, {
    type Address,
    type Response,
    type SuccessWithDevice,
    type Unsuccessful,
} from "../../lazy/trezor";
import { estimateFeesPerGas } from "../provider";
import { yParityFromV } from "../signature";
import { trimPrefix } from "../strings";
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
    toHexQuantity,
} from "./evmTransaction";

class TrezorSigner implements EIP1193Provider, HardwareSigner {
    private readonly loader: typeof trezorLoader;

    private initialized = false;
    private initializing?: Promise<void>;
    private provider: PublicClient;
    private networkAsset: string;
    private derivationPath!: string;

    constructor() {
        this.networkAsset = getDefaultNetworkAsset();
        this.provider = createProvider(requireRpcUrls(this.networkAsset));
        this.setDerivationPath(derivationPaths.Ethereum);
        this.loader = trezorLoader;
    }

    public getProvider = () => this.provider;

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
            `Deriving ${limit} Trezor addresses with offset ${offset} for base path: ${basePath}`,
        );

        const paths: string[] = [];
        for (let i = 0; i < limit; i++) {
            paths.push(`${basePath}/${offset + i}`);
        }

        await this.initialize();
        const connect = await this.loader.get();
        const addresses = this.handleError<Address[]>(
            await connect.ethereumGetAddress({
                bundle: paths.map((path) => ({
                    path: `m/${path}`,
                    showOnTrezor: false,
                })),
            }),
        );

        return addresses.payload.map((res) => ({
            address: res.address.toLowerCase() as ViemAddress,
            path: trimPrefix(res.serializedPath, "m/"),
        }));
    };

    public getDerivationPath = () => {
        return this.derivationPath;
    };

    public setDerivationPath = (path: string) => {
        this.derivationPath = `m/${path}`;
    };

    public request = async (request: {
        method: string;
        params?: Array<unknown>;
    }) => {
        switch (request.method) {
            case "eth_requestAccounts": {
                log.debug("Getting Trezor accounts");

                await this.initialize();

                const connect = await this.loader.get();
                const addresses = this.handleError<Address>(
                    await connect.ethereumGetAddress({
                        showOnTrezor: false,
                        path: this.derivationPath,
                    }),
                );

                return [addresses.payload.address.toLowerCase()];
            }

            case "eth_sendTransaction": {
                log.debug("Signing transaction with Trezor");

                await this.initialize();

                if (request.params === undefined) {
                    throw new Error("missing params for eth_sendTransaction");
                }
                const txParams = request.params[0] as HardwareTransactionLike;
                if (txParams.from === undefined) {
                    throw new Error("missing transaction sender");
                }

                const txGas = txParams.gasLimit ?? txParams.gas;
                const [connect, nonce, chainId, feeData, fallbackGas] =
                    await Promise.all([
                        this.loader.get(),
                        this.provider.getTransactionCount({
                            address: getAddress(txParams.from),
                        }),
                        this.provider.getChainId().then(BigInt),
                        estimateFeesPerGas(this.provider),
                        txGas !== undefined && txGas !== null
                            ? Promise.resolve(undefined)
                            : this.provider.estimateGas({
                                  account: txParams.from as ViemAddress,
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
                const trezorTx = {
                    chainId: Number(resolvedTx.chainId),
                    data: resolvedTx.data,
                    gasLimit: toHexQuantity(resolvedTx.gasLimit),
                    nonce: toHexQuantity(resolvedTx.nonce),
                    to: resolvedTx.to ?? null,
                    value: toHexQuantity(resolvedTx.value),
                    ...(resolvedTx.type === 2
                        ? {
                              maxFeePerGas: toHexQuantity(
                                  resolvedTx.maxFeePerGas,
                              ),
                              maxPriorityFeePerGas: toHexQuantity(
                                  resolvedTx.maxPriorityFeePerGas,
                              ),
                              txType: 2,
                          }
                        : {
                              gasPrice: toHexQuantity(resolvedTx.gasPrice),
                          }),
                };

                const signature = this.handleError(
                    await connect.ethereumSignTransaction({
                        transaction: trezorTx,
                        path: this.derivationPath,
                    }),
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

                log.debug("Broadcasting Trezor transaction", transactionLike);

                const signedSerialized = serializeTransaction(
                    transactionLike,
                    this.normalizeSignature(signature.payload),
                );

                return await this.provider.sendRawTransaction({
                    serializedTransaction: signedSerialized,
                });
            }

            case "eth_signTypedData_v4": {
                log.debug("Signing EIP-712 message with Trezor");

                await this.initialize();

                if (request.params === undefined) {
                    throw new Error("missing params for eth_signTypedData_v4");
                }
                const message = JSON.parse(request.params[1] as string);
                const types = {
                    ...message.types,
                };
                delete types["EIP712Domain"];

                const connect = await this.loader.get();
                const signature = this.handleError(
                    await connect.ethereumSignTypedData({
                        data: message,
                        metamask_v4_compat: true,
                        path: this.derivationPath,
                        domain_separator_hash: hashDomain({
                            domain: message.domain,
                            types: message.types,
                        } as never),
                        message_hash: hashStruct({
                            primaryType: message.primaryType,
                            types,
                            data: message.message,
                        } as never),
                    }),
                );
                return signature.payload.signature;
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

    private initialize = async () => {
        if (this.initialized) {
            return;
        }
        if (this.initializing === undefined) {
            this.initializing = (async () => {
                try {
                    const connect = await this.loader.get();
                    await connect.init({
                        lazyLoad: true,
                        manifest: {
                            appName: "Boltz",
                            email: "hi@bol.tz",
                            appUrl: "https://boltz.exchange",
                        },
                    });
                } catch (e) {
                    // Tolerate the SDK's idempotency string; rethrow
                    // anything else so the caller learns about transport
                    // / popup / user-cancel failures instead of running
                    // on an uninitialised SDK.
                    const isAlreadyInitialized =
                        e instanceof Error &&
                        e.message ===
                            "TrezorConnect has been already initialized";
                    if (!isAlreadyInitialized) {
                        this.initializing = undefined;
                        throw e;
                    }
                    log.debug("TrezorConnect was already initialized");
                }
                this.initialized = true;
            })();
        }

        await this.initializing;
    };

    private handleError = <T>(
        res: Awaited<Response<T>>,
    ): SuccessWithDevice<T> => {
        if (res.success) {
            return res;
        }

        throw (res as Unsuccessful).payload.error;
    };

    private normalizeSignature = (signature: {
        v?: string | number;
        r: string;
        s: string;
    }) => {
        if (signature.v === undefined) {
            throw new Error("Trezor signature is missing v");
        }
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
}

export default TrezorSigner;
