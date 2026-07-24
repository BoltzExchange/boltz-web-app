import { useNavigate, useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { quoteDexAmountIn } from "boltz-swaps/client";
import {
    assetAmountToSats,
    createAssetProvider,
    satsToAssetAmount,
} from "boltz-swaps/evm";
import { isEmptyPreimageHash } from "boltz-swaps/evm/commitment";
import {
    getLogsFromReceipt,
    getTimelockBlockNumber,
} from "boltz-swaps/evm/logs";
import { getSignerForGasAbstraction } from "boltz-swaps/evm/transaction";
import { AssetKind, RskRescueMode, SwapPosition } from "boltz-swaps/types";
import log from "loglevel";
import {
    Match,
    type Setter,
    Show,
    Switch,
    createMemo,
    createResource,
    createSignal,
} from "solid-js";
import { getAddress, isAddress } from "viem";

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import ConnectWallet from "../components/ConnectWallet";
import ContractTransaction from "../components/ContractTransaction";
import EvmRefundDestination from "../components/EvmRefundDestination";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import SignerNetworkGuard from "../components/SignerNetworkGuard";
import SwapHeader from "../components/SwapHeader";
import { getRestoredSwapIconAssets } from "../components/SwapIcons";
import SettingsMenu from "../components/settings/SettingsMenu";
import {
    type AssetType,
    RBTC,
    type blockChainsAssets,
    getKindForAsset,
} from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim } from "../rif/Signer";
import {
    claimHops,
    getClaimAssetForRoute,
} from "../status/TransactionConfirmed";
import { fromDexAmount } from "../utils/Pair";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { resolveLockupTokenFunder } from "../utils/evmLockup";
import { claimAsset } from "../utils/evmTransaction";
import { cropString } from "../utils/helper";
import { estimateFeesPerGas } from "../utils/provider";
import { fetchDexQuote } from "../utils/quoter";
import { getTimeoutEta } from "../utils/rescue";
import { createSignerNetworkCheck } from "../utils/signerNetwork";
import { GasAbstractionType } from "../utils/swapCreator";
import { getEvmDisplayAssets } from "./external-rescue/Results";
import { normalizeEvmId } from "./external-rescue/scan";
import type { EvmRescueResult } from "./external-rescue/types";

type RescueData = EvmRescueResult & { currentHeight: bigint };
type EvmRefundDisplayAmount = {
    amount: BigNumber;
    asset: string;
};

type EvmRefundDisplayQuoteParams = {
    amount: bigint;
    asset: string;
    chain: string;
    tokenIn: string;
    tokenOut: string;
};

const getEvmRefundDexDetails = (refundData: EvmRescueResult) =>
    refundData.dex ?? refundData.restoredSwap?.dex;

const getEvmRefundBridgeDetails = (refundData: EvmRescueResult) =>
    refundData.bridge ?? refundData.restoredSwap?.bridge;

export const getEvmRefundDisplayAmount = (
    refundData: EvmRescueResult,
    asset: string,
): EvmRefundDisplayAmount => {
    const dex = getEvmRefundDexDetails(refundData);
    const displayAsset =
        getEvmDisplayAssets({
            ...refundData,
            action: RskRescueMode.Refund,
            asset: asset as AssetType,
        })[0] ?? asset;

    if (dex?.position === SwapPosition.Pre) {
        return {
            amount: new BigNumber(dex.quoteAmount.toString()),
            asset: displayAsset,
        };
    }

    return {
        amount: new BigNumber(
            assetAmountToSats(refundData.amount, asset).toString(),
        ),
        asset,
    };
};

export const getEvmRefundDisplayQuoteParams = (
    refundData: EvmRescueResult,
    asset: string,
): EvmRefundDisplayQuoteParams | undefined => {
    const dex = getEvmRefundDexDetails(refundData);
    const hopDexDetails =
        dex?.position === SwapPosition.Pre
            ? dex.hops[0]?.dexDetails
            : undefined;

    if (hopDexDetails === undefined || refundData.tokenAddress === undefined) {
        return undefined;
    }

    return {
        amount: refundData.amount,
        asset: getEvmRefundDisplayAmount(refundData, asset).asset,
        chain: hopDexDetails.chain,
        tokenIn: refundData.tokenAddress,
        tokenOut: hopDexDetails.tokenIn,
    };
};

export const fetchEvmRefundDisplayQuote = async (
    params: EvmRefundDisplayQuoteParams,
): Promise<EvmRefundDisplayAmount | undefined> => {
    try {
        const [quote] = await quoteDexAmountIn(
            params.chain,
            params.tokenIn,
            params.tokenOut,
            params.amount,
        );

        if (quote === undefined) {
            return undefined;
        }

        return {
            amount: fromDexAmount(BigInt(quote.quote), params.asset),
            asset: params.asset,
        };
    } catch (error) {
        log.warn("failed to fetch EVM refund display quote", {
            error: formatError(error),
        });
        return undefined;
    }
};

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RescueData;
    setRefundTxId: Setter<string>;
}) => {
    const { t, denomination, separator } = useGlobalContext();
    const { signer, getGasAbstractionSigner } = useWeb3Signer();
    const { rescueFile } = useRescueContext();
    const [manualDestination, setManualDestination] = createSignal("");

    const isErc20 = () => getKindForAsset(props.asset) === AssetKind.ERC20;
    const dexDetails = () => getEvmRefundDexDetails(props.refundData);
    const bridgeDetails = () => getEvmRefundBridgeDetails(props.refundData);
    const displayQuoteParams = createMemo(() =>
        getEvmRefundDisplayQuoteParams(props.refundData, props.asset),
    );
    const [quotedDisplayAmount] = createResource(
        displayQuoteParams,
        fetchEvmRefundDisplayQuote,
    );
    const displayQuoteLoading = () =>
        displayQuoteParams() !== undefined && quotedDisplayAmount.loading;
    const displayAmount = () =>
        quotedDisplayAmount() ??
        getEvmRefundDisplayAmount(props.refundData, props.asset);

    const canSelectDestination = () => isErc20() && rescueFile() !== undefined;
    const gasAbstraction = () =>
        canSelectDestination()
            ? {
                  type: GasAbstractionType.Signer,
                  signer: getGasAbstractionSigner(props.asset, rescueFile()),
              }
            : undefined;

    // Pre-bridge refunds resolve their destination from the bridge instead
    const needsResolvedDestination = () =>
        dexDetails()?.position === SwapPosition.Pre &&
        bridgeDetails()?.position !== SwapPosition.Pre;
    const routeResolvesDestination = () =>
        dexDetails()?.position === SwapPosition.Pre &&
        bridgeDetails()?.position === SwapPosition.Pre;
    // When the connected wallet is the refund destination, it has to be on
    // the network the funds are refunded to
    const walletNetwork = createSignerNetworkCheck(
        () =>
            canSelectDestination() && !routeResolvesDestination()
                ? signer()
                : undefined,
        () => props.asset,
    );
    const connectedWalletOnRefundNetwork = () =>
        walletNetwork.signer() === undefined || walletNetwork.valid() === true;

    const [resolvedFunder] = createResource(
        () => {
            if (signer() !== undefined || !isErc20() || !rescueFile()) {
                return undefined;
            }
            if (!needsResolvedDestination()) {
                return undefined;
            }
            const tokenIn = dexDetails()?.hops[0]?.dexDetails?.tokenIn;
            if (tokenIn === undefined) {
                return undefined;
            }
            return {
                asset: props.asset,
                tokenIn,
                txHash: props.lockupTxHash,
            };
        },
        (lookup) =>
            resolveLockupTokenFunder(
                lookup.asset,
                lookup.tokenIn,
                lookup.txHash,
            ),
    );

    const destination = () => {
        if (!isErc20() || !rescueFile()) {
            return undefined;
        }
        try {
            const enteredDestination = manualDestination().trim();
            return (
                signer()?.address ??
                (isAddress(enteredDestination)
                    ? enteredDestination
                    : undefined) ??
                (resolvedFunder.state === "ready"
                    ? resolvedFunder()
                    : undefined)
            );
        } catch {
            return undefined;
        }
    };

    const destinationMissing = () =>
        canSelectDestination() &&
        !routeResolvesDestination() &&
        destination() === undefined;
    const hasResolvedRouteDestination = () =>
        resolvedFunder.state === "ready" && resolvedFunder() !== undefined;

    return (
        <>
            <div class="rescue-evm-refund-amount">
                <span>{t("refund")}</span>
                <Show
                    when={!displayQuoteLoading()}
                    fallback={
                        <LoadingSpinner class="inner-spinner inline-spinner" />
                    }>
                    <span>
                        {formatAmount(
                            displayAmount().amount,
                            denomination(),
                            separator(),
                            displayAmount().asset,
                        )}{" "}
                        {formatDenomination(
                            denomination(),
                            displayAmount().asset,
                        )}
                    </span>
                </Show>
            </div>

            <Show when={canSelectDestination() && !routeResolvesDestination()}>
                <EvmRefundDestination
                    asset={props.asset}
                    hideInput={
                        gasAbstraction()?.signer === undefined ||
                        hasResolvedRouteDestination() ||
                        resolvedFunder.loading
                    }
                    value={manualDestination()}
                    setValue={setManualDestination}
                />
            </Show>
            <SignerNetworkGuard network={walletNetwork}>
                <Show when={connectedWalletOnRefundNetwork()}>
                    <RefundButton
                        asset={props.asset}
                        swapId={props.refundData.restoredSwap?.id}
                        dexDetails={dexDetails()}
                        bridge={bridgeDetails()}
                        disabled={destinationMissing()}
                        setRefundTxId={
                            props.setRefundTxId as Setter<string | undefined>
                        }
                        signerAddress={props.refundData.refundAddress}
                        lockupTxHash={props.lockupTxHash}
                        gasAbstraction={gasAbstraction()?.type}
                        transactionSigner={gasAbstraction()?.signer}
                        destination={destination()}
                    />
                </Show>
            </SignerNetworkGuard>
            <Show
                when={
                    signer() === undefined &&
                    gasAbstraction()?.signer === undefined
                }>
                <button class="btn" disabled>
                    {t("refund")}
                </button>
            </Show>
            <hr />
            <BlockExplorer
                typeLabel={"lockup_tx"}
                asset={props.asset}
                kind={BlockExplorerTargetKind.Tx}
                id={props.lockupTxHash}
            />
        </>
    );
};

const ClaimState = (props: {
    asset: string;
    lockupTxHash: string;
    claimData: RescueData;
    setClaimTxId: Setter<string>;
}) => {
    const navigate = useNavigate();
    const { t, slippage } = useGlobalContext();
    const { signer, getEtherSwap, getErc20Swap, getGasAbstractionSigner } =
        useWeb3Signer();
    const { evmRescuableSwaps, rescueFile } = useRescueContext();

    const preimage = () => {
        const preimageHash = normalizeEvmId(
            props.claimData.restoredSwap?.preimageHash ??
                props.claimData.preimageHash,
        );
        const swapFromContext = evmRescuableSwaps().find(
            (s) => normalizeEvmId(s.preimageHash) === preimageHash,
        );
        return swapFromContext?.preimage
            ? Buffer.from(swapFromContext.preimage, "hex")
            : undefined;
    };

    const dexDetails = () =>
        props.claimData.dex ?? props.claimData.restoredSwap?.dex;
    const bridgeDetails = () =>
        props.claimData.bridge ?? props.claimData.restoredSwap?.bridge;
    const routedDex = () => {
        const dex = dexDetails();
        return dex?.position === SwapPosition.Post && dex.hops.length > 0
            ? dex
            : undefined;
    };
    const postBridge = () => {
        const bridge = bridgeDetails();
        return bridge?.position === SwapPosition.Post ? bridge : undefined;
    };
    const restoredReceiveAsset = () =>
        props.claimData.restoredSwap?.to ?? props.asset;
    const routeClaimAsset = () =>
        getClaimAssetForRoute(restoredReceiveAsset(), dexDetails());
    const finalReceiveAsset = () => {
        if (routedDex() === undefined) {
            return restoredReceiveAsset();
        }

        const bridge = postBridge();
        if (bridge !== undefined) {
            return bridge.destinationAsset;
        }

        const dex = routedDex();
        if (dex !== undefined) {
            return dex.hops[dex.hops.length - 1].to;
        }

        return restoredReceiveAsset();
    };
    const rescueGasSigner = () => {
        const file = rescueFile();
        return file === undefined
            ? undefined
            : getGasAbstractionSigner(routeClaimAsset(), file);
    };
    const hasDirectDestination = () => {
        const gasSigner = rescueGasSigner();
        return (
            gasSigner !== undefined &&
            normalizeEvmId(props.claimData.claimAddress) !==
                normalizeEvmId(gasSigner.address)
        );
    };
    const claimDestination = () => {
        if (routedDex() !== undefined) {
            return (
                props.claimData.restoredSwap?.originalDestination ??
                signer()?.address
            );
        }

        return hasDirectDestination()
            ? props.claimData.claimAddress
            : signer()?.address;
    };

    const canClaimWithoutWallet = () =>
        getKindForAsset(routeClaimAsset()) === AssetKind.ERC20 &&
        rescueFile() !== undefined &&
        (routedDex() !== undefined
            ? props.claimData.restoredSwap?.originalDestination !== undefined
            : hasDirectDestination());

    const signerOverride = () =>
        signer() ?? (canClaimWithoutWallet() ? rescueGasSigner() : undefined);

    const getGasAbstraction = async (
        asset: string,
    ): Promise<GasAbstractionType> => {
        if (asset === RBTC) {
            const sig = signer();
            if (sig === undefined) {
                throw new Error("missing signer for gas check");
            }
            const [balance, { gasPrice }] = await Promise.all([
                sig.provider.getBalance({ address: sig.address }),
                estimateFeesPerGas(sig.provider),
            ]);

            if (gasPrice === null || balance <= gasPrice * GasNeededToClaim) {
                return GasAbstractionType.RifRelay;
            }
            return GasAbstractionType.None;
        }

        if (getKindForAsset(asset) === AssetKind.ERC20) {
            return GasAbstractionType.Signer;
        }

        return GasAbstractionType.None;
    };

    const claimTransaction = async () => {
        const currentPreimage = preimage();
        if (!currentPreimage) return;

        const asset = routeClaimAsset();
        const { amount, claimAddress, refundAddress, timelock } =
            props.claimData;
        const amountSats = assetAmountToSats(amount, asset);

        try {
            const gasAbstraction = await getGasAbstraction(asset);
            const sig = signerOverride();
            const dex = routedDex();
            const destination = claimDestination();
            if (destination === undefined) {
                throw new Error("missing claim destination");
            }

            if (dex !== undefined) {
                const gasAbstractionSigner = getGasAbstractionSigner(
                    asset,
                    rescueFile(),
                );
                const claimSigner = getSignerForGasAbstraction(
                    gasAbstraction,
                    sig,
                    gasAbstractionSigner,
                );
                const hopDexDetails = dex.hops[0].dexDetails;
                if (claimSigner === undefined) {
                    throw new Error("missing signer for routed claim");
                }
                if (hopDexDetails === undefined) {
                    throw new Error("claim hop is missing DEX details");
                }

                const quote = await fetchDexQuote(
                    hopDexDetails,
                    satsToAssetAmount(amountSats, asset),
                );
                const transactionHash = await claimHops(
                    dex.hops,
                    gasAbstraction,
                    asset,
                    currentPreimage.toString("hex"),
                    amountSats,
                    refundAddress,
                    Number(timelock),
                    destination,
                    () => claimSigner,
                    getErc20Swap(asset),
                    slippage(),
                    quote,
                    false,
                    postBridge(),
                );

                props.setClaimTxId(transactionHash);
                return;
            }

            if (sig === undefined) {
                throw new Error("missing signer for claim");
            }

            const { transactionHash } = await claimAsset({
                gasAbstraction,
                asset,
                preimage: currentPreimage.toString("hex"),
                amount: amountSats,
                claimAddress,
                refundAddress,
                timeoutBlockHeight: Number(timelock),
                destination: getAddress(destination),
                signer: () => sig,
                gasAbstractionSigner: getGasAbstractionSigner(
                    asset,
                    rescueFile(),
                ),
                etherSwap: getEtherSwap(asset),
                erc20Swap: getErc20Swap(asset),
            });

            props.setClaimTxId(transactionHash);
        } catch (error) {
            log.error(error);
            throw error; // will be catched by ContractTransaction and notified
        }
    };

    return (
        <Show
            when={preimage() !== undefined}
            fallback={
                <>
                    <p>{t("claim_scan_required")}</p>
                    <button class="btn" onClick={() => navigate("/rescue")}>
                        {t("back")}
                    </button>
                </>
            }>
            <Show
                when={signer() !== undefined || canClaimWithoutWallet()}
                fallback={
                    <>
                        <ConnectWallet asset={routeClaimAsset()} />
                        <button class="btn" disabled>
                            {t("claim")}
                        </button>
                    </>
                }>
                <ContractTransaction
                    asset={routeClaimAsset()}
                    signerOverride={signerOverride}
                    onClick={claimTransaction}
                    buttonText={t("continue")}
                    promptText={t("transaction_prompt_receive", {
                        button: t("continue"),
                        asset: finalReceiveAsset(),
                    })}
                    waitingText={t("tx_ready_to_claim")}
                />
            </Show>
        </Show>
    );
};

const RescueEvm = () => {
    const params = useParams<{
        asset: string;
        txHash: string;
        action: RskRescueMode;
    }>();

    const { t } = useGlobalContext();
    const { evmRescuableSwaps } = useRescueContext();
    const { getEtherSwap, getErc20Swap } = useWeb3Signer();

    const getSwapContract = (asset: string) =>
        getKindForAsset(asset) === AssetKind.ERC20
            ? getErc20Swap(asset)
            : getEtherSwap(asset);

    const [refundTxId, setRefundTxId] = createSignal<string | undefined>(
        undefined,
    );
    const [claimTxId, setClaimTxId] = createSignal<string | undefined>(
        undefined,
    );

    const [chainData] = createResource(async () => {
        const provider = createAssetProvider(params.asset);
        const contract = getSwapContract(params.asset);

        const [logData, currentHeight] = await Promise.all([
            getLogsFromReceipt(
                provider,
                params.asset as AssetType,
                contract,
                params.txHash,
            ),
            getTimelockBlockNumber(provider, params.asset as AssetType),
        ]);

        return {
            ...logData,
            currentHeight: BigInt(currentHeight),
        };
    });

    // Reactive so routed swap metadata still attaches when the scan
    // populates the context after the on-chain data has resolved
    const contextData = createMemo(() =>
        evmRescuableSwaps().find(
            (swap) =>
                swap.action === params.action &&
                swap.transactionHash.toLowerCase() ===
                    params.txHash.toLowerCase(),
        ),
    );

    const rescueData = createMemo<RescueData | undefined>(() => {
        const data = chainData();
        if (data === undefined) {
            return undefined;
        }

        return {
            ...contextData(),
            ...data,
            action: params.action,
        };
    });

    const isRefundAction = () => params.action === RskRescueMode.Refund;

    const timelockExpired = () => {
        const data = rescueData();
        return data !== undefined && data.timelock <= data.currentHeight;
    };

    const isCommitmentLockup = () =>
        isEmptyPreimageHash(rescueData()?.preimageHash);

    const canRefund = () =>
        isRefundAction() && (timelockExpired() || isCommitmentLockup());

    const headerSwap = () => contextData()?.restoredSwap;
    const headerId = () => headerSwap()?.id ?? cropString(params.txHash, 15, 5);
    const headerStatus = () => headerSwap()?.status;

    return (
        <div class="frame" data-status={headerStatus()}>
            <Switch>
                <Match when={chainData.state === "ready"}>
                    <SwapHeader
                        id={headerId()}
                        status={headerStatus()}
                        assets={
                            headerSwap() !== undefined
                                ? getRestoredSwapIconAssets(headerSwap()!)
                                : undefined
                        }
                    />
                    <Switch>
                        <Match when={canRefund()}>
                            <Show
                                when={refundTxId() === undefined}
                                fallback={
                                    <>
                                        <p>{t("refunded")}</p>
                                        <hr />
                                        <BlockExplorer
                                            typeLabel={"refund_tx"}
                                            asset={params.asset}
                                            kind={BlockExplorerTargetKind.Tx}
                                            id={refundTxId()!}
                                        />
                                    </>
                                }>
                                <RefundState
                                    asset={params.asset}
                                    lockupTxHash={params.txHash}
                                    refundData={rescueData()!}
                                    setRefundTxId={
                                        setRefundTxId as Setter<string>
                                    }
                                />
                            </Show>
                        </Match>
                        <Match when={!isRefundAction()}>
                            <Show
                                when={claimTxId() === undefined}
                                fallback={
                                    <>
                                        <p>{t("claimed")}</p>
                                        <hr />
                                        <BlockExplorer
                                            typeLabel={"claim_tx"}
                                            asset={params.asset}
                                            kind={BlockExplorerTargetKind.Tx}
                                            id={claimTxId()!}
                                        />
                                    </>
                                }>
                                <ClaimState
                                    asset={params.asset}
                                    lockupTxHash={params.txHash}
                                    claimData={rescueData()!}
                                    setClaimTxId={
                                        setClaimTxId as Setter<string>
                                    }
                                />
                            </Show>
                        </Match>
                        <Match when={isRefundAction() && !timelockExpired()}>
                            <RefundEta
                                timeoutEta={() =>
                                    getTimeoutEta(
                                        params.asset as blockChainsAssets,
                                        Number(rescueData()!.timelock),
                                        Number(rescueData()!.currentHeight),
                                    )
                                }
                                timeoutBlockHeight={() =>
                                    Number(rescueData()!.timelock)
                                }
                                asset={params.asset}
                            />
                        </Match>
                    </Switch>
                </Match>
                <Match when={chainData.state === "pending"}>
                    <SwapHeader
                        id={headerId()}
                        status={headerStatus()}
                        assets={
                            headerSwap() !== undefined
                                ? getRestoredSwapIconAssets(headerSwap()!)
                                : undefined
                        }
                    />
                    <LoadingSpinner />
                </Match>
                <Match when={chainData.state === "errored"}>
                    <h2>{t("error")}</h2>
                    <h3>{formatError(chainData.error)}</h3>
                </Match>
            </Switch>
            <SettingsMenu />
        </div>
    );
};

export default RescueEvm;
