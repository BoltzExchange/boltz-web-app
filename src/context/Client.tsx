import { useNavigate } from "@solidjs/router";
import { CreateQueryResult, createQuery } from "@tanstack/solid-query";
import { createContext, lazy, useContext } from "solid-js";

import { BTC } from "../consts";
import { clientFetcher, getPairs } from "../utils/helper";
import { useCreateContext } from "./Create";
import { useGlobalContext } from "./Global";

export type ClientContextType = {
    wallets: CreateQueryResult<any>;
};

const ClientContext = createContext<ClientContextType>();

const ClientProvider = (props: { children: any }) => {
    const { setBackend } = useGlobalContext();

    const { sendAmount, onchainAddress, asset, reverse } = useCreateContext();

    const navigate = useNavigate();

    const createSwap = async () => {
        const params: any = {
            amount: Number(sendAmount()),
            address: onchainAddress(),
            autoSend: true,
            acceptZeroConf: false,
            pair: {},
        };
        if (reverse()) {
            params.pair.to = asset();
            params.pair.from = BTC;
        } else {
            params.pair.to = BTC;
            params.pair.from = asset();
        }

        const data = await clientFetcher(
            `/v1/${reverse() ? "createreverseswap" : "createswap"}`,
            params,
        );

        navigate("/swap/" + data.id);
    };

    setBackend({
        createSwap,
        fetchPairs: getPairs,
        SwapStatusPage: lazy(() => import("../pages/ClientPay")),
        SwapHistory: lazy(() => import("../components/ClientHistory")),
    });
    return (
        <ClientContext.Provider
            value={{
                wallets: createQuery(() => ({
                    queryKey: ["wallets"],
                    queryFn: () => clientFetcher("/wallets"),
                })),
            }}>
            {props.children}
        </ClientContext.Provider>
    );
};

const useClientContext = () => {
    const context = useContext(ClientContext);
    if (!context) {
        throw new Error("useClientContext: cannot find a ClientContext");
    }
    return context;
};

export { useClientContext, ClientProvider };
