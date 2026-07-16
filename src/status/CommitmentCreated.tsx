import { useNavigate } from "@solidjs/router";
import { BigNumber } from "bignumber.js";
import { createAssetProvider } from "boltz-swaps/evm";
import { emptyPreimageHash } from "boltz-swaps/evm/commitment";
import { getLockupEvent } from "boltz-swaps/evm/transaction";
import { erc20SwapAbi } from "boltz-swaps/generated/evm-abis";
import { SwapPosition } from "boltz-swaps/types";
import log from "loglevel";
import { BsGlobe } from "solid-icons/bs";
import {
    type Accessor,
    Show,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    untrack,
} from "solid-js";
import {
    type Hash,
    type PublicClient,
    type TransactionReceipt,
    zeroAddress,
} from "viem";

import CopyButton from "../components/CopyButton";
import ExternalLink from "../components/ExternalLink";
import LoadingSpinner from "../components/LoadingSpinner";
import LockupEvm from "../components/LockupEvm";
import RefundButton from "../components/RefundButton";
import { Denomination, InvoiceValidation } from "../consts/Enums";
import type { ButtonLabelParams } from "../consts/Types";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import Pair from "../utils/Pair";
import {
    baseAssetAmountToInternal,
    formatAmount,
    formatDenomination,
} from "../utils/denomination";
import { formatError } from "../utils/errors";
import { blockExplorerLink } from "../utils/explorerLink";
import {
    extractInvoice,
    fetchDeferredInvoice,
    invoiceAmountLabel,
    isDeferredInvoiceDestination,
} from "../utils/invoice";
import {
    type BridgeDetail,
    type CommitmentSwap,
    createSubmarine,
    getPreBridgeDetail,
} from "../utils/swapCreator";
import { validateInvoice, validateResponse } from "../utils/validation";

export type CommitmentAmounts = {
    pairHash: string;
    sendAmount: BigNumber;
    receiveAmount: BigNumber;
};

type InvoiceData = {
    invoice: string;
    originalDestination?: string;
    sats: number;
};

const receiptWaitTimeout = 120_000;
const receiptRetryDelay = 3_000;
const receiptWaitAttempts = 3;

const wait = (ms: number) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

const getInvoiceSats = (amounts: CommitmentAmounts) =>
    Math.floor(amounts.receiveAmount.toNumber());

export const waitForCommitmentLockupReceipt = async (
    provider: PublicClient,
    hash: Hash,
    waitTimeout = receiptWaitTimeout,
    retryDelay = receiptRetryDelay,
    attempts = receiptWaitAttempts,
): Promise<TransactionReceipt> => {
    let lastError: unknown = new Error("commitment lockup receipt not found");

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const receipt = await provider.waitForTransactionReceipt({
                hash,
                confirmations: 1,
                timeout: waitTimeout,
            });
            if (receipt !== null) {
                return receipt;
            }
            lastError = new Error("commitment lockup receipt not found");
        } catch (error) {
            lastError = error;
            log.warn("Waiting for commitment lockup receipt failed", error);
        }

        if (attempt < attempts) {
            await wait(retryDelay);
        }
    }

    throw lastError;
};

export const validateCommitmentInvoiceInput = (
    value: string,
    amounts: CommitmentAmounts,
): InvoiceData => {
    const invoiceInput = extractInvoice(value) ?? "";
    if (isDeferredInvoiceDestination(invoiceInput)) {
        return {
            invoice: invoiceInput,
            originalDestination: invoiceInput,
            sats: getInvoiceSats(amounts),
        };
    }

    return validateCommitmentInvoice(value, amounts);
};

export const validateCommitmentInvoice = (
    value: string,
    amounts: CommitmentAmounts,
): InvoiceData => {
    const invoice = extractInvoice(value) ?? "";
    const sats = validateInvoice(invoice);
    const expectedSats = getInvoiceSats(amounts);
    if (sats !== expectedSats) {
        throw new Error(InvoiceValidation.ExactAmount, { cause: expectedSats });
    }

    return { invoice, sats };
};

const resolveInvoice = async (
    validation: InvoiceData,
    amounts: CommitmentAmounts,
): Promise<InvoiceData> => {
    if (validation.originalDestination === undefined) {
        return validation;
    }

    return {
        ...validateCommitmentInvoice(
            await fetchDeferredInvoice(validation.invoice, validation.sats),
            amounts,
        ),
        originalDestination: validation.originalDestination,
    };
};

const getInvoiceAmountString = (
    amounts: CommitmentAmounts,
    asset: string,
    separator: string,
) =>
    formatAmount(
        BigNumber(getInvoiceSats(amounts)),
        Denomination.Sat,
        separator,
        asset,
    );

const CommitmentInvoiceHeader = (props: {
    amounts: CommitmentAmounts;
    copyAmount: () => string;
    invoiceAsset: string;
    lockupAsset: string;
    lockupTxHash: string;
    bridge?: BridgeDetail;
}) => {
    const { separator, t } = useGlobalContext();

    return (
        <div class="commitment-invoice-header">
            <h2
                id="commitment-invoice-label"
                class="commitment-invoice-heading">
                {t("commitment_invoice_heading", {
                    amount: getInvoiceAmountString(
                        props.amounts,
                        props.invoiceAsset,
                        separator(),
                    ),
                    denomination: formatDenomination(
                        Denomination.Sat,
                        props.invoiceAsset,
                    ),
                })}
            </h2>
            <div class="commitment-invoice-meta">
                <CopyButton
                    label="copy_amount"
                    btnClass="commitment-copy-amount"
                    data={props.copyAmount}
                />
                <span class="commitment-invoice-meta-separator" />
                <CommitmentLockupTransaction
                    asset={props.lockupAsset}
                    txHash={props.lockupTxHash}
                    bridge={props.bridge}
                />
            </div>
        </div>
    );
};

export const CommitmentLockupTransaction = (props: {
    asset: string;
    txHash: string;
    bridge?: BridgeDetail;
}) => {
    const { t } = useGlobalContext();
    const explorerHref = () =>
        blockExplorerLink(props.asset, true, props.txHash);
    // On bridged commitments this tx is the bridge send, not the final
    // lockup; that one is linked on the next step
    const label = () =>
        props.bridge !== undefined
            ? t("check_bridge_status")
            : t("blockexplorer", {
                  typeLabel: t("blockexplorer_lockup_tx"),
              });

    return (
        <Show when={explorerHref()}>
            {(href) => (
                <ExternalLink
                    class="commitment-lockup-transaction"
                    href={href()}
                    aria-label={label()}>
                    <BsGlobe size={14} />
                    <span>{label()}</span>
                </ExternalLink>
            )}
        </Show>
    );
};

export const calculateCommittedSubmarineAmounts = async (
    directPair: Pair,
    lockupAmount: BigNumber,
): Promise<CommitmentAmounts> => {
    const receiveAmount = await directPair.calculateReceiveAmount(
        lockupAmount,
        directPair.minerFees,
    );
    const invoiceSats = Math.floor(receiveAmount.toNumber());
    const sendAmount = await directPair.calculateSendAmount(
        BigNumber(invoiceSats),
        directPair.minerFees,
    );
    const creationData = await directPair.creationData(
        sendAmount,
        directPair.minerFees,
    );
    if (creationData === undefined) {
        throw new Error("missing committed swap creation data");
    }

    return {
        pairHash: creationData.pairHash,
        sendAmount,
        receiveAmount,
    };
};

const CommitmentCreated = () => {
    let invoiceInput!: HTMLInputElement;
    const navigate = useNavigate();

    const {
        deleteSwap,
        deriveKey,
        fetchPairs,
        newKey,
        notify,
        pairs,
        regularPairs,
        separator,
        setSwapStorage,
        t,
    } = useGlobalContext();
    const { swap } = usePayContext();
    const { getEtherSwap, getErc20Swap } = useWeb3Signer();
    const commitment = createMemo(() => swap() as CommitmentSwap);
    const [invoice, setInvoice] = createSignal(
        untrack(() => commitment().originalDestination ?? ""),
    );
    const [invoiceError, setInvoiceError] = createSignal<
        ButtonLabelParams | undefined
    >();
    const [loading, setLoading] = createSignal(false);
    const [loadError, setLoadError] = createSignal<string | undefined>();
    const hasInvoice = () => invoice().trim().length > 0;
    const invoiceErrorText = () => {
        const error = invoiceError();
        return error === undefined ? undefined : t(error.key, error.params);
    };

    const lockupDex = () => {
        const dex = commitment().dex;
        if (
            dex?.position !== SwapPosition.Pre ||
            dex.hops.length === 0 ||
            dex.sourceAmount === undefined
        ) {
            throw new Error(
                `commitment swap ${commitment().id} is missing a lockup-side DEX route`,
            );
        }

        return dex;
    };
    const lockupHops = () => lockupDex().hops;
    const lockupHopInputAmount = () => lockupDex().sourceAmount;

    createEffect(() => {
        if (
            commitment().commitmentLockupTxHash === undefined ||
            pairs() !== undefined
        ) {
            return;
        }

        setLoadError(undefined);
        void fetchPairs().catch((error) => {
            const message = formatError(error);
            log.error("Fetching pairs for committed swap failed", error);
            setLoadError(message);
            notify("error", message);
        });
    });

    const committedAmountsSource = createMemo(
        () => {
            const current = commitment();
            const currentPairs = pairs();
            if (
                current.commitmentLockupTxHash === undefined ||
                currentPairs === undefined
            ) {
                return undefined;
            }

            return {
                assetSend: current.assetSend,
                commitmentLockupTxHash: current.commitmentLockupTxHash,
                initialReceiveAsset: current.initialReceiveAsset,
                pairs: currentPairs,
                regularPairs: regularPairs(),
            };
        },
        undefined,
        {
            equals: (previous, next) =>
                previous?.assetSend === next?.assetSend &&
                previous?.commitmentLockupTxHash ===
                    next?.commitmentLockupTxHash &&
                previous?.initialReceiveAsset === next?.initialReceiveAsset &&
                previous?.pairs === next?.pairs &&
                previous?.regularPairs === next?.regularPairs,
        },
    );

    const [committedAmounts] = createResource(
        committedAmountsSource,
        async ({
            assetSend,
            commitmentLockupTxHash,
            initialReceiveAsset,
            pairs: currentPairs,
            regularPairs,
        }): Promise<CommitmentAmounts> => {
            const provider = createAssetProvider(assetSend);
            const receipt = await waitForCommitmentLockupReceipt(
                provider,
                commitmentLockupTxHash as Hash,
            );

            const contract = getErc20Swap(assetSend);
            const event = getLockupEvent(
                erc20SwapAbi,
                receipt,
                contract.address,
            );
            const lockupAmount = baseAssetAmountToInternal(
                assetSend,
                event.amount,
            );
            const directPair = new Pair(
                currentPairs,
                assetSend,
                initialReceiveAsset,
                regularPairs,
            );
            return calculateCommittedSubmarineAmounts(directPair, lockupAmount);
        },
    );

    const committedAmountsError = () =>
        loadError() ??
        (committedAmounts.error === undefined
            ? undefined
            : formatError(committedAmounts.error));

    const validationErrorLabel = (
        error: unknown,
    ): ButtonLabelParams | undefined => {
        if (!(error instanceof Error)) {
            return undefined;
        }

        const amountLabel = invoiceAmountLabel(error, {
            denomination: Denomination.Sat,
            separator: separator(),
            asset: commitment().initialReceiveAsset,
        });
        if (amountLabel !== undefined) {
            return amountLabel;
        }

        switch (error.message) {
            case "invalid_invoice":
            case "invalid_0_amount":
                return { key: error.message };

            default:
                return undefined;
        }
    };

    const setInvoiceInputError = (error: ButtonLabelParams | undefined) => {
        setInvoiceError(error);
        const message = error === undefined ? "" : t(error.key, error.params);
        invoiceInput.setCustomValidity(message);
        invoiceInput.classList.toggle("invalid", error !== undefined);
    };

    const validateCurrentInvoice = () => {
        const amounts = committedAmounts();
        if (amounts === undefined) {
            return undefined;
        }

        const value = invoice().trim();
        setInvoice(value);
        if (value.length === 0) {
            setInvoiceInputError(undefined);
            return undefined;
        }

        try {
            const validatedInvoice = validateCommitmentInvoiceInput(
                value,
                amounts,
            );

            setInvoice(validatedInvoice.invoice);
            setInvoiceInputError(undefined);
            return validatedInvoice;
        } catch (error) {
            setInvoiceInputError(
                validationErrorLabel(error) ?? { key: "invalid_invoice" },
            );
            return undefined;
        }
    };

    const completeSwap = async () => {
        const validatedInvoice = validateCurrentInvoice();
        if (validatedInvoice === undefined) {
            return;
        }

        const current = commitment();
        const amounts = committedAmounts();
        if (
            current.commitmentLockupTxHash === undefined ||
            amounts === undefined
        ) {
            return;
        }

        setLoading(true);
        try {
            const resolvedInvoice = await resolveInvoice(
                validatedInvoice,
                amounts,
            );
            const submarine = await createSubmarine(
                current.assetSend,
                current.assetReceive,
                amounts.sendAmount,
                BigNumber(resolvedInvoice.sats),
                resolvedInvoice.invoice,
                amounts.pairHash,
                current.gasAbstraction,
                newKey,
                resolvedInvoice.originalDestination,
            );
            await validateResponse(
                submarine,
                deriveKey,
                getEtherSwap,
                getErc20Swap,
            );

            await setSwapStorage({
                ...submarine,
                getGasToken: current.getGasToken,
                commitmentLockupTxHash: current.commitmentLockupTxHash,
                commitmentSignatureSubmitted: false,
                signer: current.signer,
                dex: current.dex,
                bridge: current.bridge,
            });
            await deleteSwap(current.id);
            navigate(`/swap/${submarine.id}`);
        } catch (error) {
            const errorLabel = validationErrorLabel(error);
            if (errorLabel !== undefined) {
                setInvoiceInputError(errorLabel);
                return;
            }

            const message = formatError(error);
            if (message.includes("invalid pair hash")) {
                try {
                    setLoadError(undefined);
                    await fetchPairs();
                    notify("error", t("feecheck"));
                } catch (refreshError) {
                    const refreshMessage = formatError(refreshError);
                    log.error(
                        "Refreshing pairs for committed swap failed",
                        refreshError,
                    );
                    notify("error", refreshMessage);
                }
                return;
            }

            log.error("Creating committed submarine swap failed", error);
            notify("error", message);
        } finally {
            setLoading(false);
        }
    };

    let autoCompletionAttempt: string | undefined;
    createEffect(() => {
        const current = commitment();
        const amounts = committedAmounts();
        if (
            current.commitmentLockupTxHash === undefined ||
            amounts === undefined ||
            loading() ||
            !isDeferredInvoiceDestination(current.originalDestination)
        ) {
            return;
        }

        const originalDestination =
            extractInvoice(current.originalDestination) ?? "";
        const currentInvoice = extractInvoice(invoice()) ?? "";
        if (currentInvoice !== originalDestination) {
            return;
        }

        const attempt = `${current.id}:${originalDestination}:${getInvoiceSats(
            amounts,
        )}`;
        if (autoCompletionAttempt === attempt) {
            return;
        }

        autoCompletionAttempt = attempt;
        void completeSwap();
    });

    return (
        <Show
            when={commitment().commitmentLockupTxHash !== undefined}
            fallback={
                <LockupEvm
                    swapId={commitment().id}
                    gasAbstraction={commitment().gasAbstraction.lockup}
                    // Exact-input commitment lockups derive the output amount
                    // from the fixed hop input; the final lockup amount is
                    // read from the on-chain event after broadcast.
                    amount={0}
                    preimageHash={emptyPreimageHash.slice(2)}
                    claimAddress={zeroAddress}
                    timeoutBlockHeight={0}
                    asset={commitment().assetSend}
                    hops={lockupHops()}
                    hopInputAmount={lockupHopInputAmount()}
                    bridge={getPreBridgeDetail(commitment().bridge)}
                />
            }>
            <>
                <Show
                    when={committedAmountsError()}
                    fallback={
                        <Show
                            when={committedAmounts()}
                            fallback={<LoadingSpinner />}>
                            {(amounts) => (
                                <>
                                    <CommitmentInvoiceHeader
                                        amounts={amounts()}
                                        invoiceAsset={
                                            commitment().initialReceiveAsset
                                        }
                                        lockupAsset={commitment().assetSend}
                                        copyAmount={() =>
                                            getInvoiceAmountString(
                                                amounts(),
                                                commitment()
                                                    .initialReceiveAsset,
                                                separator(),
                                            )
                                        }
                                        lockupTxHash={
                                            commitment().commitmentLockupTxHash!
                                        }
                                        bridge={getPreBridgeDetail(
                                            commitment().bridge,
                                        )}
                                    />
                                    <input
                                        required
                                        class="commitment-invoice-input"
                                        ref={invoiceInput}
                                        type="text"
                                        id="invoice"
                                        data-testid="invoice"
                                        aria-invalid={
                                            invoiceError() !== undefined ||
                                            undefined
                                        }
                                        aria-labelledby="commitment-invoice-label"
                                        name="invoice"
                                        value={invoice()}
                                        autocomplete="off"
                                        placeholder={t("create_and_paste")}
                                        onInput={(event) => {
                                            setInvoice(
                                                event.currentTarget.value,
                                            );
                                            validateCurrentInvoice();
                                        }}
                                    />
                                    <button
                                        class="btn commitment-invoice-submit"
                                        data-testid="commitment-invoice-submit"
                                        disabled={
                                            loading() ||
                                            invoiceError() !== undefined ||
                                            !hasInvoice()
                                        }
                                        onClick={completeSwap}>
                                        {loading() ? (
                                            <LoadingSpinner class="inner-spinner" />
                                        ) : invoiceErrorText() !== undefined &&
                                          hasInvoice() ? (
                                            invoiceErrorText()
                                        ) : (
                                            t("continue")
                                        )}
                                    </button>
                                </>
                            )}
                        </Show>
                    }>
                    {(error) => (
                        <>
                            <h2>{t("error")}</h2>
                            <p>{error()}</p>
                        </>
                    )}
                </Show>
                <hr class="commitment-action-separator" />
                <div class="commitment-refund-action">
                    <RefundButton
                        swap={commitment as Accessor<CommitmentSwap>}
                    />
                </div>
            </>
        </Show>
    );
};

export default CommitmentCreated;
