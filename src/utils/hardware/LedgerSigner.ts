import Eth from "@ledgerhq/hw-app-eth";
import Transport from "@ledgerhq/hw-transport";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
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
import type { DictKey } from "../../i18n/i18n";
import { HardwareSigner, derivationPaths } from "./HadwareSigner";

class LedgerSigner implements EIP1193Provider, HardwareSigner {
    private static readonly supportedApps = ["Ethereum", "RSK", "RSK Test"];

    private readonly provider: JsonRpcProvider;
    private derivationPath = derivationPaths.Ethereum;

    private transport?: Transport;

    constructor(
        private readonly t: (
            key: DictKey,
            values?: Record<string, any>,
        ) => string,
    ) {
        this.provider = new JsonRpcProvider(
            config.assets["RBTC"]?.network?.rpcUrls[0],
        );
    }

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

                if (this.transport === undefined) {
                    this.transport = await TransportWebHID.create();
                }

                const openApp = (await this.getApp()).name;
                log.debug(`Ledger has app open: ${openApp}`);
                if (!LedgerSigner.supportedApps.includes(openApp)) {
                    log.warn(
                        `Open Ledger app ${openApp} not in supported: ${LedgerSigner.supportedApps}`,
                    );
                    throw this.t("ledger_open_app_prompt");
                }

                const eth = new Eth(this.transport);
                const { address } = await eth.getAddress(this.derivationPath);

                return [address.toLowerCase()];
            }

            case "eth_sendTransaction": {
                log.debug("Signing transaction with Ledger");

                const txParams = request.params[0] as TransactionLike;

                const [nonce, network, feeData] = await Promise.all([
                    this.provider.getTransactionCount(txParams.from),
                    this.provider.getNetwork(),
                    this.provider.getFeeData(),
                ]);

                const tx = Transaction.from({
                    ...txParams,
                    nonce,
                    type: 0,
                    from: undefined,
                    chainId: network.chainId,
                    gasPrice: feeData.gasPrice,
                    gasLimit: (txParams as any).gas,
                });

                const eth = new Eth(this.transport);
                const signature = await eth.clearSignTransaction(
                    this.derivationPath,
                    tx.unsignedSerialized.substring(2),
                    {},
                );

                tx.signature = this.serializeSignature(signature);
                await this.provider.send("eth_sendRawTransaction", [
                    tx.serialized,
                ]);

                return tx.hash;
            }

            case "eth_signTypedData_v4": {
                log.debug("Signing EIP-712 message with Ledger");

                const eth = new Eth(this.transport);
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

                    const types = message.types;
                    delete types["EIP712Domain"];

                    const signature = await eth.signEIP712HashedMessage(
                        this.derivationPath,
                        TypedDataEncoder.hashDomain(message.domain),
                        TypedDataEncoder.hashStruct(
                            message.primaryType,
                            types,
                            message.message,
                        ),
                    );
                    return this.serializeSignature(signature);
                }
            }
        }

        return this.provider.send(request.method, request.params);
    };

    public on = () => {};

    public removeAllListeners = () => {};

    private getApp = async (): Promise<{
        name: string;
        version: string;
        flags: number | Buffer;
    }> => {
        const r = await this.transport!.send(0xb0, 0x01, 0x00, 0x00);
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

    private serializeSignature = (signature: {
        v: number | string;
        r: string;
        s: string;
    }) =>
        Signature.from({
            v: signature.v,
            r: BigInt(`0x${signature.r}`).toString(),
            s: BigInt(`0x${signature.s}`).toString(),
        }).serialized;
}

export default LedgerSigner;
