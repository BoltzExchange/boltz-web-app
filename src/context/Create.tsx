import { makePersisted } from "@solid-primitives/storage";
import type { Navigator } from "@solidjs/router";
import { useNavigate } from "@solidjs/router";
import BigNumber from "bignumber.js";
import type { Network as LiquidNetwork } from "liquidjs-lib/src/networks";
import {
    createContext,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";
import type { Accessor, JSX, Setter } from "solid-js";

import { config } from "../config";
import { type AssetType, BTC, LBTC, LN, RBTC, assets } from "../consts/Assets";
import { Side, SwapType, UrlParam } from "../consts/Enums";
import type { DictKey } from "../i18n/i18n";
import { getAddress, getNetwork } from "../utils/compat";
import { isInvoice, isLnurl } from "../utils/invoice";
import { getUrlParam, resetUrlParam, urlParamIsSet } from "../utils/urlParams";

const isValidForAsset = (asset: typeof BTC | typeof LBTC, address: string) => {
    try {
        getAddress(asset).toOutputScript(
            address,
            getNetwork(asset) as LiquidNetwork,
        );
        return true;

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
        return false;
    }
};

const handleDestination: Record<
    Exclude<AssetType, typeof RBTC>,
    {
        isValid: (destination: string) => boolean;
        action: (
            destination: string,
            setters: {
                setOnchainAddress: Setter<string>;
                setInvoice: Setter<string>;
                setAssetReceive: Setter<string>;
                setAddressValid: Setter<boolean>;
                setInvoiceValid: Setter<boolean>;
            },
        ) => ReturnType<typeof setDestination>;
    }
> = {
    [BTC]: {
        isValid: (destination) => isValidForAsset(BTC, destination),
        action: (
            destination,
            { setOnchainAddress, setAssetReceive, setAddressValid },
        ) => {
            setOnchainAddress(destination);
            setAssetReceive(BTC);
            setAddressValid(true);
            return { destinationAsset: BTC, destination };
        },
    },
    [LBTC]: {
        isValid: (destination) => isValidForAsset(LBTC, destination),
        action: (
            destination,
            { setOnchainAddress, setAssetReceive, setAddressValid },
        ) => {
            setOnchainAddress(destination);
            setAssetReceive(LBTC);
            setAddressValid(true);
            return { destinationAsset: LBTC, destination };
        },
    },
    [LN]: {
        isValid: (destination) =>
            isInvoice(destination) || isLnurl(destination),
        action: (
            destination,
            { setAssetReceive, setInvoice, setInvoiceValid },
        ) => {
            setAssetReceive(LN);
            setInvoice(destination);
            setInvoiceValid(true);
            return { destinationAsset: LN, destination };
        },
    },
};

const setDestination = (
    setAssetReceive: Setter<string>,
    setInvoice: Setter<string>,
    setOnchainAddress: Setter<string>,
    setAddressValid: Setter<boolean>,
    setInvoiceValid: Setter<boolean>,
    receiveAsset: string,
): { destinationAsset?: string; destination?: string } => {
    const destination = getUrlParam("destination");
    if (urlParamIsSet(destination)) {
        for (const { isValid, action } of Object.values(handleDestination)) {
            if (isValid(destination)) {
                return action(destination, {
                    setOnchainAddress,
                    setAssetReceive,
                    setAddressValid,
                    setInvoice,
                    setInvoiceValid,
                });
            }
        }

        if (receiveAsset === BTC || receiveAsset === LBTC) {
            setOnchainAddress(destination);
            setAssetReceive(receiveAsset);
            setAddressValid(false);
            return { destinationAsset: receiveAsset, destination };
        }

        if (receiveAsset === LN) {
            setAssetReceive(LN);
            setInvoice(destination);
            return { destinationAsset: LN, destination };
        }
    }

    return { destinationAsset: undefined, destination: undefined };
};

const isValidAsset = (asset: string) =>
    urlParamIsSet(asset) && assets.includes(asset);

const parseAmount = (amount: string): BigNumber | undefined => {
    if (!urlParamIsSet(amount)) {
        return undefined;
    }

    const parsedAmount = new BigNumber(amount);
    if (parsedAmount.isNaN()) {
        return undefined;
    }
    return parsedAmount;
};

const handleUrlParams = (
    setAssetSend: Setter<string>,
    setAssetReceive: Setter<string>,
    setInvoice: Setter<string>,
    setOnchainAddress: Setter<string>,
    setAmountChanged: Setter<Side>,
    setSendAmount: Setter<BigNumber>,
    setReceiveAmount: Setter<BigNumber>,
    setAddressValid: Setter<boolean>,
    setInvoiceValid: Setter<boolean>,
    navigate: Navigator,
) => {
    const sendAsset = getUrlParam(UrlParam.SendAsset);
    const receiveAsset = getUrlParam(UrlParam.ReceiveAsset);
    const { destinationAsset, destination } = setDestination(
        setAssetReceive,
        setInvoice,
        setOnchainAddress,
        setAddressValid,
        setInvoiceValid,
        receiveAsset,
    );

    if (isValidAsset(sendAsset)) {
        setAssetSend(sendAsset);
    }

    // The type of the destination takes precedence
    if (destinationAsset === undefined) {
        if (isValidAsset(receiveAsset)) {
            setAssetReceive(receiveAsset);
        }
    }

    // Lightning invoice amounts take precedence unless this is a LN addr
    if (destinationAsset !== LN || isLnurl(destination)) {
        const sendAmount = parseAmount(getUrlParam(UrlParam.SendAmount));
        if (sendAmount) {
            setAmountChanged(Side.Send);
            setSendAmount(sendAmount);
        }

        if (sendAmount === undefined) {
            const receiveAmount = parseAmount(
                getUrlParam(UrlParam.ReceiveAmount),
            );

            if (receiveAmount) {
                setAmountChanged(Side.Receive);
                setReceiveAmount(BigNumber(receiveAmount));
            }
        }
    }

    const params = [
        UrlParam.Destination,
        UrlParam.SendAsset,
        UrlParam.ReceiveAsset,
        UrlParam.SendAmount,
        UrlParam.ReceiveAmount,
    ];

    if (
        config.isPro &&
        params.some((param) => urlParamIsSet(getUrlParam(param)))
    ) {
        navigate("/swap");
    }

    params.forEach((param) => {
        if (urlParamIsSet(getUrlParam(param))) {
            resetUrlParam(param);
        }
    });
};

export type CreateContextType = {
    swapType: Accessor<SwapType>;
    setSwapType: Setter<SwapType>;
    invoice: Accessor<string>;
    setInvoice: Setter<string>;
    lnurl: Accessor<string>;
    setLnurl: Setter<string>;
    bolt12Offer: Accessor<string | undefined>;
    setBolt12Offer: Setter<string | undefined>;
    onchainAddress: Accessor<string>;
    setOnchainAddress: Setter<string>;
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
    pairValid: Accessor<boolean>;
    setPairValid: Setter<boolean>;
    sendAmount: Accessor<BigNumber>;
    setSendAmount: Setter<BigNumber>;
    receiveAmount: Accessor<BigNumber>;
    setReceiveAmount: Setter<BigNumber>;
    sendAmountFormatted: Accessor<string>;
    setSendAmountFormatted: Setter<string>;
    receiveAmountFormatted: Accessor<string>;
    setReceiveAmountFormatted: Setter<string>;
    amountChanged: Accessor<Side>;
    setAmountChanged: Setter<Side>;
    minimum: Accessor<number>;
    setMinimum: Setter<number>;
    maximum: Accessor<number>;
    setMaximum: Setter<number>;
    boltzFee: Accessor<number>;
    setBoltzFee: Setter<number>;
    minerFee: Accessor<number>;
    setMinerFee: Setter<number>;
    setInvoiceError: Setter<DictKey>;
    invoiceError: Accessor<DictKey>;
};

const CreateContext = createContext<CreateContextType>();

const CreateProvider = (props: { children: JSX.Element }) => {
    const defaultSelection = Object.keys(config.assets)[0];
    const navigate = useNavigate();

    const [swapType, setSwapType] = createSignal<SwapType>(SwapType.Submarine);
    const [invoice, setInvoice] = createSignal<string>("");
    const [lnurl, setLnurl] = createSignal("");
    const [bolt12Offer, setBolt12Offer] = createSignal<string | undefined>(
        undefined,
    );
    const [onchainAddress, setOnchainAddress] = createSignal("");

    const [assetReceive, setAssetReceive] = makePersisted(
        // eslint-disable-next-line solid/reactivity
        createSignal(defaultSelection),
        { name: "assetReceive" },
    );

    // eslint-disable-next-line solid/reactivity
    const [assetSend, setAssetSend] = makePersisted(createSignal(LN), {
        name: "assetSend",
    });

    createEffect(() => {
        if (assetReceive() === LN) {
            setSwapType(SwapType.Submarine);
        } else if (assetSend() === LN) {
            setSwapType(SwapType.Reverse);
        } else {
            setSwapType(SwapType.Chain);
        }
    });

    // asset selection
    const [assetSelect, setAssetSelect] = createSignal(false);
    const [assetSelected, setAssetSelected] = createSignal(null);

    // validation
    const [valid, setValid] = createSignal(false);
    const [invoiceValid, setInvoiceValid] = createSignal(false);
    const [addressValid, setAddressValid] = createSignal(false);
    const [amountValid, setAmountValid] = createSignal(false);
    const [pairValid, setPairValid] = createSignal(true);
    const [invoiceError, setInvoiceError] = createSignal<DictKey | undefined>(
        undefined,
    );

    createEffect(() => {
        if (amountValid() && pairValid()) {
            if (
                (swapType() !== SwapType.Submarine && addressValid()) ||
                (swapType() === SwapType.Submarine &&
                    invoiceValid() &&
                    (assetReceive() !== RBTC || addressValid()))
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

    const [amountChanged, setAmountChanged] = createSignal(Side.Send);
    const [minimum, setMinimum] = createSignal<number>(0);
    const [maximum, setMaximum] = createSignal<number>(0);

    // fees
    const [boltzFee, setBoltzFee] = createSignal(0);
    const [minerFee, setMinerFee] = createSignal(0);

    handleUrlParams(
        setAssetSend,
        setAssetReceive,
        setInvoice,
        setOnchainAddress,
        setAmountChanged,
        setSendAmount,
        setReceiveAmount,
        setAddressValid,
        setInvoiceValid,
        navigate,
    );

    return (
        <CreateContext.Provider
            value={{
                swapType,
                setSwapType,
                invoice,
                setInvoice,
                lnurl,
                setLnurl,
                bolt12Offer,
                setBolt12Offer,
                onchainAddress,
                setOnchainAddress,
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
                pairValid,
                setPairValid,
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
