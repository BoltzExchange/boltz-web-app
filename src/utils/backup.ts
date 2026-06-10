import type { Accessor } from "solid-js";

import { downloadJson } from "./download";
import type { RescueFile } from "./rescueFile";

const rescueFileNamePrefix = "boltz-rescue-key-DO-NOT-DELETE";

export const getRescueFileName = (date = new Date()) =>
    `${rescueFileNamePrefix}-${Math.floor(date.getTime() / 1000)}`;

export const downloadRescueFile = (rescueFile: Accessor<RescueFile | null>) => {
    const currentRescueFile = rescueFile();
    if (currentRescueFile === null) {
        throw new Error("rescue file unavailable");
    }

    downloadJson(getRescueFileName(), currentRescueFile);
};
