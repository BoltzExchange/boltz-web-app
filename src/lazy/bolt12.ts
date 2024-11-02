import Loader from "./Loader";

export default new Loader("BOLT12", async () => await import("boltz-bolt12"));
