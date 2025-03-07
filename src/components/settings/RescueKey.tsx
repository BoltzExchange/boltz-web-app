import { BiRegularDownload } from "solid-icons/bi";

import { useGlobalContext } from "../../context/Global";
import { downloadRescueFile } from "../../pages/Backup";

const RescueFile = () => {
    const iconSize = 16;

    const { t, rescueFile } = useGlobalContext();

    return (
        <div class="flex">
            <span
                class="btn-small"
                onClick={() => downloadRescueFile(t, rescueFile)}>
                <BiRegularDownload size={iconSize} />
            </span>
        </div>
    );
};

export default RescueFile;
