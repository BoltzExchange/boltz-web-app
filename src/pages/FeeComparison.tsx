import { useNavigate } from "@solidjs/router";

import Accordion from "../components/Accordion";
import { FeeComparisonTable } from "../components/FeeComparisonTable";
import SettingsCog from "../components/settings/SettingsCog";
import SettingsMenu from "../components/settings/SettingsMenu";
import { useGlobalContext } from "../context/Global";

const FeeComparison = () => {
    const { t, pairs, fetchPairs, regularPairs, fetchRegularPairs } =
        useGlobalContext();
    const navigate = useNavigate();

    void fetchPairs();
    void fetchRegularPairs();

    return (
        <div class="frame opportunities">
            <SettingsCog />
            <SettingsMenu />
            <h2>{t("swap_opportunities")}</h2>
            <p>{t("swap_opportunities_subline")}</p>
            <Accordion title={t("swap_opportunities_accordion")} isOpen={true}>
                <FeeComparisonTable
                    proPairs={pairs()}
                    regularPairs={regularPairs()}
                    onSelect={(opportunity) => {
                        navigate(
                            `/swap?sendAsset=${opportunity.assetSend}&receiveAsset=${opportunity.assetReceive}`,
                        );
                    }}
                />
            </Accordion>
        </div>
    );
};

export default FeeComparison;
