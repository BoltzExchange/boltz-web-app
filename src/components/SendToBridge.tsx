import {
    type BridgeMsgFee,
    type BridgeSendParam,
    type BridgeTransaction,
    type BridgeTransportClient,
    PendingBridgeSendKind,
    type PendingEvmBridgeSend,
    bridgeRegistry,
} from "boltz-swaps/bridge";
import {
    type CctpDirectSendTarget,
    type CctpSendParam,
    type SolanaCctpTransportClient,
    populateCctpDirectSendTransaction,
} from "boltz-swaps/cctp";
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
    onCleanup,
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
import {
    formatAssetAmountForLog,
    formatNativeAmountForLog,
} from "../utils/denomination";
import { type BridgeDetail, GasAbstractionType } from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import ApproveTrc20 from "./ApproveTrc20";
import { useBridgeSendRecovery } from "./BridgeSendRecovery";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";
import WaitForBridge from "./WaitForBridge";

const evmSendCandidateBlockLookback = 5n;
const evmSendCandidateRecoveryTimeoutMs = 120_000;
const transactionHashPattern = /^0x[0-9a-fA-F]{64}$/;

const getTransactionHashFromError = (
    error: unknown,
    depth = 0,
): string | undefined => {
    if (depth > 3 || typeof error !== "object" || error === null) {
        return undefined;
    }

    for (const key of ["hash", "transactionHash"]) {
        const value = Reflect.get(error, key);
        if (typeof value === "string" && transactionHashPattern.test(value)) {
            return value;
        }
    }

    const value = Reflect.get(error, "value");
    if (typeof value === "object" && value !== null) {
        const hash = Reflect.get(value, "hash");
        if (typeof hash === "string" && transactionHashPattern.test(hash)) {
            return hash;
        }
    }

    const cause = Reflect.get(error, "cause");
    if (cause !== error) {
        return getTransactionHashFromError(cause, depth + 1);
    }

    return undefined;
};

type PreparedEvmBridgeSend = {
    candidate: PendingEvmBridgeSend;
    txRequest: PopulatedEvmTransaction;
};

const EvmSendCandidateRecovery = (props: {
    failed: boolean;
    createdAt: number;
    onCheckAgain: () => Promise<void>;
    onReset: () => Promise<void>;
}) => {
    const { t } = useGlobalContext();
    const [now, setNow] = createSignal(Date.now());

    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    onCleanup(() => window.clearInterval(interval));

    const remainingSeconds = createMemo(() =>
        Math.max(
            Math.ceil(
                (props.createdAt + evmSendCandidateRecoveryTimeoutMs - now()) /
                    1_000,
            ),
            0,
        ),
    );

    const reset = () => {
        if (window.confirm(t("did_not_send_transaction_confirm"))) {
            void props.onReset();
        }
    };

    return (
        <>
            <h2>
                {t(
                    props.failed
                        ? "could_not_confirm_previous_transaction"
                        : "checking_previous_transaction",
                )}
            </h2>
            <h3>
                {t(
                    props.failed
                        ? "could_not_confirm_previous_transaction_line"
                        : "checking_previous_transaction_line",
                )}
            </h3>
            <Show when={!props.failed}>
                <p>
                    {t("checking_previous_transaction_countdown", {
                        seconds: remainingSeconds(),
                    })}
                </p>
                <LoadingSpinner />
            </Show>
            <Show when={props.failed}>
                <button class="btn" onClick={() => void props.onCheckAgain()}>
                    {t("check_again")}
                </button>
            </Show>
            <button class="btn btn-light" onClick={reset}>
                {t("did_not_send_transaction")}
            </button>
        </>
    );
};

type BridgeSendResult = {
    tx: BridgeTransaction;
    sourceAmount: bigint;
};

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
    const [bridgeSendActive, setBridgeSendActive] = createSignal(false);
    const txSent = createMemo<string | undefined>(() => swap()?.bridge?.txHash);
    const {
        evmSendCandidate,
        evmSendCandidateRecoveryFailed,
        pendingSend,
        pendingSendCallbacks,
        persistBridgeSend,
        recoverEvmSendCandidate,
        setEvmSendCandidate,
    } = useBridgeSendRecovery({
        swapId: () => props.swapId,
        bridge: () => props.bridge,
        txSent,
        evmSendActive: bridgeSendActive,
    });

    // Transport sends that leave the browser to sign persist post-broadcast
    // recovery state. EVM sends use a candidate until the wallet returns a hash.
    const sendTransport = async (args: {
        contract: BridgeTransportClient;
        sendParam: BridgeSendParam;
        msgFee: BridgeMsgFee;
        refundAddress: string;
    }): Promise<BridgeTransaction> => {
        if (props.bridge.kind === BridgeKind.Cctp && "send" in args.contract) {
            return await (args.contract as SolanaCctpTransportClient).send(
                args.sendParam as CctpSendParam,
                args.msgFee,
                args.refundAddress,
                { pendingSendCallbacks },
            );
        }
        if (props.bridge.kind === BridgeKind.Oft) {
            return await (args.contract as OftTransportClient).send(
                args.sendParam as SendParam,
                args.msgFee,
                args.refundAddress,
                { pendingSendCallbacks },
            );
        }
        return await bridgeDriver().sendTransport(args);
    };

    const sendPreparedEvmBridgeTransaction = async (
        connectedSigner: Signer,
        prepared: PreparedEvmBridgeSend,
    ): Promise<BridgeTransaction> => {
        await setEvmSendCandidate(prepared.candidate);
        try {
            const hash = await sendPopulatedTransaction(
                GasAbstractionType.None,
                connectedSigner,
                prepared.txRequest,
            );
            return { hash };
        } catch (error) {
            const hash = getTransactionHashFromError(error);
            if (hash !== undefined) {
                return { hash };
            }
            await setEvmSendCandidate(undefined);
            throw error;
        }
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
            balance: formatAssetAmountForLog(balance, props.bridge.sourceAsset),
            requiredAmount: formatAssetAmountForLog(
                requiredTokenAmount,
                props.bridge.sourceAsset,
            ),
            sufficient: hasEnoughTokenBalance,
        });
        log.info(`${logLabel} signer native balance check`, {
            asset: props.bridge.sourceAsset,
            destinationAsset: props.bridge.destinationAsset,
            nativeBalance: formatNativeAmountForLog(
                nativeBalance,
                props.bridge.sourceAsset,
            ),
            requiredMsgFee: formatNativeAmountForLog(
                requiredNativeBalance,
                props.bridge.sourceAsset,
            ),
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

    const sendBridgeFromSolana = async (): Promise<BridgeSendResult> => {
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
            amount: formatAssetAmountForLog(
                sourceAmount,
                props.bridge.sourceAsset,
            ),
            nativeFee: formatNativeAmountForLog(
                msgFee[0],
                props.bridge.sourceAsset,
            ),
            lzTokenFee: msgFee[1].toString(),
        });

        const tx = await sendTransport({
            contract: bridgeInstance,
            sendParam,
            msgFee,
            refundAddress: wallet.address,
        });
        return { tx, sourceAmount };
    };

    const sendBridgeFromTron = async (): Promise<BridgeSendResult> => {
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
            amount: formatAssetAmountForLog(
                sourceAmount,
                props.bridge.sourceAsset,
            ),
            nativeFee: formatNativeAmountForLog(
                msgFee[0],
                props.bridge.sourceAsset,
            ),
            lzTokenFee: msgFee[1].toString(),
        });

        const tx = await sendTransport({
            contract: bridgeInstance,
            sendParam,
            msgFee,
            refundAddress: wallet.address,
        });
        return { tx, sourceAmount };
    };

    const sendBridgeFromEvm = async (): Promise<BridgeSendResult> => {
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
            amount: formatAssetAmountForLog(
                sourceAmount,
                props.bridge.sourceAsset,
            ),
            nativeFee: formatNativeAmountForLog(
                msgFee[0],
                props.bridge.sourceAsset,
            ),
            lzTokenFee: msgFee[1].toString(),
        });

        const sendDirect = async () =>
            await bridgeDriver().sendDirect({
                target: directSendTarget,
                runner: connectedSigner,
                sendParam,
                msgFee,
                refundAddress: signerAddress,
            });

        if (
            props.bridge.kind === BridgeKind.Oft ||
            props.bridge.kind === BridgeKind.Cctp
        ) {
            let prepared: PreparedEvmBridgeSend;
            try {
                prepared =
                    props.bridge.kind === BridgeKind.Oft
                        ? await prepareOftFromEvm({
                              signer: connectedSigner,
                              signerAddress,
                              directSendTarget:
                                  directSendTarget as OftDirectSendTarget,
                              sendParam: sendParam as SendParam,
                              msgFee,
                          })
                        : await prepareCctpFromEvm({
                              signer: connectedSigner,
                              signerAddress,
                              directSendTarget:
                                  directSendTarget as CctpDirectSendTarget,
                              sendParam: sendParam as CctpSendParam,
                          });
            } catch (error) {
                const label =
                    props.bridge.kind === BridgeKind.Oft ? "OFT" : "CCTP";
                log.warn(`Falling back to direct EVM ${label} send`, {
                    sourceAsset: props.bridge.sourceAsset,
                    destinationAsset: props.bridge.destinationAsset,
                    error,
                });
                return { tx: await sendDirect(), sourceAmount };
            }

            return {
                tx: await sendPreparedEvmBridgeTransaction(
                    connectedSigner,
                    prepared,
                ),
                sourceAmount,
            };
        }

        return { tx: await sendDirect(), sourceAmount };
    };

    const getEvmCandidateFromBlock = (latestBlock: bigint) =>
        Number(
            latestBlock > evmSendCandidateBlockLookback
                ? latestBlock - evmSendCandidateBlockLookback
                : 0n,
        );

    const getEvmCandidateBase = async (args: {
        signer: Signer;
        signerAddress: Address;
    }) => {
        const [fromNonce, latestBlock] = await Promise.all([
            args.signer.provider.getTransactionCount({
                address: args.signerAddress,
                blockTag: "latest",
            }),
            bridgeDriver()
                .getProvider(props.bridge.sourceAsset)
                .getBlockNumber(),
        ]);

        return {
            fromNonce,
            fromBlock: getEvmCandidateFromBlock(latestBlock),
        };
    };

    // Capture the latest confirmed sender nonce as a lower bound. If the page is
    // closed before the wallet returns we can find the resulting transaction by
    // replaying bridge logs and matching the sender, target, nonce, and calldata.
    const prepareOftFromEvm = async (args: {
        signer: Signer;
        signerAddress: Address;
        directSendTarget: OftDirectSendTarget;
        sendParam: SendParam;
        msgFee: BridgeMsgFee;
    }): Promise<PreparedEvmBridgeSend> => {
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

        const candidateBase = await getEvmCandidateBase(args);

        return {
            candidate: {
                kind: PendingBridgeSendKind.EvmOft,
                createdAt: Date.now(),
                sender: args.signerAddress,
                ...candidateBase,
                oftContractAddress: args.directSendTarget.oftContract.address,
                transactionTo: txRequest.to,
                calldata: txRequest.data,
            },
            txRequest,
        };
    };

    // CCTP burns emit MessageSent from the MessageTransmitter rather than an
    // OFTSent event. Save the exact TokenMessenger calldata so recovery can
    // replay burn logs against it.
    const prepareCctpFromEvm = async (args: {
        signer: Signer;
        signerAddress: Address;
        directSendTarget: CctpDirectSendTarget;
        sendParam: CctpSendParam;
    }): Promise<PreparedEvmBridgeSend> => {
        const cctpBridge = config.assets?.[props.bridge.sourceAsset]?.bridge;
        if (cctpBridge?.kind !== BridgeKind.Cctp) {
            throw new Error(
                `Missing CCTP config for ${props.bridge.sourceAsset}`,
            );
        }

        const txRequest: PopulatedEvmTransaction =
            populateCctpDirectSendTransaction({
                target: args.directSendTarget,
                sendParam: args.sendParam,
            });
        if (txRequest.to === undefined || txRequest.data === undefined) {
            throw new Error(
                "CCTP direct send transaction is missing call data",
            );
        }

        const candidateBase = await getEvmCandidateBase(args);

        return {
            candidate: {
                kind: PendingBridgeSendKind.EvmCctp,
                createdAt: Date.now(),
                sender: args.signerAddress,
                ...candidateBase,
                tokenMessenger: args.directSendTarget.executionContract.address,
                messageTransmitter: cctpBridge.cctp.messageTransmitter,
                calldata: txRequest.data,
            },
            txRequest,
        };
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
                when={evmSendCandidate() === undefined || bridgeSendActive()}
                fallback={
                    <EvmSendCandidateRecovery
                        createdAt={evmSendCandidate()!.createdAt}
                        failed={evmSendCandidateRecoveryFailed()}
                        onCheckAgain={recoverEvmSendCandidate}
                        onReset={() => setEvmSendCandidate(undefined)}
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
                                                setNeedsApproval={
                                                    setNeedsApproval
                                                }
                                                approvalTarget={
                                                    approvalTarget()!
                                                }
                                            />
                                        ) : (
                                            <ApproveErc20
                                                asset={props.bridge.sourceAsset}
                                                value={() =>
                                                    requiredTokenBalance() ??
                                                    props.amount
                                                }
                                                setNeedsApproval={
                                                    setNeedsApproval
                                                }
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
                                            setBridgeSendActive(true);
                                            try {
                                                const result =
                                                    await sendBridge();
                                                await persistBridgeSend(
                                                    result.tx.hash,
                                                    result.tx.details,
                                                    result.sourceAmount,
                                                );
                                            } finally {
                                                setBridgeSendActive(false);
                                            }
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
        </Show>
    );
};

export default SendToBridge;
