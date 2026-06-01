import { type BridgeTransaction, bridgeRegistry } from "boltz-swaps/bridge";
import { createTokenContract } from "boltz-swaps/evm/contracts";
import {
    type OftTransportClient,
    getTronTokenAllowance,
} from "boltz-swaps/oft";
import {
    BridgeKind,
    CctpReceiveMode,
    NetworkTransport,
    SwapPosition,
} from "boltz-swaps/types";
import log from "loglevel";
import {
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
} from "solid-js";
import { type Address, getAddress } from "viem";

import { config } from "../config";
import { USDC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { type Signer, useWeb3Signer } from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import type { BridgeDetail } from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import ApproveTrc20 from "./ApproveTrc20";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";
import WaitForBridge from "./WaitForBridge";

type BridgeSendResult = {
    tx: BridgeTransaction;
    sourceAmount: bigint;
};

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

    const [signerBalance, setSignerBalance] = createSignal<bigint | undefined>(
        undefined,
    );
    const [requiredTokenBalance, setRequiredTokenBalance] = createSignal<
        bigint | undefined
    >(undefined);
    const [hasEnoughMsgFee, setHasEnoughMsgFee] = createSignal<
        boolean | undefined
    >(undefined);
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [approvalTarget, setApprovalTarget] = createSignal<
        string | undefined
    >(undefined);
    const txSent = createMemo(() => {
        return swap()?.bridge?.txHash;
    });

    const [signerChainId] = createResource(signer, async (currentSigner) => {
        return Number(await currentSigner.provider.getChainId());
    });

    const sourceWalletReady = () => {
        const transport = sourceTransport();

        switch (transport) {
            case NetworkTransport.Solana:
                return (
                    connectedWallet()?.transport === NetworkTransport.Solana &&
                    connectedWallet()?.address !== undefined
                );
            case NetworkTransport.Tron:
                return (
                    connectedWallet()?.transport === NetworkTransport.Tron &&
                    connectedWallet()?.address !== undefined
                );
            case NetworkTransport.Evm:
                return (
                    signer() !== undefined &&
                    signerChainId() === expectedChainId()
                );
            default: {
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported bridge source transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    const getBridgeRecipient = () =>
        getGasAbstractionSigner(props.bridge.destinationAsset).address;

    const cctpReceiveMode = () =>
        props.bridge.kind === BridgeKind.Cctp &&
        props.bridge.position === SwapPosition.Pre &&
        props.bridge.destinationAsset === USDC
            ? CctpReceiveMode.Manual
            : CctpReceiveMode.Forwarded;

    const quoteBridgeSendState = async (recipient: string) => {
        const bridgeRoute = props.bridge;
        const quotedBridgeInstance =
            await bridgeDriver().getQuotedContract(bridgeRoute);

        // we don't want to refetch a quote if we previously committed to
        // a fixed source amount, e.g. for sweeping the wallet.
        let sourceAmount = BigInt(bridgeRoute.sourceAmount ?? 0);

        // `props.amount` is the amount Boltz needs to arrive on the destination
        // chain (it was computed by the pair/DEX step on the far side). Bridges
        // that charge fees in the bridged asset (CCTP) must burn more than
        // that so the arrival matches. OFT typically returns `amount`
        // unchanged when there's no token-side fee.
        if (sourceAmount === 0n) {
            sourceAmount = await bridgeDriver().quoteAmountInForAmountOut(
                bridgeRoute,
                props.amount,
                { cctpReceiveMode: cctpReceiveMode() },
            );
        }

        const { sendParam, msgFee } = await bridgeDriver().quoteSend(
            quotedBridgeInstance,
            bridgeRoute,
            recipient,
            sourceAmount,
            { cctpReceiveMode: cctpReceiveMode() },
        );

        return {
            bridgeRoute,
            recipient,
            sourceAmount,
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
            needsApproval = false,
            approvalTarget,
        }: {
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
        setRequiredTokenBalance(requiredTokenAmount);
        setHasEnoughMsgFee(hasEnoughMsgFee);
        setNeedsApproval(needsApproval);
        setApprovalTarget(approvalTarget);
    };

    const refreshBridgeSendState = async (connectedSigner: Signer) => {
        const recipient = getBridgeRecipient();
        const tokenContract = createTokenContract(
            props.bridge.sourceAsset,
            connectedSigner,
        );
        const { bridgeRoute, sourceAmount, sendParam, msgFee } =
            await quoteBridgeSendState(recipient);
        const directSendTarget =
            await bridgeDriver().getDirectSendTarget(bridgeRoute);
        const [balance, needsUserApproval, nativeBalance] = await Promise.all([
            bridgeDriver().getSourceTokenBalance(
                bridgeRoute,
                connectedSigner.address,
            ),
            bridgeDriver().requiresDirectUserApproval(
                directSendTarget,
                connectedSigner,
            ),
            bridgeDriver().getSourceNativeBalance(
                bridgeRoute,
                connectedSigner.address,
            ),
        ]);

        const requiredTokenAmount = bridgeDriver().getDirectRequiredTokenAmount(
            directSendTarget,
            sourceAmount,
            msgFee,
        );
        const requiredNativeBalance =
            bridgeDriver().getDirectRequiredNativeBalance(
                directSendTarget,
                msgFee,
            );

        const executionContractAddress = getAddress(
            directSendTarget.executionContract.address,
        );
        let needsUpdatedApproval = false;
        if (needsUserApproval) {
            const allowance = await tokenContract.read.allowance([
                connectedSigner.address,
                executionContractAddress,
            ]);

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
                    ? executionContractAddress
                    : undefined,
            },
        );

        return {
            directSendTarget,
            recipient,
            sourceAmount,
            sendParam,
            msgFee,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
            needsUpdatedApproval,
            signerAddress: connectedSigner.address,
        };
    };

    const refreshSolanaBridgeSendState = async (walletAddress: string) => {
        const { bridgeRoute, sourceAmount, msgFee } =
            await quoteBridgeSendState(getBridgeRecipient());
        const [balance, nativeBalance] = await Promise.all([
            bridgeDriver().getSourceTokenBalance(bridgeRoute, walletAddress),
            bridgeDriver().getSourceNativeBalance(bridgeRoute, walletAddress),
        ]);
        const requiredNativeBalance =
            await bridgeDriver().getTransportRequiredNativeBalance(
                bridgeRoute,
                msgFee,
            );
        const hasEnoughTokenBalance = balance >= sourceAmount;
        const hasEnoughNativeBalanceForMsgFee =
            nativeBalance >= requiredNativeBalance;

        syncBridgeSendBalanceState(
            "Solana bridge",
            balance,
            sourceAmount,
            nativeBalance,
            requiredNativeBalance,
        );

        return {
            balance,
            sourceAmount,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
        };
    };

    const refreshTronBridgeSendState = async (walletAddress: string) => {
        const recipient = getBridgeRecipient();
        const { bridgeRoute, sourceAmount, msgFee } =
            await quoteBridgeSendState(recipient);
        const bridgeInstance = await bridgeDriver().createContract(bridgeRoute);
        const [balance, nativeBalance] = await Promise.all([
            bridgeDriver().getSourceTokenBalance(bridgeRoute, walletAddress),
            bridgeDriver().getSourceNativeBalance(bridgeRoute, walletAddress),
        ]);
        const requiredNativeBalance =
            await bridgeDriver().getTransportRequiredNativeBalance(
                bridgeRoute,
                msgFee,
            );
        const hasEnoughTokenBalance = balance >= sourceAmount;
        const hasEnoughNativeBalanceForMsgFee =
            nativeBalance >= requiredNativeBalance;
        // Tron bridge sends are OFT-only (CCTP has no Tron transport).
        const oftBridgeInstance = bridgeInstance as OftTransportClient;
        const approvalRequired =
            (await oftBridgeInstance.approvalRequired?.()) ?? false;
        let needsUpdatedApproval = false;
        let spenderAddress: string | undefined;

        if (approvalRequired) {
            spenderAddress = (await bridgeDriver().getContract(bridgeRoute))
                .address;
            const allowance = await getTronTokenAllowance(
                props.bridge.sourceAsset,
                walletAddress,
                spenderAddress,
            );
            needsUpdatedApproval = allowance < sourceAmount;
        }

        syncBridgeSendBalanceState(
            "Tron bridge",
            balance,
            sourceAmount,
            nativeBalance,
            requiredNativeBalance,
            {
                needsApproval: needsUpdatedApproval,
                approvalTarget: spenderAddress,
            },
        );

        return {
            balance,
            sourceAmount,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
            needsUpdatedApproval,
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
            case NetworkTransport.Tron: {
                const wallet = connectedWallet();
                if (
                    wallet?.transport !== NetworkTransport.Tron ||
                    wallet.address === undefined
                ) {
                    return;
                }

                await refreshTronBridgeSendState(wallet.address);
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
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported bridge source transport: ${String(exhaustiveTransport)}`,
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

        const bridgeInstance = await bridgeDriver().createContract(
            props.bridge,
            WalletConnectProvider.getSolanaProvider(),
        );
        const { sourceAmount, sendParam, msgFee } =
            await quoteBridgeSendState(recipient);

        log.debug("Quoted bridge send", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            recipient,
            amount: sourceAmount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        const tx = await bridgeDriver().sendTransport({
            contract: bridgeInstance,
            sendParam,
            msgFee,
            refundAddress: wallet.address,
        });
        return { tx, sourceAmount };
    };

    const sendBridgeFromTron = async () => {
        const wallet = connectedWallet();
        if (
            wallet?.transport !== NetworkTransport.Tron ||
            wallet.address === undefined
        ) {
            throw new Error(
                "connected Tron wallet is required for bridge send",
            );
        }

        const recipient = getBridgeRecipient();
        const {
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
            needsUpdatedApproval,
        } = await refreshTronBridgeSendState(wallet.address);

        if (!hasEnoughTokenBalance) {
            throw new Error(
                "Token balance is no longer sufficient for the updated bridge quote.",
            );
        }
        if (needsUpdatedApproval) {
            throw new Error(
                "Approval is no longer sufficient for the updated bridge quote. Please approve the new amount and try again.",
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

        const bridgeInstance = await bridgeDriver().createContract(
            props.bridge,
            WalletConnectProvider.getTronProvider(),
        );
        const { sourceAmount, sendParam, msgFee } =
            await quoteBridgeSendState(recipient);

        log.debug("Quoted bridge send", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            recipient,
            amount: sourceAmount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        const tx = await bridgeDriver().sendTransport({
            contract: bridgeInstance,
            sendParam,
            msgFee,
            refundAddress: wallet.address,
        });
        return { tx, sourceAmount };
    };

    const sendBridgeFromEvm = async () => {
        const connectedSigner = signer();
        if (connectedSigner === undefined) {
            throw new Error("connected signer is required for bridge send");
        }

        const {
            directSendTarget,
            recipient,
            sourceAmount,
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
            amount: sourceAmount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        const tx = await bridgeDriver().sendDirect({
            target: directSendTarget,
            runner: connectedSigner,
            sendParam,
            msgFee,
            refundAddress: signerAddress,
        });
        return { tx, sourceAmount };
    };

    const sendBridge = async () => {
        const transport = sourceTransport();

        switch (transport) {
            case NetworkTransport.Solana:
                return await sendBridgeFromSolana();
            case NetworkTransport.Evm:
                return await sendBridgeFromEvm();
            case NetworkTransport.Tron:
                return await sendBridgeFromTron();
            default: {
                const exhaustiveTransport: never = transport;
                throw new Error(
                    `Unsupported bridge source transport: ${String(exhaustiveTransport)}`,
                );
            }
        }
    };

    const persistBridgeSend = async (result: BridgeSendResult) => {
        const currentSwap = await getSwap(props.swapId);
        if (currentSwap === null) {
            return;
        }
        if (currentSwap.bridge !== undefined) {
            const bridge = {
                ...currentSwap.bridge,
                sourceAmount: result.sourceAmount.toString(),
                txHash: result.tx.hash,
            };
            if (result.tx.details === undefined) {
                delete bridge.details;
            } else {
                bridge.details = result.tx.details;
            }

            currentSwap.bridge = bridge;
        }

        setSwap(currentSwap);
        await setSwapStorage(currentSwap);
        log.info("Persisted bridge send tx hash for background worker", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            txHash: result.tx.hash,
            sourceAmount: result.sourceAmount.toString(),
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
                    transactionHash={txSent()!}
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
                        signerBalance()! >=
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
                                sourceTransport() === NetworkTransport.Tron ? (
                                    <ApproveTrc20
                                        asset={props.bridge.sourceAsset}
                                        setNeedsApproval={setNeedsApproval}
                                        approvalTarget={approvalTarget()!}
                                    />
                                ) : (
                                    <ApproveErc20
                                        asset={props.bridge.sourceAsset}
                                        value={() =>
                                            requiredTokenBalance() ??
                                            props.amount
                                        }
                                        setNeedsApproval={setNeedsApproval}
                                        approvalTarget={
                                            approvalTarget() as Address
                                        }
                                        resetAllowanceFirst={true}
                                    />
                                )
                            }>
                            <ContractTransaction
                                asset={props.bridge.sourceAsset}
                                /* eslint-disable-next-line solid/reactivity */
                                onClick={async () => {
                                    const result = await sendBridge();
                                    await persistBridgeSend(result);
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
