import { I18nContext } from "@solid-primitives/i18n";
import { render, screen } from "@solidjs/testing-library";
import i18n from "../../src/i18n/i18n";
import createI18n from "../../src/i18n";
import Fees from "../../src/components/Fees";
import { config, setConfig } from "../../src/signals";

describe("Fees", () => {
    test.each`
        asset      | address
        ${"BTC"}   | ${"bcrt1qh47qjmkkdxmg8cjxhe7gnnuluwddcw692cfjsv"}
    `(
        "should update after changing config()",
        async ({ asset, address }) => {
            render(() => (
                <I18nContext.Provider value={createI18n()}>
                    <Fees />
                </I18nContext.Provider>
            ));

            const label = await screen.findByText(i18n.en.network_fee);
            expect(label).not.toBeUndefined();
            console.log("config", config());
        }
    );
});
