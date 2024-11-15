import bolt11 from "bolt11";
import { exec } from "child_process";
import { promisify } from "util";

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

export const payInvoiceLnd = (invoice: string): Promise<string> =>
    execCommand(`lncli-sim 1 payinvoice -f ${invoice}`);

export const generateInvoiceLnd = async (amount: number): Promise<string> => {
    return JSON.parse(
        await execCommand(`lncli-sim 1 addinvoice --amt ${amount}`),
    ).payment_request as string;
};

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
