import log from "loglevel";
import type { Setter } from "solid-js";

import { NetworkTransport } from "../configs/base";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import {
    getTronTokenAllowance,
    sendTronTokenApproval,
} from "../utils/oft/tron";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";

const ApproveTronErc20 = (props: {
    asset: string;
    value: () => bigint;
    setNeedsApproval: Setter<boolean>;
    approvalTarget: string;
    resetAllowanceFirst?: boolean;
}) => {
    const { t } = useGlobalContext();
    const { connectedWallet } = useWeb3Signer();

    return (
        <ContractTransaction
            asset={props.asset}
            /* eslint-disable-next-line solid/reactivity */
            onClick={async () => {
                const wallet = connectedWallet();
                if (
                    wallet?.transport !== NetworkTransport.Tron ||
                    wallet.address === undefined
                ) {
                    throw new Error(
                        "connected Tron wallet is required for ERC20 approval",
                    );
                }

                const walletProvider = WalletConnectProvider.getTronProvider();
                const requestedValue = props.value();
                const approvalParams = {
                    sourceAsset: props.asset,
                    ownerAddress: wallet.address,
                    spenderAddress: props.approvalTarget,
                    walletProvider,
                };

                if (props.resetAllowanceFirst && requestedValue !== 0n) {
                    const allowance = await getTronTokenAllowance(
                        props.asset,
                        wallet.address,
                        props.approvalTarget,
                    );

                    if (allowance !== 0n) {
                        const resetTx = await sendTronTokenApproval({
                            ...approvalParams,
                            amount: 0n,
                        });
                        log.info(
                            "Tron ERC20 approval reset submitted",
                            resetTx.hash,
                        );
                        await resetTx.wait(1);
                    }
                }

                const tx = await sendTronTokenApproval({
                    ...approvalParams,
                    amount: requestedValue,
                });
                await tx.wait(1);
                log.info("Tron ERC20 approval successful", tx.hash);
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

export default ApproveTronErc20;
