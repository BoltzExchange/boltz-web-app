import { Show, createEffect, createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { customDerivationPathRdns, useWeb3Signer } from "../context/Web3";
import { HardwareSigner } from "../utils/hardware/HadwareSigner";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";

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
    const { getEtherSwap, signer, providers } = useWeb3Signer();
    const { t, getSwap, setSwapStorage } = useGlobalContext();

    const value = () => satoshiToWei(props.amount);

    const [signerBalance, setSignerBalance] = createSignal<bigint>(0n);

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (signer() === undefined) {
            return;
        }

        setSignerBalance(
            await signer().provider.getBalance(await signer().getAddress()),
        );
    });

    return (
        <Show
            when={signer() === undefined || signerBalance() > value()}
            fallback={<InsufficientBalance />}>
            <ContractTransaction
                /* eslint-disable-next-line solid/reactivity */
                onClick={async () => {
                    const contract = getEtherSwap();
                    const tx = await contract.lock(
                        prefix0x(props.preimageHash),
                        props.claimAddress,
                        props.timeoutBlockHeight,
                        {
                            value: value(),
                        },
                    );
                    const currentSwap = await getSwap(props.swapId);
                    currentSwap.lockupTx = tx.hash;
                    currentSwap.signer = signer().address;

                    if (customDerivationPathRdns.includes(signer().rdns)) {
                        currentSwap.derivationPath = (
                            providers()[signer().rdns]
                                .provider as unknown as HardwareSigner
                        ).getDerivationPath();
                    }

                    await setSwapStorage(currentSwap);
                }}
                children={<ConnectWallet />}
                address={{
                    address: props.signerAddress,
                    derivationPath: props.derivationPath,
                }}
                buttonText={t("send")}
                promptText={t("transaction_prompt", { button: t("send") })}
                waitingText={t("tx_in_mempool_subline")}
                showHr={false}
            />
        </Show>
    );
};

export default LockupEvm;
