import { RiArrowsArrowDropDownFill } from "solid-icons/ri";
import { createSignal } from "solid-js";

import { BlockExplorer } from "../../consts/Enums";
import { useGlobalContext } from "../../context/Global";

const BlockExplorerSetting = () => {
    const { blockExplorer, setBlockExplorer } = useGlobalContext();

    const [dropdown, setDropdown] = createSignal(false);

    const toggleBlockExplorer = (evt: MouseEvent) => {
        setDropdown(!dropdown());
        evt.stopPropagation();
    };

    const explorers = [BlockExplorer.Blockstream, BlockExplorer.Mempool];

    return (
        <>
            <div
                class="blockexplorer-setting toggle select"
                data-dropdown={dropdown()}
                onClick={toggleBlockExplorer}>
                <RiArrowsArrowDropDownFill />
                {explorers.map((explorer) => (
                    <span
                        class={blockExplorer() === explorer ? "active" : ""}
                        onClick={() => setBlockExplorer(explorer)}>
                        {explorer}
                    </span>
                ))}
            </div>
        </>
    );
};

export default BlockExplorerSetting;
