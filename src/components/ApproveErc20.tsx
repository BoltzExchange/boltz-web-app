import log from "loglevel";
import type { Setter } from "solid-js";
import type { Address } from "viem";

import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import { createTokenContract } from "../context/contracts";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";

const ApproveErc20 = (props: {
    asset: string;
    value: () => bigint;
    setNeedsApproval: Setter<boolean>;
    approvalTarget?: Address;
    resetAllowanceFirst?: boolean;
}) => {
    const { t } = useGlobalContext();
    const { signer, getErc20Swap } = useWeb3Signer();

    return (
        <ContractTransaction
            asset={props.asset}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const connectedSigner = signer();
                if (connectedSigner === undefined) {
                    throw new Error(
                        "connected signer is required for ERC20 approval",
                    );
                }

                const contract = createTokenContract(
                    props.asset,
                    connectedSigner,
                );
                const approvalTarget =
                    props.approvalTarget ?? getErc20Swap(props.asset).address;
                const requestedValue = props.value();

                if (props.resetAllowanceFirst && requestedValue !== 0n) {
                    const allowance = await contract.read.allowance([
                        connectedSigner.address,
                        approvalTarget,
                    ]);

                    // Some ERC20 tokens reject non-zero to non-zero allowance
                    // changes, so queue approve(0) first and pin the follow-up
                    // approval to the next nonce to preserve ordering.
                    if (allowance !== 0n) {
                        const resetTx = await contract.write.approve(
                            [approvalTarget, 0n],
                            { account: connectedSigner.account, chain: null },
                        );
                        log.info("ERC20 approval reset submitted", resetTx);
                        await connectedSigner.provider.waitForTransactionReceipt(
                            { hash: resetTx, confirmations: 1 },
                        );
                    }
                }

                const tx = await contract.write.approve(
                    [approvalTarget, requestedValue],
                    { account: connectedSigner.account, chain: null },
                );
                await connectedSigner.provider.waitForTransactionReceipt({
                    hash: tx,
                    confirmations: 1,
                });
                log.info("ERC20 approval successful", tx);
                props.setNeedsApproval(false);
            }}
            children={<ConnectWallet asset={props.asset} />}
            buttonText={t("approve")}
            promptText={
                props.resetAllowanceFirst
                    ? t("approve_allowance_reset_line", {
                          tokenStandard: "ERC20",
                      })
                    : t("approve_allowance_line", {
                          tokenStandard: "ERC20",
                      })
            }
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

export default ApproveErc20;
