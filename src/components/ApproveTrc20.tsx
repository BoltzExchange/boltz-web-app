import log from "loglevel";
import type { Setter } from "solid-js";

import { NetworkTransport } from "../configs/base";
import { useGlobalContext } from "../context/Global";
import { useWeb3Signer } from "../context/Web3";
import WalletConnectProvider from "../utils/WalletConnectProvider";
import { sendTronTokenApproval } from "../utils/oft/tron";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";

const ApproveTrc20 = (props: {
    asset: string;
    value: () => bigint;
    setNeedsApproval: Setter<boolean>;
    approvalTarget: string;
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
                        "connected Tron wallet is required for TRC20 approval",
                    );
                }

                const walletProvider = WalletConnectProvider.getTronProvider();
                const tx = await sendTronTokenApproval({
                    sourceAsset: props.asset,
                    ownerAddress: wallet.address,
                    spenderAddress: props.approvalTarget,
                    amount: props.value(),
                    walletProvider,
                });
                await tx.wait(1);
                log.info("Tron TRC20 approval successful", tx.hash);
                props.setNeedsApproval(false);
            }}
            children={<ConnectWallet asset={props.asset} />}
            buttonText={t("approve")}
            promptText={t("approve_allowance_line", {
                tokenStandard: "TRC20",
            })}
            waitingText={t("tx_in_mempool_subline")}
            showHr={false}
        />
    );
};

export default ApproveTrc20;
