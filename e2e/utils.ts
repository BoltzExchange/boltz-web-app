import { type Page, expect, request } from "@playwright/test";
import axios from "axios";
import { crypto } from "bitcoinjs-lib";
import bolt11 from "bolt11";
import { exec, spawn } from "child_process";
import { randomBytes } from "crypto";
import ECPairFactory from "ecpair";
import fs from "fs";
import { networks } from "liquidjs-lib";
import { promisify } from "util";

import { config } from "../src/config";
import { type AssetType, BTC, LBTC } from "../src/consts/Assets";
import dict from "../src/i18n/i18n";
import { type UTXO } from "../src/utils/blockchain";
import { ecc } from "../src/utils/ecpair";
import { findMagicRoutingHint } from "../src/utils/magicRoutingHint";

const execAsync = promisify(exec);

const executeInScriptsContainer =
    'docker exec boltz-scripts bash -c "source /etc/profile.d/utils.sh && ';

/**
 * Execute a command in the background without waiting for its completion.
 */
const execCommandBackground = (command: string): void => {
    const child = spawn(`${executeInScriptsContainer}${command}"`, [], {
        shell: "/bin/bash",
        stdio: "ignore",
        detached: true,
        timeout: 15_000,
    });

    child.unref();
};

const execCommand = async (command: string): Promise<string> => {
    try {
        const { stdout, stderr } = await execAsync(
            `${executeInScriptsContainer}${command}"`,
            { shell: "/bin/bash" },
        );

        if (stderr) {
            throw new Error(`Error executing command: ${stderr}`);
        }

        return stdout.trim();
    } catch (error) {
        console.error(`Failed to execute command: ${command}`, error);
        throw error;
    }
};

const boltzCli = async (command: string): Promise<string> => {
    try {
        const { stdout, stderr } = await execAsync(
            `docker exec boltz-backend boltz-cli --rpc.certificates /boltz-data/certificates ${command}`,
            { shell: "/bin/bash" },
        );

        if (stderr) {
            throw new Error(`Error executing command: ${stderr}`);
        }

        return stdout.trim();
    } catch (error) {
        console.error(`Failed to execute command: ${command}`, error);
        throw error;
    }
};

export const getBitcoinAddress = (): Promise<string> =>
    execCommand("bitcoin-cli-sim-client getnewaddress");

export const getLiquidAddress = (): Promise<string> =>
    execCommand("elements-cli-sim-client getnewaddress");

export const bitcoinSendToAddress = (
    address: string,
    amount: string,
): Promise<string> =>
    execCommand(`bitcoin-cli-sim-client sendtoaddress "${address}" ${amount}`);

export const elementsSendToAddress = (
    address: string,
    amount: string | number,
): Promise<string> =>
    execCommand(`elements-cli-sim-client sendtoaddress "${address}" ${amount}`);

export const generateBitcoinBlock = (): Promise<string> =>
    execCommand("bitcoin-cli-sim-client -generate");

export const generateBitcoinBlocks = (blocks: number): Promise<string> =>
    execCommand(`bitcoin-cli-sim-client -generate ${blocks}`);

export const generateLiquidBlock = (): Promise<string> =>
    execCommand("elements-cli-sim-client -generate");

export const generateLiquidBlocks = (blocks: number): Promise<string> =>
    execCommand(`elements-cli-sim-client -generate ${blocks}`);

export const getBitcoinWalletTx = (txId: string): Promise<string> =>
    execCommand(`bitcoin-cli-sim-client gettransaction ${txId}`);

export const getElementsWalletTx = (txId: string): Promise<string> =>
    execCommand(`elements-cli-sim-client gettransaction ${txId}`);

export const payInvoiceLnd = (invoice: string): Promise<string> =>
    execCommand(`lncli-sim 1 payinvoice -f ${invoice}`);

export const payInvoiceLndBackground = (invoice: string): void => {
    execCommandBackground(`lncli-sim 1 payinvoice -f ${invoice}`);
};

export const getBitcoinBlockHeight = async (): Promise<number> => {
    return JSON.parse(
        await execCommand("bitcoin-cli-sim-client getblockchaininfo"),
    ).blocks as number;
};

export const getLiquidBlockHeight = async (): Promise<number> => {
    return JSON.parse(
        await execCommand("elements-cli-sim-client getblockchaininfo"),
    ).blocks as number;
};

export const setDisableCooperativeSignatures = (
    disable: boolean,
): Promise<string> => boltzCli(`dev-disablecooperative ${disable}`);

export const decodeLiquidRawTransaction = (tx: string): Promise<string> =>
    execCommand(`elements-cli-sim-client decoderawtransaction "${tx}"`);

export const elementsGetReceivedByAddress = async (
    address: string,
    minconf: number,
): Promise<string> => {
    return JSON.parse(
        await execCommand(
            `elements-cli-sim-client getreceivedbyaddress "${address}" ${minconf}`,
        ),
    ).bitcoin as string;
};

export const generateInvoiceLnd = async (amount: number): Promise<string> => {
    return JSON.parse(
        await execCommand(`lncli-sim 1 addinvoice --amt ${amount}`),
    ).payment_request as string;
};

export const waitForNodesToSync = async (): Promise<void> => {
    const height = JSON.parse(
        await execCommand("bitcoin-cli-sim-client getblockchaininfo"),
    ).blocks;

    const nodesToCheck = [
        async (): Promise<number> => {
            return JSON.parse(await execCommand("lncli-sim 1 getinfo"))
                .block_height as number;
        },
        async (): Promise<number> => {
            return JSON.parse(await execCommand("lightning-cli-sim 1 getinfo"))
                .blockheight as number;
        },
        async (): Promise<number> => {
            return JSON.parse(await execCommand("lncli-sim 2 getinfo"))
                .block_height as number;
        },
        async (): Promise<number> => {
            return JSON.parse(await execCommand("lightning-cli-sim 2 getinfo"))
                .blockheight as number;
        },
    ];

    for (const node of nodesToCheck) {
        while (true) {
            const nodeHeight = await node();
            if (nodeHeight === height) {
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
    }
};

export const addReferral = (name: string): Promise<string> =>
    boltzCli(`addreferral ${name} 0`);

export const setFailedToPay = async (swapId: string): Promise<void> => {
    await boltzCli(`setswapstatus ${swapId} invoice.failedToPay`);
};

export const getReferrals = async (): Promise<Record<string, unknown>> =>
    JSON.parse(await boltzCli(`getreferrals`)) as Record<string, unknown>;

export const setReferral = (
    name: string,
    config: Record<string, unknown>,
): Promise<string> =>
    boltzCli(`setreferral ${name} '${JSON.stringify(config)}'`);

export const lookupInvoiceLnd = async (
    invoice: string,
): Promise<{ state: string; r_preimage: string }> => {
    const decoded = bolt11.decode(invoice);
    let paymentHash: string | undefined;

    for (const tag of decoded.tags) {
        switch (tag.tagName) {
            case "payment_hash":
                paymentHash = tag.data as string;
                break;
        }
    }

    return JSON.parse(
        await execCommand(`lncli-sim 1 lookupinvoice ${paymentHash}`),
    ) as never;
};

export const getBolt12Offer = async (): Promise<string> => {
    return JSON.parse(await execCommand("lightning-cli-sim 1 offer any ''"))
        .bolt12 as string;
};

export const verifyRescueFile = async (page: Page) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: dict.en.download_new_key }).click();

    const fileName = "rescue-file.json";
    await (await downloadPromise).saveAs(fileName);

    await page.getByTestId("rescueFileUpload").setInputFiles(fileName);

    if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
    }
};

export const backupRescueFile = async (page: Page, fileName: string) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: dict.en.download_new_key }).click();

    await (await downloadPromise).saveAs(fileName);

    await page.getByTestId("rescueFileUpload").setInputFiles(fileName);
};

export const setupSwapAssets = async (page: Page) => {
    await page.locator(".arrow-down").first().click();
    await page.getByTestId("select-L-BTC").click();
    await page
        .locator(
            "div:nth-child(3) > .asset-wrap > .asset > .asset-selection > .arrow-down",
        )
        .click();
    await page.getByTestId("select-LN").click();
};

export const fillSwapDetails = async (page: Page) => {
    await page.getByTestId("invoice").fill(await getBolt12Offer());
    await page.getByTestId("sendAmount").fill("0.005");
    await page.getByTestId("create-swap-button").click();
};

export const createAndVerifySwap = async (page: Page, rescueFile: string) => {
    await page.goto("/");
    await setupSwapAssets(page);
    await fillSwapDetails(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: dict.en.download_new_key }).click();
    await (await downloadPromise).saveAs(rescueFile);

    await page.getByTestId("rescueFileUpload").setInputFiles(rescueFile);
    await page.getByTestId("copy_address").click();
};

export const generateInvoiceWithRoutingHint = async (
    claimAddress: string,
    invoiceAmount: number,
) => {
    const ECPair = ECPairFactory(ecc);

    const preimage = randomBytes(32);
    const claimKeys = ECPair.fromWIF(
        ECPair.makeRandom({ network: networks.regtest }).toWIF(),
        networks.regtest,
    );

    const addressHash = crypto
        .sha256(Buffer.from(claimAddress, "utf-8"))
        .toString("hex");
    const addressSignature = claimKeys.signSchnorr(
        Buffer.from(addressHash, "hex"),
    );

    const swapRes = await (
        await axios.post(`${config.apiUrl.normal}/v2/swap/reverse`, {
            address: claimAddress,
            from: BTC,
            to: LBTC,
            invoiceAmount,
            addressSignature: Buffer.from(
                Object.values(addressSignature),
            ).toString("hex"),
            claimPublicKey: Buffer.from(
                Object.values(claimKeys.publicKey),
            ).toString("hex"),
            preimageHash: crypto.sha256(preimage).toString("hex"),
        })
    ).data;

    const magicRoutingHint = findMagicRoutingHint(swapRes.invoice);

    if (magicRoutingHint === null) {
        throw new Error("no magic routing hint");
    }

    if (
        magicRoutingHint.pubkey !==
        Buffer.from(Object.values(claimKeys.publicKey)).toString("hex")
    ) {
        throw new Error("invalid public key in magic routing hint");
    }

    return swapRes.invoice as string;
};

export const fetchBip21Invoice = async (invoice: string) => {
    const requestContext = await request.newContext();

    const res = await requestContext.get(
        `${config.apiUrl.normal}/v2/swap/reverse/${invoice}/bip21`,
    );

    const data = (await res.json()) as { bip21: string; signature: string };

    return data;
};

export const getCurrentSwapId = (page: Page) => {
    const url = new URL(page.url());
    return url.pathname.split("/").pop();
};

export const waitForUTXOs = async (
    asset: AssetType,
    address: string,
    amount: number,
) => {
    await expect
        .poll(
            async () => {
                const utxos = (
                    await axios.get<UTXO[]>(
                        `${config.assets[asset].blockExplorerApis[0].normal}/address/${address}/utxo`,
                    )
                ).data;

                return utxos.length === amount;
            },
            { timeout: 30_000 },
        )
        .toBe(true);
};

export const waitForBlockHeight = async (asset: string, height: number) => {
    await expect
        .poll(
            async () => {
                const currentHeight = (
                    await axios.get<string>(
                        `${config.assets[asset].blockExplorerApis[0].normal}/blocks/tip/height`,
                    )
                ).data;
                return Number(currentHeight) >= height;
            },
            { timeout: 30_000 },
        )
        .toBe(true);
};
