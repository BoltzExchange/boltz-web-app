export default {
    openapi: "3.0.1",
    info: {
        title: "boltzrpc.proto",
        version: "version not set",
    },
    servers: [
        {
            url: "/",
        },
    ],
    tags: [
        {
            name: "Boltz",
        },
    ],
    paths: {
        "/v1/createchannel": {
            post: {
                tags: ["Boltz"],
                summary:
                    "Create a new swap from onchain to a new lightning channel. The daemon will only accept the invoice payment if the HTLCs\nis coming trough a new channel channel opened by Boltz.",
                operationId: "Boltz_CreateChannel",
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/CreateChannelRequest",
                            },
                        },
                    },
                    required: true,
                },
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/CreateSwapResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
                "x-codegen-request-body-name": "body",
            },
        },
        "/v1/createreverseswap": {
            post: {
                tags: ["Boltz"],
                summary:
                    "Creates a new reverse swap from lightning to onchain. If `accept_zero_conf` is set to true in the request, the daemon\nwill not wait until the lockup transaction from Boltz is confirmed in a block, but will claim it instantly.",
                operationId: "Boltz_CreateReverseSwap",
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/CreateReverseSwapRequest",
                            },
                        },
                    },
                    required: true,
                },
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/CreateReverseSwapResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
                "x-codegen-request-body-name": "body",
            },
        },
        "/v1/createswap": {
            post: {
                tags: ["Boltz"],
                summary: "Creates a new swap from onchain to lightning.",
                operationId: "Boltz_CreateSwap",
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/CreateSwapRequest",
                            },
                        },
                    },
                    required: true,
                },
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/CreateSwapResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
                "x-codegen-request-body-name": "body",
            },
        },
        "/v1/deposit": {
            post: {
                tags: ["Boltz"],
                summary:
                    "This is a wrapper for channel creation swaps. The daemon only returns the ID, timeout block height and lockup address.\nThe Boltz backend takes care of the rest. When an amount of onchain coins that is in the limits is sent to the address\nbefore the timeout block height, the daemon creates a new lightning invoice, sends it to the Boltz backend which\nwill try to pay it and if that is not possible, create a new channel to make the swap succeed.",
                operationId: "Boltz_Deposit",
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/DepositRequest",
                            },
                        },
                    },
                    required: true,
                },
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/DepositResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
                "x-codegen-request-body-name": "body",
            },
        },
        "/v1/info": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Gets general information about the daemon like the chain of the LND node it is connected to\nand the IDs of pending swaps.",
                operationId: "Boltz_GetInfo",
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/GetInfoResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/listswaps": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Returns a list of all swaps, reverse swaps and channel creations in the database.",
                operationId: "Boltz_ListSwaps",
                parameters: [
                    {
                        name: "from",
                        in: "query",
                        schema: {
                            type: "string",
                            default: "BTC",
                            enum: ["BTC", "LBTC"],
                        },
                    },
                    {
                        name: "to",
                        in: "query",
                        schema: {
                            type: "string",
                            default: "BTC",
                            enum: ["BTC", "LBTC"],
                        },
                    },
                    {
                        name: "isAuto",
                        in: "query",
                        schema: {
                            type: "boolean",
                        },
                    },
                    {
                        name: "state",
                        in: "query",
                        description:
                            " - ERROR: Unknown client error. Check the error field of the message for more information\n - SERVER_ERROR: Unknown server error. Check the status field of the message for more information\n - REFUNDED: Client refunded locked coins after the HTLC timed out\n - ABANDONED: Client noticed that the HTLC timed out but didn't find any outputs to refund",
                        schema: {
                            type: "string",
                            default: "PENDING",
                            enum: [
                                "PENDING",
                                "SUCCESSFUL",
                                "ERROR",
                                "SERVER_ERROR",
                                "REFUNDED",
                                "ABANDONED",
                            ],
                        },
                    },
                ],
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ListSwapsResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/pairs": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Fetches all aaailable pairs for submarine and reverse swaps.",
                operationId: "Boltz_GetPairs",
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/GetPairsResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/serviceinfo": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Fetches the latest limits and fees from the Boltz backend API it is connected to.",
                operationId: "Boltz_GetServiceInfo",
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/GetServiceInfoResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/swap/{id}": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Gets all available information about a swap from the database.",
                operationId: "Boltz_GetSwapInfo",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: {
                            type: "string",
                        },
                    },
                ],
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/GetSwapInfoResponse",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/swap/{id}/stream": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Returns the entire history of the swap if is still pending and streams updates in real time.",
                operationId: "Boltz_GetSwapInfoStream",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: {
                            type: "string",
                        },
                    },
                    {
                        name: "includeHistory",
                        in: "query",
                        schema: {
                            type: "boolean",
                        },
                    },
                ],
                responses: {
                    "200": {
                        description:
                            "A successful response.(streaming responses)",
                        content: {
                            "application/json": {
                                schema: {
                                    title: "Stream result of GetSwapInfoResponse",
                                    type: "object",
                                    properties: {
                                        result: {
                                            $ref: "#/components/schemas/GetSwapInfoResponse",
                                        },
                                        error: {
                                            $ref: "#/components/schemas/Status",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
        "/v1/wallets": {
            get: {
                tags: ["Boltz"],
                summary:
                    "Returns the current balance and subaccount of the liquid wallet.",
                operationId: "Boltz_GetWallets",
                parameters: [
                    {
                        name: "currency",
                        in: "query",
                        schema: {
                            type: "string",
                        },
                    },
                    {
                        name: "includeReadonly",
                        in: "query",
                        schema: {
                            type: "boolean",
                        },
                    },
                ],
                responses: {
                    "200": {
                        description: "A successful response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Wallets",
                                },
                            },
                        },
                    },
                    default: {
                        description: "An unexpected error response.",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/Status",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            Any: {
                type: "object",
                properties: {
                    "@type": {
                        type: "string",
                    },
                },
                additionalProperties: {
                    type: "object",
                },
            },
            Balance: {
                type: "object",
                properties: {
                    total: {
                        type: "string",
                        format: "uint64",
                    },
                    confirmed: {
                        type: "string",
                        format: "uint64",
                    },
                    unconfirmed: {
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            ChannelCreationInfo: {
                type: "object",
                properties: {
                    swapId: {
                        title: "ID of the swap to which this channel channel belongs",
                        type: "string",
                    },
                    status: {
                        type: "string",
                    },
                    inboundLiquidity: {
                        type: "integer",
                        format: "int64",
                    },
                    private: {
                        type: "boolean",
                    },
                    fundingTransactionId: {
                        type: "string",
                    },
                    fundingTransactionVout: {
                        type: "integer",
                        format: "int64",
                    },
                },
                description:
                    "Channel creations are an optional extension to a submarine swap in the data types of boltz-client.",
            },
            ChannelId: {
                type: "object",
                properties: {
                    cln: {
                        type: "string",
                    },
                    lnd: {
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            CombinedChannelSwapInfo: {
                type: "object",
                properties: {
                    swap: {
                        $ref: "#/components/schemas/SwapInfo",
                    },
                    channelCreation: {
                        $ref: "#/components/schemas/ChannelCreationInfo",
                    },
                },
            },
            CreateChannelRequest: {
                type: "object",
                properties: {
                    amount: {
                        type: "string",
                        format: "int64",
                    },
                    inboundLiquidity: {
                        type: "integer",
                        description:
                            "Percentage of inbound liquidity the channel that is opened should have.\n25 by default.",
                        format: "int64",
                    },
                    private: {
                        type: "boolean",
                    },
                },
            },
            CreateReverseSwapRequest: {
                type: "object",
                properties: {
                    amount: {
                        type: "string",
                        format: "int64",
                    },
                    address: {
                        title: "If no value is set, the daemon will query a new P2WKH address from LND",
                        type: "string",
                    },
                    acceptZeroConf: {
                        type: "boolean",
                    },
                    pair: {
                        $ref: "#/components/schemas/Pair",
                    },
                    chanIds: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    wallet: {
                        type: "string",
                    },
                },
            },
            CreateReverseSwapResponse: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                    },
                    lockupAddress: {
                        type: "string",
                    },
                    routingFeeMilliSat: {
                        type: "integer",
                        format: "int64",
                    },
                    claimTransactionId: {
                        title: "Only populated when 0-conf is accepted",
                        type: "string",
                    },
                },
            },
            CreateSwapRequest: {
                type: "object",
                properties: {
                    amount: {
                        type: "string",
                        format: "int64",
                    },
                    pair: {
                        $ref: "#/components/schemas/Pair",
                    },
                    chanIds: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    autoSend: {
                        type: "boolean",
                    },
                    refundAddress: {
                        type: "string",
                    },
                    wallet: {
                        type: "string",
                    },
                },
            },
            CreateSwapResponse: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                    },
                    address: {
                        type: "string",
                    },
                    expectedAmount: {
                        type: "string",
                        format: "int64",
                    },
                    bip21: {
                        type: "string",
                    },
                    txId: {
                        type: "string",
                    },
                    timeoutBlockHeight: {
                        type: "integer",
                        format: "int64",
                    },
                    timeoutHours: {
                        type: "number",
                        format: "float",
                    },
                },
            },
            Currency: {
                type: "string",
                default: "BTC",
                enum: ["BTC", "LBTC"],
            },
            DepositRequest: {
                type: "object",
                properties: {
                    inboundLiquidity: {
                        type: "integer",
                        description:
                            "Percentage of inbound liquidity the channel that is opened in case the invoice cannot be paid should have.\n25 by default.",
                        format: "int64",
                    },
                },
            },
            DepositResponse: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                    },
                    address: {
                        type: "string",
                    },
                    timeoutBlockHeight: {
                        type: "integer",
                        format: "int64",
                    },
                },
            },
            "Fees.MinerFees": {
                type: "object",
                properties: {
                    lockup: {
                        type: "string",
                        format: "uint64",
                    },
                    claim: {
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            GetFeeEstimationResponse: {
                type: "object",
                properties: {
                    fees: {
                        $ref: "#/components/schemas/boltzrpc.Fees",
                    },
                    limits: {
                        $ref: "#/components/schemas/Limits",
                    },
                },
            },
            GetInfoResponse: {
                type: "object",
                properties: {
                    version: {
                        type: "string",
                    },
                    node: {
                        type: "string",
                    },
                    network: {
                        type: "string",
                    },
                    nodePubkey: {
                        type: "string",
                    },
                    autoSwapStatus: {
                        type: "string",
                    },
                    blockHeights: {
                        type: "object",
                        additionalProperties: {
                            type: "integer",
                            format: "int64",
                        },
                    },
                    symbol: {
                        type: "string",
                    },
                    lndPubkey: {
                        type: "string",
                    },
                    blockHeight: {
                        type: "integer",
                        format: "int64",
                    },
                    pendingSwaps: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    pendingReverseSwaps: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                },
            },
            GetPairsResponse: {
                type: "object",
                properties: {
                    submarine: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/SubmarinePair",
                        },
                    },
                    reverse: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/ReversePair",
                        },
                    },
                },
            },
            GetServiceInfoResponse: {
                type: "object",
                properties: {
                    fees: {
                        $ref: "#/components/schemas/boltzrpc.Fees",
                    },
                    limits: {
                        $ref: "#/components/schemas/Limits",
                    },
                },
            },
            GetSubaccountsResponse: {
                type: "object",
                properties: {
                    current: {
                        type: "string",
                        format: "uint64",
                    },
                    subaccounts: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Subaccount",
                        },
                    },
                },
            },
            GetSwapInfoResponse: {
                type: "object",
                properties: {
                    swap: {
                        $ref: "#/components/schemas/SwapInfo",
                    },
                    channelCreation: {
                        $ref: "#/components/schemas/ChannelCreationInfo",
                    },
                    reverseSwap: {
                        $ref: "#/components/schemas/ReverseSwapInfo",
                    },
                },
            },
            Limits: {
                type: "object",
                properties: {
                    minimal: {
                        type: "string",
                        format: "uint64",
                    },
                    maximal: {
                        type: "string",
                        format: "uint64",
                    },
                    maximalZeroConfAmount: {
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            ListSwapsResponse: {
                type: "object",
                properties: {
                    swaps: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/SwapInfo",
                        },
                    },
                    channelCreations: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/CombinedChannelSwapInfo",
                        },
                    },
                    reverseSwaps: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/ReverseSwapInfo",
                        },
                    },
                },
            },
            Pair: {
                type: "object",
                properties: {
                    from: {
                        $ref: "#/components/schemas/Currency",
                    },
                    to: {
                        $ref: "#/components/schemas/Currency",
                    },
                },
            },
            RemoveWalletResponse: {
                type: "object",
            },
            ReversePair: {
                title: "Reverse Pair",
                type: "object",
                properties: {
                    pair: {
                        $ref: "#/components/schemas/Pair",
                    },
                    hash: {
                        type: "string",
                    },
                    rate: {
                        type: "number",
                        format: "float",
                    },
                    limits: {
                        $ref: "#/components/schemas/Limits",
                    },
                    fees: {
                        $ref: "#/components/schemas/ReversePair.Fees",
                    },
                },
            },
            "ReversePair.Fees": {
                type: "object",
                properties: {
                    percentage: {
                        type: "number",
                        format: "float",
                    },
                    minerFees: {
                        $ref: "#/components/schemas/Fees.MinerFees",
                    },
                },
            },
            ReverseSwapInfo: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                    },
                    state: {
                        $ref: "#/components/schemas/SwapState",
                    },
                    error: {
                        type: "string",
                    },
                    status: {
                        title: "Latest status message of the Boltz backend",
                        type: "string",
                    },
                    privateKey: {
                        type: "string",
                    },
                    preimage: {
                        type: "string",
                    },
                    redeemScript: {
                        type: "string",
                    },
                    invoice: {
                        type: "string",
                    },
                    claimAddress: {
                        type: "string",
                    },
                    onchainAmount: {
                        type: "string",
                        format: "int64",
                    },
                    timeoutBlockHeight: {
                        type: "integer",
                        format: "int64",
                    },
                    lockupTransactionId: {
                        type: "string",
                    },
                    claimTransactionId: {
                        type: "string",
                    },
                    pair: {
                        $ref: "#/components/schemas/Pair",
                    },
                    chanIds: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/ChannelId",
                        },
                    },
                    blindingKey: {
                        type: "string",
                    },
                    createdAt: {
                        type: "string",
                        format: "int64",
                    },
                    serviceFee: {
                        type: "string",
                        format: "uint64",
                    },
                    onchainFee: {
                        type: "string",
                        format: "uint64",
                    },
                    routingFeeMsat: {
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            Status: {
                type: "object",
                properties: {
                    code: {
                        type: "integer",
                        format: "int32",
                    },
                    message: {
                        type: "string",
                    },
                    details: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Any",
                        },
                    },
                },
            },
            Subaccount: {
                type: "object",
                properties: {
                    balance: {
                        $ref: "#/components/schemas/Balance",
                    },
                    pointer: {
                        type: "string",
                        format: "uint64",
                    },
                    type: {
                        type: "string",
                    },
                },
            },
            SubmarinePair: {
                title: "Submarine Pair",
                type: "object",
                properties: {
                    pair: {
                        $ref: "#/components/schemas/Pair",
                    },
                    hash: {
                        type: "string",
                    },
                    rate: {
                        type: "number",
                        format: "float",
                    },
                    limits: {
                        $ref: "#/components/schemas/Limits",
                    },
                    fees: {
                        $ref: "#/components/schemas/SubmarinePair.Fees",
                    },
                },
            },
            "SubmarinePair.Fees": {
                type: "object",
                properties: {
                    percentage: {
                        type: "number",
                        format: "float",
                    },
                    minerFees: {
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            SwapInfo: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                    },
                    pair: {
                        $ref: "#/components/schemas/Pair",
                    },
                    state: {
                        $ref: "#/components/schemas/SwapState",
                    },
                    error: {
                        type: "string",
                    },
                    status: {
                        title: "Latest status message of the Boltz backend",
                        type: "string",
                    },
                    privateKey: {
                        type: "string",
                    },
                    preimage: {
                        type: "string",
                    },
                    redeemScript: {
                        type: "string",
                    },
                    invoice: {
                        type: "string",
                    },
                    lockupAddress: {
                        type: "string",
                    },
                    expectedAmount: {
                        type: "string",
                        format: "int64",
                    },
                    timeoutBlockHeight: {
                        type: "integer",
                        format: "int64",
                    },
                    lockupTransactionId: {
                        type: "string",
                    },
                    refundTransactionId: {
                        type: "string",
                        description:
                            "If the swap times out or fails for some other reason, the damon will automatically refund the coins sent to the\n`lockup_address` back to the configured wallet or the address specified in the `refund_address` field.",
                    },
                    refundAddress: {
                        type: "string",
                    },
                    chanIds: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/ChannelId",
                        },
                    },
                    blindingKey: {
                        type: "string",
                    },
                    createdAt: {
                        type: "string",
                        format: "int64",
                    },
                    serviceFee: {
                        type: "string",
                        format: "uint64",
                    },
                    onchainFee: {
                        type: "string",
                        format: "uint64",
                    },
                    autoSend: {
                        type: "boolean",
                    },
                },
            },
            SwapState: {
                title: "- ERROR: Unknown client error. Check the error field of the message for more information\n - SERVER_ERROR: Unknown server error. Check the status field of the message for more information\n - REFUNDED: Client refunded locked coins after the HTLC timed out\n - ABANDONED: Client noticed that the HTLC timed out but didn't find any outputs to refund",
                type: "string",
                default: "PENDING",
                enum: [
                    "PENDING",
                    "SUCCESSFUL",
                    "ERROR",
                    "SERVER_ERROR",
                    "REFUNDED",
                    "ABANDONED",
                ],
            },
            VerifyWalletPasswordResponse: {
                type: "object",
                properties: {
                    correct: {
                        type: "boolean",
                    },
                },
            },
            Wallet: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                    },
                    currency: {
                        type: "string",
                    },
                    readonly: {
                        type: "boolean",
                    },
                    balance: {
                        $ref: "#/components/schemas/Balance",
                    },
                },
            },
            WalletCredentials: {
                type: "object",
                properties: {
                    mnemonic: {
                        title: "only one of these is allowed to be present",
                        type: "string",
                    },
                    xpub: {
                        type: "string",
                    },
                    coreDescriptor: {
                        type: "string",
                    },
                    subaccount: {
                        title: "only used in combination with mnemonic",
                        type: "string",
                        format: "uint64",
                    },
                },
            },
            WalletInfo: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                    },
                    currency: {
                        type: "string",
                    },
                },
            },
            Wallets: {
                type: "object",
                properties: {
                    wallets: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Wallet",
                        },
                    },
                },
            },
            "boltzrpc.Fees": {
                type: "object",
                properties: {
                    percentage: {
                        type: "number",
                        format: "float",
                    },
                    miner: {
                        $ref: "#/components/schemas/boltzrpc.MinerFees",
                    },
                },
            },
            "boltzrpc.MinerFees": {
                type: "object",
                properties: {
                    normal: {
                        type: "integer",
                        format: "int64",
                    },
                    reverse: {
                        type: "integer",
                        format: "int64",
                    },
                },
            },
        },
    },
    "x-original-swagger-version": "2.0",
} as const;
