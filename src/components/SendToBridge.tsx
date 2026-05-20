import {
    type BridgeMsgFee,
    type BridgeSendParam,
    type BridgeTransaction,
    type BridgeTransportClient,
    PendingBridgeSendKind,
    type PendingEvmOftBridgeSend,
    bridgeRegistry,
} from "boltz-swaps/bridge";
import { isWalletRejectionError } from "boltz-swaps/errors";
import { createTokenContract } from "boltz-swaps/evm/contracts";
import type { PopulatedEvmTransaction } from "boltz-swaps/evm/transaction";
import {
    type OftDirectSendTarget,
    type OftTransportClient,
    type SendParam,
    getTronTokenAllowance,
    populateOftDirectSendTransaction,
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
import { sendPopulatedTransaction } from "src/utils/evmTransaction";
import { type Address, getAddress } from "viem";

import { config } from "../config";
import { USDC } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { type Signer, useWeb3Signer } from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import { type BridgeDetail, GasAbstractionType } from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import ApproveTrc20 from "./ApproveTrc20";
import { useBridgeSendRecovery } from "./BridgeSendRecovery";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";
import WaitForBridge from "./WaitForBridge";

const evmPendingSendBlockLookback = 5n;

const SendToBridge = (props: {
    bridge: BridgeDetail;
    swapId: string;
    amount: bigint;
}) => {
    const { swap } = usePayContext();
    const { t } = useGlobalContext();
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
    const txSent = createMemo<string | undefined>(() => swap()?.bridge?.txHash);
    const {
        pendingSend,
        pendingSendCallbacks,
        persistBridgeSend,
        setPendingSend,
    } = useBridgeSendRecovery({
        swapId: () => props.swapId,
        bridge: () => props.bridge,
        txSent,
    });

    // OFT transport sends (Solana/Tron) need callbacks to persist a pending
    // send before broadcast. Other bridges (CCTP) go through the driver as-is.
    const sendTransport = async (args: {
        contract: BridgeTransportClient;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> => {
        if (props.bridge.kind !== BridgeKind.Oft) {
            return await bridgeDriver().sendTransport(args);
        }
        return await (args.contract as OftTransportClient).send(
            args.sendParam as SendParam,
            args.msgFee,
            args.refundAddress,
            { pendingSendCallbacks },
        );
    };

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
        // `props.amount` is the amount Boltz needs to arrive on the destination
        // chain (it was computed by the pair/DEX step on the far side). Bridges
        // that charge fees in the bridged asset (CCTP) must burn more than
        // that so the arrival matches. OFT typically returns `amount`
        // unchanged when there's no token-side fee.
        const tokenAmount = await bridgeDriver().quoteAmountInForAmountOut(
            bridgeRoute,
            props.amount,
            { cctpReceiveMode: cctpReceiveMode() },
        );
        const { sendParam, msgFee } = await bridgeDriver().quoteSend(
            quotedBridgeInstance,
            bridgeRoute,
            recipient,
            tokenAmount,
            { cctpReceiveMode: cctpReceiveMode() },
        );

        return {
            bridgeRoute,
            recipient,
            tokenAmount,
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
        const recipient = getBridgeRecipient();
        const tokenContract = createTokenContract(
            props.bridge.sourceAsset,
            connectedSigner,
        );
        const { bridgeRoute, tokenAmount, sendParam, msgFee } =
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
            tokenAmount,
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
            sendParam,
            msgFee,
            hasEnoughTokenBalance,
            hasEnoughNativeBalanceForMsgFee,
            needsUpdatedApproval,
            signerAddress: connectedSigner.address,
        };
    };

    const refreshSolanaBridgeSendState = async (walletAddress: string) => {
        const { bridgeRoute, tokenAmount, msgFee } =
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
        const hasEnoughTokenBalance = balance >= tokenAmount;
        const hasEnoughNativeBalanceForMsgFee =
            nativeBalance >= requiredNativeBalance;

        syncBridgeSendBalanceState(
            "Solana bridge",
            balance,
            tokenAmount,
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

    const refreshTronBridgeSendState = async (walletAddress: string) => {
        const recipient = getBridgeRecipient();
        const { bridgeRoute, msgFee } = await quoteBridgeSendState(recipient);
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
        const hasEnoughTokenBalance = balance >= props.amount;
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
            needsUpdatedApproval = allowance < props.amount;
        }

        syncBridgeSendBalanceState(
            "Tron bridge",
            balance,
            props.amount,
            nativeBalance,
            requiredNativeBalance,
            {
                trackRequiredTokenBalance: false,
                needsApproval: needsUpdatedApproval,
                approvalTarget: spenderAddress,
            },
        );

        return {
            balance,
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

        const quotedBridgeInstance = await bridgeDriver().getQuotedContract(
            props.bridge,
        );
        const tokenAmount = await bridgeDriver().quoteAmountInForAmountOut(
            props.bridge,
            props.amount,
            { cctpReceiveMode: cctpReceiveMode() },
        );
        const bridgeInstance = await bridgeDriver().createContract(
            props.bridge,
            WalletConnectProvider.getSolanaProvider(),
        );
        const { sendParam, msgFee } = await bridgeDriver().quoteSend(
            quotedBridgeInstance,
            props.bridge,
            recipient,
            tokenAmount,
            { cctpReceiveMode: cctpReceiveMode() },
        );

        log.debug("Quoted bridge send", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            recipient,
            amount: tokenAmount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        return await sendTransport({
            contract: bridgeInstance,
            sendParam,
            msgFee,
            refundAddress: wallet.address,
        });
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
        const { sendParam, msgFee } = await quoteBridgeSendState(recipient);

        log.debug("Quoted bridge send", {
            swapId: props.swapId,
            sourceAsset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            recipient,
            amount: props.amount.toString(),
            nativeFee: msgFee[0].toString(),
            lzTokenFee: msgFee[1].toString(),
        });

        return await sendTransport({
            contract: bridgeInstance,
            sendParam,
            msgFee,
            refundAddress: wallet.address,
        });
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

        if (props.bridge.kind === BridgeKind.Oft) {
            let txRequest: PopulatedEvmTransaction;
            try {
                txRequest = await prepareOftFromEvm({
                    signer: connectedSigner,
                    signerAddress,
                    directSendTarget: directSendTarget as OftDirectSendTarget,
                    sendParam: sendParam as SendParam,
                    msgFee,
                });
            } catch (error) {
                log.warn("Falling back to direct EVM OFT send", {
                    sourceAsset: props.bridge.sourceAsset,
                    destinationAsset: props.bridge.destinationAsset,
                    error,
                });
                return await bridgeDriver().sendDirect({
                    target: directSendTarget,
                    runner: connectedSigner,
                    sendParam,
                    msgFee,
                    refundAddress: signerAddress,
                });
            }

            try {
                const hash = await sendPopulatedTransaction(
                    GasAbstractionType.None,
                    connectedSigner,
                    txRequest,
                );
                return { hash };
            } catch (error) {
                if (isWalletRejectionError(error)) {
                    await setPendingSend(undefined);
                }
                throw error;
            }
        }

        return await bridgeDriver().sendDirect({
            target: directSendTarget,
            runner: connectedSigner,
            sendParam,
            msgFee,
            refundAddress: signerAddress,
        });
    };

    // Capture the latest confirmed sender nonce as a lower bound and persist the
    // populated call before broadcast. If the page is closed before the wallet
    // returns we can find the resulting transaction by replaying OFTSent logs and
    // matching on the sender and calldata.
    const prepareOftFromEvm = async (args: {
        signer: Signer;
        signerAddress: Address;
        directSendTarget: OftDirectSendTarget;
        sendParam: SendParam;
        msgFee: BridgeMsgFee;
    }): Promise<PopulatedEvmTransaction> => {
        const txRequest: PopulatedEvmTransaction =
            populateOftDirectSendTransaction({
                target: args.directSendTarget,
                sendParam: args.sendParam,
                msgFee: args.msgFee,
                refundAddress: args.signerAddress,
            });
        if (txRequest.to === undefined || txRequest.data === undefined) {
            throw new Error("OFT direct send transaction is missing call data");
        }

        const [fromNonce, latestBlock] = await Promise.all([
            args.signer.provider.getTransactionCount({
                address: args.signerAddress,
                blockTag: "latest",
            }),
            bridgeDriver()
                .getProvider(props.bridge.sourceAsset)
                .getBlockNumber(),
        ]);

        const pending: PendingEvmOftBridgeSend = {
            kind: PendingBridgeSendKind.EvmOft,
            createdAt: Date.now(),
            sender: args.signerAddress,
            fromNonce,
            // Reorgs can move the transaction back a few blocks; start a bit
            // earlier so log replay still finds it.
            fromBlock: Number(
                latestBlock > evmPendingSendBlockLookback
                    ? latestBlock - evmPendingSendBlockLookback
                    : 0n,
            ),
            oftContractAddress: args.directSendTarget.oftContract.address,
            transactionTo: txRequest.to,
            calldata: txRequest.data,
        };
        await setPendingSend(pending);

        return txRequest;
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
                when={pendingSend() === undefined}
                fallback={<WaitForBridge bridge={props.bridge} />}>
                <Show
                    when={
                        signerBalance() !== undefined &&
                        hasEnoughMsgFee() !== undefined
                    }
                    fallback={
                        <Show
                            when={sourceWalletReady()}
                            fallback={
                                <ConnectWallet
                                    asset={props.bridge.sourceAsset}
                                />
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
                            <InsufficientBalance
                                asset={props.bridge.sourceAsset}
                            />
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
                                    sourceTransport() ===
                                    NetworkTransport.Tron ? (
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
                                        const tx = await sendBridge();
                                        await persistBridgeSend(
                                            tx.hash,
                                            tx.details,
                                        );
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
        </Show>
    );
};

export default SendToBridge;
