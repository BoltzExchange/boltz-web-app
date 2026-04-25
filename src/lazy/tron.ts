import Loader from "./Loader";

export default new Loader("Tron", async () => {
    const tronweb = await import("tronweb");

    return {
        TronWeb: tronweb.TronWeb,
    };
});
