import log from "loglevel";
import type { Setter } from "solid-js";

import { useGlobalContext } from "../context/Global";
import { createTokenContract, useWeb3Signer } from "../context/Web3";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";

const ApproveErc20 = (props: {
    asset: string;
    value: () => bigint;
    setNeedsApproval: Setter<boolean>;
    approvalTarget?: string;
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
                const target =
                    props.approvalTarget ??
                    (await getErc20Swap(props.asset).getAddress());
                const requestedValue = props.value();

                if (props.resetAllowanceFirst && requestedValue !== 0n) {
                    const allowance = await contract.allowance(
                        await connectedSigner.getAddress(),
                        target,
                    );

                    // Some ERC20 tokens reject non-zero to non-zero allowance
                    // changes, so queue approve(0) first and pin the follow-up
                    // approval to the next nonce to preserve ordering.
                    if (allowance !== 0n) {
                        const resetTx = await contract.approve(target, 0);
                        log.info(
                            "ERC20 approval reset submitted",
                            resetTx.hash,
                        );
                        await resetTx.wait(1);
                    }
                }

                const tx = await contract.approve(target, requestedValue);
                await tx.wait(1);
                log.info("ERC20 approval successful", tx.hash);
                props.setNeedsApproval(false);
            }}
            children={<ConnectWallet asset={props.asset} />}
            buttonText={t("approve_erc20")}
            promptText={
                props.resetAllowanceFirst
                    ? t("approve_erc20_reset_line")
                    : t("approve_erc20_line", {
                          button: t("approve_erc20"),
                      })
            }
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

export default ApproveErc20;
