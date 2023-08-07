const isTor = window?.location?.hostname.endsWith(".onion");

export const defaultLanguage = "en";
export const pairs = ["BTC/BTC", "L-BTC/BTC"];
export const network = "main";
export const isBeta = false;
export const bolt11_prefix = "lnbc";
export const loglevel = "info";
export const api_url = isTor
    ? "http://boltzzzbnus4m7mta3cxmflnps4fp7dueu2tgurstbvrbt6xswzcocyd.onion/api"
    : "https://api.boltz.exchange";
export const blockexplorer_url = isTor
    ? "http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion"
    : "https://mempool.space";
export const blockexplorer_url_liquid = isTor
    ? "http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion"
    : "https://liquid.network";
