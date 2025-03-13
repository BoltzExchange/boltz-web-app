import { BiRegularDownload } from "solid-icons/bi";

import { useGlobalContext } from "../../context/Global";
import { downloadRescueFile } from "../../pages/Backup";

const RescueFile = () => {
    const iconSize = 16;

    const { rescueFile } = useGlobalContext();

    return (
        <div class="flex">
            <span
                class="btn-small"
                onClick={() => downloadRescueFile(rescueFile)}>
                <BiRegularDownload size={iconSize} />
            </span>
        </div>
    );
};

export default RescueFile;
