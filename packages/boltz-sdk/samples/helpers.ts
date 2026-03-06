/**
 * Shared helpers for boltz-sdk samples.
 *
 * Initializes the SDK with regtest configuration and exports common utilities
 * including regtest docker exec commands for full automation.
 *
 * Run any sample with:
 *   npx tsx packages/boltz-sdk/samples/reverse/claim.ts
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hex } from "@scure/base";
import { exec } from "child_process";
import { promisify } from "util";

import { init as initLiquidZkp } from "boltz-core/dist/lib/liquid";
import { confidential } from "liquidjs-lib";

import {
    BoltzWs,
    type ECKeys,
    ECPair,
    SwapType,
    getPairs,
    init,
} from "../src/index";

const execAsync = promisify(exec);

const BOLTZ_API = "http://localhost:9001";

init({
    apiUrl: BOLTZ_API,
    network: "regtest",
});

const randomBytes = (length: number): Uint8Array => {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    return buf;
};

export const generateKeys = (): ECKeys => {
    const privKey = randomBytes(32);
    return ECPair.fromPrivateKey(privKey);
};

export const generatePreimage = () => {
    const preimage = randomBytes(32);
    const preimageHash = sha256(preimage);
    return { preimage, preimageHash };
};

/** Verify connectivity to the Boltz backend and print available pairs. */
export const checkConnection = async () => {
    console.log(`Connecting to Boltz backend at ${BOLTZ_API}...\n`);
    try {
        const pairs = await getPairs();
        const sub = Object.keys(pairs[SwapType.Submarine] || {}).length;
        const rev = Object.keys(pairs[SwapType.Reverse] || {}).length;
        const chain = Object.keys(pairs[SwapType.Chain] || {}).length;
        console.log(
            `Available pairs: ${sub} submarine, ${rev} reverse, ${chain} chain\n`,
        );
    } catch (e) {
        console.error(`Could not connect to Boltz backend at ${BOLTZ_API}`);
        console.error("Make sure regtest is running: cd regtest && ./start.sh");
        console.error(`Error: ${e}`);
        process.exit(1);
    }
};

// --- Regtest docker exec commands (same pattern as e2e/utils.ts) ---

const executeInScriptsContainer =
    'docker exec boltz-scripts bash -c "source /etc/profile.d/utils.sh && ';

const execCommand = async (command: string): Promise<string> => {
    const { stdout, stderr } = await execAsync(
        `${executeInScriptsContainer}${command}"`,
        { shell: "/bin/bash" },
    );
    if (stderr) {
        throw new Error(`Error executing command: ${stderr}`);
    }
    return stdout.trim();
};

/** Convert satoshis to BTC string for CLI commands. */
const satToBtc = (sats: number): string => (sats / 1e8).toFixed(8);

/** Generate a BOLT-11 invoice via LND in regtest. */
export const generateInvoiceLnd = async (
    amountSats: number,
): Promise<string> => {
    const result = JSON.parse(
        await execCommand(`lncli-sim 1 addinvoice --amt ${amountSats}`),
    );
    return result.payment_request as string;
};

/** Pay a Lightning invoice via LND in regtest. */
export const payInvoiceLnd = (invoice: string): Promise<string> =>
    execCommand(`lncli-sim 1 payinvoice -f ${invoice}`);

/** Send BTC to an address in regtest. */
export const bitcoinSendToAddress = (
    address: string,
    amountSats: number,
): Promise<string> =>
    execCommand(
        `bitcoin-cli-sim-client sendtoaddress "${address}" ${satToBtc(amountSats)}`,
    );

/** Send L-BTC to an address in regtest. */
export const elementsSendToAddress = (
    address: string,
    amountSats: number,
): Promise<string> =>
    execCommand(
        `elements-cli-sim-client sendtoaddress "${address}" ${satToBtc(amountSats)}`,
    );

/** Mine a Bitcoin block in regtest. */
export const generateBitcoinBlock = (): Promise<string> =>
    execCommand("bitcoin-cli-sim-client -generate");

/** Mine N Bitcoin blocks in regtest. */
export const generateBitcoinBlocks = (n: number): Promise<string> =>
    execCommand(`bitcoin-cli-sim-client -generate ${n}`);

/** Mine a Liquid block in regtest. */
export const generateLiquidBlock = (): Promise<string> =>
    execCommand("elements-cli-sim-client -generate");

/** Mine N Liquid blocks in regtest. */
export const generateLiquidBlocks = (n: number): Promise<string> =>
    execCommand(`elements-cli-sim-client -generate ${n}`);

/** Get current Bitcoin block height in regtest. */
export const getBitcoinBlockHeight = async (): Promise<number> =>
    JSON.parse(await execCommand("bitcoin-cli-sim-client getblockchaininfo"))
        .blocks as number;

/** Get current Liquid block height in regtest. */
export const getLiquidBlockHeight = async (): Promise<number> =>
    JSON.parse(await execCommand("elements-cli-sim-client getblockchaininfo"))
        .blocks as number;

/** Initialize secp256k1-zkp for Liquid transaction construction. */
export const initLiquid = async () => {
    const zkp = (await import("@vulpemventures/secp256k1-zkp")).default;
    const secp = await zkp();
    initLiquidZkp(secp);
    return { secp, confidential: new confidential.Confidential(secp) };
};

/** Force-set a swap status via boltzr-cli (for refund testing). */
export const setSwapStatus = async (
    swapId: string,
    status: string,
): Promise<void> => {
    await execAsync(
        `docker exec boltz-backend boltzr-cli --grpc-certificates /boltz-data/certificates swap set-status ${swapId} ${status}`,
        { shell: "/bin/bash" },
    );
};

/** Get a fresh Bitcoin address from the regtest wallet. */
export const getBitcoinAddress = (): Promise<string> =>
    execCommand("bitcoin-cli-sim-client getnewaddress");

/** Get a fresh Liquid address from the regtest wallet. */
export const getLiquidAddress = (): Promise<string> =>
    execCommand("elements-cli-sim-client getnewaddress");

/**
 * Shared WebSocket instance for samples.
 * Reuses a single connection across all swap status listeners.
 */
export const ws = new BoltzWs();
ws.connect();

export { hex };
