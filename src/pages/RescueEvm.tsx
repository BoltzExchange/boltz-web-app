import { useNavigate, useParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import type { Setter } from "solid-js";
import { Match, Show, Switch, createResource, createSignal } from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import RefundEta from "../components/RefundEta";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import {
    AssetKind,
    type AssetType,
    RBTC,
    type RefundableAssetType,
    getKindForAsset,
} from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim, relayClaimTransaction } from "../rif/Signer";
import type { LogRefundData } from "../utils/contractLogs";
import { createAssetProvider, getLogsFromReceipt } from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { cropString } from "../utils/helper";
import { getTimeoutEta } from "../utils/rescue";
import { prefix0x, satsToAssetAmount } from "../utils/rootstock";

type RescueData = LogRefundData & { currentHeight: bigint };

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RescueData;
    setRefundTxId: Setter<string>;
}) => {
    const { t, denomination, separator } = useGlobalContext();

    return (
        <>
            <p>
                {t("refund")}{" "}
                {formatAmount(
                    new BigNumber(props.refundData.amount.toString()),
                    denomination(),
                    separator(),
                    props.asset,
                )}{" "}
                {formatDenomination(denomination(), props.asset)}
            </p>

            <RefundButton
                asset={props.asset}
                setRefundTxId={props.setRefundTxId}
                signerAddress={props.refundData.refundAddress}
                lockupTxHash={props.lockupTxHash}
            />
            <hr />
            <BlockExplorer
                typeLabel={"lockup_tx"}
                asset={props.asset}
                txId={props.lockupTxHash}
            />
        </>
    );
};

// Some providers return malformed tx responses (e.g. nonce: "undefined")
// after the tx has already been submitted. Extract the hash when possible.
const sendClaimTx = async (
    send: () => Promise<{ hash: string }>,
): Promise<string> => {
    try {
        return (await send()).hash;
    } catch (e) {
        const txData = (e as { value?: { hash?: string } })?.value;
        if (txData?.hash?.startsWith("0x")) {
            log.warn("Claim tx sent but response parsing failed:", txData.hash);
            return txData.hash;
        }
        throw e;
    }
};

const ClaimState = (props: {
    asset: string;
    lockupTxHash: string;
    claimData: RescueData;
    setClaimTxId: Setter<string>;
}) => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();
    const { signer, getEtherSwap, getErc20Swap } = useWeb3Signer();
    const { evmRescuableSwaps } = useRescueContext();
    const params = useParams();

    const isErc20 = () => getKindForAsset(props.asset) === AssetKind.ERC20;

    const preimage = () => {
        const swapFromContext = evmRescuableSwaps().find(
            (s) => s.preimageHash === props.claimData.preimageHash,
        );
        return swapFromContext?.preimage
            ? Buffer.from(swapFromContext.preimage, "hex")
            : undefined;
    };

    const claimTransaction = async () => {
        const currentPreimage = preimage();
        if (!currentPreimage) return;

        const asset = props.asset;
        const { amount, tokenAddress, claimAddress, refundAddress, timelock } =
            props.claimData;
        const preimageHex = prefix0x(currentPreimage.toString("hex"));

        try {
            let transactionHash: string;

            const isRsk = asset === RBTC;
            let useRif = false;

            if (isRsk) {
                const balance = await signer().provider.getBalance(
                    await signer().getAddress(),
                );
                const gasPrice = (await signer().provider.getFeeData())
                    .gasPrice;
                useRif =
                    gasPrice === null || balance <= gasPrice * GasNeededToClaim;
            }

            if (useRif) {
                transactionHash = await relayClaimTransaction(
                    signer(),
                    getEtherSwap(asset),
                    currentPreimage.toString("hex"),
                    amount,
                    refundAddress,
                    timelock,
                );
            } else if (isErc20()) {
                const rawAmount = satsToAssetAmount(amount, asset);
                const erc20Swap = getErc20Swap(asset);
                transactionHash = await sendClaimTx(() =>
                    erc20Swap[
                        "claim(bytes32,uint256,address,address,address,uint256)"
                    ](
                        preimageHex,
                        rawAmount,
                        tokenAddress,
                        claimAddress,
                        refundAddress,
                        timelock,
                    ),
                );
            } else {
                const rawAmount = satsToAssetAmount(amount, asset);
                const etherSwap = getEtherSwap(asset);
                transactionHash = await sendClaimTx(() =>
                    etherSwap["claim(bytes32,uint256,address,uint256)"](
                        preimageHex,
                        rawAmount,
                        refundAddress,
                        timelock,
                    ),
                );
            }

            props.setClaimTxId(transactionHash);
        } catch (error) {
            log.error(error);
            throw error; // will be catched by ContractTransaction and notified
        }
    };

    const basePath = `/rescue/external/${params.type?.toLowerCase() ?? ""}`;

    return (
        <Show
            when={preimage() !== undefined}
            fallback={
                <>
                    <p>{t("claim_scan_required")}</p>
                    <button class="btn" onClick={() => navigate(basePath)}>
                        {t("back")}
                    </button>
                </>
            }>
            <ContractTransaction
                asset={props.asset}
                onClick={claimTransaction}
                address={{
                    address: undefined,
                }}
                buttonText={t("continue")}
                promptText={t("transaction_prompt_receive", {
                    button: t("continue"),
                    asset: props.asset,
                })}
                waitingText={t("tx_ready_to_claim")}
            />
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
    const { signer, getEtherSwap, getErc20Swap } = useWeb3Signer();

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

    const [rescueData] = createResource<RescueData>(async () => {
        if (signer() === undefined) {
            return undefined;
        }

        const provider = createAssetProvider(params.asset);
        const contract = getSwapContract(params.asset).connect(
            provider,
        ) as ReturnType<typeof getSwapContract>;

        const [logData, currentHeight] = await Promise.all([
            getLogsFromReceipt(
                provider,
                params.asset as AssetType,
                contract,
                params.txHash,
            ),
            provider.getBlockNumber(),
        ]);

        return {
            ...logData,
            currentHeight: BigInt(currentHeight),
        };
    });

    const isRefundAction = () => params.action === RskRescueMode.Refund;

    const timelockExpired = () =>
        rescueData() && rescueData().timelock <= rescueData().currentHeight;

    const canRefund = () => isRefundAction() && timelockExpired();

    const pageTitle = () => {
        if (isRefundAction()) {
            return t("refund");
        }
        return t("claim");
    };

    return (
        <div class="frame">
            <Show
                when={signer() !== undefined}
                fallback={<h2>{t("no_wallet")}</h2>}>
                <Switch>
                    <Match when={rescueData.state === "ready"}>
                        <SettingsCog />
                        <SettingsMenu />
                        <h2 style={{ "margin-bottom": "6px" }}>
                            {pageTitle()} {cropString(params.txHash, 15, 5)}
                        </h2>
                        <hr />
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
                                                txId={refundTxId()}
                                            />
                                        </>
                                    }>
                                    <RefundState
                                        asset={params.asset}
                                        lockupTxHash={params.txHash}
                                        refundData={rescueData()}
                                        setRefundTxId={setRefundTxId}
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
                                                txId={claimTxId()}
                                            />
                                        </>
                                    }>
                                    <ClaimState
                                        asset={params.asset}
                                        lockupTxHash={params.txHash}
                                        claimData={rescueData()}
                                        setClaimTxId={setClaimTxId}
                                    />
                                </Show>
                            </Match>
                            <Match
                                when={isRefundAction() && !timelockExpired()}>
                                <RefundEta
                                    timeoutEta={() =>
                                        getTimeoutEta(
                                            params.asset as RefundableAssetType,
                                            Number(rescueData().timelock),
                                            Number(rescueData().currentHeight),
                                        )
                                    }
                                    timeoutBlockHeight={() =>
                                        Number(rescueData().timelock)
                                    }
                                    refundableAsset={
                                        params.asset as RefundableAssetType
                                    }
                                />
                            </Match>
                        </Switch>
                    </Match>
                    <Match when={rescueData.state === "pending"}>
                        <h2>{pageTitle()}</h2>
                        <LoadingSpinner />
                    </Match>
                    <Match when={rescueData.state === "errored"}>
                        <h2>{t("error")}</h2>
                        <h3>{formatError(rescueData.error)}</h3>
                    </Match>
                </Switch>
            </Show>
        </div>
    );
};

export default RescueEvm;
