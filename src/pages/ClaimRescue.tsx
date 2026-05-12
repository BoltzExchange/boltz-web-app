import { hex } from "@scure/base";
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

import BlockExplorer, {
    BlockExplorerTargetKind,
} from "../components/BlockExplorer";
import {
    isToUnconfidentialLiquid,
    unconfidentialExtra,
} from "../components/Fees";
import LoadingSpinner from "../components/LoadingSpinner";
import { SwapIcons } from "../components/SwapIcons";
import { hiddenInformation } from "../components/settings/PrivacyMode";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { type AssetType, LN } from "../consts/Assets";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import {
    type ChainPairTypeTaproot,
    type ChainSwapDetails,
    type RestorableSwap,
    type ReversePairTypeTaproot,
    type SwapStatus,
    getRestorableSwaps,
    getSwapStatus,
} from "../utils/boltzClient";
import { claim } from "../utils/claim";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import { getPair } from "../utils/helper";
import { extractAddress } from "../utils/invoice";
import { derivePreimageFromRescueKey, getXpub } from "../utils/rescueFile";
import type { ChainSwap, ReverseSwap, SomeSwap } from "../utils/swapCreator";

const mapClaimableSwap = ({
    swap,
    pair,
}: {
    swap: RestorableSwap &
        Pick<SwapStatus, "transaction"> & { preimage?: string };
    pair: ChainPairTypeTaproot | ReversePairTypeTaproot;
}):
    | (Partial<ChainSwap | ReverseSwap> & Pick<SwapStatus, "transaction">)
    | undefined => {
    if (swap === undefined) {
        return undefined;
    }

    const claim = swap.claimDetails;
    if (claim === undefined || claim.amount === undefined) {
        return undefined;
    }

    const unconfidentialExtraFee = isToUnconfidentialLiquid({
        assetReceive: () => swap.to,
        addressValid: () => true,
        onchainAddress: () => claim.lockupAddress,
    })
        ? unconfidentialExtra
        : 0;

    if (swap.type === SwapType.Chain) {
        const refund = swap.refundDetails;
        if (refund === undefined) {
            return undefined;
        }
        return {
            ...swap,
            type: SwapType.Chain,
            assetSend: swap.from,
            assetReceive: swap.to,
            receiveAmount:
                claim.amount -
                ((pair as ChainPairTypeTaproot).fees.minerFees.user.claim +
                    unconfidentialExtraFee),
            version: OutputType.Taproot,
            claimPrivateKeyIndex: claim.keyIndex,
            refundPrivateKeyIndex: refund.keyIndex,
            refundPrivateKey: refund.serverPublicKey,
            claimDetails: {
                ...claim,
                swapTree: claim.tree,
            } as ChainSwapDetails,
            lockupDetails: {
                ...refund,
                swapTree: refund.tree,
            } as ChainSwapDetails,
        };
    } else if (swap.type === SwapType.Reverse) {
        return {
            ...swap,
            type: SwapType.Reverse,
            assetSend: swap.from,
            assetReceive: swap.to,
            version: OutputType.Taproot,
            blindingKey: claim.blindingKey,
            claimPrivateKeyIndex: claim.keyIndex,
            refundPublicKey: claim.serverPublicKey,
            swapTree: claim.tree,
            receiveAmount:
                claim.amount -
                ((pair as ReversePairTypeTaproot).fees.minerFees.claim +
                    unconfidentialExtraFee),
        };
    }

    return undefined;
};

const ClaimRescue = () => {
    const params = useParams<{ id: string }>();

    const { t, pairs, notify, fetchPairs, privacyMode } = useGlobalContext();
    const { rescuableSwaps, rescueFile, deriveKey } = useRescueContext();
    const { onchainAddress, addressValid, setOnchainAddress, setAddressValid } =
        useCreateContext();

    const [claimTxId, setClaimTxId] = createSignal<string>("");
    const [claimRunning, setClaimRunning] = createSignal<boolean>(false);
    const [btnErrorMsg, setBtnErrorMsg] = createSignal<string>("");

    const [claimableSwap] = createResource(pairs, async () => {
        try {
            const rescue = rescueFile();
            if (rescue === undefined || pairs() === undefined) {
                throw Error("rescue file or pairs not found");
            }

            const swapById = (swap: RestorableSwap) => swap.id === params.id;

            // Fetch swap if it's not in the location state
            const restorableSwap =
                rescuableSwaps()?.find(swapById) ||
                (await getRestorableSwaps(getXpub(rescue)))?.find(swapById);

            if (restorableSwap === undefined) {
                throw Error(
                    `failed to find a restorable swap with ID ${params.id}`,
                );
            }

            const claimDetails = restorableSwap.claimDetails;
            if (claimDetails === undefined) {
                throw Error(
                    `failed to find claim details for swap ${params.id}`,
                );
            }

            const swapStatus = await getSwapStatus(params.id);

            if (swapStatus?.transaction?.hex === undefined) {
                throw Error(`failed to fetch swap ${params.id}`);
            }

            if (restorableSwap.type === SwapType.Reverse) {
                const reversePair = getPair(
                    pairs(),
                    SwapType.Reverse,
                    LN,
                    restorableSwap.to,
                ) as ReversePairTypeTaproot;

                if (reversePair === undefined) {
                    throw Error(
                        `failed to find a reverse pair for ${params.id}`,
                    );
                }

                return mapClaimableSwap({
                    swap: {
                        ...restorableSwap,
                        preimage: hex.encode(
                            derivePreimageFromRescueKey(
                                rescue,
                                claimDetails.keyIndex,
                                restorableSwap.to as AssetType,
                            ),
                        ),
                        transaction: {
                            id: swapStatus.transaction.id,
                            hex: swapStatus.transaction.hex,
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
                    throw Error(`failed to find a chain pair for ${params.id}`);
                }

                const derivedKey = hex.encode(
                    derivePreimageFromRescueKey(
                        rescue,
                        claimDetails.keyIndex,
                        restorableSwap.to as AssetType,
                    ),
                );

                return mapClaimableSwap({
                    swap: {
                        ...restorableSwap,
                        claimPrivateKey: derivedKey,
                        preimage: derivedKey,
                        transaction: {
                            id: swapStatus.transaction.id,
                            hex: swapStatus.transaction.hex,
                        },
                    },
                    pair: chainPair,
                });
            }

            throw Error(`failed to construct claimable swap ${params.id}`);
        } catch (e) {
            throw Error(
                `failed to construct claimable swap ${params.id}: ${formatError(e)}`,
                { cause: e },
            );
        }
    });

    const handleInputChange = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);

        const swap = claimableSwap();
        if (swap === undefined || swap.assetReceive === undefined) {
            return;
        }
        try {
            const assetName = swap.assetReceive;
            const actualAsset = probeUserInput(assetName, address);

            if (actualAsset !== assetName) {
                throw new Error("Invalid asset");
            }

            input.setCustomValidity("");
            input.classList.remove("invalid");
            setAddressValid(true);
            setOnchainAddress(address);

            if (btnErrorMsg() !== "") {
                setBtnErrorMsg("");
            }
        } catch (e) {
            setAddressValid(false);

            if (inputValue.length !== 0) {
                log.debug(`Invalid address input: ${formatError(e)}`);

                const msg = t("invalid_address", {
                    asset: swap.assetReceive,
                });
                input.classList.add("invalid");
                setBtnErrorMsg(msg);
            }
        }
    };

    const handleClaim = async () => {
        try {
            setClaimRunning(true);
            const swap = claimableSwap();
            if (swap === undefined) {
                throw new Error("missing claimable swap");
            }

            const res = await claim(
                deriveKey,
                {
                    ...(swap as ReverseSwap | ChainSwap),
                    claimAddress: onchainAddress(),
                },
                swap.transaction as { hex: string },
                true,
            );
            if (res === undefined) {
                throw new Error("claim failed");
            }
            notify(
                "success",
                t("swap_completed", {
                    id: privacyMode() ? hiddenInformation : res.id,
                }),
            );
            setClaimTxId(res.claimTx!);
        } catch (e) {
            log.error(`Swap ${params.id} claim failed:`, e);
            notify(
                "error",
                t("claim_fail", {
                    id: privacyMode() ? hiddenInformation : params.id,
                }),
            );
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
        setOnchainAddress("");
        setAddressValid(false);
    });

    return (
        <>
            <div class="frame">
                <Switch>
                    <Match
                        when={
                            claimableSwap.state === "ready" &&
                            claimableSwap() !== undefined
                        }>
                        <span class="frame-header">
                            <h2>
                                {t("claim_swap", {
                                    id: privacyMode()
                                        ? hiddenInformation
                                        : params.id,
                                })}
                                <SwapIcons swap={claimableSwap() as SomeSwap} />
                            </h2>
                            <SettingsCog />
                            <SettingsMenu />
                        </span>
                        <hr />

                        <Switch>
                            <Match when={claimTxId() === ""}>
                                <input
                                    required
                                    onInput={(e) =>
                                        handleInputChange(e.currentTarget)
                                    }
                                    onKeyUp={(e) =>
                                        handleInputChange(e.currentTarget)
                                    }
                                    onPaste={(e) =>
                                        handleInputChange(e.currentTarget)
                                    }
                                    type="text"
                                    id="onchainAddress"
                                    data-testid="onchainAddress"
                                    name="onchainAddress"
                                    autocomplete="off"
                                    placeholder={t("onchain_address", {
                                        asset: claimableSwap()!.assetReceive,
                                    })}
                                    value={onchainAddress()}
                                    disabled={claimRunning()}
                                />
                                <button
                                    class="btn"
                                    onClick={handleClaim}
                                    disabled={
                                        !addressValid() ||
                                        !claimableSwap() ||
                                        claimRunning()
                                    }>
                                    {claimRunning() ? (
                                        <LoadingSpinner class="inner-spinner" />
                                    ) : btnErrorMsg() ? (
                                        btnErrorMsg()
                                    ) : (
                                        t("claim")
                                    )}
                                </button>
                            </Match>
                            <Match when={claimTxId() !== ""}>
                                <p data-testid="claimed">{t("claimed")}</p>
                                <hr />
                                <BlockExplorer
                                    typeLabel={"claim_tx"}
                                    asset={claimableSwap()!.assetReceive!}
                                    kind={BlockExplorerTargetKind.Tx}
                                    id={claimTxId()}
                                />
                            </Match>
                        </Switch>
                    </Match>
                    <Match when={claimableSwap.state === "pending"}>
                        <LoadingSpinner />
                    </Match>
                    <Match when={claimableSwap.state === "errored"}>
                        <h2>{t("error")}</h2>
                        <hr />
                        <p>
                            <strong>
                                {t("failed_get_swap", {
                                    id: privacyMode()
                                        ? hiddenInformation
                                        : params.id,
                                })}
                            </strong>
                            <br />
                            {t("failed_get_swap_subline")}
                        </p>
                    </Match>
                </Switch>
            </div>
        </>
    );
};

export default ClaimRescue;
