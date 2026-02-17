import log from "loglevel";
import { Show, createEffect, createSignal } from "solid-js";
import type { Address } from "viem";

import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    EtherSwapAbi,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";
import OptimizedRoute from "./OptimizedRoute";

const lockupGasUsage = 46_000n;

const InsufficientBalance = () => {
    const { t } = useGlobalContext();

    return (
        <>
            <p>{t("insufficient_balance_line")}</p>
            <ConnectWallet />
            <button class="btn" disabled={true}>
                {t("insufficient_balance")}
            </button>
        </>
    );
};

const LockupEvm = (props: {
    swapId: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
}) => {
    const { setSwap } = usePayContext();
    const { providers, publicClient, walletClient, getContracts, currentRdns } =
        useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();

    const value = () => satoshiToWei(props.amount);

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (walletClient() === undefined) {
            return;
        }

        const [balance, gasPrice] = await Promise.all([
            publicClient().getBalance({
                address: walletClient().account.address,
            }),
            publicClient().getGasPrice(),
        ]);

        const spendable = balance - gasPrice * lockupGasUsage;
        log.info("EVM signer spendable balance", spendable);
        setSignerBalance(spendable);
    });

    const sendTransaction = async () => {
        try {
            const [account] = await walletClient().getAddresses();
            const txHash = await walletClient().writeContract({
                address: getContracts().swapContracts.EtherSwap as Address,
                abi: EtherSwapAbi,
                functionName: "lock",
                args: [
                    prefix0x(props.preimageHash),
                    props.claimAddress,
                    props.timeoutBlockHeight,
                ],
                chain: walletClient().chain,
                account,
                value: value(),
            });
            const currentSwap = await getSwap(props.swapId);
            currentSwap.lockupTx = txHash;
            currentSwap.signer = account;

            const rdns = currentRdns();
            if (
                rdns &&
                customDerivationPathRdns.includes(rdns) &&
                providers()[rdns]
            ) {
                currentSwap.derivationPath = (
                    providers()[rdns].provider as unknown as HardwareSigner
                ).getDerivationPath();
            }

            setSwap(currentSwap);
            await setSwapStorage(currentSwap);
        } catch (error) {
            log.error("Failed to send lockup transaction", error);
            throw error;
        }
    };

    return (
        <>
            <OptimizedRoute />
            <Show
                when={signerBalance() !== undefined}
                fallback={
                    <Show
                        when={walletClient() !== undefined}
                        fallback={<ConnectWallet />}>
                        <LoadingSpinner />
                    </Show>
                }>
                <Show
                    when={
                        walletClient() === undefined ||
                        signerBalance() > value()
                    }
                    fallback={<InsufficientBalance />}>
                    <ContractTransaction
                        onClick={sendTransaction}
                        children={<ConnectWallet />}
                        address={{
                            address: props.signerAddress,
                            derivationPath: props.derivationPath,
                        }}
                        buttonText={t("send")}
                        promptText={t("transaction_prompt", {
                            button: t("send"),
                        })}
                        waitingText={t("tx_in_mempool_subline")}
                        showHr={false}
                    />
                </Show>
            </Show>
        </>
    );
};

export default LockupEvm;
