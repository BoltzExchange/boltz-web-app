import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { Signature, TransactionResponse } from "ethers";
import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";
import { Accessor, Setter, Show, createSignal, onMount } from "solid-js";
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

const RefundEvm = ({
    swapId,
    amount,
    claimAddress,
    preimageHash,
    timeoutBlockHeight,
}: {
    swapId: string;
    amount: number;
    preimageHash: string;
    claimAddress: string;
    timeoutBlockHeight: number;
}) => {
    const { setSwap } = usePayContext();
    const { getEtherSwap, signer } = useWeb3Signer();
    const { setSwapStorage, getSwap, t } = useGlobalContext();

    return (
        <ContractTransaction
            onClick={async () => {
                const [contract, currentSwap] = await Promise.all([
                    getEtherSwap(),
                    getSwap(swapId),
                ]);

                let tx: TransactionResponse;

                if (
                    timeoutBlockHeight <
                    (await signer().provider.getBlockNumber())
                ) {
                    tx = await contract.refund(
                        prefix0x(preimageHash),
                        satoshiToWei(amount),
                        claimAddress,
                        timeoutBlockHeight,
                    );
                } else {
                    const { signature } = await getEipRefundSignature(
                        currentSwap.assetSend,
                        currentSwap.id,
                        currentSwap.type,
                    );
                    const decSignature = Signature.from(signature);

                    tx = await contract.refundCooperative(
                        prefix0x(preimageHash),
                        satoshiToWei(amount),
                        claimAddress,
                        timeoutBlockHeight,
                        decSignature.v,
                        decSignature.r,
                        decSignature.s,
                    );
                }

                currentSwap.refundTx = tx.hash;
                await setSwapStorage(currentSwap);
                setSwap(currentSwap);
                await tx.wait(1);
            }}
            buttonText={t("refund")}
        />
    );
};

const RefundButton = ({
    swap,
    setRefundTxId,
}: {
    swap: Accessor<SubmarineSwap | ChainSwap>;
    setRefundTxId?: Setter<string>;
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

    if (swap() && swap().assetSend === RBTC) {
        if (swap().type === SwapType.Submarine) {
            const submarine = swap() as SubmarineSwap;

            return (
                <RefundEvm
                    swapId={submarine.id}
                    amount={submarine.expectedAmount}
                    claimAddress={submarine.claimAddress}
                    timeoutBlockHeight={submarine.timeoutBlockHeight}
                    preimageHash={decodeInvoice(submarine.invoice).preimageHash}
                />
            );
        } else {
            const chain = swap() as ChainSwap;

            return (
                <RefundEvm
                    swapId={chain.id}
                    amount={chain.lockupDetails.amount}
                    claimAddress={chain.lockupDetails.claimAddress}
                    timeoutBlockHeight={chain.lockupDetails.timeoutBlockHeight}
                    preimageHash={crypto
                        .sha256(Buffer.from(chain.preimage, "hex"))
                        .toString("hex")}
                />
            );
        }
    }

    const [valid, setValid] = createSignal<boolean>(false);
    const [refundRunning, setRefundRunning] = createSignal<boolean>(false);

    const refundAddressChange = (evt: InputEvent, asset: string) => {
        const input = evt.currentTarget as HTMLInputElement;
        const inputValue = input.value.trim();

        const lockupAddress =
            swap().type === SwapType.Submarine
                ? (swap() as SubmarineSwap).address
                : (swap() as ChainSwap).lockupDetails.lockupAddress;

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

        const transactionToRefund = await getLockupTransaction(
            swap().assetSend,
            swap().id,
            swap().type,
        );

        try {
            const res = await refund(
                swap(),
                refundAddress(),
                transactionToRefund,
            );

            // save refundTx into swaps json and set it to the current swap
            // only if the swap exist in localstorage, else it is a refund json
            // so we save it into the signal
            const currentSwap = (await getSwap(res.id)) as SubmarineSwap;
            if (currentSwap !== null) {
                currentSwap.refundTx = res.refundTx;
                await setSwapStorage(currentSwap);
                setSwap(currentSwap);
            } else {
                if (setRefundTxId) {
                    setRefundTxId(res.refundTx);
                }
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
                    setTimeoutEta(transactionToRefund.timeoutEta);
                    setTimeoutBlockheight(
                        transactionToRefund.timeoutBlockHeight,
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

    onMount(async () => {
        if (!swap()) return;

        const transactionToRefund = await getLockupTransaction(
            swap().assetSend,
            swap().id,
            swap().type,
        );

        // show refund ETA for legacy swaps
        if (swap().version !== OutputType.Taproot) {
            setTimeoutEta(transactionToRefund.timeoutEta);
            setTimeoutBlockheight(transactionToRefund.timeoutBlockHeight);
        }
    });

    return (
        <>
            <Show when={timeoutEta() > 0 || timeoutBlockheight() > 0}>
                <RefundEta
                    timeoutEta={timeoutEta}
                    timeoutBlockHeight={timeoutBlockheight}
                />
            </Show>
            <h3 style={"color: #fff"}>
                {swap()
                    ? t("refund_address_header", { asset: swap()?.assetSend })
                    : t("refund_address_header_no_asset")}
            </h3>
            <input
                data-testid="refundAddress"
                id="refundAddress"
                disabled={swap() === null}
                onInput={(e) =>
                    setValid(refundAddressChange(e, swap()?.assetSend))
                }
                type="text"
                name="refundAddress"
                placeholder={
                    swap()
                        ? t("onchain_address", { asset: swap()?.assetSend })
                        : t("onchain_address_no_asset")
                }
            />
            <button
                data-testid="refundButton"
                class="btn"
                disabled={!valid() || refundRunning()}
                onclick={() => refundAction()}>
                {t("refund")}
            </button>
        </>
    );
};

export default RefundButton;
