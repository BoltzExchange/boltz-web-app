import type { Accessor } from "solid-js";

import { downloadJson } from "./download";
import type { RescueFile } from "./rescueFile";

export const rescueFileName = "boltz-rescue-key-DO-NOT-DELETE";

export const downloadRescueFile = (rescueFile: Accessor<RescueFile | null>) => {
    const currentRescueFile = rescueFile();
    if (currentRescueFile === null) {
        throw new Error("rescue file unavailable");
    }

    downloadJson(rescueFileName, currentRescueFile);
};
