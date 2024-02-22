import { makePersisted } from "@solid-primitives/storage";
import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import { crypto } from "bitcoinjs-lib";
import { OutputType } from "boltz-core";
import { randomBytes } from "crypto";
import {
    Accessor,
    Setter,
    createContext,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";

import { pairs } from "../config";
import { BTC, LN, RBTC, sideSend } from "../consts";
import { useWeb3Signer } from "../context/Web3";
import { getPairs } from "../utils/boltzClient";
import { ECPair } from "../utils/ecpair";
import {
    clientFetcher,
    fetcher,
    getPair,
    isBoltzClient,
} from "../utils/helper";
import { extractAddress } from "../utils/invoice";
import { validateResponse } from "../utils/validation";
import { useGlobalContext } from "./Global";
import { useSwapContext } from "./Swap";

export type CreateContextType = {
    reverse: Accessor<boolean>;
    setReverse: Setter<boolean>;
    invoice: Accessor<string>;
    setInvoice: Setter<string>;
    lnurl: Accessor<string>;
    setLnurl: Setter<string>;
    onchainAddress: Accessor<string>;
    setOnchainAddress: Setter<string>;
    asset: Accessor<string>;
    setAsset: Setter<string>;
    assetSend: Accessor<string>;
    setAssetSend: Setter<string>;
    assetReceive: Accessor<string>;
    setAssetReceive: Setter<string>;
    assetSelect: Accessor<boolean>;
    setAssetSelect: Setter<boolean>;
    assetSelected: Accessor<string>;
    setAssetSelected: Setter<string>;
    valid: Accessor<boolean>;
    setValid: Setter<boolean>;
    invoiceValid: Accessor<boolean>;
    setInvoiceValid: Setter<boolean>;
    addressValid: Accessor<boolean>;
    setAddressValid: Setter<boolean>;
    amountValid: Accessor<boolean>;
    setAmountValid: Setter<boolean>;
    sendAmount: Accessor<BigNumber>;
    setSendAmount: Setter<BigNumber>;
    receiveAmount: Accessor<BigNumber>;
    setReceiveAmount: Setter<BigNumber>;
    sendAmountFormatted: Accessor<string>;
    setSendAmountFormatted: Setter<string>;
    receiveAmountFormatted: Accessor<string>;
    setReceiveAmountFormatted: Setter<string>;
    amountChanged: Accessor<string>;
    setAmountChanged: Setter<string>;
    minimum: Accessor<number>;
    setMinimum: Setter<number>;
    maximum: Accessor<number>;
    setMaximum: Setter<number>;
    boltzFee: Accessor<number>;
    setBoltzFee: Setter<number>;
    minerFee: Accessor<number>;
    setMinerFee: Setter<number>;
    createSwap: () => Promise<void>;
};

const defaultSelection = Object.keys(pairs)[0].split("/")[0];

const CreateContext = createContext<CreateContextType>();

const CreateProvider = (props: { children: any }) => {
    const [asset, setAsset] = createSignal<string>(defaultSelection);
    const [reverse, setReverse] = createSignal<boolean>(true);
    const [invoice, setInvoice] = createSignal<string>("");
    const [lnurl, setLnurl] = createSignal("");
    const [onchainAddress, setOnchainAddress] = createSignal("");

    const [assetReceive, setAssetReceive] = makePersisted(
        createSignal(defaultSelection),
        { name: "assetReceive" },
    );

    const [assetSend, setAssetSend] = makePersisted(createSignal(LN), {
        name: "assetSend",
    });

    createEffect(() => setReverse(assetReceive() !== LN));

    [assetSend, assetReceive].forEach((signal) => {
        createEffect(() => {
            if (signal() !== LN) {
                setAsset(signal());
            }
        });
    });

    // asset selection
    const [assetSelect, setAssetSelect] = createSignal(false);
    const [assetSelected, setAssetSelected] = createSignal(null);

    // validation
    const [valid, setValid] = createSignal(false);
    const [invoiceValid, setInvoiceValid] = createSignal(false);
    const [addressValid, setAddressValid] = createSignal(false);
    const [amountValid, setAmountValid] = createSignal(true);

    // amounts
    const [sendAmount, setSendAmount] = createSignal(BigNumber(0));
    const [receiveAmount, setReceiveAmount] = createSignal(BigNumber(0));
    const [sendAmountFormatted, setSendAmountFormatted] = createSignal("0");
    const [receiveAmountFormatted, setReceiveAmountFormatted] =
        createSignal("0");

    const [amountChanged, setAmountChanged] = createSignal(sideSend);
    const [minimum, setMinimum] = createSignal<number>(0);
    const [maximum, setMaximum] = createSignal<number>(0);

    // fees
    const [boltzFee, setBoltzFee] = createSignal(0);
    const [minerFee, setMinerFee] = createSignal(0);

    const navigate = useNavigate();

    let createSwap = async () => {
        let params: any = {
            amount: Number(sendAmount()),
            address: onchainAddress(),
            autoSend: false,
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

    if (!isBoltzClient) {
        const { config, setConfig, notify, ref, t } = useGlobalContext();

        const { getEtherSwap } = useWeb3Signer();

        const { swaps, setSwaps } = useSwapContext();
        createSwap = async () => {
            const assetName = asset();
            const isRsk = assetName === RBTC;

            const keyPair = !isRsk ? ECPair.makeRandom() : null;

            let params: any;
            let preimage: Buffer | null = null;

            if (reverse()) {
                preimage = randomBytes(32);
                const preimageHash = crypto.sha256(preimage).toString("hex");

                params = {
                    invoiceAmount: Number(sendAmount()),
                    preimageHash: preimageHash,
                };

                if (isRsk) {
                    params.claimAddress = onchainAddress();
                } else {
                    params.claimPublicKey = keyPair.publicKey.toString("hex");
                }
            } else {
                params = {
                    invoice: invoice(),
                };

                if (!isRsk) {
                    params.refundPublicKey = keyPair.publicKey.toString("hex");
                }
            }

            params.pairHash = getPair(config(), assetName, reverse()).hash;
            params.referralId = ref();

            if (reverse()) {
                params.to = assetName;
                params.from = BTC;
            } else {
                params.to = BTC;
                params.from = assetName;
            }

            // create swap
            try {
                const data = await fetcher(
                    `/v2/swap/${reverse() ? "reverse" : "submarine"}`,
                    assetName,
                    params,
                );

                if (!isRsk) {
                    data.version = OutputType.Taproot;
                }

                data.date = new Date().getTime();
                data.reverse = reverse();
                data.asset = asset();
                data.receiveAmount = Number(receiveAmount());
                data.sendAmount = Number(sendAmount());

                if (keyPair !== null) {
                    data.privateKey = keyPair.privateKey.toString("hex");
                }

                if (preimage !== null) {
                    data.preimage = preimage.toString("hex");
                }

                if (data.reverse) {
                    const addr = onchainAddress();
                    if (addr) {
                        data.onchainAddress = extractAddress(addr);
                    }
                } else {
                    data.invoice = invoice();
                }

                // validate response
                const success = await validateResponse(data, getEtherSwap);

                if (!success) {
                    navigate("/error/");
                    return;
                }
                setSwaps(swaps().concat(data));
                setInvoice("");
                setInvoiceValid(false);
                setOnchainAddress("");
                setAddressValid(false);
                if (reverse() || isRsk) {
                    navigate("/swap/" + data.id);
                } else {
                    navigate("/swap/refund/" + data.id);
                }
            } catch (err) {
                let msg = err;

                if (typeof err.json === "function") {
                    msg = (await err.json()).error;
                }

                if (msg === "invalid pair hash") {
                    setConfig(await getPairs(assetName));
                    notify("error", t("feecheck"));
                } else {
                    notify("error", msg);
                }
            }
        };
    }

    return (
        <CreateContext.Provider
            value={{
                reverse,
                setReverse,
                invoice,
                setInvoice,
                lnurl,
                setLnurl,
                onchainAddress,
                setOnchainAddress,
                asset,
                setAsset,
                assetSend,
                setAssetSend,
                assetReceive,
                setAssetReceive,
                assetSelect,
                setAssetSelect,
                assetSelected,
                setAssetSelected,
                valid,
                setValid,
                invoiceValid,
                setInvoiceValid,
                addressValid,
                setAddressValid,
                amountValid,
                setAmountValid,
                sendAmount,
                setSendAmount,
                receiveAmount,
                setReceiveAmount,
                sendAmountFormatted,
                setSendAmountFormatted,
                receiveAmountFormatted,
                setReceiveAmountFormatted,
                amountChanged,
                setAmountChanged,
                minimum,
                setMinimum,
                maximum,
                setMaximum,
                boltzFee,
                setBoltzFee,
                minerFee,
                setMinerFee,
                createSwap,
            }}>
            {props.children}
        </CreateContext.Provider>
    );
};

const useCreateContext = () => {
    const context = useContext(CreateContext);
    if (!context) {
        throw new Error("useCreateContext: cannot find a CreateContext");
    }
    return context;
};

export { useCreateContext, CreateProvider };
