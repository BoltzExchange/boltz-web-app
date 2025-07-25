import { useParams } from "@solidjs/router";
import { OutputType } from "boltz-core";
import log from "loglevel";
import {
    Match,
    Switch,
    createResource,
    createSignal,
    onCleanup,
    onMount,
} from "solid-js";

import AddressInput from "../components/AddressInput";
import BlockExplorer from "../components/BlockExplorer";
import {
    isToUnconfidentialLiquid,
    unconfidentialExtra,
} from "../components/Fees";
import LoadingSpinner from "../components/LoadingSpinner";
import { SwapIcons } from "../components/SwapIcons";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import type {
    ChainPairTypeTaproot,
    RestorableSwap,
    ReversePairTypeTaproot,
    SwapStatus,
} from "../utils/boltzClient";
import { getRestorableSwaps, getSwapStatus } from "../utils/boltzClient";
import { claim, derivePreimageFromRescueKey } from "../utils/claim";
import { formatError } from "../utils/errors";
import { getPair } from "../utils/helper";
import { getXpub } from "../utils/rescueFile";
import type { ChainSwap, ReverseSwap } from "../utils/swapCreator";

const mapClaimableSwap = ({
    swap,
    pair,
}: {
    swap: RestorableSwap &
        Pick<SwapStatus, "transaction"> & { preimage?: string };
    pair: ChainPairTypeTaproot | ReversePairTypeTaproot;
}) => {
    if (swap === undefined) {
        return undefined;
    }

    const unconfidentialExtraFee = isToUnconfidentialLiquid({
        assetReceive: () => swap.to,
        addressValid: () => true,
        onchainAddress: () => swap.claimDetails.lockupAddress,
    })
        ? unconfidentialExtra
        : 0;

    if (swap.type === SwapType.Chain) {
        return {
            ...swap,
            assetSend: swap.from,
            assetReceive: swap.to,
            receiveAmount:
                swap.claimDetails.amount -
                ((pair as ChainPairTypeTaproot).fees.minerFees.user.claim +
                    (pair as ChainPairTypeTaproot).fees.minerFees.server +
                    unconfidentialExtraFee),
            version: OutputType.Taproot,
            claimPrivateKey: swap.claimDetails.blindingKey,
            claimPrivateKeyIndex: swap.claimDetails.keyIndex,
            blindingPrivateKey: swap.refundDetails.blindingKey,
            refundPrivateKeyIndex: swap.refundDetails.keyIndex,
            refundPrivateKey: swap.refundDetails.serverPublicKey,
            lockupDetails: {
                ...swap.refundDetails,
                swapTree: swap.refundDetails.tree,
            },
            claimDetails: {
                ...swap.claimDetails,
                swapTree: swap.claimDetails.tree,
            },
        } as Partial<ChainSwap> as ChainSwap & SwapStatus;
    } else if (swap.type === SwapType.Reverse) {
        return {
            ...swap,
            assetSend: swap.from,
            assetReceive: swap.to,
            version: OutputType.Taproot,
            address: swap.claimDetails.lockupAddress,
            blindingKey: swap.claimDetails.blindingKey,
            claimPrivateKey: swap.claimDetails.blindingKey,
            claimPrivateKeyIndex: swap.claimDetails.keyIndex,
            claimPublicKey: swap.claimDetails.serverPublicKey,
            refundPublicKey: swap.claimDetails.serverPublicKey,
            swapTree: swap.claimDetails.tree,
            receiveAmount:
                swap.claimDetails.amount -
                ((pair as ReversePairTypeTaproot).fees.minerFees.claim +
                    (pair as ReversePairTypeTaproot).fees.minerFees.lockup +
                    unconfidentialExtraFee),
            transaction: {
                id: swap.transaction?.id,
                hex: swap.transaction?.hex,
            },
        } as Partial<ReverseSwap> as ReverseSwap & SwapStatus;
    }

    return undefined;
};

const ClaimRescue = () => {
    const params = useParams<{ id: string }>();

    const {
        t,
        pairs,
        notify,
        deriveKey,
        fetchPairs,
        rescueFile,
        externalBroadcast,
    } = useGlobalContext();
    const { rescuableSwaps } = useRescueContext();
    const { onchainAddress, addressValid, setOnchainAddress } =
        useCreateContext();

    const [claimTxId, setClaimTxId] = createSignal<string>("");
    const [claimRunning, setClaimRunning] = createSignal<boolean>(false);

    const [claimableSwap] = createResource(pairs, async () => {
        try {
            if (rescueFile() === undefined || pairs() === undefined) {
                return undefined;
            }

            const swapById = (swap: RestorableSwap) => swap.id === params.id;

            // Fetch swap if it's not in the location state
            const restorableSwap =
                rescuableSwaps()?.find(swapById) ||
                (await getRestorableSwaps(getXpub(rescueFile())))?.find(
                    swapById,
                );

            if (restorableSwap === undefined) {
                log.error(
                    `Failed to find a restorable swap with ID ${params.id}`,
                );
                return undefined;
            }

            const swapStatus = await getSwapStatus(params.id);

            if (swapStatus === undefined) {
                log.error(`Failed to get swap status for ${params.id}`);
                return undefined;
            }

            if (restorableSwap.type === SwapType.Reverse) {
                const reversePair = getPair(
                    pairs(),
                    SwapType.Reverse,
                    LN,
                    restorableSwap.to,
                ) as ReversePairTypeTaproot;

                if (reversePair === undefined) {
                    log.error(`Failed to find a reverse pair for ${params.id}`);
                    return undefined;
                }

                return mapClaimableSwap({
                    swap: {
                        ...restorableSwap,
                        preimage: derivePreimageFromRescueKey(
                            rescueFile(),
                            restorableSwap.claimDetails.keyIndex,
                        ).toString("hex"),
                        transaction: {
                            id: swapStatus.transaction?.id,
                            hex: swapStatus.transaction?.hex,
                        },
                    },
                    pair: reversePair,
                });
            }

            if (restorableSwap.type === SwapType.Chain) {
                const chainPair = getPair(
                    pairs(),
                    SwapType.Chain,
                    restorableSwap.from,
                    restorableSwap.to,
                ) as ChainPairTypeTaproot;

                if (chainPair === undefined) {
                    log.error(`Failed to find a chain pair for ${params.id}`);
                    return undefined;
                }

                return mapClaimableSwap({
                    swap: {
                        ...restorableSwap,
                        claimPrivateKey: derivePreimageFromRescueKey(
                            rescueFile(),
                            restorableSwap.claimDetails.keyIndex,
                        ).toString("hex"),
                        preimage: derivePreimageFromRescueKey(
                            rescueFile(),
                            restorableSwap.claimDetails.keyIndex,
                        ).toString("hex"),
                        transaction: {
                            id: swapStatus.transaction?.id,
                            hex: swapStatus.transaction?.hex,
                        },
                    },
                    pair: chainPair,
                });
            }

            return undefined;
        } catch (e) {
            log.error(`Failed to construct claimable swap ${params.id}:`, e);
            notify(
                "error",
                t("failed_get_swap", { id: params.id, error: formatError(e) }),
            );
            return undefined;
        }
    });

    const handleClaim = async () => {
        try {
            setClaimRunning(true);
            const res = await claim(
                deriveKey,
                {
                    ...(claimableSwap() as ReverseSwap | ChainSwap),
                    claimAddress: onchainAddress(),
                },
                claimableSwap().transaction as { hex: string },
                true,
                externalBroadcast(),
            );
            notify("success", t("swap_completed", { id: res.id }), true, true);
            setClaimTxId(res.claimTx);
        } catch (e) {
            log.error(`Swap ${params.id} claim failed:`, e);
            notify("error", t("claim_fail", { id: params.id }));
        } finally {
            setClaimRunning(false);
        }
    };

    onMount(() => {
        if (!pairs()) {
            void fetchPairs();
        }
    });

    onCleanup(() => {
        log.debug("cleanup ClaimRescue");
        setOnchainAddress("");
    });

    return (
        <>
            <div class="frame">
                <Switch>
                    <Match when={claimableSwap.state === "ready"}>
                        <span class="frame-header">
                            <h2>
                                {t("claim_swap", { id: params.id })}
                                <SwapIcons swap={claimableSwap()} />
                            </h2>
                            <SettingsCog />
                            <SettingsMenu />
                        </span>
                        <hr />

                        <Switch>
                            <Match when={claimableSwap.state === "ready"}>
                                <AddressInput />
                                <button
                                    class="btn"
                                    onClick={handleClaim}
                                    disabled={!addressValid()}>
                                    {t("claim")}
                                </button>
                            </Match>
                            <Match when={claimTxId() !== ""}>
                                <p>{t("claimed")}</p>
                                <hr />
                                <BlockExplorer
                                    typeLabel={"claim_tx"}
                                    asset={claimableSwap().assetSend}
                                    txId={claimTxId()}
                                />
                            </Match>
                            <Match when={claimRunning()}>
                                <p>{t("tx_ready_to_claim")}</p>
                                <LoadingSpinner />
                            </Match>
                        </Switch>
                    </Match>
                    <Match when={claimableSwap.state === "pending"}>
                        <LoadingSpinner />
                    </Match>
                    <Match when={claimableSwap.state === "errored"}>
                        <h2>{t("error")}</h2>
                        <hr />
                        <p>{t("pay_swap_404")}</p>
                    </Match>
                </Switch>
            </div>
        </>
    );
};

export default ClaimRescue;
