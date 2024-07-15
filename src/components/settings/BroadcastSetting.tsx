import { RiArrowsArrowDropDownFill } from "solid-icons/ri";
import { createSignal } from "solid-js";

import { BlockExplorer } from "../../consts/Enums";
import { useGlobalContext } from "../../context/Global";

const BroadcastSetting = () => {
    const { broadcaster, setBroadcaster } = useGlobalContext();

    const [dropdown, setDropdown] = createSignal(false);

    const toggleBroadcaster = (evt: MouseEvent) => {
        setDropdown(!dropdown());
        evt.stopPropagation();
    };

    const explorers = [
        BlockExplorer.Boltz,
        BlockExplorer.Blockstream,
        BlockExplorer.Mempool,
    ];

    return (
        <>
            <div
                class="blockexplorer-setting toggle select"
                data-dropdown={dropdown()}
                onClick={toggleBroadcaster}>
                <RiArrowsArrowDropDownFill />
                {explorers.map((explorer) => (
                    <span
                        class={broadcaster() === explorer ? "active" : ""}
                        onClick={() => setBroadcaster(explorer)}>
                        {explorer}
                    </span>
                ))}
            </div>
        </>
    );
};

export default BroadcastSetting;
