import Loader from "./Loader";

export default new Loader("bolt12", async () => await import("boltz-bolt12"));
