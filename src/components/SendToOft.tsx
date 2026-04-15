import log from "loglevel";
import {
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
} from "solid-js";

import { config } from "../config";
import { NetworkTransport } from "../configs/base";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import {
    type Signer,
    createTokenContract,
    useWeb3Signer,
} from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import { getSolanaNativeBalance as getSolanaBalance } from "../utils/chains/solana";
import {
    getOftDirectRequiredNativeBalance,
    getOftDirectRequiredTokenAmount,
    getOftDirectSendTarget,
    requiresOftDirectUserApproval,
    sendOftDirect,
} from "../utils/oft/directSend";
import {
    createOftContract,
    getOftTransport,
    getQuotedOftContract,
    getRequiredSolanaOftNativeBalance,
    getSolanaOftTokenBalance,
    quoteOftSend,
} from "../utils/oft/oft";
import type { OftDetail } from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import BlockExplorer, { ExplorerKind } from "./BlockExplorer";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";

const WaitForOft = (props: { asset: string; transactionHash: string }) => {
    const { t } = useGlobalContext();

    return (
        <>
            <h2>{t("waiting_for_oft")}</h2>
            <LoadingSpinner />
            <BlockExplorer
                asset={props.asset}
                txId={props.transactionHash}
                explorer={ExplorerKind.LayerZero}
                typeLabel={"lockup_tx"}
            />
        </>
    );
};

const SendToOft = (props: {
    oft: OftDetail;
    swapId: string;
    amount: bigint;
}) => {
    const { setSwap, swap } = usePayContext();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { signer, connectedWallet, getGasAbstractionSigner } =
        useWeb3Signer();

    const sourceTransport = () => getOftTransport(props.oft.sourceAsset);

    const expectedChainId = () =>
        config.assets?.[props.oft.sourceAsset]?.network?.chainId;

    const sourceGasToken = () =>
        config.assets?.[props.oft.sourceAsset]?.network?.gasToken;

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);
    const [requiredTokenBalance, setRequiredTokenBalance] =
        createSignal<bigint>(undefined);
    const [hasEnoughMsgFee, setHasEnoughMsgFee] =
        createSignal<boolean>(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [approvalTarget, setApprovalTarget] = createSignal<string>(undefined);
    const txSent = createMemo(() => {
        return swap()?.oft?.txHash;
    });

    const [signerChainId] = createResource(signer, async (currentSigner) => {
        return await currentSigner.provider
            .getNetwork()
            .then((n) => Number(n.chainId));
    });

    const sourceWalletReady = () => {
        const transport = sourceTransport();

        switch (transport) {
            case NetworkTransport.Solana:
                return (
                    connectedWallet()?.transport === NetworkTransport.Solana &&
                    connectedWallet()?.address !== undefined
                );
            case NetworkTransport.Evm:
                return (
                    signer() !== undefined &&
                    signerChainId() === expectedChainId()
                );
            default: {
                throw new Error(
                    `Unsupported OFT source transport: ${transport}`,
                );
            }
        }
    };

    const getOftRecipient = () =>
        getGasAbstractionSigner(props.oft.destinationAsset).address;

    const quoteOftSendState = async (recipient: string) => {
        const oftRoute = props.oft;
        const quotedOftInstance = await getQuotedOftContract(oftRoute);
        const { sendParam, msgFee } = await quoteOftSend(
            quotedOftInstance,
            oftRoute,
            recipient,
            props.amount,
        );

        return {
            oftRoute,
            recipient,
            sendParam,
            msgFee,
        };
    };

    const syncOftSendBalanceState = (
        logLabel: string,
        balance: bigint,
        requiredTokenAmount: bigint,
        nativeBalance: bigint,
        requiredNativeBalance: bigint,
        {
            trackRequiredTokenBalance = true,
            needsApproval = false,
            approvalTarget,
        }: {
            trackRequiredTokenBalance?: boolean;
            needsApproval?: boolean;
            approvalTarget?: string;
        } = {},
    ) => {
        const hasEnoughTokenBalance = balance >= requiredTokenAmount;
        const hasEnoughMsgFee = nativeBalance >= requiredNativeBalance;

        log.info(`${logLabel} signer token balance check`, {
            asset: props.oft.sourceAsset,
            balance: balance.toString(),
            requiredAmount: requiredTokenAmount.toString(),
            sufficient: hasEnoughTokenBalance,
        });
        log.info(`${logLabel} signer native balance check`, {
            asset: props.oft.sourceAsset,
            destinationAsset: props.oft.destinationAsset,
            nativeBalance: nativeBalance.toString(),
            requiredMsgFee: requiredNativeBalance.toString(),
            sufficient: hasEnoughMsgFee,
        });

        setSignerBalance(balance);
        setRequiredTokenBalance(
            trackRequiredTokenBalance ? requiredTokenAmount : undefined,
        );
        setHasEnoughMsgFee(hasEnoughMsgFee);
        setNeedsApproval(needsApproval);
        setApprovalTarget(approvalTarget);
    };

    const refreshOftSendState = async (connectedSigner: Signer) => {
        const signerAddress = await connectedSigner.getAddress();
        const recipient = getOftRecipient();
        const tokenContract = createTokenContract(
            props.oft.sourceAsset,
            connectedSigner,
        );
        const { oftRoute, sendParam, msgFee } =
            await quoteOftSendState(recipient);
        const directSendTarget = await getOftDirectSendTarget(oftRoute);
        const [balance, needsUserApproval, nativeBalance] = await Promise.all([
            tokenContract.balanceOf(signerAddress),
            requiresOftDirectUserApproval(directSendTarget, connectedSigner),
            connectedSigner.provider.getBalance(signerAddress),
        ]);

        const requiredTokenAmount = getOftDirectRequiredTokenAmount(
            directSendTarget,
            props.amount,
            msgFee,
        );
        const requiredNativeBalance = getOftDirectRequiredNativeBalance(
            directSendTarget,
            msgFee,
        );

        let needsUpdatedApproval = false;
        if (needsUserApproval) {
            const allowance = await tokenContract.allowance(
                signerAddress,
                directSendTarget.executionContract.address,
            );

            needsUpdatedApproval = allowance < requiredTokenAmount;
        }

        const hasEnoughTokenBalance = balance >= requiredTokenAmount;
        const hasEnoughNativeBalanceForMsgFee =
            nativeBalance >= requiredNativeBalance;

        syncOftSendBalanceState(
            "OFT",
            balance,
            requiredTokenAmount,
            nativeBalance,
            requiredNativeBalance,
            {
                needsApproval: needsUpdatedApproval,
                approvalTarget: needsUserApproval
                    ? directSendTarget.executionContract.address
                    : undefined,
            },
        );

        return {
            directSendTarget,
            recipient,
            sendParam,
            msgFee,
            signerAddress,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
            needsUpdatedApproval,
        };
    };

    const refreshSolanaOftSendState = async (walletAddress: string) => {
        const { oftRoute, msgFee } = await quoteOftSendState(getOftRecipient());
        const [balance, nativeBalance, requiredNativeBalance] =
            await Promise.all([
                getSolanaOftTokenBalance(oftRoute, walletAddress),
                getSolanaBalance(props.oft.sourceAsset, walletAddress),
                getRequiredSolanaOftNativeBalance(
                    props.oft.sourceAsset,
                    msgFee[0],
                ),
            ]);
        const hasEnoughTokenBalance = balance >= props.amount;
        const hasEnoughNativeBalanceForMsgFee =
            nativeBalance >= requiredNativeBalance;

        syncOftSendBalanceState(
            "Solana OFT",
            balance,
            props.amount,
            nativeBalance,
            requiredNativeBalance,
            { trackRequiredTokenBalance: false },
        );

        return {
            balance,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
        };
    };

    const syncOftSendState = async () => {
        const transport = sourceTransport();

        switch (transport) {
            case NetworkTransport.Solana: {
                const wallet = connectedWallet();
                if (
                    wallet?.transport !== NetworkTransport.Solana ||
                    wallet.address === undefined
                ) {
                    return;
                }

                await refreshSolanaOftSendState(wallet.address);
                return;
            }
            case NetworkTransport.Evm: {
                if (
                    signer() === undefined ||
                    signerChainId() !== expectedChainId()
                ) {
                    return;
                }

                const connectedSigner = signer();
                if (connectedSigner === undefined) {
                    return;
                }

                await refreshOftSendState(connectedSigner);
                return;
            }
            default: {
                throw new Error(
                    `Unsupported OFT source transport: ${transport}`,
                );
            }
        }
    };

    const sendOftFromSolana = async () => {
        const wallet = connectedWallet();
        if (
            wallet?.transport !== NetworkTransport.Solana ||
            wallet.address === undefined
        ) {
            throw new Error("connected Solana wallet is required for OFT send");
        }

        const recipient = getOftRecipient();
        const { hasEnoughTokenBalance, hasEnoughNativeBalanceForMsgFee } =
            await refreshSolanaOftSendState(wallet.address);

        if (!hasEnoughTokenBalance) {
            throw new Error(
                "Token balance is no longer sufficient for the updated OFT quote.",
            );
        }
        if (!hasEnoughNativeBalanceForMsgFee) {
            throw new Error(
                "Native balance is no longer sufficient for the updated OFT message fee.",
            );
        }

        log.debug(`Sending OFT ${props.oft.destinationAsset} to ${recipient}`);

        const quotedOftInstance = await getQuotedOftContract(props.oft);
        const oftInstance = await createOftContract(
            props.oft,
            WalletConnectProvider.getSolanaProvider(),
        );
        const { sendParam, msgFee } = await quoteOftSend(
            quotedOftInstance,
            props.oft,
            recipient,
            props.amount,
        );

        log.debug("Quoted OFT send", {
            swapId: props.swapId,
            sourceAsset: props.oft.sourceAsset,
            destinationAsset: props.oft.destinationAsset,
            recipient,
            amount: props.amount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        return (await oftInstance.send(sendParam, msgFee, wallet.address)).hash;
    };

    const sendOftFromEvm = async () => {
        const connectedSigner = signer();
        if (connectedSigner === undefined) {
            throw new Error("connected signer is required for OFT send");
        }

        const {
            directSendTarget,
            recipient,
            sendParam,
            msgFee,
            signerAddress,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
            needsUpdatedApproval,
        } = await refreshOftSendState(connectedSigner);

        log.debug(`Sending OFT ${props.oft.destinationAsset} to ${recipient}`);

        if (needsUpdatedApproval) {
            throw new Error(
                "Approval is no longer sufficient for the updated OFT quote. Please approve the new amount and try again.",
            );
        }
        if (!hasEnoughTokenBalance) {
            throw new Error(
                "Token balance is no longer sufficient for the updated OFT quote.",
            );
        }
        if (!hasEnoughNativeBalanceForMsgFee) {
            throw new Error(
                "Native balance is no longer sufficient for the updated OFT message fee.",
            );
        }

        log.debug("Quoted OFT send", {
            swapId: props.swapId,
            sourceAsset: props.oft.sourceAsset,
            destinationAsset: props.oft.destinationAsset,
            recipient,
            amount: props.amount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        return (
            await sendOftDirect({
                target: directSendTarget,
                runner: connectedSigner,
                sendParam,
                msgFee,
                refundAddress: signerAddress,
            })
        ).hash;
    };

    const sendOft = async () => {
        const transport = sourceTransport();

        switch (transport) {
            case NetworkTransport.Solana:
                return await sendOftFromSolana();
            case NetworkTransport.Evm:
                return await sendOftFromEvm();
            case NetworkTransport.Tron:
                throw new Error("OFT sending is not implemented for tron yet");
            default: {
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported OFT source transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    const persistOftSend = async (txHash: string) => {
        const currentSwap = await getSwap(props.swapId);
        if (currentSwap.oft !== undefined) {
            currentSwap.oft = {
                ...currentSwap.oft,
                txHash,
            };
        }

        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
        log.info("Persisted OFT send tx hash for background worker", {
            swapId: props.swapId,
            sourceAsset: props.oft.sourceAsset,
            destinationAsset: props.oft.destinationAsset,
            txHash,
        });
    };

    createEffect(() => {
        void syncOftSendState();
    });

    return (
        <Show
            when={txSent() === undefined}
            fallback={
                <WaitForOft
                    asset={props.oft.sourceAsset}
                    transactionHash={txSent()}
                />
            }>
            <Show
                when={
                    signerBalance() !== undefined &&
                    hasEnoughMsgFee() !== undefined
                }
                fallback={
                    <Show
                        when={sourceWalletReady()}
                        fallback={
                            <ConnectWallet asset={props.oft.sourceAsset} />
                        }>
                        <LoadingSpinner />
                    </Show>
                }>
                <Show
                    when={
                        signerBalance() >=
                        (requiredTokenBalance() ?? props.amount)
                    }
                    fallback={
                        <InsufficientBalance asset={props.oft.sourceAsset} />
                    }>
                    <Show
                        when={hasEnoughMsgFee()}
                        fallback={
                            <InsufficientBalance
                                asset={props.oft.sourceAsset}
                                line={t(
                                    "insufficient_gas_balance_line" as DictKey,
                                    {
                                        gasToken: sourceGasToken(),
                                    },
                                )}
                            />
                        }>
                        <Show
                            when={!needsApproval()}
                            fallback={
                                <ApproveErc20
                                    asset={props.oft.sourceAsset}
                                    value={() =>
                                        requiredTokenBalance() ?? props.amount
                                    }
                                    setNeedsApproval={setNeedsApproval}
                                    approvalTarget={approvalTarget()}
                                    resetAllowanceFirst={true}
                                />
                            }>
                            <ContractTransaction
                                asset={props.oft.sourceAsset}
                                /* eslint-disable-next-line solid/reactivity */
                                onClick={async () => {
                                    const txHash = await sendOft();
                                    await persistOftSend(txHash);
                                }}
                                children={
                                    <ConnectWallet
                                        asset={props.oft.sourceAsset}
                                    />
                                }
                                buttonText={t("send")}
                                promptText={t("transaction_prompt", {
                                    button: t("send"),
                                })}
                                waitingText={t("tx_in_mempool_subline")}
                                showHr={false}
                            />
                        </Show>
                    </Show>
                </Show>
            </Show>
        </Show>
    );
};

export default SendToOft;
