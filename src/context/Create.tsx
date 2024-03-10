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

import { pairs } from "../config";
import { LN, sideSend } from "../consts";
import { buttonLabelParams } from "../types";

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
    buttonLabel: Accessor<buttonLabelParams>;
    setButtonLabel: Setter<buttonLabelParams>;
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

    const [buttonLabel, setButtonLabel] = createSignal<buttonLabelParams>({
        key: "create_swap",
    });

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
                buttonLabel,
                setButtonLabel,
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
