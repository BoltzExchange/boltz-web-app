import log from "loglevel";
import { transports, wagmiConfig, walletTransport } from "src/config/wagmi";
import {
    type Address,
    type PublicClient,
    type Signature,
    type TransactionRequestBase,
    type TransactionSerializable,
    type WalletClient,
    createPublicClient,
    createWalletClient,
    hashDomain,
    hashStruct,
    serializeTransaction,
} from "viem";

import type { EIP1193Provider } from "../../consts/Types";
import type {
    Response,
    SuccessWithDevice,
    Address as TrezorAddress,
    Unsuccessful,
} from "../../lazy/trezor";
import trezorLoader from "../../lazy/trezor";
import { ensureHex, trimPrefix } from "../strings";
import type { DerivedAddress, HardwareSigner } from "./HardwareSigner";
import { derivationPaths } from "./HardwareSigner";

class TrezorSigner implements EIP1193Provider, HardwareSigner {
    private publicClient: PublicClient;
    private walletClient: WalletClient;
    private readonly loader: typeof trezorLoader;

    private initialized = false;
    private derivationPath!: string;

    constructor() {
        this.setDerivationPath(derivationPaths.Ethereum);
        this.loader = trezorLoader;
    }

    public getPublicClient = (): PublicClient => this.publicClient;
    public getWalletClient = (): WalletClient => this.walletClient;

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
        const addresses = this.handleError<TrezorAddress[]>(
            await connect.ethereumGetAddress({
                bundle: paths.map((path) => ({
                    path: `m/${path}`,
                    showOnTrezor: false,
                })),
            }),
        );

        this.publicClient = createPublicClient({
            chain: wagmiConfig.chains[0],
            transport: transports[0],
        }) as any;
        this.walletClient = createWalletClient({
            account: addresses[0].address as Address,
            chain: wagmiConfig.chains[0],
            transport: walletTransport,
        });

        return addresses.payload.map((res) => ({
            address: res.address.toLowerCase(),
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
                const addresses = this.handleError<TrezorAddress>(
                    await connect.ethereumGetAddress({
                        showOnTrezor: false,
                        path: this.derivationPath,
                    } as never),
                );

                return [addresses.payload.address.toLowerCase()];
            }

            case "eth_sendTransaction": {
                log.debug("Signing transaction with Trezor");

                await this.initialize();

                const txParams = request.params[0] as TransactionRequestBase;

                const [connect, nonce, chainId, gasPrice] = await Promise.all([
                    this.loader.get(),
                    this.publicClient.getTransactionCount({
                        address: txParams.from as Address,
                    }),
                    this.publicClient.getChainId(),
                    this.publicClient.getGasPrice(),
                ]);

                const value = BigInt(txParams.value || 0);
                const trezorTx = {
                    to: txParams.to,
                    data: txParams.data,
                    nonce: nonce.toString(16),
                    chainId,
                    gasPrice,
                    value: "0x" + value.toString(16),
                    gasLimit: txParams.gas,
                };

                const signature = this.handleError(
                    await connect.ethereumSignTransaction({
                        transaction: trezorTx,
                        path: this.derivationPath,
                    } as unknown as never),
                );

                const txSignature: Signature = {
                    v: BigInt(signature.payload.v),
                    r: ensureHex(signature.payload.r),
                    s: ensureHex(signature.payload.s),
                };
                const transactionSerializable: TransactionSerializable = {
                    to: txParams.to,
                    data: txParams.data,
                    nonce,
                    chainId,
                    gasPrice,
                    value,
                };

                log.debug(
                    "Broadcasting Trezor transaction",
                    transactionSerializable,
                );

                const serializedTransaction = serializeTransaction(
                    transactionSerializable,
                    txSignature,
                );

                const hash = await this.walletClient.sendRawTransaction({
                    serializedTransaction,
                });

                return hash;
            }

            case "eth_signTypedData_v4": {
                log.debug("Signing EIP-712 message with Trezor");

                await this.initialize();

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
                        }),
                        message_hash: hashStruct({
                            primaryType: message.primaryType,
                            types,
                            data: message.message,
                        }),
                    }),
                );
                return signature.payload.signature;
            }
        }

        return (await this.walletClient.request({
            method: request.method,
            params: request.params,
        })) as never;
    };

    public on = () => {};

    public removeAllListeners = () => {};

    private initialize = async () => {
        if (this.initialized) {
            return;
        }

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
            if (
                !(e instanceof Error) ||
                e.message !== "TrezorConnect has been already initialized"
            ) {
                log.debug("TrezorConnect already initialized");
                return;
            }
        }

        this.initialized = true;
    };

    private handleError = <T>(
        res: Awaited<Response<T>>,
    ): SuccessWithDevice<T> => {
        if (res.success) {
            return res;
        }

        throw (res as Unsuccessful).payload.error;
    };
}

export default TrezorSigner;
