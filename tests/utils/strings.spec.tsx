import { render } from "@solidjs/testing-library";

import { emphasize, trimPrefix } from "../../src/utils/strings";

describe("trimPrefix", () => {
    test("should strip a matching prefix", () => {
        expect(trimPrefix("m/84/0/0", "m/")).toEqual("84/0/0");
    });

    test("should return the string unchanged when the prefix is absent", () => {
        expect(trimPrefix("84/0/0", "m/")).toEqual("84/0/0");
    });
});

describe("emphasize", () => {
    const renderText = (text: string) =>
        render(() => <p>{emphasize(text)}</p>).container.querySelector("p")!;

    test("should render plain text without any <strong> tags", () => {
        const p = renderText("This key works on any device.");

        expect(p.querySelectorAll("strong")).toHaveLength(0);
        expect(p.textContent).toEqual("This key works on any device.");
    });

    test("should wrap a single bold segment in <strong>", () => {
        const p = renderText("Failing to do so may lead to **LOSS OF FUNDS**.");

        const strongs = p.querySelectorAll("strong");
        expect(strongs).toHaveLength(1);
        expect(strongs[0].textContent).toEqual("LOSS OF FUNDS");
        expect(p.textContent).toEqual(
            "Failing to do so may lead to LOSS OF FUNDS.",
        );
    });

    test("should wrap multiple bold segments in <strong>", () => {
        const p = renderText("Save it in a **SECURE** and **PERMANENT** spot!");

        const strongs = p.querySelectorAll("strong");
        expect(strongs).toHaveLength(2);
        expect([...strongs].map((s) => s.textContent)).toEqual([
            "SECURE",
            "PERMANENT",
        ]);
        expect(p.textContent).toEqual(
            "Save it in a SECURE and PERMANENT spot!",
        );
    });

    test("should leave unbalanced markers as literal text", () => {
        const p = renderText("a **b");

        expect(p.querySelectorAll("strong")).toHaveLength(0);
        expect(p.textContent).toEqual("a **b");
    });
});
