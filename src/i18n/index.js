import { createMemo } from "solid-js";
import { translator, flatten, resolveTemplate } from "@solid-primitives/i18n";
import dict from "./i18n";
import { i18n } from "../signals";

const dictLocale = createMemo(() => flatten(dict[i18n()]));

export default translator(dictLocale, resolveTemplate);
