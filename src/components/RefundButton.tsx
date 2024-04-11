import { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import log from "loglevel";
import { Accessor, Setter, createSignal } from "solid-js";
import { ChainSwap, SubmarineSwap } from "src/utils/swapCreator";

import { SwapType } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { usePayContext } from "../context/Pay";
import { getSubmarineTransaction } from "../utils/boltzClient";
import { getAddress, getNetwork } from "../utils/compat";
import { refund } from "../utils/refund";

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

    /*
    TODO
    if (swap() && swap().asset === RBTC) {
        const { getEtherSwap, getSigner } = useWeb3Signer();

        return (
            <ContractTransaction
                onClick={async () => {
                    const [contract, signer] = await Promise.all([
                        getEtherSwap(),
                        getSigner(),
                    ]);

                    const currentSwap = swap();
                    const preimageHash = prefix0x(
                        decodeInvoice(currentSwap.invoice).preimageHash,
                    );

                    let tx: TransactionResponse;

                    if (
                        currentSwap.timeoutBlockHeight <
                        (await signer.provider.getBlockNumber())
                    ) {
                        tx = await contract.refund(
                            preimageHash,
                            satoshiToWei(currentSwap.expectedAmount),
                            currentSwap.claimAddress,
                            currentSwap.timeoutBlockHeight,
                        );
                    } else {
                        const { signature } = await getSubmarineEipSignature(
                            currentSwap.asset,
                            currentSwap.id,
                        );
                        const decSignature = Signature.from(signature);

                        tx = await contract.refundCooperative(
                            preimageHash,
                            satoshiToWei(currentSwap.expectedAmount),
                            currentSwap.claimAddress,
                            currentSwap.timeoutBlockHeight,
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
    }
     */

    const [refundRunning, setRefundRunning] = createSignal<boolean>(false);
    const [valid, setValid] = createSignal<boolean>(false);

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

        try {
            const transactionToRefund = await getSubmarineTransaction(
                swap().assetSend,
                swap().id,
            );
            log.debug(
                `got swap transaction for ${swap().id}`,
                transactionToRefund,
            );
            const res = await refund(
                swap(),
                refundAddress(),
                transactionToRefund,
            );

            // save refundTx into swaps json and set it to the current swap
            // only if the swaps was not initiated with the refund json
            // refundjson has no date
            if (res.date !== undefined) {
                const currentSwap = (await getSwap(res.id)) as SubmarineSwap;
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
            if (typeof error.json === "function") {
                error
                    .json()
                    .then((jsonError: any) => {
                        let msg = jsonError.error;
                        if (
                            msg === "bad-txns-inputs-missingorspent" ||
                            msg === "Transaction already in block chain" ||
                            msg.startsWith("insufficient fee")
                        ) {
                            msg = t("already_refunded");
                        } else if (
                            msg === "mandatory-script-verify-flag-failed"
                        ) {
                            msg = t("locktime_not_satisfied");
                        }
                        log.error(msg);
                        notify("error", msg);
                    })
                    .catch((genericError: any) => {
                        log.error(genericError);
                        notify("error", genericError);
                    });
            } else {
                log.error(error.message);
                notify("error", error.message);
            }
        }

        setRefundRunning(false);
    };

    return (
        <>
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
