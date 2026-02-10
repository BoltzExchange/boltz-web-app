import type { Address, PublicClient } from "viem";

import { config } from "../config";
import { RBTC } from "../consts/Assets";

type PublicClientGetter = () => PublicClient;

const BoltzSmartWalletFactoryAbi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "forwarderTemplate",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "address",
                name: "addr",
                type: "address",
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "salt",
                type: "uint256",
            },
        ],
        name: "Deployed",
        type: "event",
    },
    {
        inputs: [],
        name: "DATA_VERSION_HASH",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                internalType: "address",
                name: "recoverer",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "index",
                type: "uint256",
            },
            {
                internalType: "bytes",
                name: "sig",
                type: "bytes",
            },
        ],
        name: "createUserSmartWallet",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "domainSeparator",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "getCreationBytecode",
        outputs: [
            {
                internalType: "bytes",
                name: "",
                type: "bytes",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                internalType: "address",
                name: "recoverer",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "index",
                type: "uint256",
            },
        ],
        name: "getSmartWalletAddress",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "masterCopy",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "from",
                type: "address",
            },
        ],
        name: "nonce",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "relayHub",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "tokenContract",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "recoverer",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "value",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "nonce",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "tokenAmount",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "tokenGas",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "validUntilTime",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "index",
                        type: "uint256",
                    },
                    {
                        internalType: "bytes",
                        name: "data",
                        type: "bytes",
                    },
                ],
                internalType: "struct IForwarder.DeployRequest",
                name: "req",
                type: "tuple",
            },
            {
                internalType: "bytes32",
                name: "suffixData",
                type: "bytes32",
            },
            {
                internalType: "address",
                name: "feesReceiver",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "sig",
                type: "bytes",
            },
        ],
        name: "relayedUserSmartWalletCreation",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "runtimeCodeHash",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];

const ForwarderAbi = [
    {
        inputs: [
            {
                internalType: "address",
                name: "to",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "data",
                type: "bytes",
            },
        ],
        name: "directExecute",
        outputs: [
            {
                internalType: "bool",
                name: "success",
                type: "bool",
            },
            {
                internalType: "bytes",
                name: "ret",
                type: "bytes",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "suffixData",
                type: "bytes32",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "relayHub",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "tokenContract",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "value",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "gas",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "nonce",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "tokenAmount",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "tokenGas",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "validUntilTime",
                        type: "uint256",
                    },
                    {
                        internalType: "bytes",
                        name: "data",
                        type: "bytes",
                    },
                ],
                internalType: "struct IForwarder.ForwardRequest",
                name: "forwardRequest",
                type: "tuple",
            },
            {
                internalType: "address",
                name: "feesReceiver",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "signature",
                type: "bytes",
            },
        ],
        name: "execute",
        outputs: [
            {
                internalType: "bool",
                name: "success",
                type: "bool",
            },
            {
                internalType: "bytes",
                name: "ret",
                type: "bytes",
            },
        ],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [],
        name: "getOwner",
        outputs: [
            {
                internalType: "bytes32",
                name: "owner",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "nonce",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "suffixData",
                type: "bytes32",
            },
            {
                components: [
                    {
                        internalType: "address",
                        name: "relayHub",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "from",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "tokenContract",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "value",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "gas",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "nonce",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "tokenAmount",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "tokenGas",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "validUntilTime",
                        type: "uint256",
                    },
                    {
                        internalType: "bytes",
                        name: "data",
                        type: "bytes",
                    },
                ],
                internalType: "struct IForwarder.ForwardRequest",
                name: "forwardRequest",
                type: "tuple",
            },
            {
                internalType: "bytes",
                name: "signature",
                type: "bytes",
            },
        ],
        name: "verify",
        outputs: [],
        stateMutability: "view",
        type: "function",
    },
];

export const getSmartWalletAddress = async (
    publicClient: PublicClientGetter,
    owner: Address,
    recoverer: Address,
    index: bigint,
) => {
    const address = await publicClient().readContract({
        address: config.assets[RBTC].contracts.smartWalletFactory as Address,
        abi: BoltzSmartWalletFactoryAbi,
        functionName: "getSmartWalletAddress",
        args: [owner, recoverer, index],
        authorizationList: undefined,
    });
    return address as Address;
};

export const getSmartWalletFactoryAddress = () => {
    return config.assets[RBTC].contracts.smartWalletFactory as Address;
};

export const getSmartWalletNonce = async (
    publicClient: PublicClientGetter,
    address: Address,
) => {
    const nonce = BigInt(
        await publicClient().getTransactionCount({
            address: address,
            blockTag: "pending",
        }),
    );
    return nonce;
};

export const getWalletNonce = async (
    publicClient: PublicClientGetter,
    address: Address,
) => {
    const nonce = BigInt(
        await publicClient().getTransactionCount({
            address: address,
        }),
    );
    return nonce;
};

export const wagmiSmartWalletFactoryContractConfig = {
    address: config.assets[RBTC].contracts.smartWalletFactory as Address,
    abi: BoltzSmartWalletFactoryAbi,
} as const;

export const getWagmiForwarderContractConfig = (forwarder: string) => {
    return {
        address: forwarder as Address,
        abi: ForwarderAbi,
    } as const;
};
