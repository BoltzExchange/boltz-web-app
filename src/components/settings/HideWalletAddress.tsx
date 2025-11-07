import { useGlobalContext } from "../../context/Global";

const HideWalletAddress = () => {
    const { hideWalletAddress, setHideWalletAddress, t } = useGlobalContext();

    const toggleHideWalletAddress = (evt: MouseEvent) => {
        setHideWalletAddress(!hideWalletAddress());
        evt.stopPropagation();
    };

    return (
        <>
            <div
                class="toggle"
                title={t("hide_wallet_address_tooltip")}
                onClick={toggleHideWalletAddress}>
                <span class={hideWalletAddress() ? "active" : ""}>
                    {t("on")}
                </span>
                <span class={!hideWalletAddress() ? "active" : ""}>
                    {t("off")}
                </span>
            </div>
        </>
    );
};

export default HideWalletAddress;
