import { useParams } from "@solidjs/router";
import log from "loglevel";
import {
    Match,
    Switch,
    createResource,
    createSignal,
    onCleanup,
    onMount,
} from "solid-js";

import BlockExplorer from "../components/BlockExplorer";
import LoadingSpinner from "../components/LoadingSpinner";
import { SwapIcons } from "../components/SwapIcons";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { SwapType } from "../consts/Enums";
import { useCreateContext } from "../context/Create";
import { useGlobalContext } from "../context/Global";
import { useRescueContext } from "../context/Rescue";
import { getRestorableSwaps, getSwapStatus } from "../utils/boltzClient";
import { claim, derivePreimageFromRescueKey } from "../utils/claim";
import { probeUserInput } from "../utils/compat";
import { formatError } from "../utils/errors";
import { extractAddress } from "../utils/invoice";
import { mapRestorableToSomeSwap } from "../utils/rescue";
import { getXpub } from "../utils/rescueFile";
import type { ChainSwap, ReverseSwap, SomeSwap } from "../utils/swapCreator";

const ClaimRescue = () => {
    const params = useParams<{ id: string }>();

    const { t, pairs, notify, fetchPairs, externalBroadcast } =
        useGlobalContext();
    const { rescuableSwaps, rescueFile, deriveKey } = useRescueContext();
    const { onchainAddress, addressValid, setOnchainAddress, setAddressValid } =
        useCreateContext();

    const [claimTxId, setClaimTxId] = createSignal<string>("");
    const [claimRunning, setClaimRunning] = createSignal<boolean>(false);
    const [btnErrorMsg, setBtnErrorMsg] = createSignal<string>("");

    const [claimableSwap] = createResource(pairs, async () => {
        try {
            if (rescueFile() === undefined || pairs() === undefined) {
                throw Error("rescue file or pairs not found");
            }

            const swapById = (swap: SomeSwap) => swap.id === params.id;

            // Fetch swap if it's not in the location state
            const restorableSwap =
                rescuableSwaps()?.find(swapById) ||
                (await getRestorableSwaps(getXpub(rescueFile())))
                    .map((swap) =>
                        mapRestorableToSomeSwap({ swap, pairs: pairs() }),
                    )
                    ?.find(swapById);

            if (restorableSwap === undefined) {
                throw Error(
                    `failed to find a restorable swap with ID ${params.id}`,
                );
            }

            const swapStatus = await getSwapStatus(params.id);

            if (swapStatus?.transaction?.hex === undefined) {
                throw Error(`failed to fetch swap ${params.id}`);
            }

            if (restorableSwap.type === SwapType.Reverse) {
                return {
                    ...restorableSwap,
                    preimage: derivePreimageFromRescueKey(
                        rescueFile(),
                        (restorableSwap as ReverseSwap).claimPrivateKeyIndex,
                    ).toString("hex"),
                    transaction: {
                        id: swapStatus.transaction?.id,
                        hex: swapStatus.transaction?.hex,
                    },
                };
            }

            if (restorableSwap.type === SwapType.Chain) {
                const derivedKey = derivePreimageFromRescueKey(
                    rescueFile(),
                    (restorableSwap as ChainSwap).claimPrivateKeyIndex,
                ).toString("hex");

                return {
                    ...restorableSwap,
                    claimPrivateKey: derivedKey,
                    preimage: derivedKey,
                    transaction: {
                        id: swapStatus.transaction?.id,
                        hex: swapStatus.transaction?.hex,
                    },
                };
            }

            throw Error(`failed to construct claimable swap ${params.id}`);
        } catch (e) {
            throw Error(
                `failed to construct claimable swap ${params.id}: ${formatError(e)}`,
            );
        }
    });

    const handleInputChange = (input: HTMLInputElement) => {
        const inputValue = input.value.trim();
        const address = extractAddress(inputValue);

        try {
            const assetName = claimableSwap().assetReceive;
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
                    asset: claimableSwap().assetReceive,
                });
                input.classList.add("invalid");
                setBtnErrorMsg(msg);
            }
        }
    };

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
                                {t("claim_swap", { id: params.id })}
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
                                        asset: claimableSwap().assetReceive,
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
                                    asset={claimableSwap().assetReceive}
                                    txId={claimTxId()}
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
                                {t("failed_get_swap", { id: params.id })}
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
