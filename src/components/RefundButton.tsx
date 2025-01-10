import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { Signature, TransactionResponse } from "ethers";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";
import {
    Accessor,
    Match,
    Setter,
    Show,
    Switch,
    createResource,
    createSignal,
} from "solid-js";
import { ChainSwap, SubmarineSwap } from "src/utils/swapCreator";

import RefundEta from "../components/RefundEta";
import { RBTC } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { useWeb3Signer } from "../context/Web3";
import {
    getEipRefundSignature,
    getLockupTransaction,
} from "../utils/boltzClient";
import { getAddress, getNetwork } from "../utils/compat";
import { formatError } from "../utils/errors";
import { decodeInvoice } from "../utils/invoice";
import { refund } from "../utils/refund";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import ContractTransaction from "./ContractTransaction";
import LoadingSpinner from "./LoadingSpinner";

export const RefundEvm = (props: {
    disabled?: boolean;
    swapId?: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    signerAddress: string;
    derivationPath?: string;
    timeoutBlockHeight: number;
    setRefundTxHash?: Setter<string>;
}) => {
    const { setSwap } = usePayContext();
    const { getEtherSwap, signer } = useWeb3Signer();
    const { setSwapStorage, getSwap, t } = useGlobalContext();

    return (
        <ContractTransaction
            disabled={props.disabled}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const contract = getEtherSwap();

                let tx: TransactionResponse;

                if (
                    props.timeoutBlockHeight <
                    (await signer().provider.getBlockNumber())
                ) {
                    tx = await contract[
                        "refund(bytes32,uint256,address,uint256)"
                    ](
                        prefix0x(props.preimageHash),
                        satoshiToWei(props.amount),
                        props.claimAddress,
                        props.timeoutBlockHeight,
                    );
                } else {
                    const { signature } = await getEipRefundSignature(
                        props.preimageHash,
                        // The endpoints for submarine and chain swap call the same endpoint
                        SwapType.Submarine,
                    );
                    const decSignature = Signature.from(signature);

                    tx = await contract.refundCooperative(
                        prefix0x(props.preimageHash),
                        satoshiToWei(props.amount),
                        props.claimAddress,
                        props.timeoutBlockHeight,
                        decSignature.v,
                        decSignature.r,
                        decSignature.s,
                    );
                }

                if (props.setRefundTxHash !== undefined) {
                    props.setRefundTxHash(tx.hash);
                }

                if (props.swapId !== undefined) {
                    const currentSwap = await getSwap(props.swapId);
                    currentSwap.refundTx = tx.hash;
                    await setSwapStorage(currentSwap);
                    setSwap(currentSwap);
                }

                await tx.wait(1);
            }}
            address={{
                address: props.signerAddress,
                derivationPath: props.derivationPath,
            }}
            buttonText={t("refund")}
        />
    );
};

export const RefundBtc = (props: {
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId?: Setter<string>;
    buttonOverride?: string;
}) => {
    const {
        getSwap,
        setSwapStorage,
        setRefundAddress,
        refundAddress,
        notify,
        t,
    } = useGlobalContext();
    const { setSwap } = usePayContext();

    const [timeoutEta, setTimeoutEta] = createSignal<number | null>(null);
    const [timeoutBlockheight, setTimeoutBlockheight] = createSignal<
        number | null
    >(null);

    const [valid, setValid] = createSignal<boolean>(false);
    const [refundRunning, setRefundRunning] = createSignal<boolean>(false);

    const refundAddressChange = (evt: InputEvent, asset: string) => {
        const input = evt.currentTarget as HTMLInputElement;
        const inputValue = input.value.trim();

        const lockupAddress =
            props.swap().type === SwapType.Submarine
                ? (props.swap() as SubmarineSwap).address
                : (props.swap() as ChainSwap).lockupDetails.lockupAddress;

        if (inputValue === lockupAddress) {
            log.debug("refunds to lockup address are blocked");
            input.setCustomValidity("lockup address");
            return false;
        }
        try {
            getAddress(asset).toOutputScript(
                inputValue,
                getNetwork(asset) as LiquidNetwork,
            );
            input.setCustomValidity("");
            setRefundAddress(inputValue);
            return true;
        } catch (e) {
            log.debug("parsing refund address failed", e);
            input.setCustomValidity("invalid address");
        }

        return false;
    };

    const refundAction = async () => {
        setRefundRunning(true);

        try {
            const res = await refund(
                props.swap(),
                refundAddress(),
                lockupTransaction(),
            );

            // save refundTx into swaps json and set it to the current swap
            // only if the swap exist in localstorage, else it is a refund json
            // so we save it into the signal
            const currentSwap = await getSwap(res.id);
            if (currentSwap !== null) {
                currentSwap.refundTx = res.refundTx;
                await setSwapStorage(currentSwap);
                setSwap(currentSwap);
            }
            if (props.setRefundTxId) {
                props.setRefundTxId(res.refundTx);
            }
        } catch (error) {
            log.warn("refund failed", error);
            if (typeof error === "string") {
                let msg = error;
                if (
                    msg === "bad-txns-inputs-missingorspent" ||
                    msg === "Transaction already in block chain" ||
                    msg.startsWith("insufficient fee")
                ) {
                    msg = t("already_refunded");
                } else if (
                    msg === "mandatory-script-verify-flag-failed" ||
                    msg === "non-final"
                ) {
                    msg = t("locktime_not_satisfied");
                    setTimeoutEta(lockupTransaction().timeoutEta);
                    setTimeoutBlockheight(
                        lockupTransaction().timeoutBlockHeight,
                    );
                }
                log.error(msg);
                notify("error", msg);
            } else {
                log.error(formatError(error));
                notify("error", formatError(error));
            }
        }

        setRefundRunning(false);
    };

    // eslint-disable-next-line solid/reactivity
    const [lockupTransaction] = createResource(props.swap, async (swap) => {
        if (!swap) {
            return undefined;
        }

        const transactionToRefund = await getLockupTransaction(
            swap.id,
            swap.type,
        );

        // show refund ETA for legacy swaps
        if (swap.version !== OutputType.Taproot) {
            setTimeoutEta(transactionToRefund.timeoutEta);
            setTimeoutBlockheight(transactionToRefund.timeoutBlockHeight);
        }

        return transactionToRefund;
    });

    return (
        <Switch>
            <Match
                when={
                    lockupTransaction.state === "ready" ||
                    lockupTransaction.state == "unresolved"
                }>
                <Show when={timeoutEta() > 0 || timeoutBlockheight() > 0}>
                    <RefundEta
                        timeoutEta={timeoutEta}
                        timeoutBlockHeight={timeoutBlockheight}
                    />
                </Show>
                <h3 style={{ color: "#fff" }}>
                    {props.swap()
                        ? t("refund_address_header", {
                              asset: props.swap()?.assetSend,
                          })
                        : t("refund_address_header_no_asset")}
                </h3>
                <input
                    data-testid="refundAddress"
                    id="refundAddress"
                    disabled={props.swap() === null}
                    onInput={(e) =>
                        setValid(
                            refundAddressChange(e, props.swap()?.assetSend),
                        )
                    }
                    type="text"
                    name="refundAddress"
                    placeholder={
                        props.swap()
                            ? t("onchain_address", {
                                  asset: props.swap()?.assetSend,
                              })
                            : t("onchain_address_no_asset")
                    }
                />
                <button
                    data-testid="refundButton"
                    class="btn"
                    disabled={!valid() || refundRunning()}
                    onClick={() => refundAction()}>
                    {props.buttonOverride ?? t("refund")}
                </button>
            </Match>
            <Match when={lockupTransaction.state === "pending"}>
                <LoadingSpinner />
            </Match>
            <Match when={lockupTransaction.state === "errored"}>
                <button class="btn" disabled={true}>
                    {t("no_lockup_transaction")}
                </button>
            </Match>
        </Switch>
    );
};

const RefundButton = (props: {
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId?: Setter<string>;
    buttonOverride?: string;
}) => {
    const [preimageHash] = createResource(async () => {
        return (await decodeInvoice((props.swap() as SubmarineSwap).invoice))
            .preimageHash;
    });

    return (
        <Show
            when={
                props.swap() === null ||
                props.swap() === undefined ||
                props.swap().assetSend !== RBTC
            }
            fallback={
                <Show
                    when={props.swap().type === SwapType.Submarine}
                    fallback={
                        <RefundEvm
                            swapId={props.swap().id}
                            signerAddress={props.swap().signer}
                            derivationPath={props.swap().derivationPath}
                            amount={
                                (props.swap() as ChainSwap).lockupDetails.amount
                            }
                            claimAddress={
                                (props.swap() as ChainSwap).lockupDetails
                                    .claimAddress
                            }
                            timeoutBlockHeight={
                                (props.swap() as ChainSwap).lockupDetails
                                    .timeoutBlockHeight
                            }
                            preimageHash={crypto
                                .sha256(
                                    Buffer.from(
                                        (props.swap() as ChainSwap).preimage,
                                        "hex",
                                    ),
                                )
                                .toString("hex")}
                        />
                    }>
                    <Show
                        when={!preimageHash.loading}
                        fallback={<LoadingSpinner />}>
                        <RefundEvm
                            swapId={props.swap().id}
                            signerAddress={props.swap().signer}
                            claimAddress={props.swap().claimAddress}
                            derivationPath={props.swap().derivationPath}
                            amount={
                                (props.swap() as SubmarineSwap).expectedAmount
                            }
                            timeoutBlockHeight={
                                (props.swap() as SubmarineSwap)
                                    .timeoutBlockHeight
                            }
                            preimageHash={preimageHash()}
                        />
                    </Show>
                </Show>
            }>
            <RefundBtc {...props} />
        </Show>
    );
};

export default RefundButton;
