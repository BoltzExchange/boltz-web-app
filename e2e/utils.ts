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

export const getBitcoinAddress = async (): Promise<string> => {
    return execCommand("bitcoin-cli-sim-client getnewaddress");
};

export const bitcoinSendToAddress = async (
    address: string,
    amount: string,
): Promise<string> => {
    return execCommand(
        `bitcoin-cli-sim-client sendtoaddress "${address}" ${amount}`,
    );
};

export const elementsSendToAddress = async (
    address: string,
    amount: string,
): Promise<string> => {
    return execCommand(
        `elements-cli-sim-client sendtoaddress "${address}" ${amount}`,
    );
};

export const generateBitcoinBlock = async (): Promise<string> => {
    return execCommand("bitcoin-cli-sim-client -generate");
};

export const generateLiquidBlock = async (): Promise<string> => {
    return execCommand("elements-cli-sim-client -generate");
};

export const getBitcoinWalletTx = async (txId: string): Promise<string> => {
    return execCommand(`bitcoin-cli-sim-client gettransaction ${txId}`);
};

export const payInvoiceLnd = async (invoice: string): Promise<string> => {
    return execCommand(`lncli-sim 1 payinvoice -f ${invoice}`);
};

export const generateInvoiceLnd = async (amount: number): Promise<string> => {
    return execCommand(`lncli-sim 1 addinvoice --amt ${amount}`);
};
