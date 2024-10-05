import type { Address, Unsuccessful } from "@trezor/connect-web";
import TrezorConnect from "@trezor/connect-web";
import type {
    Response,
    SuccessWithDevice,
} from "@trezor/connect/lib/types/params";
import {
    JsonRpcProvider,
    Signature,
    Transaction,
    TransactionLike,
} from "ethers";
import log from "loglevel";

import { config } from "../../config";
import { EIP1193Provider } from "../../consts/Types";
import { HardwareSigner, derivationPaths } from "./HadwareSigner";

class TrezorSigner implements EIP1193Provider, HardwareSigner {
    private readonly provider: JsonRpcProvider;

    private initialized = false;
    private derivationPath!: string;

    constructor() {
        this.provider = new JsonRpcProvider(
            config.assets["RBTC"].network.rpcUrls[0],
        );
        this.setDerivationPath(derivationPaths.Ethereum);
    }

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

                const addresses = this.handleError<Address>(
                    await TrezorConnect.ethereumGetAddress({
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

                const [nonce, network, feeData] = await Promise.all([
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
                    await TrezorConnect.ethereumSignTransaction({
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
                const signature = this.handleError(
                    await TrezorConnect.ethereumSignTypedData({
                        data: message,
                        metamask_v4_compat: true,
                        path: this.derivationPath,
                    }),
                );
                return signature.payload.signature;
            }
        }

        return this.provider.send(request.method, request.params);
    };

    public on = () => {};

    public removeAllListeners = () => {};

    private initialize = async () => {
        if (this.initialized) {
            return;
        }

        try {
            await TrezorConnect.init({
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
            return res as SuccessWithDevice<T>;
        }

        throw (res as Unsuccessful).payload.error;
    };
}

export default TrezorSigner;
