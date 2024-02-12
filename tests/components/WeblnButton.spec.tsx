import { render } from "@solidjs/testing-library";

import WeblnButton from "../../src/components/WeblnButton";
import { contextWrapper } from "../helper";

describe("WeblnButton", () => {
    test("should render WeblnButton", async () => {
        render(() => <WeblnButton />, {
            wrapper: contextWrapper,
        });
    });
});
