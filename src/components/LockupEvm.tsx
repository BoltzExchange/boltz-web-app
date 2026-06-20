import type { RouterCall } from "boltz-swaps/bridge";
import {
    type QuoteData,
    encodeDexQuote,
    getCommitmentLockupDetails,
    quoteDexAmountOut,
} from "boltz-swaps/client";
import { prefix0x, satsToAssetAmount } from "boltz-swaps/evm";
import {
    createRouterContract,
    createTokenContract,
} from "boltz-swaps/evm/contracts";
import { getSignerForGasAbstraction } from "boltz-swaps/evm/transaction";
import {
    erc20SwapAbi,
    etherSwapAbi,
    routerAbi,
} from "boltz-swaps/generated/evm-abis";
import { calculateAmountWithSlippage } from "boltz-swaps/helper";
import { AssetKind } from "boltz-swaps/types";
import { randomBytes } from "crypto";
import log from "loglevel";
import {
    type Accessor,
    type Setter,
    Show,
    createEffect,
    createResource,
    createSignal,
} from "solid-js";
import {
    type Address,
    encodeAbiParameters,
    encodeFunctionData,
    getAddress,
    keccak256,
    maxUint256,
} from "viem";

import { config } from "../config";
import { getKindForAsset, getTokenAddress } from "../consts/Assets";
import { useGlobalContext } from "../context/Global";
import {
    type Signer,
    customDerivationPathRdns,
    useWeb3Signer,
} from "../context/Web3";
import { useModifySwap } from "../hooks/useModifySwap";
import type { EncodedHop } from "../utils/Pair";
import { formatAssetAmountForLog } from "../utils/denomination";
import { sendPopulatedTransaction } from "../utils/evmTransaction";
import type { HardwareSigner } from "../utils/hardware/HardwareSigner";
import { estimateFeesPerGas } from "../utils/provider";
import {
    type BridgeDetail,
    GasAbstractionType,
    type SomeSwap,
} from "../utils/swapCreator";
import ApproveErc20 from "./ApproveErc20";
import ConnectWallet from "./ConnectWallet";
import ContractTransaction from "./ContractTransaction";
import InsufficientBalance from "./InsufficientBalance";
import LoadingSpinner from "./LoadingSpinner";
import OptimizedRoute from "./OptimizedRoute";
import SendToBridge from "./SendToBridge";

const lockupGasUsage = 46_000n;

const permitWitnessTransferFromTypes = {
    PermitWitnessTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "witness", type: "ExecuteAndLockERC20" },
    ],
    TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
    ],
    ExecuteAndLockERC20: [
        { name: "preimageHash", type: "bytes32" },
        { name: "token", type: "address" },
        { name: "claimAddress", type: "address" },
        { name: "refundAddress", type: "address" },
        { name: "timelock", type: "uint256" },
        { name: "callsHash", type: "bytes32" },
    ],
} as const;

const getHopExecutionQuote = async (
    hop: EncodedHop,
    lockupAmount: bigint,
    slippage: number,
): Promise<{
    targetLockupAmount: bigint;
    quote: QuoteData;
    amountIn: bigint;
}> => {
    if (hop.dexDetails === undefined) {
        throw new Error("missing DEX details for lockup hop");
    }
    const targetLockupAmount = calculateAmountWithSlippage(
        lockupAmount,
        slippage / 2,
    );

    const quotes = await quoteDexAmountOut(
        hop.dexDetails.chain,
        hop.dexDetails.tokenIn,
        hop.dexDetails.tokenOut,
        targetLockupAmount,
    );

    if (!Array.isArray(quotes) || quotes.length === 0) {
        log.error("No DEX quotes returned for lockup hop", {
            dexDetails: hop.dexDetails,
            targetLockupAmount: formatAssetAmountForLog(
                targetLockupAmount,
                hop.to,
            ),
        });
        throw new Error("could not get DEX quote for lockup hop");
    }

    const quote = quotes[0];

    return {
        quote,
        targetLockupAmount,
        amountIn: BigInt(quote.quote),
    };
};

const hashRouterCalls = (calls: RouterCall[]) => {
    const encodedCalls = encodeAbiParameters(
        [
            {
                type: "tuple[]",
                components: [
                    { name: "target", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "callData", type: "bytes" },
                ],
            },
        ],
        [calls],
    );

    return keccak256(encodedCalls);
};

const lockupErc20WithPermit2 = async (
    gasAbstraction: GasAbstractionType,
    asset: string,
    amount: bigint,
    preimageHash: string,
    claimAddress: Address,
    timeoutBlockHeight: number,
    signer: Signer,
    transactionSigner: Signer,
): Promise<string> => {
    const router = createRouterContract(asset, transactionSigner);
    const tokenAddress = getAddress(getTokenAddress(asset));
    const calls: RouterCall[] = [];
    const callsHash = hashRouterCalls(calls);

    const refundAddress = signer.address;
    const [permit2Address, chainId] = await Promise.all([
        router.read.PERMIT2(),
        transactionSigner.provider.getChainId().then(BigInt),
    ]);

    const nonce = BigInt("0x" + randomBytes(32).toString("hex"));
    const permit2DeadlineSeconds = 1_800;
    const deadline = BigInt(
        Math.floor(Date.now() / 1000) + permit2DeadlineSeconds,
    );

    const permit2Signature = await signer.signTypedData({
        account: signer.account,
        domain: {
            name: "Permit2",
            verifyingContract: permit2Address,
            chainId,
        },
        types: permitWitnessTransferFromTypes,
        primaryType: "PermitWitnessTransferFrom",
        message: {
            permitted: {
                token: tokenAddress,
                amount,
            },
            spender: router.address,
            nonce,
            deadline,
            witness: {
                preimageHash: prefix0x(preimageHash),
                token: tokenAddress,
                claimAddress: getAddress(claimAddress),
                refundAddress,
                timelock: BigInt(timeoutBlockHeight),
                callsHash,
            },
        },
    });

    const tx = {
        to: router.address,
        data: encodeFunctionData({
            abi: routerAbi,
            functionName: "executeAndLockERC20WithPermit2",
            args: [
                prefix0x(preimageHash),
                tokenAddress,
                getAddress(claimAddress),
                refundAddress,
                BigInt(timeoutBlockHeight),
                calls,
                {
                    permitted: {
                        token: tokenAddress,
                        amount,
                    },
                    nonce,
                    deadline,
                },
                refundAddress,
                permit2Signature,
            ],
        }),
    };

    return await sendPopulatedTransaction(
        gasAbstraction,
        transactionSigner,
        tx,
    );
};

const lockupWithHops = async (
    hops: EncodedHop[],
    gasAbstraction: GasAbstractionType,
    asset: string,
    swapId: string,
    lockupAmount: bigint,
    connectedSigner: Signer,
    getGasAbstractionSigner: (asset: string) => Signer,
    slippage: number,
    getSwap: (id: string) => Promise<SomeSwap | null>,
    modifySwap: ReturnType<typeof useModifySwap>,
): Promise<string> => {
    const transactionSigner = getSignerForGasAbstraction(
        gasAbstraction,
        connectedSigner,
        getGasAbstractionSigner(asset),
    );
    if (transactionSigner === undefined) {
        throw new Error("missing transaction signer for lockup");
    }

    const lockup = async () => {
        if (hops.length !== 1) {
            throw new Error("only one hop is supported for now");
        }

        const hop = hops[0];
        if (hop.dexDetails === undefined) {
            throw new Error("missing DEX details for lockup hop");
        }

        const { targetLockupAmount, quote, amountIn } =
            await getHopExecutionQuote(hop, lockupAmount, slippage);
        log.info("Got DEX quote for lockup hop", {
            amountIn: formatAssetAmountForLog(amountIn, hop.from),
            targetLockupAmount: formatAssetAmountForLog(
                targetLockupAmount,
                hop.to,
            ),
            quoteData: quote.data,
        });

        const router = createRouterContract(hop.from, transactionSigner);
        const calldata = await encodeDexQuote(
            hop.dexDetails.chain,
            router.address,
            amountIn,
            targetLockupAmount,
            quote.data,
        );

        const ownerAddress = connectedSigner.address;
        const refundAddress = transactionSigner.address;
        const [permit2Address, chainId] = await Promise.all([
            router.read.PERMIT2(),
            transactionSigner.provider.getChainId().then(BigInt),
        ]);

        const calls = calldata.calls.map((call) => ({
            target: getAddress(call.to),
            value: BigInt(call.value),
            callData: prefix0x(call.data),
        })) satisfies RouterCall[];

        // Must match the Solidity contract's abi.encode of Call[] struct.
        const callsHash = hashRouterCalls(calls);

        const nonce = BigInt("0x" + randomBytes(32).toString("hex"));

        const permit2DeadlineSeconds = 1_800;
        const deadline = BigInt(
            Math.floor(Date.now() / 1000) + permit2DeadlineSeconds,
        );

        const tokenAddress = getAddress(getTokenAddress(asset));
        const commitmentLockupDetails = await getCommitmentLockupDetails(asset);
        const commitmentPreimageHash = "00".repeat(32);

        const permit2Signature = await connectedSigner.signTypedData({
            account: connectedSigner.account,
            domain: {
                name: "Permit2",
                verifyingContract: permit2Address,
                chainId,
            },
            types: permitWitnessTransferFromTypes,
            primaryType: "PermitWitnessTransferFrom",
            message: {
                permitted: {
                    token: getAddress(hop.dexDetails.tokenIn),
                    amount: amountIn,
                },
                spender: router.address,
                nonce,
                deadline,
                witness: {
                    preimageHash: prefix0x(commitmentPreimageHash),
                    token: tokenAddress,
                    claimAddress: getAddress(
                        commitmentLockupDetails.claimAddress,
                    ),
                    refundAddress: refundAddress,
                    timelock: BigInt(commitmentLockupDetails.timelock),
                    callsHash,
                },
            },
        });

        const tx = {
            to: router.address,
            data: encodeFunctionData({
                abi: routerAbi,
                functionName: "executeAndLockERC20WithPermit2",
                args: [
                    prefix0x(commitmentPreimageHash),
                    tokenAddress,
                    getAddress(commitmentLockupDetails.claimAddress),
                    refundAddress,
                    BigInt(commitmentLockupDetails.timelock),
                    calls,
                    {
                        permitted: {
                            token: getAddress(hop.dexDetails.tokenIn),
                            amount: amountIn,
                        },
                        nonce,
                        deadline,
                    },
                    ownerAddress,
                    permit2Signature,
                ],
            }),
        };

        log.info("Broadcasting commitment lockup with hops", {
            swapId,
            asset,
            gasAbstraction,
            amountIn: formatAssetAmountForLog(amountIn, hop.from),
            targetLockupAmount: formatAssetAmountForLog(
                targetLockupAmount,
                hop.to,
            ),
            routerAddress: router.address,
        });
        const transactionHash = await sendPopulatedTransaction(
            gasAbstraction,
            transactionSigner,
            tx,
        );
        const currentSwap = await modifySwap(swapId, (s) => {
            s.commitmentLockupTxHash = transactionHash;
            s.commitmentSignatureSubmitted = false;
            s.signer = ownerAddress;
        });
        if (currentSwap === null) {
            throw new Error(`missing swap ${swapId} for lockup persistence`);
        }
        log.info("Persisted commitment lockup tx hash for background worker", {
            swapId,
            asset,
            commitmentLockupTxHash: transactionHash,
        });

        return transactionHash;
    };

    let commitmentTxHash: string | undefined = (await getSwap(swapId))
        ?.commitmentLockupTxHash;
    if (commitmentTxHash === undefined) {
        commitmentTxHash = await lockup();
    } else {
        log.debug("Reusing existing commitment lockup tx hash", {
            swapId,
            asset,
            commitmentLockupTxHash: commitmentTxHash,
        });
    }

    return commitmentTxHash;
};

const LockupTransaction = (props: {
    asset: string;
    gasAbstraction: GasAbstractionType;
    value: () => bigint;
    preimageHash: string;
    claimAddress: Address;
    timeoutBlockHeight: number;
    swapId: string;
    needsApproval: Accessor<boolean>;
    setNeedsApproval: Setter<boolean>;
    approvalAsset?: string;
    approvalValue?: () => bigint;
    approvalTarget?: Address;
    hops?: EncodedHop[];
}) => {
    const { t, slippage, getSwap } = useGlobalContext();
    const {
        getErc20Swap,
        getEtherSwap,
        signer,
        providers,
        getGasAbstractionSigner,
    } = useWeb3Signer();
    const modifySwap = useModifySwap();

    return (
        <Show
            when={!props.needsApproval()}
            fallback={
                <ApproveErc20
                    asset={props.approvalAsset ?? props.asset}
                    value={
                        props.gasAbstraction === GasAbstractionType.Signer
                            ? () => maxUint256
                            : (props.approvalValue ?? props.value)
                    }
                    setNeedsApproval={props.setNeedsApproval}
                    approvalTarget={props.approvalTarget}
                />
            }>
            <ContractTransaction
                asset={props.asset}
                /* eslint-disable-next-line solid/reactivity */
                onClick={async () => {
                    const connectedSigner = signer();
                    if (connectedSigner === undefined) {
                        throw new Error(
                            "connected signer is required for lockup",
                        );
                    }

                    let transactionHash: string;
                    const transactionSigner = getSignerForGasAbstraction(
                        props.gasAbstraction,
                        connectedSigner,
                        getGasAbstractionSigner(props.asset),
                    );
                    if (transactionSigner === undefined) {
                        throw new Error(
                            "transaction signer is required for lockup",
                        );
                    }

                    if (props.hops !== undefined && props.hops.length > 0) {
                        transactionHash = await lockupWithHops(
                            props.hops,
                            props.gasAbstraction,
                            props.asset,
                            props.swapId,
                            props.value(),
                            connectedSigner,
                            getGasAbstractionSigner,
                            slippage(),
                            getSwap,
                            modifySwap,
                        );
                    } else if (
                        getKindForAsset(props.asset) === AssetKind.EVMNative
                    ) {
                        const contract = getEtherSwap(props.asset);
                        const tx = {
                            to: contract.address,
                            data: encodeFunctionData({
                                abi: etherSwapAbi,
                                functionName: "lock",
                                args: [
                                    prefix0x(props.preimageHash),
                                    getAddress(props.claimAddress),
                                    BigInt(props.timeoutBlockHeight),
                                ],
                            }),
                            value: props.value(),
                        };
                        transactionHash = await sendPopulatedTransaction(
                            props.gasAbstraction,
                            transactionSigner,
                            tx,
                        );
                    } else {
                        if (props.gasAbstraction === GasAbstractionType.None) {
                            const contract = getErc20Swap(props.asset);
                            const tx = {
                                to: contract.address,
                                data: encodeFunctionData({
                                    abi: erc20SwapAbi,
                                    functionName: "lock",
                                    args: [
                                        prefix0x(props.preimageHash),
                                        props.value(),
                                        getAddress(
                                            getTokenAddress(props.asset),
                                        ),
                                        getAddress(props.claimAddress),
                                        BigInt(props.timeoutBlockHeight),
                                    ],
                                }),
                            };
                            transactionHash = await sendPopulatedTransaction(
                                props.gasAbstraction,
                                transactionSigner,
                                tx,
                            );
                        } else {
                            transactionHash = await lockupErc20WithPermit2(
                                props.gasAbstraction,
                                props.asset,
                                props.value(),
                                props.preimageHash,
                                props.claimAddress,
                                props.timeoutBlockHeight,
                                connectedSigner,
                                transactionSigner,
                            );
                        }
                    }

                    const updated = await modifySwap(props.swapId, (s) => {
                        s.lockupTx = transactionHash;
                        s.signer = connectedSigner.address;

                        if (
                            customDerivationPathRdns.includes(
                                connectedSigner.rdns,
                            )
                        ) {
                            s.derivationPath = (
                                providers()[connectedSigner.rdns]
                                    .provider as unknown as HardwareSigner
                            ).getDerivationPath();
                        }
                    });
                    if (updated === null) {
                        throw new Error(
                            `missing swap ${props.swapId} for lockup persistence`,
                        );
                    }
                }}
                children={<ConnectWallet asset={props.asset} />}
                buttonText={t("send")}
                promptText={t("transaction_prompt", {
                    button: t("send"),
                })}
                waitingText={t("tx_in_mempool_subline")}
                showHr={false}
            />
        </Show>
    );
};

const LockupEvm = (props: {
    asset: string;
    gasAbstraction: GasAbstractionType;
    swapId: string;
    amount: number;
    preimageHash: string;
    claimAddress: Address;
    timeoutBlockHeight: number;
    hops?: EncodedHop[];
    bridge?: BridgeDetail;
}) => {
    const { slippage } = useGlobalContext();
    const { getErc20Swap, signer } = useWeb3Signer();

    const value = () => satsToAssetAmount(props.amount, props.asset);

    const hasHopsBefore = () =>
        props.hops !== undefined && props.hops.length > 0;

    // The actual asset the user needs to hold (hop input token or boltz asset)
    const userAsset = () =>
        hasHopsBefore() ? props.hops![0].from : props.asset;

    const expectedChainId = () =>
        config.assets?.[props.asset]?.network?.chainId;

    const [signerBalance, setSignerBalance] = createSignal<bigint | undefined>(
        undefined,
    );
    const [needsApproval, setNeedsApproval] = createSignal<boolean>(false);
    const [requiredValue, setRequiredValue] = createSignal<bigint>(0n);
    const [approvalTarget, setApprovalTarget] = createSignal<
        Address | undefined
    >(undefined);
    const [bridgeValue, setBridgeValue] = createSignal<bigint | undefined>(
        undefined,
    );

    const [signerChainId] = createResource(signer, async (currentSigner) => {
        return Number(await currentSigner.provider.getChainId());
    });

    createEffect(() => {
        void (async () => {
            if (props.bridge !== undefined) {
                if (!hasHopsBefore() || props.hops === undefined) {
                    throw new Error(
                        `bridge swap ${props.swapId} is missing a lockup-side DEX hop`,
                    );
                }
                setBridgeValue(
                    (
                        await getHopExecutionQuote(
                            props.hops[0],
                            value(),
                            slippage(),
                        )
                    ).amountIn,
                );
                return;
            }

            const activeSigner = signer();
            if (activeSigner === undefined) {
                return;
            }

            if (signerChainId() === undefined) {
                return;
            }

            if (hasHopsBefore() && props.hops !== undefined) {
                const hop = props.hops[0];
                const hopInputContract = createTokenContract(
                    hop.from,
                    activeSigner,
                );
                const router = createRouterContract(hop.from, activeSigner);
                const permit2Address = await router.read.PERMIT2();

                const [balance, allowance, requiredValue] = await Promise.all([
                    hopInputContract.read.balanceOf([activeSigner.address]),
                    hopInputContract.read.allowance([
                        activeSigner.address,
                        permit2Address,
                    ]),
                    getHopExecutionQuote(hop, value(), slippage()).then(
                        ({ amountIn }) => amountIn,
                    ),
                ]);

                log.info("Hop input token balance", {
                    asset: hop.from,
                    balance: formatAssetAmountForLog(balance, hop.from),
                });
                log.info("Hop required amount (DEX quote + slippage)", {
                    asset: hop.from,
                    requiredAmount: formatAssetAmountForLog(
                        requiredValue,
                        hop.from,
                    ),
                });

                setSignerBalance(balance);
                setRequiredValue(requiredValue);
                // Permit2 requires a one-time unlimited approval of the
                // input token to the Permit2 contract
                setNeedsApproval(allowance < requiredValue);
                setApprovalTarget(permit2Address);

                return;
            }

            switch (getKindForAsset(props.asset)) {
                case AssetKind.EVMNative: {
                    const [balance, gasPrice] = await Promise.all([
                        activeSigner.provider.getBalance({
                            address: activeSigner.address,
                        }),
                        estimateFeesPerGas(activeSigner.provider).then(
                            (data) => data.gasPrice,
                        ),
                    ]);

                    if (gasPrice === null) {
                        throw new Error("missing gas price");
                    }
                    const spendable = balance - gasPrice * lockupGasUsage;
                    log.info("EVM signer spendable balance", {
                        asset: props.asset,
                        spendableBalance: formatAssetAmountForLog(
                            spendable,
                            props.asset,
                        ),
                    });
                    setSignerBalance(spendable);
                    setRequiredValue(value());
                    setNeedsApproval(false);
                    setApprovalTarget(undefined);

                    break;
                }
                case AssetKind.ERC20: {
                    const contract = createTokenContract(
                        props.asset,
                        activeSigner,
                    );
                    const router = createRouterContract(
                        props.asset,
                        activeSigner,
                    );

                    const approvalTarget =
                        props.gasAbstraction !== GasAbstractionType.None
                            ? await router.read.PERMIT2()
                            : getErc20Swap(props.asset).address;

                    const [balance, allowance] = await Promise.all([
                        contract.read.balanceOf([activeSigner.address]),
                        contract.read.allowance([
                            activeSigner.address,
                            approvalTarget,
                        ]),
                    ]);

                    log.info("ERC20 signer balance", {
                        asset: props.asset,
                        balance: formatAssetAmountForLog(balance, props.asset),
                    });

                    const needsApproval = allowance < value();
                    log.info("ERC20 signer needs approval", needsApproval);

                    setSignerBalance(balance);
                    setRequiredValue(value());
                    setNeedsApproval(needsApproval);
                    setApprovalTarget(approvalTarget);

                    break;
                }
                default:
                    break;
            }
        })();
    });

    return (
        <>
            <OptimizedRoute />
            <Show
                when={props.bridge === undefined}
                fallback={
                    <Show
                        when={bridgeValue() !== undefined}
                        fallback={<LoadingSpinner />}>
                        <SendToBridge
                            bridge={props.bridge!}
                            swapId={props.swapId}
                            amount={bridgeValue()!}
                        />
                    </Show>
                }>
                <Show
                    when={signerBalance() !== undefined}
                    fallback={
                        <Show
                            when={
                                signer() !== undefined &&
                                signerChainId() === expectedChainId()
                            }
                            fallback={<ConnectWallet asset={props.asset} />}>
                            <LoadingSpinner />
                        </Show>
                    }>
                    <Show
                        when={signerBalance()! >= requiredValue()}
                        fallback={<InsufficientBalance asset={userAsset()} />}>
                        <LockupTransaction
                            asset={props.asset}
                            gasAbstraction={props.gasAbstraction}
                            value={value}
                            preimageHash={props.preimageHash}
                            claimAddress={props.claimAddress}
                            timeoutBlockHeight={props.timeoutBlockHeight}
                            swapId={props.swapId}
                            needsApproval={needsApproval}
                            setNeedsApproval={setNeedsApproval}
                            approvalAsset={
                                hasHopsBefore()
                                    ? props.hops![0].from
                                    : undefined
                            }
                            approvalValue={
                                hasHopsBefore() ? () => maxUint256 : undefined
                            }
                            approvalTarget={approvalTarget()}
                            hops={hasHopsBefore() ? props.hops : undefined}
                        />
                    </Show>
                </Show>
            </Show>
        </>
    );
};

export default LockupEvm;
