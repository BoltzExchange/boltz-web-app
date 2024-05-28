import { config } from "./src/config";

const checkCooperativeDisabled = () => {
    if (config.cooperativeDisabled) {
        console.error("Cooperative signatures are disabled in config");
        process.exit(1);
    }
};

checkCooperativeDisabled();
