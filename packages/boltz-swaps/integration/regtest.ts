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

export const hasCommitmentSupport = async (asset: string): Promise<boolean> => {
    try {
        const res = await fetch(
            `${BOLTZ_API_URL}/v2/commitment/${asset}/details`,
            { signal: AbortSignal.timeout(5_000) },
        );
        return res.ok;
    } catch {
        return false;
    }
};

export const hasSubmarinePair = async (
    from: string,
    to: string,
): Promise<boolean> => {
    try {
        const res = await fetch(`${BOLTZ_API_URL}/v2/swap/submarine`, {
            signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
            return false;
        }
        const pairs = (await res.json()) as Record<
            string,
            Record<string, unknown>
        >;
        return pairs[from]?.[to] !== undefined;
    } catch {
        return false;
    }
};

export const refreshBackendBalanceCache = (symbol?: string): Promise<string> =>
    execInBackend(
        `dev refresh-balance-cache${symbol !== undefined ? ` ${symbol}` : ""}`,
    );

export const payInvoiceInBackground = (invoice: string): void => {
    exec(`${SCRIPTS_PREFIX}lncli-sim 1 payinvoice -f ${invoice}"`, () => {});
};

export const addInvoiceLnd = async (
    amountSat: number,
): Promise<{ invoice: string; paymentHash: string }> => {
    const res = JSON.parse(
        await execInScripts(`lncli-sim 1 addinvoice --amt ${amountSat}`),
    ) as { payment_request: string; r_hash: string };
    return { invoice: res.payment_request, paymentHash: res.r_hash };
};

export const cancelInvoiceLnd = (paymentHash: string): Promise<string> =>
    execInScripts(`lncli-sim 1 cancelinvoice ${paymentHash}`);

export const clnCreateOffer = async (
    label: string,
): Promise<{ offer: string; offerId: string }> => {
    const res = JSON.parse(
        await execInScripts(`lightning-cli-sim 1 offer any "${label}"`),
    ) as { bolt12: string; offer_id: string };
    return { offer: res.bolt12, offerId: res.offer_id };
};

// Total sats received on paid invoices fetched from the given offer.
export const clnOfferReceivedSats = async (
    offerId: string,
): Promise<number> => {
    const res = JSON.parse(
        await execInScripts("lightning-cli-sim 1 listinvoices"),
    ) as {
        invoices: {
            local_offer_id?: string;
            status: string;
            amount_received_msat?: number | string;
        }[];
    };
    const msat = res.invoices
        .filter((i) => i.local_offer_id === offerId && i.status === "paid")
        .reduce(
            (sum, i) =>
                sum +
                Number(String(i.amount_received_msat ?? 0).replace(/\D/g, "")),
            0,
        );
    return Math.floor(msat / 1000);
};

export const allowSwapRefund = (swapId: string): Promise<string> =>
    execInBackend(`swap allow-refund ${swapId}`);

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

// Sats received at a wallet-owned Liquid address — esplora cannot see the
// value of blinded outputs, the owning wallet can.
export const elementsGetReceivedByAddress = async (
    address: string,
): Promise<number> => {
    const received = JSON.parse(
        await execInScripts(
            `elements-cli-sim-client getreceivedbyaddress "${address}"`,
        ),
    ) as Record<string, number>;
    return Math.round((received.bitcoin ?? 0) * 1e8);
};

export const generateLiquidBlock = (): Promise<string> =>
    execInScripts("elements-cli-sim-client -generate");

const chainCli = (asset: string): string =>
    asset === "BTC" ? "bitcoin-cli-sim-client" : "elements-cli-sim-client";

export const getBlockCount = async (asset: string): Promise<number> =>
    Number((await execInScripts(`${chainCli(asset)} getblockcount`)).trim());

export const generateBlocks = (asset: string, count: number): Promise<string> =>
    execInScripts(`${chainCli(asset)} -generate ${count}`);

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
