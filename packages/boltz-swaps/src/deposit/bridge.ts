import { type Hex, getAddress } from "viem";

import { bridgeRegistry } from "../bridge/index.ts";
import {
    type PendingBridgeSendRecoveryResult,
    type PendingEvmCctpBridgeSend,
    recoverPendingEvmCctpSend,
} from "../bridge/pendingSend.ts";
import { PendingBridgeSendKind } from "../bridge/types.ts";
import { getCctpAttestation } from "../cctp/attestation.ts";
import {
    type CctpDirectSendTarget,
    populateCctpDirectSendTransaction,
} from "../cctp/directSend.ts";
import {
    decodeCctpGuid,
    encodeCctpGuid,
    parseCctpBurnMessage,
    parseCctpMessageSent,
} from "../cctp/events.ts";
import {
    addressToBytes32,
    encodeCctpReceiveMessage,
    isCctpNonceUsed,
} from "../cctp/evm.ts";
import type { CctpSendParam } from "../cctp/types.ts";
import { getAssetBridge } from "../config.ts";
import { createAssetProvider } from "../evm/provider.ts";
import type { Signer } from "../interfaces/signer.ts";
import { getLogger } from "../logger.ts";
import { BridgeKind, CctpReceiveMode } from "../types.ts";
import { ensureUnlimitedApproval, sendSponsored } from "./sponsored.ts";
import { DEPOSIT_BRIDGE_ASSET } from "./types.ts";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const requireCctpConfig = (asset: string) => {
    const bridge = getAssetBridge(asset);
    if (bridge?.kind !== BridgeKind.Cctp) {
        throw new Error(`missing CCTP config for asset ${asset}`);
    }
    return bridge.cctp;
};

// `getSentEvent` derives the guid from the burn receipt as
// `encodeCctpGuid(sourceDomain, txHash)`; after a crash-recovery only the tx
// hash survives, so reconstruct the same guid from the configured CCTP domain.
export const deriveCctpGuid = (
    sourceAsset: string,
    sourceTxHash: string,
): string =>
    encodeCctpGuid(requireCctpConfig(sourceAsset).domain, sourceTxHash);

export type SponsoredBurnResult = {
    burnTxHash: string;
    guid: string;
    cctpNonce: string;
    cctpMessage: string;
    pendingSend: PendingEvmCctpBridgeSend;
};

export type CctpMintResult = {
    mintTxHash?: string;
    // USDC (6dp) actually minted on Arbitrum.
    mintedAmount: bigint;
    blockNumber: number;
};

// Gas-sponsored CCTP burn on the source chain, minting to `mintRecipient` on
// Arbitrum in Forwarded mode. Persists the recovery record BEFORE broadcasting
// so a crash mid-send is recoverable via `recoverBurn`.
export const sponsoredCctpBurn = async ({
    sourceAsset,
    amount,
    mintRecipient,
    signer,
    persistPending,
}: {
    sourceAsset: string;
    amount: bigint;
    mintRecipient: string;
    signer: Signer;
    persistPending: (pending: PendingEvmCctpBridgeSend) => Promise<void>;
}): Promise<SponsoredBurnResult> => {
    const log = getLogger();
    const driver = bridgeRegistry.requireDriverForAsset(sourceAsset);
    const route = driver.getPreRoute(sourceAsset);
    if (route === undefined) {
        throw new Error(`no CCTP pre-route for ${sourceAsset}`);
    }

    const cctp = requireCctpConfig(sourceAsset);
    const baseOptions = await driver.buildQuoteOptions(
        route.destinationAsset,
        mintRecipient,
        false,
    );
    const contract = await driver.getQuotedContract(route);
    const { sendParam } = await driver.quoteSend(
        contract,
        route,
        mintRecipient,
        amount,
        { ...baseOptions, cctpReceiveMode: CctpReceiveMode.Forwarded },
    );

    const target = (await driver.getDirectSendTarget(
        route,
    )) as CctpDirectSendTarget;
    const tokenMessenger = getAddress(target.executionContract.address);

    // Gas-sponsored one-time approval, then the burn as a separate send.
    await ensureUnlimitedApproval(
        signer,
        getAddress(target.burnToken),
        tokenMessenger,
        amount,
    );

    const burnTx = populateCctpDirectSendTransaction({
        target,
        sendParam: sendParam as CctpSendParam,
    });

    const fromNonce = await signer.provider.getTransactionCount({
        address: getAddress(signer.address),
    });
    const fromBlock = Number(await signer.provider.getBlockNumber());
    const pendingSend: PendingEvmCctpBridgeSend = {
        kind: PendingBridgeSendKind.EvmCctp,
        createdAt: Date.now(),
        sender: getAddress(signer.address),
        fromNonce,
        fromBlock,
        tokenMessenger,
        messageTransmitter: getAddress(cctp.messageTransmitter),
        calldata: burnTx.data,
    };
    await persistPending(pendingSend);

    const burnTxHash = await sendSponsored(signer, burnTx);
    const receipt = await signer.provider.waitForTransactionReceipt({
        hash: burnTxHash,
    });

    const messageInfo = parseCctpMessageSent(receipt);
    if (messageInfo === undefined) {
        throw new Error(
            `no MessageSent log in CCTP burn ${burnTxHash} — the sponsored send returned an unexpected tx`,
        );
    }
    const sent = driver.getSentEvent(contract, receipt, tokenMessenger);

    log.info("Sent gas-sponsored CCTP burn", {
        sourceAsset,
        burnTxHash,
        guid: sent.guid,
    });

    return {
        burnTxHash,
        guid: sent.guid,
        cctpNonce: messageInfo.nonce,
        cctpMessage: messageInfo.message,
        pendingSend,
    };
};

// Poll Circle's Forwarding Service for the mint on Arbitrum. Cross-checks the
// mint recipient (Circle may batch multiple mints into one forward tx).
// Undefined on timeout → caller falls back to `manualMint`.
export const awaitCctpMint = async ({
    sourceAsset,
    guid,
    mintRecipient,
    deadlineMs,
    pollIntervalMs = 5_000,
    signal,
}: {
    sourceAsset: string;
    guid: string;
    mintRecipient: string;
    deadlineMs: number;
    pollIntervalMs?: number;
    signal?: AbortSignal;
}): Promise<CctpMintResult | undefined> => {
    const driver = bridgeRegistry.requireDriverForAsset(sourceAsset);
    const route = driver.getPreRoute(sourceAsset);
    if (route === undefined) {
        throw new Error(`no CCTP pre-route for ${sourceAsset}`);
    }
    const contract = await driver.getQuotedContract(route);
    const destProvider = createAssetProvider(DEPOSIT_BRIDGE_ASSET);
    const expectedRecipient = addressToBytes32(mintRecipient).toLowerCase();

    while (Date.now() < deadlineMs) {
        if (signal?.aborted) {
            throw new Error("aborted");
        }
        const received = await driver.getReceivedEventByGuid(
            contract,
            destProvider,
            "",
            guid,
        );
        if (received !== undefined) {
            if (received.toAddress.toLowerCase() === expectedRecipient) {
                return {
                    mintedAmount: received.amountReceivedLD,
                    blockNumber: received.blockNumber,
                };
            }
            getLogger().warn(
                "CCTP mint recipient mismatch for guid; continuing to poll",
                { guid, got: received.toAddress },
            );
        }
        await sleep(pollIntervalMs);
    }
    return undefined;
};

// Self-mint fallback: fetch the attestation from Circle Iris and submit
// `receiveMessage` ourselves, guarded by `isCctpNonceUsed` for idempotency.
// Returns undefined until the attestation is ready.
export const manualMint = async ({
    guid,
    signer,
}: {
    guid: string;
    signer: Signer;
}): Promise<CctpMintResult | undefined> => {
    const decoded = decodeCctpGuid(guid);
    if (decoded === undefined) {
        throw new Error(`invalid CCTP guid: ${guid}`);
    }
    const attestation = await getCctpAttestation(
        decoded.sourceDomain,
        decoded.sourceTxHash,
    );
    if (attestation === undefined) {
        return undefined; // not ready yet
    }

    const burnInfo = parseCctpBurnMessage(attestation.message);
    const messageTransmitter = getAddress(
        requireCctpConfig(DEPOSIT_BRIDGE_ASSET).messageTransmitter,
    );

    let mintTxHash: string | undefined;
    if (
        !(await isCctpNonceUsed(
            messageTransmitter,
            signer.provider,
            burnInfo.nonce,
        ))
    ) {
        mintTxHash = await sendSponsored(signer, {
            to: messageTransmitter,
            data: encodeCctpReceiveMessage(
                attestation.message as Hex,
                attestation.attestation as Hex,
            ),
        });
        await signer.provider.waitForTransactionReceipt({
            hash: mintTxHash as Hex,
        });
    }

    // Manual receive carries no forwarding fee, so the minted amount is exactly
    // the burn's post-protocol-fee `amountReceived`.
    return {
        mintTxHash,
        mintedAmount: burnInfo.amountReceived,
        blockNumber: Number(await signer.provider.getBlockNumber()),
    };
};

export const recoverBurn = (
    sourceAsset: string,
    pendingSend: PendingEvmCctpBridgeSend,
): Promise<PendingBridgeSendRecoveryResult> =>
    recoverPendingEvmCctpSend(pendingSend, createAssetProvider(sourceAsset));
