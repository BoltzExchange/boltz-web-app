import { ImCog } from "solid-icons/im";

import { useGlobalContext } from "../context/Global";

const SettingsCog = () => {
    const { setSettingsMenu } = useGlobalContext();

    return (
        <span id="settings-cog" onClick={() => setSettingsMenu(true)}>
            <ImCog />
        </span>
    );
};

export default SettingsCog;
