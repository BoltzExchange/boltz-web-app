import type { ContractTransactionResponse } from "ethers";
import log from "loglevel";
import {
    type Accessor,
    type Setter,
    Show,
    createEffect,
    createSignal,
} from "solid-js";

import { AssetKind, getKindForAsset, getTokenAddress } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    createTokenContract,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";
import OptimizedRoute from "./OptimizedRoute";

const lockupGasUsage = 46_000n;

const InsufficientBalance = (props: { asset?: string }) => {
    const { t } = useGlobalContext();

    return (
        <>
            <p>{t("insufficient_balance_line")}</p>
            <ConnectWallet asset={props.asset} />
            <button class="btn" disabled={true}>
                {t("insufficient_balance")}
            </button>
        </>
    );
};

const ApproveErc20 = (props: {
    asset: string;
    value: () => bigint;
    signerAddress: string;
    derivationPath: string;
    setNeedsApproval: Setter<boolean>;
}) => {
    const { t } = useGlobalContext();
    const { signer, getErc20Swap } = useWeb3Signer();

    return (
        <ContractTransaction
            asset={props.asset}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const contract = createTokenContract(props.asset, signer());
                const tx = await contract.approve(
                    getErc20Swap(props.asset).getAddress(),
                    // TODO: what amount do we want to approve?
                    props.value(),
                );
                await tx.wait(1);
                log.info("ERC20 approval successful", tx.hash);
                props.setNeedsApproval(false);
            }}
            children={<ConnectWallet asset={props.asset} />}
            address={{
                address: props.signerAddress,
                derivationPath: props.derivationPath,
            }}
            buttonText={t("approve_erc20")}
            promptText={t("approve_erc20_line", {
                button: t("approve_erc20"),
            })}
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

const LockupTransaction = (props: {
    asset: string;
    value: () => bigint;
    preimageHash: string;
    claimAddress: string;
    timeoutBlockHeight: number;
    signerAddress: string;
    derivationPath?: string;
    swapId: string;
    needsApproval: Accessor<boolean>;
    setNeedsApproval: Setter<boolean>;
}) => {
    const { setSwap } = usePayContext();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { getErc20Swap, getEtherSwap, signer, providers } = useWeb3Signer();

    return (
        <Show
            when={!props.needsApproval()}
            fallback={
                <ApproveErc20
                    asset={props.asset}
                    value={props.value}
                    signerAddress={props.signerAddress}
                    derivationPath={props.derivationPath}
                    setNeedsApproval={props.setNeedsApproval}
                />
            }>
            <ContractTransaction
                asset={props.asset}
                /* eslint-disable-next-line solid/reactivity */
                onClick={async () => {
                    let tx: ContractTransactionResponse;

                    if (getKindForAsset(props.asset) === AssetKind.EVMNative) {
                        const contract = getEtherSwap(props.asset);
                        tx = await contract["lock(bytes32,address,uint256)"](
                            prefix0x(props.preimageHash),
                            props.claimAddress,
                            props.timeoutBlockHeight,
                            {
                                value: props.value(),
                            },
                        );
                    } else {
                        const contract = getErc20Swap(props.asset);
                        tx = await contract[
                            "lock(bytes32,uint256,address,address,uint256)"
                        ](
                            prefix0x(props.preimageHash),
                            props.value(),
                            getTokenAddress(props.asset),
                            props.claimAddress,
                            props.timeoutBlockHeight,
                        );
                    }

                    const currentSwap = await getSwap(props.swapId);
                    currentSwap.lockupTx = tx.hash;
                    currentSwap.signer = signer().address;

                    if (customDerivationPathRdns.includes(signer().rdns)) {
                        currentSwap.derivationPath = (
                            providers()[signer().rdns]
                                .provider as unknown as HardwareSigner
                        ).getDerivationPath();
                    }

                    setSwap(currentSwap);
                    await setSwapStorage(currentSwap);
                }}
                children={<ConnectWallet asset={props.asset} />}
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
    );
};

const LockupEvm = (props: {
    asset: string;
    swapId: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
}) => {
    const { getErc20Swap, signer } = useWeb3Signer();

    const value = () => satsToAssetAmount(props.amount, props.asset);

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);

    // eslint-disable-next-line solid/reactivity
    createEffect(async () => {
        if (signer() === undefined) {
            return;
        }

        switch (getKindForAsset(props.asset)) {
            case AssetKind.EVMNative: {
                const [balance, gasPrice] = await Promise.all([
                    signer().provider.getBalance(await signer().getAddress()),
                    signer()
                        .provider.getFeeData()
                        .then((data) => data.gasPrice),
                ]);

                const spendable = balance - gasPrice * lockupGasUsage;
                log.info("EVM signer spendable balance", spendable);
                setSignerBalance(spendable);

                break;
            }
            case AssetKind.ERC20: {
                const contract = createTokenContract(props.asset, signer());

                const [balance, allowance] = await Promise.all([
                    contract.balanceOf(await signer().getAddress()),
                    contract.allowance(
                        await signer().getAddress(),
                        getErc20Swap(props.asset).getAddress(),
                    ),
                ]);

                log.info("ERC20 signer balance", balance);

                const needsApproval = allowance < value();
                log.info("ERC20 signer needs approval", needsApproval);

                setSignerBalance(balance);
                setNeedsApproval(needsApproval);

                break;
            }
            default:
                break;
        }
    });

    return (
        <>
            <OptimizedRoute />
            <Show
                when={signerBalance() !== undefined}
                fallback={
                    <Show
                        when={signer() !== undefined}
                        fallback={<ConnectWallet asset={props.asset} />}>
                        <LoadingSpinner />
                    </Show>
                }>
                <Show
                    when={signer() === undefined || signerBalance() > value()}
                    fallback={<InsufficientBalance asset={props.asset} />}>
                    <LockupTransaction
                        asset={props.asset}
                        value={value}
                        preimageHash={props.preimageHash}
                        claimAddress={props.claimAddress}
                        timeoutBlockHeight={props.timeoutBlockHeight}
                        signerAddress={props.signerAddress}
                        derivationPath={props.derivationPath}
                        swapId={props.swapId}
                        needsApproval={needsApproval}
                        setNeedsApproval={setNeedsApproval}
                    />
                </Show>
            </Show>
        </>
    );
};

export default LockupEvm;
