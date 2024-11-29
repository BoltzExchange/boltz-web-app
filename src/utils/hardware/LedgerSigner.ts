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
import ledgerLoader, { Transport } from "../../lazy/ledger";
import {
    DerivedAddress,
    HardwareSigner,
    derivationPaths,
} from "./HadwareSigner";

class LedgerSigner implements EIP1193Provider, HardwareSigner {
    private static readonly supportedApps = ["Ethereum", "RSK", "RSK Test"];

    private readonly provider: JsonRpcProvider;
    private readonly loader: typeof ledgerLoader;

    private transport?: Transport;
    private derivationPath = derivationPaths.Ethereum;

    constructor(
        private readonly t: (
            key: DictKey,
            values?: Record<string, unknown>,
        ) => string,
    ) {
        this.provider = new JsonRpcProvider(
            config.assets["RBTC"]?.network?.rpcUrls[0],
        );

        this.loader = ledgerLoader;
    }

    public getProvider = (): JsonRpcProvider => this.provider;

    public deriveAddresses = async (
        basePath: string,
        offset: number,
        limit: number,
    ): Promise<DerivedAddress[]> => {
        log.debug(
            `Deriving ${limit} Ledger addresses with offset ${offset} for base path: ${basePath}`,
        );

        const modules = await this.loader.get();
        await this.checkApp(modules);

        const eth = new modules.eth(this.transport);

        const addresses: DerivedAddress[] = [];
        for (let i = 0; i < limit; i++) {
            const path = `${basePath}/${offset + i}`;
            const { address } = await eth.getAddress(path);
            addresses.push({ path, address: address.toLowerCase() });
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
                await this.checkApp(modules);

                const eth = new modules.eth(this.transport);
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
                    gasLimit: (txParams as unknown as { gas: number }).gas,
                });

                const modules = await this.loader.get();
                const eth = new modules.eth(this.transport);
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

                const modules = await this.loader.get();
                const eth = new modules.eth(this.transport);
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

        return (await this.provider.send(
            request.method,
            request.params,
        )) as never;
    };

    public on = () => {};

    public removeAllListeners = () => {};

    private checkApp = async (
        modules: Awaited<ReturnType<typeof ledgerLoader.get>>,
    ) => {
        if (this.transport === undefined) {
            this.transport = await modules.webhid.create();
        }

        const openApp = (await this.getApp()).name;
        log.debug(`Ledger has app open: ${openApp}`);
        if (!LedgerSigner.supportedApps.includes(openApp)) {
            log.warn(
                `Open Ledger app ${openApp} not in supported: ${LedgerSigner.supportedApps.join(", ")}`,
            );
            await this.transport.close();
            this.transport = undefined;
            throw this.t("ledger_open_app_prompt");
        }
    };

    private getApp = async (): Promise<{
        name: string;
        version: string;
        flags: number | Buffer;
    }> => {
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

    private serializeSignature = (signature: {
        v: number | string;
        r: string;
        s: string;
    }) => {
        const v =
            typeof signature.v === "string" && !signature.v.startsWith("0x")
                ? BigInt(`0x${signature.v}`)
                : signature.v;

        return Signature.from({
            v,
            r: BigInt(`0x${signature.r}`).toString(),
            s: BigInt(`0x${signature.s}`).toString(),
        }).serialized;
    };
}

export default LedgerSigner;
