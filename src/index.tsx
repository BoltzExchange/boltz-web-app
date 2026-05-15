/* @refresh reload */
import "@fontsource/noto-mono/index.css";
import "@fontsource/noto-sans/200.css";
import "@fontsource/noto-sans/800.css";
import "@fontsource/noto-sans/index.css";
import {
    Navigate,
    Route,
    type RouteSectionProps,
    Router,
    useLocation,
    useParams,
} from "@solidjs/router";
import { setLogger } from "boltz-swaps/logger";
import log from "loglevel";
import { Show } from "solid-js";
import { render } from "solid-js/web";

import { configureBoltzSwaps } from "./boltzSwapsConfig";
import Chatwoot from "./chatwoot";
import Footer from "./components/Footer";
import Nav from "./components/Nav";
import Notification from "./components/Notification";
import { SwapChecker } from "./components/SwapChecker";
import { SwapExecutionWorker } from "./components/SwapExecutionWorker";
import { WalletConnect } from "./components/WalletConnect";
import { config } from "./config";
import { CreateProvider } from "./context/Create";
import { FiatProvider } from "./context/Fiat";
import { GlobalProvider } from "./context/Global";
import { PayProvider } from "./context/Pay";
import { RescueProvider } from "./context/Rescue";
import { Web3SignerProvider } from "./context/Web3";
import ClaimRescue from "./pages/ClaimRescue";
import Create from "./pages/Create";
import Error from "./pages/Error";
import GasAbstractionSweepRescue from "./pages/GasAbstractionSweepRescue";
import Hero from "./pages/Hero";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import Pay from "./pages/Pay";
import Privacy from "./pages/Privacy";
import RefundRescue from "./pages/RefundRescue";
import Rescue from "./pages/Rescue";
import RescueEvm from "./pages/RescueEvm";
import Terms from "./pages/Terms";
import RescueExternal from "./pages/external-rescue/RescueExternal";
import Btcpay from "./pages/products/Btcpay";
import Client from "./pages/products/Client";
import Pro from "./pages/products/Pro";
import Products from "./pages/products/Products";
import "./style/index.scss";
import "./utils/patches";

setLogger(log);
configureBoltzSwaps();

if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
        .register("/service-worker.js", { scope: "/" })
        .then((reg) => {
            log.info(`Registration succeeded. Scope is ${reg.scope}`);
        });
}

log.setLevel(config.loglevel as log.LogLevelDesc);

const urlParams = new URLSearchParams(window.location.search);
const embeddedParam = urlParams.get("embedded");
const themeParam = urlParams.get("theme");

const isEmbedded = embeddedParam === "true";
const initialTheme = isEmbedded
    ? (themeParam ?? "default")
    : config.isPro
      ? "pro"
      : "default";
document.documentElement.setAttribute("boltz-theme", initialTheme);
document.body.classList.remove("loading");

const App = (props: RouteSectionProps) => {
    const isEmbedded = embeddedParam === "true";
    const location = useLocation();

    const isSwapRoute = () => location.pathname.startsWith("/swap");

    return (
        <GlobalProvider initialEmbeddedMode={isEmbedded}>
            <FiatProvider>
                <Web3SignerProvider>
                    <WalletConnect />
                    <CreateProvider>
                        <PayProvider>
                            <RescueProvider>
                            <Show when={!isEmbedded}>
                                <Nav
                                    isPro={config.isPro}
                                    network={config.network}
                                />
                            </Show>
                            <Show when={!isEmbedded || isSwapRoute()}>
                                {props.children}
                            </Show>
                            <Show when={isEmbedded && !isSwapRoute()}>
                                <Create />
                            </Show>
                            <Notification />
                            <Show when={!isEmbedded}>
                                <Footer />
                            </Show>
                            </RescueProvider>
                        </PayProvider>
                    </CreateProvider>
                </Web3SignerProvider>
            </FiatProvider>
        </GlobalProvider>
    );
};

const redirectRefundToRescue = () => {
    const search = window.location.search;

    return (
        <>
            <Route
                path="/refund"
                component={() => <Navigate href={`/rescue${search}`} />}
            />
            <Route
                path="/refund/external"
                component={() => (
                    <Navigate href={`/rescue/external${search}`} />
                )}
            />
            <Route
                path="/refund/external/:type"
                component={() => {
                    const params = useParams<{ type: string }>();
                    return (
                        <Navigate
                            href={`/rescue/external/${params.type}${search}`}
                        />
                    );
                }}
            />
        </>
    );
};

const cleanup = render(
    () => (
        <Router root={App}>
            <Route path="/" component={Hero} />
            <Route path="/swap" component={Create} />
            <Route path="/products" component={Products} />
            <Route path="/products/btcpay" component={Btcpay} />
            <Route path="/products/client" component={Client} />
            <Route path="/products/pro" component={Pro} />
            {/* Compatibility with link in Breez:
                                https://github.com/breez/breezmobile/blob/a1b0ffff902dfa2210af8fdb047b715535ff11e9/src/json/vendors.json#L30 */}
            <Route path="/swapbox" component={Create} />
            <Route path="/swap/:id" component={Pay} />
            <Route path="/swap/:id/claim" component={ClaimRescue} />
            <Route
                path="/swap/rescue/evm/gas-abstraction/:asset/:address/:action"
                component={GasAbstractionSweepRescue}
            />
            <Route
                path="/swap/rescue/evm/:asset/:txHash/:action"
                component={RescueEvm}
            />
            <Route path="/error" component={() => <Error />} />
            <Route path="/rescue" component={Rescue} />
            <Route path="/rescue/external" component={RescueExternal} />
            <Route path="/rescue/external/:type" component={RescueExternal} />
            <Route
                path="/rescue/external/:type/:mode"
                component={RescueExternal}
            />
            <Route path="/rescue/claim/:id" component={ClaimRescue} />
            <Route path="/rescue/refund/:id" component={RefundRescue} />
            {redirectRefundToRescue()}
            <Route path="/history" component={History} />
            <Route path="/terms" component={Terms} />
            <Route path="/privacy" component={Privacy} />
            <Route path="*404" component={NotFound} />
        </Router>
    ),
    document.getElementById("root")!,
);

if (import.meta.hot) {
    log.info("Hot reload");
    import.meta.hot.dispose(cleanup);
}
