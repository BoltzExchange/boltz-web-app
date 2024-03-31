import { makePersisted } from "@solid-primitives/storage";
import BigNumber from "bignumber.js";
import {
    Accessor,
    Setter,
    createContext,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";

import { config } from "../config";
import { BTC, LBTC, LN, RBTC, sideSend } from "../consts";
import { detectUrlParam } from "../utils/urlparams";

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
    setInvoiceError: Setter<string>;
    invoiceError: Accessor<string>;
};

const CreateContext = createContext<CreateContextType>();

const CreateProvider = (props: { children: any }) => {
    const defaultSelection = Object.keys(config.assets)[0];

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
    const [amountValid, setAmountValid] = createSignal(false);
    const [invoiceError, setInvoiceError] = createSignal<string>("");

    createEffect(() => {
        if (amountValid()) {
            if (
                (reverse() && addressValid()) ||
                (!reverse() &&
                    invoiceValid() &&
                    (asset() !== RBTC || addressValid()))
            ) {
                setValid(true);
                return;
            }
        }
        setValid(false);
    });

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

    // embed
    const invoiceParam = detectUrlParam("invoice");
    if (invoiceParam && invoiceParam !== "") {
        setInvoice(invoiceParam);
        setReverse(false);
    }
    const addressParam = detectUrlParam("address");
    if (addressParam && addressParam !== "") {
        setOnchainAddress(addressParam);
        setReverse(true);
    }
    const assetParam = detectUrlParam("asset");
    if (
        assetParam &&
        assetParam !== "" &&
        [BTC, LBTC, RBTC].includes(assetParam)
    ) {
        setAsset(assetParam);
    }
    const sendAmountParam = detectUrlParam("sendAmount");
    if (sendAmountParam && sendAmountParam !== "") {
        setSendAmount(BigNumber(sendAmountParam));
    }
    const receiveAmountParam = detectUrlParam("receiveAmount");
    if (receiveAmountParam && receiveAmountParam !== "") {
        setReceiveAmount(BigNumber(receiveAmountParam));
    }
    const bip21Param = detectUrlParam("bip21");
    if (bip21Param && bip21Param !== "") {
        // handle bip21
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
                invoiceError,
                setInvoiceError,
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
