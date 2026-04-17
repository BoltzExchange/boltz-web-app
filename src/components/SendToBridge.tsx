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
import { bridgeRegistry } from "../utils/bridge";
import type { BridgeDetail } from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";
import WaitForBridge from "./WaitForBridge";

const SendToBridge = (props: {
    bridge: BridgeDetail;
    swapId: string;
    amount: bigint;
}) => {
    const { setSwap, swap } = usePayContext();
    const { t, getSwap, setSwapStorage } = useGlobalContext();
    const { signer, connectedWallet, getGasAbstractionSigner } =
        useWeb3Signer();

    const bridgeDriver = () =>
        bridgeRegistry.requireDriverForRoute(props.bridge);

    const sourceTransport = () =>
        bridgeDriver().getTransport(props.bridge.sourceAsset);

    const expectedChainId = () =>
        config.assets?.[props.bridge.sourceAsset]?.network?.chainId;

    const sourceGasToken = () =>
        config.assets?.[props.bridge.sourceAsset]?.network?.gasToken;

    const [signerBalance, setSignerBalance] = createSignal<bigint>(undefined);
    const [requiredTokenBalance, setRequiredTokenBalance] =
        createSignal<bigint>(undefined);
    const [hasEnoughMsgFee, setHasEnoughMsgFee] =
        createSignal<boolean>(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [approvalTarget, setApprovalTarget] = createSignal<string>(undefined);
    const txSent = createMemo(() => {
        return swap()?.bridge?.txHash;
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
                    `Unsupported bridge source transport: ${transport}`,
                );
            }
        }
    };

    const getBridgeRecipient = () =>
        getGasAbstractionSigner(props.bridge.destinationAsset).address;

    const quoteBridgeSendState = async (recipient: string) => {
        const bridgeRoute = props.bridge;
        const quotedBridgeInstance =
            await bridgeDriver().getQuotedContract(bridgeRoute);
        const { sendParam, msgFee } = await bridgeDriver().quoteSend(
            quotedBridgeInstance,
            bridgeRoute,
            recipient,
            props.amount,
        );

        return {
            bridgeRoute,
            recipient,
            sendParam,
            msgFee,
        };
    };

    const syncBridgeSendBalanceState = (
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
            asset: props.bridge.sourceAsset,
            balance: balance.toString(),
            requiredAmount: requiredTokenAmount.toString(),
            sufficient: hasEnoughTokenBalance,
        });
        log.info(`${logLabel} signer native balance check`, {
            asset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
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

    const refreshBridgeSendState = async (connectedSigner: Signer) => {
        const signerAddress = await connectedSigner.getAddress();
        const recipient = getBridgeRecipient();
        const tokenContract = createTokenContract(
            props.bridge.sourceAsset,
            connectedSigner,
        );
        const { bridgeRoute, sendParam, msgFee } =
            await quoteBridgeSendState(recipient);
        const directSendTarget =
            await bridgeDriver().getDirectSendTarget(bridgeRoute);
        const [balance, needsUserApproval, nativeBalance] = await Promise.all([
            bridgeDriver().getSourceTokenBalance(bridgeRoute, signerAddress),
            bridgeDriver().requiresDirectUserApproval(
                directSendTarget,
                connectedSigner,
            ),
            bridgeDriver().getSourceNativeBalance(bridgeRoute, signerAddress),
        ]);

        const requiredTokenAmount = bridgeDriver().getDirectRequiredTokenAmount(
            directSendTarget,
            props.amount,
            msgFee,
        );
        const requiredNativeBalance =
            bridgeDriver().getDirectRequiredNativeBalance(
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

        syncBridgeSendBalanceState(
            "Bridge",
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

    const refreshSolanaBridgeSendState = async (walletAddress: string) => {
        const { bridgeRoute, msgFee } =
            await quoteBridgeSendState(getBridgeRecipient());
        const [balance, nativeBalance] = await Promise.all([
            bridgeDriver().getSourceTokenBalance(bridgeRoute, walletAddress),
            bridgeDriver().getSourceNativeBalance(bridgeRoute, walletAddress),
        ]);
        const requiredNativeBalance = bridgeDriver().getBufferedNativeFee(
            msgFee[0],
        );
        const hasEnoughTokenBalance = balance >= props.amount;
        const hasEnoughNativeBalanceForMsgFee =
            nativeBalance >= requiredNativeBalance;

        syncBridgeSendBalanceState(
            "Solana bridge",
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

    const syncBridgeSendState = async () => {
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

                await refreshSolanaBridgeSendState(wallet.address);
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

                await refreshBridgeSendState(connectedSigner);
                return;
            }
            default: {
                throw new Error(
                    `Unsupported bridge source transport: ${transport}`,
                );
            }
        }
    };

    const sendBridgeFromSolana = async () => {
        const wallet = connectedWallet();
        if (
            wallet?.transport !== NetworkTransport.Solana ||
            wallet.address === undefined
        ) {
            throw new Error(
                "connected Solana wallet is required for bridge send",
            );
        }

        const recipient = getBridgeRecipient();
        const { hasEnoughTokenBalance, hasEnoughNativeBalanceForMsgFee } =
            await refreshSolanaBridgeSendState(wallet.address);

        if (!hasEnoughTokenBalance) {
            throw new Error(
                "Token balance is no longer sufficient for the updated bridge quote.",
            );
        }
        if (!hasEnoughNativeBalanceForMsgFee) {
            throw new Error(
                "Native balance is no longer sufficient for the updated bridge message fee.",
            );
        }

        log.debug(
            `Sending bridge ${props.bridge.destinationAsset} to ${recipient}`,
        );

        const quotedBridgeInstance = await bridgeDriver().getQuotedContract(
            props.bridge,
        );
        const bridgeInstance = await bridgeDriver().createContract(
            props.bridge,
            WalletConnectProvider.getSolanaProvider(),
        );
        const { sendParam, msgFee } = await bridgeDriver().quoteSend(
            quotedBridgeInstance,
            props.bridge,
            recipient,
            props.amount,
        );

        log.debug("Quoted bridge send", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            recipient,
            amount: props.amount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        return (await bridgeInstance.send(sendParam, msgFee, wallet.address))
            .hash;
    };

    const sendBridgeFromEvm = async () => {
        const connectedSigner = signer();
        if (connectedSigner === undefined) {
            throw new Error("connected signer is required for bridge send");
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
        } = await refreshBridgeSendState(connectedSigner);

        log.debug(
            `Sending bridge ${props.bridge.destinationAsset} to ${recipient}`,
        );

        if (needsUpdatedApproval) {
            throw new Error(
                "Approval is no longer sufficient for the updated bridge quote. Please approve the new amount and try again.",
            );
        }
        if (!hasEnoughTokenBalance) {
            throw new Error(
                "Token balance is no longer sufficient for the updated bridge quote.",
            );
        }
        if (!hasEnoughNativeBalanceForMsgFee) {
            throw new Error(
                "Native balance is no longer sufficient for the updated bridge message fee.",
            );
        }

        log.debug("Quoted bridge send", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            recipient,
            amount: props.amount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        return (
            await bridgeDriver().sendDirect({
                target: directSendTarget,
                runner: connectedSigner,
                sendParam,
                msgFee,
                refundAddress: signerAddress,
            })
        ).hash;
    };

    const sendBridge = async () => {
        const transport = sourceTransport();

        switch (transport) {
            case NetworkTransport.Solana:
                return await sendBridgeFromSolana();
            case NetworkTransport.Evm:
                return await sendBridgeFromEvm();
            case NetworkTransport.Tron:
                throw new Error(
                    "Bridge sending is not implemented for tron yet",
                );
            default: {
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported bridge source transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    const persistBridgeSend = async (txHash: string) => {
        const currentSwap = await getSwap(props.swapId);
        if (currentSwap?.bridge !== undefined) {
            currentSwap.bridge = {
                ...currentSwap.bridge,
                txHash,
            };
        }

        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
        log.info("Persisted bridge send tx hash for background worker", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            txHash,
        });
    };

    createEffect(() => {
        void syncBridgeSendState();
    });

    return (
        <Show
            when={txSent() === undefined}
            fallback={
                <WaitForBridge
                    bridge={props.bridge}
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
                            <ConnectWallet asset={props.bridge.sourceAsset} />
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
                        <InsufficientBalance asset={props.bridge.sourceAsset} />
                    }>
                    <Show
                        when={hasEnoughMsgFee()}
                        fallback={
                            <InsufficientBalance
                                asset={props.bridge.sourceAsset}
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
                                    asset={props.bridge.sourceAsset}
                                    value={() =>
                                        requiredTokenBalance() ?? props.amount
                                    }
                                    setNeedsApproval={setNeedsApproval}
                                    approvalTarget={approvalTarget()}
                                    resetAllowanceFirst={true}
                                />
                            }>
                            <ContractTransaction
                                asset={props.bridge.sourceAsset}
                                /* eslint-disable-next-line solid/reactivity */
                                onClick={async () => {
                                    const txHash = await sendBridge();
                                    await persistBridgeSend(txHash);
                                }}
                                children={
                                    <ConnectWallet
                                        asset={props.bridge.sourceAsset}
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

export default SendToBridge;
