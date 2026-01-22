import { useGlobalContext } from "../../context/Global";

const slippageRange = { min: 0.1, max: 5 };
const slippageStep = 0.1;

// TODO: weird rounding issues
const Slippage = () => {
    const { slippage, setSlippage } = useGlobalContext();

    const clamp = (value: number) =>
        Math.min(slippageRange.max, Math.max(slippageRange.min, value));

    const handleChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseFloat(target.value);
        if (isNaN(value)) return;
        const clamped = clamp(value);
        target.value = String(clamped);
        setSlippage(clamped / 100);
    };

    return (
        <div class="slippage-input">
            <input
                type="number"
                min={slippageRange.min}
                max={slippageRange.max}
                step={slippageStep}
                value={slippage() * 100}
                onChange={handleChange}
            />
            <span>%</span>
        </div>
    );
};

export default Slippage;
