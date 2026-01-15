import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import BigNumber from "bignumber.js";
import log from "loglevel";
import type { Setter } from "solid-js";
import {
    Match,
    Show,
    Switch,
    createResource,
    createSignal,
    onCleanup,
    onMount,
} from "solid-js";
import { rescueKeyMode } from "src/components/MnemonicInput";

import BlockExplorer from "../components/BlockExplorer";
import ContractTransaction from "../components/ContractTransaction";
import LoadingSpinner from "../components/LoadingSpinner";
import { RefundEvm as RefundButton } from "../components/RefundButton";
import RescueFileUpload from "../components/RescueFileUpload";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { useWeb3Signer } from "../context/Web3";
import { GasNeededToClaim, relayClaimTransaction } from "../rif/Signer";
import type { LogRefundData } from "../utils/contractLogs";
import { getLogsFromReceipt } from "../utils/contractLogs";
import { formatAmount, formatDenomination } from "../utils/denomination";
import { formatError } from "../utils/errors";
import { cropString } from "../utils/helper";
import { type RescueFile, rskDerivationPath } from "../utils/rescueFile";
import { prefix0x, satoshiToWei } from "../utils/rootstock";
import { PreimageWorker } from "../workers/preimage/PreimageWorker";

type RescueData = LogRefundData & { currentHeight: bigint };

const RefundState = (props: {
    asset: string;
    lockupTxHash: string;
    refundData: RescueData;
    setRefundTxId: Setter<string>;
}) => {
    const { t, denomination, separator } = useGlobalContext();

    const timelockExpired = () =>
        props.refundData.timelock <= props.refundData.currentHeight;

    return (
        <>
            <p>
                {t("refund")}{" "}
                {formatAmount(
                    new BigNumber(props.refundData.amount.toString()),
                    denomination(),
                    separator(),
                )}{" "}
                {formatDenomination(denomination(), props.asset)}
            </p>

            <Show when={!timelockExpired()}>
                <h3>
                    {t("refund_available_in", {
                        blocks: (
                            props.refundData.timelock -
                            props.refundData.currentHeight
                        ).toString(),
                    })}
                </h3>
            </Show>

            <RefundButton
                disabled={!timelockExpired()}
                setRefundTxId={props.setRefundTxId}
                amount={Number(props.refundData.amount)}
                preimageHash={props.refundData.preimageHash}
                claimAddress={props.refundData.claimAddress}
                signerAddress={props.refundData.refundAddress}
                timeoutBlockHeight={Number(props.refundData.timelock)}
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
    const [searchParams] = useSearchParams();
    const { t, notify } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();
    const { rescueFile, setRescueFile } = useRescueContext();
    const [preimage, setPreimage] = createSignal<Buffer | undefined>(undefined);
    const [loading, setLoading] = createSignal(false);
    const [invalidRescueKey, setInvalidRescueKey] = createSignal(false);

    let worker: PreimageWorker | undefined;

    const findPreimage = async ({ mnemonic }: RescueFile) => {
        setLoading(true);
        worker = new PreimageWorker();
        try {
            const preimageHex = await worker.findPreimage(
                mnemonic,
                props.claimData.preimageHash,
            );

            if (!preimageHex) {
                setInvalidRescueKey(true);
                return;
            }

            setPreimage(Buffer.from(preimageHex, "hex"));
        } catch (error) {
            log.error("could not find matching preimage", formatError(error));
            setRescueFile(undefined);
            setPreimage(undefined);
            setInvalidRescueKey(false);
            notify("error", t("error_occurred", { error: formatError(error) }));
        } finally {
            setLoading(false);
        }
    };

    const claimTransaction = async () => {
        try {
            let transactionHash: string;

            const balance = await signer().provider.getBalance(
                await signer().getAddress(),
            );
            const gasPrice = (await signer().provider.getFeeData()).gasPrice;
            const useRif =
                gasPrice === null || balance <= gasPrice * GasNeededToClaim;

            if (useRif) {
                transactionHash = await relayClaimTransaction(
                    signer(),
                    getEtherSwap(),
                    preimage().toString("hex"),
                    Number(props.claimData.amount),
                    props.claimData.refundAddress,
                    Number(props.claimData.timelock),
                );
            } else {
                transactionHash = (
                    await getEtherSwap()[
                        "claim(bytes32,uint256,address,uint256)"
                    ](
                        prefix0x(preimage().toString("hex")),
                        satoshiToWei(Number(props.claimData.amount)),
                        props.claimData.refundAddress,
                        props.claimData.timelock,
                    )
                ).hash;
            }

            props.setClaimTxId(transactionHash);
        } catch (error) {
            log.error(error);
            notify("error", t("error_occurred", { error: formatError(error) }));
        }
    };

    onMount(() => {
        setRescueFile(undefined);
    });

    onCleanup(() => worker?.terminate());

    return (
        <>
            <Show when={!loading()} fallback={<LoadingSpinner />}>
                <Switch>
                    <Match
                        when={
                            (rescueFile() === undefined ||
                                preimage() === undefined) &&
                            !invalidRescueKey()
                        }>
                        <Show when={searchParams.mode !== rescueKeyMode}>
                            <p>{t("upload_rescue_key_evm")}</p>
                        </Show>
                        <RescueFileUpload
                            onFileValidated={(result) =>
                                findPreimage(result.data as RescueFile)
                            }
                            onError={() => {
                                setRescueFile(undefined);
                                setPreimage(undefined);
                                notify("error", t("invalid_refund_file"));
                            }}
                        />
                        <Show when={searchParams.mode !== rescueKeyMode}>
                            <button
                                class="btn btn-light"
                                data-testid="backBtn"
                                onClick={() => {
                                    navigate("/rescue/external/rsk");
                                }}>
                                {t("back")}
                            </button>
                        </Show>
                    </Match>
                    <Match
                        when={
                            rescueFile() !== undefined &&
                            preimage() !== undefined &&
                            !invalidRescueKey()
                        }>
                        <ContractTransaction
                            onClick={claimTransaction}
                            address={{
                                address: props.claimData.refundAddress,
                                derivationPath: rskDerivationPath,
                            }}
                            buttonText={t("continue")}
                            promptText={t("transaction_prompt_receive", {
                                button: t("continue"),
                                asset: props.asset,
                            })}
                            waitingText={t("tx_ready_to_claim")}
                        />
                    </Match>
                    <Match when={invalidRescueKey()}>
                        <p>{t("invalid_rescue_key_evm")}</p>
                        <button
                            class="btn btn-light"
                            data-testid="backBtn"
                            onClick={() => {
                                setRescueFile(undefined);
                                setPreimage(undefined);
                                setInvalidRescueKey(false);
                            }}>
                            {t("back")}
                        </button>
                    </Match>
                </Switch>
            </Show>
        </>
    );
};

const RescueEvm = () => {
    const params = useParams<{ asset: string; txHash: string }>();

    const { t } = useGlobalContext();
    const { signer, getEtherSwap } = useWeb3Signer();

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

        const [logData, currentHeight] = await Promise.all([
            getLogsFromReceipt(signer(), getEtherSwap(), params.txHash),
            signer().provider.getBlockNumber(),
        ]);

        return {
            ...logData,
            currentHeight: BigInt(currentHeight),
        };
    });

    const timelockExpired = () =>
        rescueData() && rescueData().timelock <= rescueData().currentHeight;

    const pageTitle = () => {
        if (typeof timelockExpired() !== "boolean") {
            return "";
        }

        if (timelockExpired()) {
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
                            <Match when={timelockExpired()}>
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
                            <Match when={!timelockExpired()}>
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
                        </Switch>
                    </Match>
                    <Match when={rescueData.state === "pending"}>
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
