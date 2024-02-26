import { useNavigate } from "@solidjs/router";
import { CreateQueryResult, createQuery } from "@tanstack/solid-query";
import { createContext, createEffect, lazy, useContext } from "solid-js";

import { BTC } from "../consts";
import { clientFetcher, getPairs } from "../utils/helper";
import { useCreateContext } from "./Create";
import { useGlobalContext } from "./Global";

export type ClientContextType = {
    wallets: CreateQueryResult<any>;
    info: CreateQueryResult<any>;
};

const ClientContext = createContext<ClientContextType>();

const ClientProvider = (props: { children: any }) => {
    const { setHideHero, setBackend, setOnline } = useGlobalContext();
    setHideHero(true);

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

    const info = createQuery(() => ({
        queryKey: ["info"],
        queryFn: () => clientFetcher("/v1/info"),
    }));
    createEffect(() => {
        if (info.isError) {
            setOnline(false);
        }
        if (info.isSuccess) {
            setOnline(true);
        }
    });
    return (
        <ClientContext.Provider
            value={{
                wallets: createQuery(() => ({
                    queryKey: ["wallets"],
                    queryFn: () => clientFetcher("/v1/wallets"),
                })),
                info,
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
