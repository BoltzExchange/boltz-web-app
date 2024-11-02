import type { Address, Unsuccessful } from "@trezor/connect-web";
import type TrezorConnect from "@trezor/connect-web";
import type {
    Response,
    SuccessWithDevice,
} from "@trezor/connect/lib/types/params";
import {
    JsonRpcProvider,
    Signature,
    Transaction,
    TransactionLike,
    TypedDataEncoder,
} from "ethers";
import log from "loglevel";

import { config } from "../../config";
import { EIP1193Provider } from "../../consts/Types";
import Loader from "../../lazy/Loader";
import { HardwareSigner, derivationPaths } from "./HadwareSigner";

/* eslint-disable @typescript-eslint/no-explicit-any */

class TrezorSigner implements EIP1193Provider, HardwareSigner {
    private readonly provider: JsonRpcProvider;
    private readonly modules: Loader<typeof TrezorConnect>;

    private initialized = false;
    private derivationPath!: string;

    constructor() {
        this.provider = new JsonRpcProvider(
            config.assets["RBTC"]?.network?.rpcUrls[0],
        );
        this.setDerivationPath(derivationPaths.Ethereum);
        this.modules = new Loader("Trezor", async () => {
            return (await import("@trezor/connect-web")).default;
        });
    }

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

                const connect = await this.modules.get();
                const addresses = this.handleError<Address>(
                    await connect.ethereumGetAddress({
                        showOnTrezor: false,
                        path: this.derivationPath,
                    } as any),
                );

                return [addresses.payload.address.toLowerCase()];
            }

            case "eth_sendTransaction": {
                log.debug("Signing transaction with Trezor");

                await this.initialize();

                const txParams = request.params[0] as TransactionLike;

                const [connect, nonce, network, feeData] = await Promise.all([
                    this.modules.get(),
                    this.provider.getTransactionCount(txParams.from),
                    this.provider.getNetwork(),
                    this.provider.getFeeData(),
                ]);

                const trezorTx = {
                    to: txParams.to,
                    data: txParams.data,
                    nonce: nonce.toString(16),
                    gasLimit: (txParams as any).gas,
                    chainId: Number(network.chainId),
                    gasPrice: feeData.gasPrice.toString(16),
                    value: BigInt(txParams.value || 0).toString(16),
                };

                const signature = this.handleError(
                    await connect.ethereumSignTransaction({
                        transaction: trezorTx,
                        path: this.derivationPath,
                    } as unknown as any),
                );

                const tx = Transaction.from({
                    ...trezorTx,
                    type: 0,
                    value: txParams.value,
                    gasPrice: feeData.gasPrice,
                    nonce: Number(trezorTx.nonce),
                    signature: Signature.from(signature.payload),
                });

                await this.provider.send("eth_sendRawTransaction", [
                    tx.serialized,
                ]);

                return tx.hash;
            }

            case "eth_signTypedData_v4": {
                log.debug("Signing EIP-712 message with Trezor");

                await this.initialize();

                const message = JSON.parse(request.params[1] as string);
                const types = {
                    ...message.types,
                };
                delete types["EIP712Domain"];

                const connect = await this.modules.get();
                const signature = this.handleError(
                    await connect.ethereumSignTypedData({
                        data: message,
                        metamask_v4_compat: true,
                        path: this.derivationPath,
                        domain_separator_hash: TypedDataEncoder.hashDomain(
                            message.domain,
                        ),
                        message_hash: TypedDataEncoder.hashStruct(
                            message.primaryType,
                            types,
                            message.message,
                        ),
                    }),
                );
                return signature.payload.signature;
            }
        }

        return (await this.provider.send(
            request.method,
            request.params,
        )) as never;
    };

    public on = () => {};

    public removeAllListeners = () => {};

    private initialize = async () => {
        if (this.initialized) {
            return;
        }

        try {
            const connect = await this.modules.get();
            await connect.init({
                lazyLoad: true,
                manifest: {
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
