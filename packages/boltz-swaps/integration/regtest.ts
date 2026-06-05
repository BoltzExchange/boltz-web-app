import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const BOLTZ_API_URL = "http://localhost:9001";

const ESPLORA_API: Record<string, string> = {
    BTC: "http://localhost:4002/api",
    "L-BTC": "http://localhost:4003/api",
};

const SCRIPTS_PREFIX =
    'docker exec boltz-scripts bash -c "source /etc/profile.d/utils.sh && ';

const execInScripts = async (command: string): Promise<string> => {
    const { stdout } = await execAsync(`${SCRIPTS_PREFIX}${command}"`);
    return stdout.trim();
};

const BACKEND_PREFIX =
    "docker exec boltz-backend boltzr-cli --grpc-certificates /boltz-data/certificates ";

const execInBackend = async (command: string): Promise<string> => {
    const { stdout } = await execAsync(`${BACKEND_PREFIX}${command}`);
    return stdout.trim();
};

export const setBackendSignersDisabled = (disabled: boolean): Promise<string> =>
    execInBackend(`signer ${disabled ? "disable" : "enable"} --all`);

export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

export const satsToCoins = (sats: number): string => (sats / 1e8).toFixed(8);

export const getBitcoinAddress = (): Promise<string> =>
    execInScripts("bitcoin-cli-sim-client getnewaddress");

export const getLiquidAddress = (): Promise<string> =>
    execInScripts("elements-cli-sim-client getnewaddress");

export const bitcoinSendToAddress = (
    address: string,
    coins: string,
): Promise<string> =>
    execInScripts(`bitcoin-cli-sim-client sendtoaddress "${address}" ${coins}`);

export const elementsSendToAddress = (
    address: string,
    coins: string,
): Promise<string> =>
    execInScripts(
        `elements-cli-sim-client sendtoaddress "${address}" ${coins}`,
    );

export const generateBitcoinBlock = (): Promise<string> =>
    execInScripts("bitcoin-cli-sim-client -generate");

export const generateLiquidBlock = (): Promise<string> =>
    execInScripts("elements-cli-sim-client -generate");

type EsploraUtxo = {
    txid: string;
    vout: number;
    value: number;
    status: { confirmed: boolean };
};

export const getAddressUtxos = async (
    asset: string,
    address: string,
): Promise<EsploraUtxo[]> => {
    const res = await fetch(`${ESPLORA_API[asset]}/address/${address}/utxo`);
    if (!res.ok) {
        return [];
    }
    return (await res.json()) as EsploraUtxo[];
};

type EsploraTxStatus = { confirmed: boolean; block_height?: number };

const getTxStatus = async (
    asset: string,
    txid: string,
): Promise<EsploraTxStatus | undefined> => {
    const res = await fetch(`${ESPLORA_API[asset]}/tx/${txid}/status`);
    if (!res.ok) {
        return undefined;
    }
    return (await res.json()) as EsploraTxStatus;
};

export const waitForTxConfirmed = async (
    asset: string,
    txid: string,
    timeoutMs = 30_000,
): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const status = await getTxStatus(asset, txid);
        if (status?.confirmed === true) {
            return;
        }
        if (Date.now() > deadline) {
            throw new Error(
                `timed out waiting for ${asset} tx ${txid} to confirm`,
            );
        }
        await sleep(300);
    }
};

export const waitForAddressUtxos = async (
    asset: string,
    address: string,
    timeoutMs = 30_000,
): Promise<EsploraUtxo[]> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const utxos = await getAddressUtxos(asset, address);
        if (utxos.length > 0) {
            return utxos;
        }
        if (Date.now() > deadline) {
            throw new Error(
                `timed out waiting for a UTXO at ${asset} address ${address}`,
            );
        }
        await sleep(300);
    }
};
