import { Page } from "@playwright/test";
import bolt11 from "bolt11";
import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";

import dict from "../src/i18n/i18n";

const execAsync = promisify(exec);

const executeInScriptsContainer =
    'docker exec boltz-scripts bash -c "source /etc/profile.d/utils.sh && ';

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
            `docker exec boltz-backend boltz-cli ${command}`,
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

export const generateLiquidBlock = (): Promise<string> =>
    execCommand("elements-cli-sim-client -generate");

export const getBitcoinWalletTx = (txId: string): Promise<string> =>
    execCommand(`bitcoin-cli-sim-client gettransaction ${txId}`);

export const getElementsWalletTx = (txId: string): Promise<string> =>
    execCommand(`elements-cli-sim-client gettransaction ${txId}`);

export const payInvoiceLnd = (invoice: string): Promise<string> =>
    execCommand(`lncli-sim 1 payinvoice -f ${invoice}`);

export const decodeLiquidRawTransaction = (tx: string): Promise<string> =>
    execCommand(`elements-cli-sim-client decoderawtransaction "${tx}"`);

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
    await page.getByText("address").click();
};
