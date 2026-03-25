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
    type blockChainsAssets,
    getKindForAsset,
} from "../consts/Assets";
import { RskRescueMode } from "../consts/Enums";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim } from "../rif/Signer";
import type { LogRefundData } from "../utils/contractLogs";
import {
    getLogsFromReceipt,
    getTimelockBlockNumber,
} from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { claimAsset } from "../utils/evmTransaction";
import { cropString } from "../utils/helper";
import { createAssetProvider } from "../utils/provider";
import { getTimeoutEta } from "../utils/rescue";
import { assetAmountToSats } from "../utils/rootstock";
import { GasAbstractionType } from "../utils/swapCreator";

type RescueData = LogRefundData & { currentHeight: bigint };

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RescueData;
    setRefundTxId: Setter<string>;
}) => {
    const { t, denomination, separator } = useGlobalContext();
    const { signer, getGasAbstractionSigner } = useWeb3Signer();
    const { rescueFile } = useRescueContext();

    const isErc20 = () => getKindForAsset(props.asset) === AssetKind.ERC20;

    const gasAbstraction = () =>
        isErc20() && rescueFile()
            ? {
                  type: GasAbstractionType.Signer,
                  signer: getGasAbstractionSigner(props.asset, rescueFile()),
              }
            : undefined;

    const destination = () => {
        if (!isErc20() || !rescueFile()) {
            return undefined;
        }
        try {
            return signer()?.address;
        } catch {
            return undefined;
        }
    };

    return (
        <>
            <p>
                {t("refund")}{" "}
                {formatAmount(
                    new BigNumber(
                        assetAmountToSats(
                            props.refundData.amount,
                            props.asset,
                        ).toString(),
                    ),
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
                gasAbstraction={gasAbstraction().type}
                transactionSigner={gasAbstraction().signer}
                destination={destination()}
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

const ClaimState = (props: {
    asset: string;
    lockupTxHash: string;
    claimData: RescueData;
    setClaimTxId: Setter<string>;
}) => {
    const navigate = useNavigate();
    const { t } = useGlobalContext();
    const { signer, getEtherSwap, getErc20Swap, getGasAbstractionSigner } =
        useWeb3Signer();
    const { evmRescuableSwaps, rescueFile } = useRescueContext();
    const params = useParams();

    const preimage = () => {
        const swapFromContext = evmRescuableSwaps().find(
            (s) => s.preimageHash === props.claimData.preimageHash,
        );
        return swapFromContext?.preimage
            ? Buffer.from(swapFromContext.preimage, "hex")
            : undefined;
    };

    const getGasAbstraction = async (): Promise<GasAbstractionType> => {
        if (props.asset === RBTC) {
            const balance = await signer().provider.getBalance(
                await signer().getAddress(),
            );
            const gasPrice = (await signer().provider.getFeeData()).gasPrice;
            if (gasPrice === null || balance <= gasPrice * GasNeededToClaim) {
                return GasAbstractionType.RifRelay;
            }
            return GasAbstractionType.None;
        }

        if (getKindForAsset(props.asset) === AssetKind.ERC20) {
            return GasAbstractionType.Signer;
        }

        return GasAbstractionType.None;
    };

    const claimTransaction = async () => {
        const currentPreimage = preimage();
        if (!currentPreimage) return;

        const asset = props.asset;
        const { amount, claimAddress, refundAddress, timelock } =
            props.claimData;

        try {
            const gasAbstraction = await getGasAbstraction();
            const connectedAddress = await signer().getAddress();

            const { transactionHash } = await claimAsset(
                gasAbstraction,
                asset,
                currentPreimage.toString("hex"),
                Number(amount),
                claimAddress,
                refundAddress,
                Number(timelock),
                connectedAddress,
                signer,
                getGasAbstractionSigner(asset, rescueFile()),
                getEtherSwap(asset),
                getErc20Swap(asset),
            );

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
            getTimelockBlockNumber(provider, params.asset as AssetType),
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
                                            params.asset as blockChainsAssets,
                                            Number(rescueData().timelock),
                                            Number(rescueData().currentHeight),
                                        )
                                    }
                                    timeoutBlockHeight={() =>
                                        Number(rescueData().timelock)
                                    }
                                    asset={params.asset}
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
