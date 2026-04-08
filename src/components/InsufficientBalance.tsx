import { useGlobalContext } from "../context/Global";
import ConnectWallet from "./ConnectWallet";

const InsufficientBalance = (props: { asset?: string; line?: string }) => {
    const { t } = useGlobalContext();

    return (
        <>
            <p>{props.line ?? t("insufficient_balance_line")}</p>
            <ConnectWallet asset={props.asset} />
            <button class="btn" disabled={true}>
                {t("insufficient_balance")}
            </button>
        </>
    );
};

export default InsufficientBalance;
