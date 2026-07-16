import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { bridgeRegistry } from "boltz-swaps/bridge";
import {
    type ChainPairTypeTaproot,
    fetchBip21Invoice,
} from "boltz-swaps/client";
import { isLnurlAmountError } from "boltz-swaps/errors";
import { isKnownTokenAddress } from "boltz-swaps/evm";
import { InvoiceType, decodeInvoice } from "boltz-swaps/invoice";
import { resolveInvoice } from "boltz-swaps/resolveInvoice";
import { SwapPosition, SwapType } from "boltz-swaps/types";
import log from "loglevel";
import {
    type Accessor,
    createEffect,
    createMemo,
    createSignal,
    on,
} from "solid-js";

import {
    BTC,
    LBTC,
    LN,
    RBTC,
    getBridgeKind,
    getCanonicalAsset,
    getRouteViaAsset,
    isEvmAsset,
} from "../consts/Assets";
import { Side } from "../consts/Enums";
import type { ButtonLabelParams } from "../consts/Types";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import {
    type Signer,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import type { DictKey } from "../i18n/i18n";
import { GasNeededToClaim, getSmartWalletAddress } from "../rif/Signer";
import Pair, {
    type CreationData,
    type EncodedHop,
    toDexAmount,
} from "../utils/Pair";
import { calculateSendAmount } from "../utils/calculate";
import { canCommitSubmarineSendAmount } from "../utils/commitmentSwap";
import { validateAddress as validateOnchainAddress } from "../utils/compat";
import {
    btcToSat,
    formatAmount,
    formatAssetAmountForLog,
    formatDenomination,
    formatSwapAmountForLog,
} from "../utils/denomination";
import { formatError } from "../utils/errors";
import { handleCreateSwapError } from "../utils/handleCreateSwapError";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { getDestinationAddress, getPair } from "../utils/helper";
import { getAssetByBip21Prefix } from "../utils/invoice";
import { findMagicRoutingHint } from "../utils/magicRoutingHint";
import { estimateFeesPerGas } from "../utils/provider";
import { gasTopUpSupported } from "../utils/quoter";
import { canSendAsset } from "../utils/selectableAsset";
import {
    type BridgeDetail,
    type ChainSwap,
    type DexDetail,
    type GasAbstraction,
    GasAbstractionType,
    type ReverseSwap,
    type SubmarineSwap,
    createChain,
    createCommitmentSwap,
    createReverse,
    createSubmarine,
} from "../utils/swapCreator";
import {
    type SwapMetadataSource,
    buildSwapMetadataPayload,
    encryptSwapMetadata,
} from "../utils/swapMetadata";
import { validateResponse } from "../utils/validation";
import LoadingSpinner from "./LoadingSpinner";
import { getMagicRoutingHintSavedFees } from "./OptimizedRoute";

// In milliseconds
const invoiceFetchTimeout = 25_000;

const userErrorLabelKeys = new Set<DictKey>([
    "invalid_pair",
    "invalid_send_asset",
    "maximum_amount",
    "invalid_0_amount",
    "min_amount_destination",
    "max_amount_destination",
]);

const buildBridgeDetail = (
    asset: string,
    position: SwapPosition,
    sourceAmount?: BigNumber,
): BridgeDetail | undefined => {
    const route =
        position === SwapPosition.Pre
            ? bridgeRegistry.getPreRoute(asset)
            : bridgeRegistry.getPostRoute(asset);
    if (route === undefined) {
        return undefined;
    }

    const driver = bridgeRegistry.getDriverForAsset(asset);
    if (driver === undefined) {
        return undefined;
    }

    const bridge = driver.getRoutePosition(route, position);
    if (position !== SwapPosition.Pre || sourceAmount === undefined) {
        return bridge;
    }

    return {
        ...bridge,
        sourceAmount: sourceAmount.toFixed(0),
    };
};

const buildDexDetail = (
    hops: EncodedHop[],
    position: SwapPosition | undefined,
    sendAmount: BigNumber,
    receiveAmount: BigNumber,
    sourceAmount?: BigNumber,
): DexDetail | undefined => {
    if (position === undefined) {
        return undefined;
    }

    const dex = {
        hops,
        position,
        quoteAmount:
            position === SwapPosition.Post
                ? Number(receiveAmount)
                : Number(sendAmount),
    };

    if (position !== SwapPosition.Pre || sourceAmount === undefined) {
        return dex;
    }

    return {
        ...dex,
        sourceAmount: toDexAmount(sourceAmount, hops[0].from).toString(),
    };
};

const getLockupGasAbstraction = (assetSend: string): GasAbstractionType => {
    const asset = getCanonicalAsset(assetSend);
    if (isEvmAsset(asset) && asset !== RBTC) {
        return GasAbstractionType.Signer;
    }

    return GasAbstractionType.None;
};

export const getClaimAddress = async (
    assetReceive: Accessor<string>,
    assetSend: Accessor<string>,
    signer: Accessor<Signer | undefined>,
    onchainAddress: Accessor<string>,
    getGasAbstractionSigner: (asset: string) => Signer,
    getGasToken: boolean | undefined,
): Promise<{
    gasAbstraction: GasAbstraction;
    gasPrice: bigint;
    claimAddress: string;
}> => {
    const lockupGasAbstraction = getLockupGasAbstraction(assetSend());

    if (assetReceive() === RBTC && signer() !== undefined) {
        const activeSigner = signer()!;
        const [balance, gasPrice] = await Promise.all([
            activeSigner.provider.getBalance({
                address: activeSigner.address,
            }),
            estimateFeesPerGas(activeSigner.provider).then(
                (data) => data.gasPrice ?? 0n,
            ),
        ]);
        log.debug("RSK balance", formatAssetAmountForLog(balance, RBTC));

        const balanceNeeded = gasPrice * GasNeededToClaim;
        log.debug(
            "RSK balance needed",
            formatAssetAmountForLog(balanceNeeded, RBTC),
        );

        if (balance <= balanceNeeded) {
            log.info("Using RIF smart wallet as claim address");
            return {
                gasPrice,
                gasAbstraction: {
                    lockup: lockupGasAbstraction,
                    claim: GasAbstractionType.RifRelay,
                },
                claimAddress: (await getSmartWalletAddress(activeSigner))
                    .address,
            };
        }

        log.info("RIF smart wallet not needed");
    }

    if (
        (isEvmAsset(assetReceive()) ||
            getBridgeKind(assetReceive()) !== undefined) &&
        assetReceive() !== RBTC
    ) {
        const canonicalReceiveAsset = getCanonicalAsset(assetReceive());
        const gasSigner = getGasAbstractionSigner(canonicalReceiveAsset);
        log.debug("Using gas abstraction signer", gasSigner.address);
        return {
            gasPrice: 0n,
            gasAbstraction: {
                lockup: lockupGasAbstraction,
                claim: GasAbstractionType.Signer,
            },
            claimAddress:
                getBridgeKind(assetReceive()) === undefined &&
                getRouteViaAsset(assetReceive()) === undefined &&
                !getGasToken
                    ? onchainAddress()
                    : gasSigner.address,
        };
    }

    log.debug("Using no gas abstraction");
    return {
        gasPrice: 0n,
        gasAbstraction: {
            lockup: lockupGasAbstraction,
            claim: GasAbstractionType.None,
        },
        claimAddress: onchainAddress(),
    };
};

const CreateButton = () => {
    const navigate = useNavigate();
    const {
        separator,
        setSwapStorage,
        denomination,
        pairs,
        setPairs,
        online,
        notify,
        t,
        newKey,
        deriveKey,
        rescueFile,
        regularPairs,
    } = useGlobalContext();
    const {
        pair,
        setPair,
        getGasToken,
        invoice,
        lnurl,
        onchainAddress,
        receiveAmount,
        sendAmount,
        amountChanged,
        amountValid,
        setInvoice,
        setInvoiceValid,
        setLnurl,
        setOnchainAddress,
        valid,
        addressValid,
        setAddressValid,
        minimum,
        maximum,
        invoiceValid,
        invoiceError,
        bolt12Offer,
        setBolt12Offer,
        setSendAmount,
        setReceiveAmount,
        bolt12Loading,
        quoteLoading,
        quoteError,
        setAmountChanged,
    } = useCreateContext();
    const {
        signer,
        connectedWallet,
        providers,
        getEtherSwap,
        getErc20Swap,
        getGasAbstractionSigner,
    } = useWeb3Signer();

    const [buttonDisable, setButtonDisable] = createSignal(false);
    const [loading, setLoading] = createSignal(false);
    const [buttonLabel, setButtonLabel] = createSignal<ButtonLabelParams>({
        key: "create_swap",
    });
    const pairsLoading = () => online() && pairs() === undefined;
    const invalidPairState = () => pairs() !== undefined && !pair().isRoutable;
    const buttonClass = createMemo(() => {
        if (!online()) {
            return "btn btn-danger";
        }
        if (!pairsLoading() && userErrorLabelKeys.has(buttonLabel().key)) {
            return "btn btn-error";
        }
        return "btn";
    });
    const [originalDestination, setOriginalDestination] = createSignal<
        string | undefined
    >(undefined);

    const swapType = () => pair().swapToCreate?.type;
    const assetSend = () => pair().fromAsset;
    const assetReceive = () => pair().toAsset;
    const deferredInvoiceDestination = () => lnurl() || bolt12Offer();
    const canCreateCommitmentSwap = () =>
        canCommitSubmarineSendAmount(pair(), amountChanged()) &&
        amountValid() &&
        invoiceError() === undefined &&
        (invoice() === "" || deferredInvoiceDestination() !== undefined);
    const canCreateSwap = () =>
        valid() || validWayToFetchInvoice() || canCreateCommitmentSwap();
    const getSwapCreationLogContext = (
        claimAddress?: string,
        gasAbstraction?: GasAbstraction,
    ) => ({
        swapType: swapType() ?? "unknown",
        assetSend: assetSend(),
        assetReceive: assetReceive(),
        sendAmount: formatSwapAmountForLog(sendAmount(), assetSend()),
        receiveAmount: formatSwapAmountForLog(receiveAmount(), assetReceive()),
        onchainAddress: onchainAddress(),
        claimAddress,
        gasAbstraction,
        originalDestination: originalDestination(),
        getGasToken: getGasToken(),
        hasInvoice: Boolean(invoice()),
        hasLnurl: Boolean(lnurl()),
        hasBolt12Offer: Boolean(bolt12Offer()),
    });

    createEffect(
        on(
            [
                valid,
                amountValid,
                addressValid,
                invoiceValid,
                invoiceError,
                quoteError,
                amountChanged,
                pair,
                lnurl,
                online,
                minimum,
                bolt12Offer,
                denomination,
                sendAmount,
                receiveAmount,
                onchainAddress,
                invoice,
            ],
            () => {
                setButtonDisable(false);
                if (!online()) {
                    setButtonLabel({ key: "api_offline" });
                    return;
                }
                if (pairs() === undefined) {
                    return;
                }
                if (!pair().isRoutable) {
                    if (!canSendAsset(pair().fromAsset)) {
                        setButtonLabel({ key: "invalid_send_asset" });
                    } else {
                        setButtonLabel({ key: "invalid_pair" });
                    }
                    return;
                }

                const isChainSwapWithZeroAmount = () =>
                    swapType() === SwapType.Chain &&
                    !isEvmAsset(assetSend()) &&
                    sendAmount().isZero();

                const isSubmarineSwapInvoiceValid = () =>
                    swapType() === SwapType.Submarine && !invoiceError();

                const hasInvalidDestinationInput = () => {
                    if (swapType() === SwapType.Submarine) {
                        return (
                            Boolean(invoiceError()) ||
                            (invoice() !== "" &&
                                !invoiceValid() &&
                                lnurl() === "" &&
                                bolt12Offer() === undefined)
                        );
                    }
                    return onchainAddress() !== "" && !addressValid();
                };

                const shouldShowAmountError = () =>
                    !amountValid() &&
                    // Chain swaps with 0-amount that do not have RBTC as sending asset
                    // can skip this check
                    !isChainSwapWithZeroAmount() &&
                    !canCreateCommitmentSwap() &&
                    (isSubmarineSwapInvoiceValid() ||
                        swapType() !== SwapType.Submarine) &&
                    !(sendAmount().isZero() && hasInvalidDestinationInput());

                if (shouldShowAmountError()) {
                    const quoteErrorKey = quoteError();
                    if (
                        quoteErrorKey !== undefined &&
                        (sendAmount().isGreaterThan(0) ||
                            receiveAmount().isGreaterThan(0))
                    ) {
                        setButtonLabel({ key: quoteErrorKey });
                        return;
                    }

                    if (
                        sendAmount().isGreaterThan(0) &&
                        receiveAmount().isZero()
                    ) {
                        setButtonLabel({ key: "error_zero_quote" });
                        return;
                    }

                    const lessThanMin =
                        sendAmount().isZero() ||
                        Number(sendAmount()) < minimum();
                    setButtonLabel({
                        key: lessThanMin ? "minimum_amount" : "maximum_amount",
                        params: {
                            amount: formatAmount(
                                BigNumber(lessThanMin ? minimum() : maximum()),
                                denomination(),
                                separator(),
                                assetSend(),
                            ),
                            denomination: formatDenomination(
                                denomination(),
                                assetSend(),
                            ),
                        },
                    });
                    return;
                }

                if (swapType() !== SwapType.Submarine) {
                    if (!addressValid()) {
                        setButtonLabel({
                            key: "invalid_address",
                            params: {
                                asset: assetReceive(),
                            },
                        });
                        return;
                    }
                } else {
                    if (canCreateCommitmentSwap()) {
                        setButtonLabel({ key: "create_swap" });
                        return;
                    }
                    if (validWayToFetchInvoice()) {
                        setButtonLabel({ key: "create_swap" });
                        return;
                    }
                    if (!invoiceValid()) {
                        setButtonLabel({
                            key: invoiceError() || "invalid_invoice",
                        });
                        return;
                    }
                }
                setButtonLabel({ key: "create_swap" });
            },
        ),
    );

    const validWayToFetchInvoice = (): boolean => {
        return (
            swapType() === SwapType.Submarine &&
            deferredInvoiceDestination() !== undefined &&
            amountValid() &&
            sendAmount().isGreaterThan(0) &&
            assetReceive() !== assetSend()
        );
    };

    const getOriginalDestination = () =>
        originalDestination() ||
        (assetReceive() !== LN && onchainAddress() !== ""
            ? onchainAddress()
            : undefined);

    const showInvalidAddress = (asset: string) => {
        setAddressValid(false);
        notify(
            "error",
            t("invalid_address", {
                asset,
            }),
        );
    };

    const fetchInvoice = async (): Promise<boolean> => {
        const destination = deferredInvoiceDestination();
        if (destination === undefined) {
            return false;
        }
        const fetchingLnurl = lnurl() !== "";

        log.info(
            fetchingLnurl
                ? "Resolving invoice for LNURL or BIP-353"
                : "Resolving invoice for bolt12 offer",
            destination,
        );

        try {
            const { invoice } = await resolveInvoice(
                destination,
                Number(receiveAmount()),
                { timeoutMs: invoiceFetchTimeout },
            );

            setOriginalDestination(destination);
            setInvoice(invoice);
            if (fetchingLnurl) {
                setLnurl("");
            } else {
                setBolt12Offer(undefined);
            }
            setInvoiceValid(true);
            return true;
        } catch (e) {
            log.warn("Resolving invoice failed", e);
            setInvoiceValid(false);

            if (isLnurlAmountError(e)) {
                const value = {
                    amount: formatAmount(
                        BigNumber(e.limitSat),
                        denomination(),
                        separator(),
                        BTC,
                    ),
                    denomination: formatDenomination(denomination(), BTC),
                };
                const errorMsg: DictKey = `${e.kind}_amount_destination`;

                setButtonDisable(true);
                setButtonLabel({ key: errorMsg, params: value });
                notify("error", t(errorMsg, value));
                return false;
            }

            notify("error", formatError(e));
            return false;
        }
    };

    const createSwap = async (
        claimAddress: string,
        gasAbstraction: GasAbstraction,
    ): Promise<boolean> => {
        try {
            let data!: SubmarineSwap | ReverseSwap | ChainSwap;
            let dex: SwapMetadataSource["dex"];
            let bridge: SwapMetadataSource["bridge"];
            const buildCreationMetadata = async (
                creationData?: Pick<
                    CreationData,
                    "hops" | "hopsPosition" | "sendAmount" | "receiveAmount"
                >,
            ): Promise<string | undefined> => {
                const sourceAmount =
                    amountChanged() === Side.Send ? sendAmount() : undefined;
                bridge =
                    buildBridgeDetail(
                        assetSend(),
                        SwapPosition.Pre,
                        sourceAmount,
                    ) ?? buildBridgeDetail(assetReceive(), SwapPosition.Post);
                dex =
                    creationData?.hops !== undefined &&
                    creationData?.hopsPosition !== undefined
                        ? buildDexDetail(
                              creationData.hops,
                              creationData.hopsPosition,
                              creationData.sendAmount,
                              creationData.receiveAmount,
                              // If the bridge is involved, the source amount is already
                              // persisted on the bridge and isn't involved in the DEX quote.
                              bridge === undefined ? sourceAmount : undefined,
                          )
                        : undefined;

                const payload = buildSwapMetadataPayload({
                    dex,
                    bridge,
                    originalDestination:
                        dex !== undefined || bridge !== undefined
                            ? getOriginalDestination()
                            : undefined,
                });
                const mnemonic = rescueFile()?.mnemonic;
                if (payload === undefined || mnemonic === undefined) {
                    return undefined;
                }

                return await encryptSwapMetadata(mnemonic, payload);
            };

            switch (swapType()) {
                case SwapType.Submarine: {
                    const createSubmarineSwap = async () => {
                        const creationData = await pair().creationData(
                            sendAmount(),
                            pair().minerFees,
                        );
                        if (creationData === undefined) {
                            throw new Error("missing swap creation data");
                        }
                        const metadata =
                            await buildCreationMetadata(creationData);
                        data = await createSubmarine(
                            creationData.from,
                            creationData.to,
                            creationData.sendAmount,
                            creationData.receiveAmount,
                            invoice(),
                            creationData.pairHash,
                            gasAbstraction,
                            newKey,
                            originalDestination(),
                            metadata,
                        );
                    };

                    const decodedInvoice = decodeInvoice(invoice());
                    const isBolt12 = decodedInvoice.type === InvoiceType.Bolt12;

                    const magicRoutingHint = !isBolt12
                        ? findMagicRoutingHint(invoice())
                        : undefined;

                    const bip21 =
                        magicRoutingHint || isBolt12
                            ? (await fetchBip21Invoice(invoice()))?.bip21
                            : undefined;

                    const bip21Decoded = bip21 ? new URL(bip21) : undefined;

                    const bip21Asset = bip21Decoded
                        ? getAssetByBip21Prefix(bip21Decoded.protocol)
                        : undefined;

                    if (
                        !bip21 ||
                        bip21Decoded === undefined ||
                        bip21Asset === undefined ||
                        assetSend() === bip21Asset
                    ) {
                        log.debug("Creating submarine swap");
                        await createSubmarineSwap();
                        break;
                    }

                    const chainAddress = bip21Decoded.pathname;
                    const bip21Amount = BigNumber(
                        bip21Decoded.searchParams.get("amount") ?? 0,
                    );
                    const bip21AmountSats = btcToSat(bip21Amount);

                    try {
                        // Create swap using its Magic Routing Hint (MRH)
                        log.debug("MRH detected. Preparing swap");

                        // If bip21Amount is less than the minimal for the new pair, don't use the MRH
                        const chainPair = getPair<ChainPairTypeTaproot>(
                            pairs(),
                            SwapType.Chain,
                            assetSend(),
                            bip21Asset,
                        );
                        if (
                            !chainPair ||
                            bip21AmountSats.isLessThan(chainPair.limits.minimal)
                        ) {
                            log.debug(
                                `BIP21 amount ${formatSwapAmountForLog(
                                    bip21AmountSats,
                                    bip21Asset,
                                )} is less than minimal ${
                                    chainPair === undefined
                                        ? "unknown"
                                        : formatSwapAmountForLog(
                                              BigNumber(
                                                  chainPair.limits.minimal,
                                              ),
                                              bip21Asset,
                                          )
                                } for chain swap. Creating submarine swap.`,
                            );
                            await createSubmarineSwap();
                            break;
                        }

                        if (
                            bip21AmountSats.isGreaterThan(
                                decodedInvoice.satoshis,
                            )
                        ) {
                            throw new Error("invalid_bip21_amount");
                        }

                        const mrhSendAmount = calculateSendAmount(
                            bip21AmountSats,
                            chainPair.fees.percentage,
                            chainPair.fees.minerFees.server +
                                chainPair.fees.minerFees.user.claim,
                            SwapType.Chain,
                        );

                        const savedFees = getMagicRoutingHintSavedFees({
                            pairs,
                            assetSend,
                            addressValid,
                            onchainAddress,
                            sendAmount: () => mrhSendAmount,
                            assetReceive: () => bip21Asset,
                        });

                        if (BigNumber(savedFees).isLessThanOrEqualTo(0)) {
                            log.debug(
                                "MRH is more expensive than submarine swap. Creating submarine swap",
                            );
                            await createSubmarineSwap();
                            break;
                        }

                        setPair(
                            new Pair(
                                pairs(),
                                assetSend(),
                                bip21Asset,
                                regularPairs(),
                            ),
                        );
                        setOnchainAddress(chainAddress);
                        setReceiveAmount(bip21AmountSats);
                        setSendAmount(mrhSendAmount);

                        log.debug("Creating MRH swap");
                        const mrhRescue = rescueFile();
                        if (mrhRescue === null) {
                            throw new Error("missing rescue file");
                        }
                        const metadata = await buildCreationMetadata();
                        const chainSwap = await createChain(
                            assetSend(),
                            bip21Asset,
                            sendAmount(),
                            receiveAmount(),
                            onchainAddress(),
                            chainPair.hash,
                            gasAbstraction,
                            mrhRescue,
                            newKey,
                            originalDestination(),
                            metadata,
                        );

                        data = {
                            ...chainSwap,
                            magicRoutingHintSavedFees: savedFees,
                        };

                        break;
                    } catch (e) {
                        log.error("Error creating MRH swap", {
                            ...getSwapCreationLogContext(
                                claimAddress,
                                gasAbstraction,
                            ),
                            bip21Asset,
                            chainAddress,
                            bip21Amount: formatSwapAmountForLog(
                                bip21AmountSats,
                                bip21Asset,
                            ),
                            error: formatError(e),
                        });
                        throw new Error(t("invalid_invoice"), { cause: e });
                    }
                }

                case SwapType.Reverse: {
                    const creationData = await pair().creationData(
                        sendAmount(),
                        pair().minerFees,
                    );
                    if (creationData === undefined) {
                        throw new Error("missing swap creation data");
                    }
                    const rescue = rescueFile();
                    if (rescue === null) {
                        throw new Error("missing rescue file");
                    }
                    const metadata = await buildCreationMetadata(creationData);
                    data = await createReverse(
                        creationData.from,
                        creationData.to,
                        creationData.sendAmount,
                        creationData.receiveAmount,
                        claimAddress,
                        creationData.pairHash,
                        gasAbstraction,
                        rescue,
                        newKey,
                        getOriginalDestination(),
                        metadata,
                    );
                    break;
                }

                case SwapType.Chain: {
                    const creationData = await pair().creationData(
                        sendAmount(),
                        pair().minerFees,
                    );
                    if (creationData === undefined) {
                        throw new Error("missing swap creation data");
                    }
                    const rescue = rescueFile();
                    if (rescue === null) {
                        throw new Error("missing rescue file");
                    }
                    const metadata = await buildCreationMetadata(creationData);
                    data = await createChain(
                        creationData.from,
                        creationData.to,
                        creationData.sendAmount,
                        creationData.receiveAmount,
                        claimAddress,
                        creationData.pairHash,
                        gasAbstraction,
                        rescue,
                        newKey,
                        getOriginalDestination(),
                        metadata,
                    );
                    break;
                }
            }

            try {
                await validateResponse(
                    data,
                    deriveKey,
                    getEtherSwap,
                    getErc20Swap,
                );
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                log.error(
                    `failed to create ${swapType()} swap: ${error.stack}`,
                );
                log.error("server response for swap creation:", data);
                navigate("/error");
                return false;
            }

            log.debug(`Created swap ${data.id}:`, {
                destination: getDestinationAddress(data),
                receiveAmount: formatSwapAmountForLog(
                    data.receiveAmount,
                    data.assetReceive,
                ),
            });

            await setSwapStorage({
                ...data,
                getGasToken: getGasToken(),
                dex,
                bridge,
                signer:
                    // We do not have to commit to a signer when creating submarine swaps
                    swapType() !== SwapType.Submarine
                        ? (signer()?.address ?? connectedWallet()?.address)
                        : undefined,
                derivationPath:
                    swapType() !== SwapType.Submarine &&
                    signer() !== undefined &&
                    customDerivationPathRdns.includes(signer()!.rdns)
                        ? (
                              providers()[signer()!.rdns]
                                  .provider as unknown as HardwareSigner
                          ).getDerivationPath()
                        : undefined,
            });

            setInvoice("");
            setInvoiceValid(false);
            setOnchainAddress("");
            setAddressValid(false);
            setOriginalDestination(undefined);

            navigate("/swap/" + data.id);

            return true;
        } catch (err) {
            log.error("Swap creation failed", {
                ...getSwapCreationLogContext(claimAddress, gasAbstraction),
                error: formatError(err),
            });

            const recovered = await handleCreateSwapError(
                err,
                notify,
                t,
                pair,
                regularPairs,
                setPairs,
                setSendAmount,
                setAmountChanged,
            );

            if (!recovered) {
                notify("error", formatError(err));
            }

            return false;
        }
    };

    const createLocalCommitmentSwap = async () => {
        const creationData = await pair().creationData(
            sendAmount(),
            pair().minerFees,
        );
        if (creationData === undefined) {
            throw new Error("missing swap creation data");
        }
        if (
            creationData.hopsPosition !== SwapPosition.Pre ||
            creationData.hops.length === 0
        ) {
            throw new Error("commitment swap requires a pre-swap DEX route");
        }

        const { gasAbstraction } = await getClaimAddress(
            assetReceive,
            assetSend,
            signer,
            onchainAddress,
            getGasAbstractionSigner,
            getGasToken(),
        );

        const dex = buildDexDetail(
            creationData.hops,
            SwapPosition.Pre,
            sendAmount(),
            BigNumber(0),
            sendAmount(),
        );
        const bridge = buildBridgeDetail(
            assetSend(),
            SwapPosition.Pre,
            sendAmount(),
        );
        if (pair().hasPreBridge && bridge === undefined) {
            throw new Error("missing pre-bridge details for commitment swap");
        }

        const commitmentSwap = createCommitmentSwap(
            creationData.from,
            creationData.to,
            assetReceive(),
            assetSend(),
            sendAmount(),
            gasAbstraction,
            dex,
            bridge,
            deferredInvoiceDestination(),
        );

        await setSwapStorage({
            ...commitmentSwap,
            getGasToken: getGasToken(),
        });
        navigate("/swap/" + commitmentSwap.id);
    };

    const buttonClick = async () => {
        setLoading(true);
        try {
            if (canCreateCommitmentSwap()) {
                await createLocalCommitmentSwap();
                return;
            }

            if (validWayToFetchInvoice()) {
                if (!(await fetchInvoice())) {
                    return;
                }
            }

            const { gasAbstraction, claimAddress } = await getClaimAddress(
                assetReceive,
                assetSend,
                signer,
                onchainAddress,
                getGasAbstractionSigner,
                getGasToken(),
            );

            if (isKnownTokenAddress(assetReceive(), onchainAddress())) {
                showInvalidAddress(assetReceive());
                return;
            }

            if (
                (assetReceive() === BTC || assetReceive() === LBTC) &&
                !validateOnchainAddress(assetReceive(), claimAddress)
            ) {
                showInvalidAddress(assetReceive());
                return;
            }

            if (!valid()) return;

            log.debug("Creating with EVM address", claimAddress);

            await createSwap(claimAddress, gasAbstraction);
        } catch (e) {
            log.error("Swap creation setup failed", {
                ...getSwapCreationLogContext(),
                error: formatError(e),
            });
            notify("error", formatError(e));
        } finally {
            setLoading(false);
        }
    };

    const getButtonLabel = (label: ButtonLabelParams) => {
        return t(label.key, label.params);
    };

    return (
        <button
            id="create-swap-button"
            data-testid="create-swap-button"
            class={buttonClass()}
            disabled={
                !online() ||
                pairsLoading() ||
                !canCreateSwap() ||
                buttonDisable() ||
                loading() ||
                quoteLoading() ||
                (gasTopUpSupported(assetReceive()) &&
                    getGasToken() === undefined) ||
                (onchainAddress() === "" &&
                    invoice() === "" &&
                    deferredInvoiceDestination() === undefined &&
                    !canCreateCommitmentSwap())
            }
            onClick={buttonClick}>
            {(pairsLoading() ||
                loading() ||
                bolt12Loading() ||
                quoteLoading()) &&
            !invalidPairState() ? (
                <LoadingSpinner class="inner-spinner" />
            ) : (
                getButtonLabel(buttonLabel())
            )}
        </button>
    );
};

export default CreateButton;
