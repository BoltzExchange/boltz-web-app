import { type NormalizeOAS, OASModel, createClient } from "fets";
import { config, configReady } from "src/config";

import type openapi from "./openapi";

type oas = NormalizeOAS<typeof openapi>;

export type Status = OASModel<oas, "Status">;
export type Model<T> = OASModel<oas, T>;
export type Wallet = OASModel<oas, "Wallet">;

export const fetchWallets = async () => {
    const response = await client()["/v1/wallets"].get();
    if (response.ok) {
        return (await response.json()).wallets;
    }
    throw responseError(response);
};

export const fetchInfo = async () => {
    const response = await client()["/v1/info"].get();
    if (response.ok) {
        return await response.json();
    }
    throw responseError(response);
};

export const fetchPairs = async () => {
    const response = await client()["/v1/pairs"].get();
    if (response.ok) {
        return await response.json();
    }
    throw responseError(response);
};

export const client = () =>
    configReady()
        ? createClient<oas>({
            endpoint: config().boltzClientApiUrl,
            plugins: [
                {
                    onResponse: async ({ response }) => {
                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.message);
                        }
                        return Promise.reject(response);
                    },
                },
            ],
        })
        : null;

export const responseError = (response: any) => {
    return new Error(response.message);
};
