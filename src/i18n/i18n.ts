const dict = {
    en: {
        language: "English",
        or: "or",
        status: "Status",
        fast: "Fast",
        l2: "Built on Layer 2",
        l2_sub: "Boltz utilizes Layer 2 scaling technologies like the Lightning Network",
        assets_sub: "Bitcoin Layers and Stablecoins",
        safe: "Safe",
        non_custodial: "Non-Custodial",
        non_custodial_sub:
            "Swaps on Boltz are atomic, cryptography ensures that users are always in control of their money",
        node: "Lightning Nodes",
        error: "Error",
        error_subline: "Invalid response from the API, something is wrong.",
        error_wasm: "WebAssembly not supported",
        history: "History",
        swap: "Swap",
        refund: "Refund",
        partner: "Partner",
        support: "Support",
        docs: "Docs",
        onion: "Onion",
        terms: "Terms",
        privacy: "Privacy",
        blockexplorer: "open {{ typeLabel }}",
        blockexplorer_lockup_address: "lockup address",
        blockexplorer_lockup_tx: "lockup transaction",
        blockexplorer_claim_tx: "claim transaction",
        blockexplorer_refund_tx: "refund transaction",
        help: "Help",
        network_fee: "Network Fee",
        fee: "Boltz Fee",
        denomination: "Denomination",
        send: "Send",
        continue: "Continue",
        receive: "Receive",
        min: "Min",
        max: "Max",
        minimum_amount: "Minimum amount is {{ amount }} {{ denomination }}",
        maximum_amount: "Maximum amount is {{ amount }} {{ denomination }}",
        assets: "Multi-Layer",
        footer: "Made with 🧡 by Team Boltz",
        create_swap: "Create Atomic Swap",
        create_swap_subline: "Payment Includes Network and Boltz Fee",
        get_gas_token_for_gas: "Get {{ gasToken }} for gas",
        new_swap: "New Swap",
        feecheck:
            "Network fee was updated based on network situation, please confirm new amounts and continue with swap.",
        create_and_paste:
            "Paste a Lightning invoice, BOLT12 or LNURL to receive funds",
        congrats: "Congratulations!",
        successfully_swapped:
            "You successfully received {{ amount }} {{ denomination }}!",
        timeout_eta: "Timeout ETA",
        pay_invoice: "Swap: {{ id }}",
        pay_swap_404: "Swap not found!",
        pay_timeout_blockheight: "Timeout Block Height ({{ network }})",
        send_to: "Send {{ amount }} {{ denomination }} to",
        send_between:
            "Send between {{ min }} and {{ max }} {{ denomination }} to",
        pay_invoice_to:
            "Pay this invoice about {{ amount }} {{ denomination }}",
        no_wallet: "No wallet installed",
        connect_wallet: "Connect wallet",
        please_connect_wallet: "Please connect wallet",
        connect_to_address: "Connect to swap address",
        disconnect_address: "Disconnect wallet",
        lockup_failed: "Lockup Failed!",
        failure_reason: "Failure reason",
        invoice_payment_failure: "Could not pay your lightning invoice",
        onchain_address: "Enter {{ asset }} address to receive funds",
        onchain_address_no_asset: "Enter address",
        invalid_refund_file: "Invalid rescue key",
        invalid_backup_file: "Invalid backup file",
        invalid_invoice:
            "Please provide a valid Lightning invoice, BOLT12 or LNURL",
        invalid_0_amount: "Invoices without amount are not supported",
        copy_invoice: "lightning invoice",
        copy_address: "address",
        copy_amount: "amount",
        copy_bip21: "BIP21",
        refund_swap: "Refund Swap",
        rescue_a_swap_subline:
            "If you sent BTC or L-BTC into a Boltz swap, upload or enter your rescue key to rescue a swap that is not available in this browser’s swap history.",
        rescue_a_swap_mnemonic:
            "Enter your rescue key to rescue a swap that is not available in this browser’s swap history.",
        refund_past_swaps: "Past swaps",
        refund_past_swaps_subline:
            "Swaps that got saved into your browsers storage",
        no_rescuable_swaps: "No rescuable swaps found in your browser history",
        cant_find_swap: "Can't find your swap?",
        rescue_external_explainer:
            "Try rescuing an external swap via rescue key and other emergency methods.",
        refund_external_scanning_rsk:
            "Scanning for rescuable swaps in your Rootstock Wallet...",
        connected_wallet_no_swaps:
            "The connected Rootstock Wallet does not contain any rescuable swaps.",
        rescue_external_swap: "Rescue External Swap",
        history_no_swaps: "Looks like you didn't do any swaps yet.",
        refund_address_header:
            "Enter a {{ asset }} address to receive your refund on:",
        refund_address_header_no_asset:
            "Enter an address to receive your refund on:",
        refund_backup: "Backup",
        refund_import: "Import Backup",
        refund_clear: "Delete storage",
        delete_storage:
            "Are you sure you want to clear your storage?\nYour swap information and you refund / claim private keys will be lost.",
        delete_storage_single_swap:
            "Are you sure you want to clear Swap {{ id }} from your storage?\nYour swap information and you refund / claim private keys will be lost.",
        delete_logs: "Are you sure you want to clear your logs?",
        tx_in_mempool: "Transaction is in mempool",
        tx_in_mempool_subline: "Waiting for confirmation to complete the swap.",
        tx_in_mempool_warning:
            "Keep this page open, otherwise your swap can't complete!",
        invoice_pending: "Transaction received, paying invoice.",
        invoice_pending_pro:
            "Transaction received, invoice queued. In some occasions, swap might be cancelled.",
        invoice_expired: "Invoice expired, try again!",
        create_invoice_webln: "create invoice via WebLN",
        pay_invoice_webln: "pay invoice via WebLN",
        select_asset: "Select {{ direction }} Asset",
        select_network: "Select network",
        search: "Search",
        tx_confirmed: "Transaction confirmed",
        tx_ready_to_claim: "Claiming transaction now...",
        refunded: "Swap has been refunded successfully!",
        locktime_not_satisfied: "Locktime requirement not satisfied",
        already_refunded: "Swap already refunded",
        api_offline: "API is offline",
        api_offline_msg:
            "Could not connect to the Boltz API, please try again later",
        refund_explainer: "You will be able to refund after the swap timeout!",
        wasm_not_supported: "Please activate WebAssembly in your browser",
        created: "Created",
        view: "View",
        id: "ID",
        headline: "Non-Custodial Bitcoin Bridge",
        headline_pro: "Stack Sats Non-Custodially",
        subline:
            "Swap between different Bitcoin layers and Stablecoins while staying in full control.",
        subline_pro:
            "Earn sats for swapping Bitcoin in directions that help balance our liquidity.",
        start_swapping: "Start Swapping",
        partners: "Partners",
        integrations: "Integrations",
        oldest_channel_years: "{{ years }} yrs",
        oldest_channel: "Oldest Channel",
        capacity: "Capacity ({{ denomination }})",
        peers: "Number of Peers",
        num_channels: "Number of Channels",
        beta_caution: "BETA - USE WITH CAUTION!",
        pro: "pro",
        pro_banner: "Looking to use Boltz Pro via API?",
        warning_return:
            "Return to this page after paying the invoice! The payment might show pending until you return to this page.",
        warning_expiry:
            "Make sure your transaction confirms within ~24 hours after creation of this swap!",
        not_found: "404 - Not Found",
        not_found_subline: "This page seems to have vanished.",
        back_to_home: "Back to Home",
        transaction_prompt:
            'Press "{{ button }}" in order to open your connected wallet and confirm the displayed transaction.',
        transaction_prompt_receive:
            'Press "{{ button }}" in order to open your connected wallet and confirm the displayed transaction to receive {{ asset }}.',
        transaction_failed: "Transaction failed: {{ error }}",
        wallet_request_rejected: "Request was rejected in your wallet.",
        invalid_address: "Invalid {{ asset }} address",
        scan_qr_code: "Scan QR Code",
        version: "Version",
        commithash: "Commit Hash",
        open_in_wallet: "Open in Wallet",
        branding: "Branding",
        regtest: "Regtest",
        broadcasting_claim: "Broadcasting claim transaction...",
        paste_invalid:
            "Clipboard contains invalid characters or maximum amount is exceeded",
        email: "Email",
        switch_paste: "Switched swap direction/asset based on pasted content",
        settings: "Settings",
        decimal_separator: "Decimal Separator",
        denomination_tooltip: "Choose your preferred denomination: BTC or sats",
        decimal_tooltip:
            "Choose your preferred decimal separator: dot or comma",
        show_fiat_rate: "Show USD Rate",
        show_fiat_rate_tooltip: "Show USD equivalent of swap amount",
        fiat_rate_not_available: "USD rate unavailable",
        swap_completed: "Swap {{ id }} completed successfully!",
        claim_fail: "Failed to claim swap: {{ id }}",
        logs: "Logs",
        logs_tooltip: "Logs of the web app, useful for debugging",
        hide_wallet_address: "Privacy Mode",
        hide_wallet_address_tooltip:
            "Hides EVM wallet address and Swap ID for privacy in demos/recordings",
        bitcoin_only: "Bitcoin-Only Mode",
        bitcoin_only_tooltip:
            "Only show Bitcoin and Lightning, hide all other pairs",
        slippage: "Slippage",
        slippage_tooltip: "Maximum price slippage tolerance for DEX swaps",
        gas_topup: "Auto gas top-up",
        gas_topup_tooltip:
            "Automatically convert a small portion of your swap into native gas if your connected wallet has no gas.",
        gas_topup_label: "Gas ({{ gasToken }}): 0.{{ cost }}",
        oft_messaging_fee_label: "OFT fee",
        dex_quote_changed: "DEX quote has changed",
        zero_conf: "Zero-Conf",
        zero_conf_tooltip:
            "Accept transactions that are not yet confirmed in a block",
        on: "on",
        off: "off",
        invalid_pair: "Invalid pair",
        error_starting_qr_scanner:
            "Couldn't access camera, please check permissions!",
        insufficient_balance: "Insufficient balance",
        insufficient_balance_line:
            "You do not have enough balance in your wallet for this swap.",
        select_wallet: "Select wallet",
        select_derivation_path: "Select derivation path",
        submit_derivation_path: "Submit",
        not_supported_in_browser: "Not supported in this browser",
        switch_network: "Switch network",
        block: "block",
        logs_scan_progress: "Scan progress {{ value }}%",
        accept: "Accept",
        wallet_connect_failed: "Wallet connection failed: {{ error }}",
        ledger_open_app_prompt: "Open Ethereum or RSK app",
        validate_payment: "Show Proof of Payment",
        no_browser_wallet: "No browser wallet detected",
        sent: "Sent",
        will_receive: "Will receive",
        refund_available_in: "Refund will be available in {{ blocks }} blocks",
        no_wallet_connected: "No wallet connected",
        no_lockup_transaction: "No lockup transaction found",
        routing_fee_limit: "Routing fee limit",
        download_boltz_rescue_key: "Boltz Rescue Key",
        download_boltz_rescue_key_subline:
            "Back up all your swaps with a single Rescue Key 🙌",
        download_boltz_rescue_key_subline_second:
            "This key works on any device and works for all swaps created with it. Save the key in a secure and permanent location.",
        download_boltz_rescue_key_subline_third:
            "To continue, please download a new Rescue Key.",
        download_new_key: "Download New Key",
        verify_boltz_rescue_key: "Verify Boltz Rescue Key",
        verify_boltz_rescue_key_subline:
            "Please select your previously saved Boltz Rescue Key to verify it.",
        verify_key: "Verify key",
        verify_key_failed:
            "Verification of the Boltz Rescue Key failed. We recommend downloading a new Boltz Rescue Key to continue.",
        rescue_key: "Rescue Key",
        reset_rescue_key_tooltip:
            "Generate a new Rescue Key and wipe all swap data",
        reset_rescue_key_prompt:
            "⚠️ WARNING: This will delete ALL your swap data and generate a new Rescue Key.\n\nDon't proceed unless you have a backup of your existing Rescue Key or you're absolutely sure you won't need it. \n\nType 'confirm' to proceed:",
        reset_rescue_key_invalid_confirmation:
            "Invalid confirmation. Please type 'confirm' to proceed.",
        reset_rescue_key_error:
            "An error occurred while resetting the Rescue Key. Please reload this page and try again.\n\nError: {{ error }}",
        reset_rescue_key_success: "New Rescue Key generated successfully!",
        no_swaps_found: "No swaps found",
        rif_extra_fee:
            "Wallet doesn't contain enough RBTC, fee adjusted to include RIF Relay fee!",
        back: "Back",
        next: "Next",
        pagination_info: "Page {{ start }} of {{ end }}",
        generate_key: "Generate new key",
        backup_boltz_rescue_key: "Backup Boltz Rescue Key",
        backup_boltz_rescue_key_subline_second:
            "This new key works on any device and works for all swaps created with it.",
        backup_boltz_rescue_key_subline_third:
            "Please write down or copy this key and store it in a secure and permanent location.",
        backup_boltz_rescue_key_reminder: "Keep this safe. Do not share.",
        copy_rescue_key: "Copy rescue key",
        user_saved_key: "I have saved the rescue key",
        verify_mnemonic_word: {
            start: "What is the word at ",
            strong: "position {{ number }}",
            end: " of your rescue key?",
        },
        incorrect_word: "Incorrect word. Please double-check your rescue key.",
        enter_mnemonic: "Enter rescue key",
        verify_boltz_rescue_key_mnemonic:
            "Please enter your rescue key below to import it.",
        hint_paste_mnemonic: "Hint: you can paste all 12 words at once.",
        swap_opportunities: "Available Pro Opportunities",
        swap_opportunities_subline:
            "Earn sats or get a discount by swapping these pairs",
        pro_fee: "Pro Rate",
        regular_fee: "Regular Rate",
        swap_opportunities_accordion: "Pro Opportunities",
        no_opportunities_found: {
            text: "No Pro opportunities found at the moment. Please check again later.",
            telegram_bot_text_prefix: "For fee alerts, check out our ",
            telegram_bot_text_middle: " or ",
            telegram_bot_text_suffix: " bot.",
            telegram_bot: "Telegram",
            simplex: "SimpleX",
        },
        refresh_for_refund:
            "If you sent Bitcoin into this swap, refresh the page to check for a refund.",
        applied_routing_hint:
            "Your recipient supports receiving {{ asset }} directly. This saves you fees and they still get the full amount.",
        optimized_route_amount:
            "Swap route optimized, saving you ~{{ amount }} {{ denomination }}",
        claim: "Claim",
        claimed: "Swap has been claimed successfully!",
        rescue: "Rescue",
        rescue_swap: "Rescue Swap",
        claim_swap: "Claim: {{ id }}",
        failed_get_swap: "Could not get swap {{ id }}",
        failed_get_swap_subline:
            "Please re-insert the rescue key and try again.",
        in_progress: "In progress",
        completed: "Completed",
        get_refundable_error:
            "Failed to load UTXO data. Refresh to try again or check your internet connection if the problem persists.",
        min_amount_destination:
            "Minimum amount for the destination address is {{ amount }} {{ denomination }}",
        max_amount_destination:
            "Maximum amount for the destination address is {{ amount }} {{ denomination }}",
        destination: "Destination",
        destination_address: "{{ address }}",

        // Products page
        products: "Products",
        products_description:
            "A suite of products for seamless interoperability between Bitcoin layers",
        products_plugin_title: "Boltz BTCPay Plugin",
        products_plugin_description:
            "A non-custodial solution to easily accept Lightning payments without running a Lightning node",
        products_client_title: "Boltz Client",
        products_client_description:
            "Our enterprise-grade swap daemon for server integrations and liquidity management",
        products_pro_title: "Boltz Pro",
        products_pro_description:
            "A platform for earning sats non-custodially by providing just-in-time liquidity",
        learn_more: "Learn more",
        get_started: "Open Boltz Pro",
        documentation: "Documentation",
        view_on_github: "View on Github",
        chat_with_us: "Chat with us",

        // Plugin
        boltz_plugin_name: "Boltz BTCPay Plugin",
        boltz_plugin_description:
            "Non-custodial solution to easily accept Lightning payments",
        boltz_plugin_step_install_title: "Add the plugin",
        boltz_plugin_step_install_description:
            "Install the Boltz plugin on your BTCPay Server",
        boltz_plugin_step_setup_title: "Set up your wallet",
        boltz_plugin_step_setup_description:
            "Connect your external wallet or create a new one",
        boltz_plugin_step_paid_title: "Accept Lightning",
        boltz_plugin_step_paid_description:
            "Receive Lightning payments that auto-settle to mainchain Bitcoin",
        boltz_plugin_features_title: "Why use it?",
        boltz_plugin_features_description:
            "Built for merchants who want full control without complexity",
        boltz_plugin_feature_flexible_title: "Flexible",
        boltz_plugin_feature_flexible_description:
            "Accept Lightning payments without running a node or fully manage liquidity of an existing Lightning node",
        boltz_plugin_feature_liquid_title: "Powered by Liquid",
        boltz_plugin_feature_liquid_description:
            "Fully leverage the power of Liquid Taproot Swaps for low fees and increased privacy",
        boltz_plugin_feature_autoswap_title: "Settle on Bitcoin",
        boltz_plugin_feature_autoswap_description:
            "Autoswap to mainchain Bitcoin based on your preferences",
        boltz_plugin_feature_self_custodial_title: "Non-custodial",
        boltz_plugin_feature_self_custodial_description:
            "Stay in full control of your Bitcoin, powered by Boltz Atomic Swaps",

        boltz_plugin_questions_title: "Questions?",
        boltz_plugin_questions_subtitle: "We'd love to hear from you!",
        // Client
        boltz_client_name: "Boltz Client",
        boltz_client_description:
            "Enterprise-grade swap daemon for server integrations and liquidity management",
        boltz_client_features_title: "Built for Professionals",
        boltz_client_features_description:
            "Powerful features designed for professional Lightning node operators",
        boltz_client_feature_taproot_title: "Taproot-First",
        boltz_client_feature_taproot_description:
            "Leveraging Taproot Swaps for enhanced efficiency and privacy",
        boltz_client_node_agnostic_title: "Node Agnostic",
        boltz_client_node_agnostic_description:
            "First-class citizen support for CLN in addition to LND, giving you flexibility in your node infrastructure setup",
        boltz_client_autoswap_title: "Intelligent Autoswap",
        boltz_client_autoswap_description:
            "Fine-grained control for automated channel rebalancing with customizable thresholds, preferences, and smart settlement on Bitcoin",
        boltz_client_liquid_title: "Liquid-First",
        boltz_client_liquid_description:
            "Optimized for channel rebalancing using Liquid swaps for low fees and fast execution",
        boltz_client_cli_title: "Powerful API & CLI",
        boltz_client_cli_first_paragraph:
            "Built-in wallet system and comprehensive API for seamless integration into your infrastructure.",
        boltz_client_cli_second_paragraph:
            "Monitor, control, and automate everything from the command line or your own applications.",
        boltz_client_cta_title: "Ready to add Boltz to your infrastructure?",
        boltz_client_cta_subtitle:
            "Join enterprises and node runners trusting Boltz Client",

        // Pro
        boltz_pro_name: "Boltz Pro",
        boltz_pro_description: "A platform for earning sats non-custodially",
        boltz_pro_how_it_works_title: "How it works",
        boltz_pro_how_it_works_description:
            "You get paid for swapping in directions that help us rebalance our liquidity",
        boltz_pro_chart_title: "Boltz Pro Fee History Sample",
        boltz_pro_chart_y_axis: "Boltz Pro Fee",
        boltz_pro_chart_x_axis: "Date",
        boltz_pro_negative_fee: "You earn sats",
        boltz_pro_lower_fee: "You save sats",
        boltz_pro_regular_fee: "Regular Boltz Fee",
        boltz_pro_target_audience_title: "Who is Boltz Pro For?",
        boltz_pro_target_audience_subtitle:
            "Built for professionals seeking earn opportunities, not for everyday payments",
        boltz_pro_perfect_for_title: "Built For",
        boltz_pro_perfect_for_1:
            "Lightning node operators looking to decrease excess inbound liquidity to earn sats",
        boltz_pro_perfect_for_2:
            "Professionals collaborating with external node operators to manage liquidity",
        boltz_pro_perfect_for_3:
            "Users topping up Lightning wallets within routing limits",
        boltz_pro_not_designed_for_title: "Not Designed For",
        boltz_pro_not_designed_for_1:
            "Everyday Lightning payments, like buying a coffee",
        boltz_pro_not_designed_for_2:
            "Payment reliability to destinations with high routing fees",
        boltz_pro_not_designed_for_3:
            "Scenarios requiring guaranteed instant settlement",
        boltz_pro_cta_title: "Start earning sats now!",
        boltz_pro_cta_subtitle:
            "Head over to Boltz Pro and check out the latest earn opportunities",
        boltz_pro_options_title: "3 ways to use it",
        boltz_pro_options_subtitle: "Choose what fits you best",
        boltz_pro_option_client_title: "Boltz Client",
        boltz_pro_option_client_description:
            "Fully automate Boltz Pro via API & CLI",
        boltz_pro_option_web_title: "Web App",
        boltz_pro_option_web_description:
            "Monitor and execute swap opportunities via web",
        boltz_pro_option_chat_title: "Chat Bots",
        boltz_pro_option_chat_description_prefix: "Get instant alerts in",
        boltz_pro_option_chat_description_middle: "or",
        boltz_pro_option_chat_description_suffix: ".",

        balance: "Balance",
        display: "Display",
        security: "Security",
        failed: "Failed",
        swaps_found: "Scanning swaps ({{ count }} found)",
        claim_scan_required:
            "To claim this swap, go back and scan with your rescue file uploaded.",
        invalid_rescue_key_evm:
            "This rescue key is not associated with this swap. Please try again using a different rescue key.",
        error_occurred: "An error occurred: {{ error }}",

        rsk_rescue_prompt:
            'If you sent RBTC into a Boltz swap, use "Refund Swap"; if you were receiving RBTC, use "Resume Swap" to rescue a swap that is not available in this browser’s swap history.',
        rsk_rescue_refund_title: "Refund Swap",
        rsk_rescue_refund_explainer:
            "Connect your Rootstock wallet to scan for swaps that have expired and can be refunded.",
        rsk_rescue_resume_title: "Resume Swap",
        rsk_rescue_resume_explainer:
            "Use your rescue key to find pending swaps that can be resumed.",
        searching_resumable_swaps:
            "Searching for resumable swaps... {{ progress }}%",
        unmatched_swaps:
            "This wallet has {{ count }} additional claimable swaps. To access them, please switch to the Rescue Key used to initiate those swaps.",
        approve_erc20: "Approve",
        approve_erc20_line: "Set ERC20 allowance for the swap contract",
    },
    de: {
        language: "Deutsch",
        or: "oder",
        status: "Status",
        fast: "Schnell",
        l2: "Auf Layer-2 gebaut",
        l2_sub: "Boltz nutzt Layer-2 Skalierungstechnologien wie das Lightning-Netzwerk",
        assets_sub: "Bitcoin-Layer und Stablecoins",
        safe: "Sicher",
        non_custodial: "Non-Custodial",
        non_custodial_sub:
            "Swaps auf Boltz sind atomar, Kryptografie stellt sicher, dass Nutzer stets die Kontrolle über ihre Bitcoin behalten",
        node: "Lightning-Knoten",
        error: "Fehler",
        error_subline:
            "Ungültige Antwort von der API, irgendwas ist hier falsch gelaufen.",
        error_wasm: "WebAssembly nicht unterstützt",
        history: "Historie",
        swap: "Swap",
        refund: "Rückerstattung",
        partner: "Partner",
        support: "Hilfe",
        docs: "Docs",
        onion: "Onion",
        terms: "Nutzungsbedingungen",
        privacy: "Datenschutz",
        blockexplorer: "{{ typeLabel }} anzeigen",
        blockexplorer_lockup_address: "Lockupadresse",
        blockexplorer_lockup_tx: "Lockuptransaktion",
        blockexplorer_claim_tx: "Claimtransaktion",
        blockexplorer_refund_tx: "Rückerstattungstransaktion",
        help: "Hilfe",
        network_fee: "Netzwerkgebühr",
        fee: "Boltzgebühr",
        denomination: "Denominierung",
        send: "Sende",
        continue: "Weiter",
        receive: "Empfange",
        min: "Min",
        max: "Max",
        minimum_amount: "Mindestbetrag ist {{ amount }} {{ denomination }}",
        maximum_amount: "Höchstbetrag ist {{ amount }} {{ denomination }}",
        assets: "Multi-layer",
        footer: "Mit 🧡 gemacht von Team Boltz",
        create_swap: "Erstelle Atomic Swap",
        create_swap_subline: "Zahlung beinhaltet Netzwerk- und Boltzgebühr",
        get_gas_token_for_gas: "Erhalte {{ gasToken }} für Gas",
        new_swap: "Neuer Swap",
        feecheck:
            "Die Netzwerkgebühr wurde aufgrund der Netzwerksituation aktualisiert. Bitte bestätige die neuen Beträge und fahren mit dem Swap fort.",
        create_and_paste:
            "Füge eine Lightning-Rechnung, BOLT12 oder LNURL des Empfängers ein",
        congrats: "Herzlichen Glückwunsch!",
        successfully_swapped:
            "Du hast erfolgreich {{ amount }} {{ denomination }} empfangen!",
        timeout_eta: "Timeout-ETA",
        pay_invoice: "Swap: {{ id }}",
        pay_swap_404: "Swap nicht gefunden!",
        pay_timeout_blockheight: "Timeout Blockhöhe ({{ network }})",
        send_to: "Sende {{ amount }} {{ denomination }} an",
        send_between:
            "Sende zwischen {{ min }} und {{ max }} {{ denomination }} an",
        pay_invoice_to:
            "Zahle diese Rechnung über {{ amount }} {{ denomination }}",
        no_wallet: "Wallet ist nicht installiert",
        connect_wallet: "Wallet verbinden",
        please_connect_wallet: "Bitte Wallet verbinden",
        connect_to_address: "Mit Swap-Adresse verbinden",
        disconnect_address: "Wallet trennen",
        lockup_failed: "Lockup fehlgeschlagen!",
        failure_reason: "Grund für den Fehler",
        invoice_payment_failure:
            "Deine Lightning-Rechung konnte nicht bezahlt werden",
        onchain_address: "Gib eine {{ asset }} Empfangsadresse ein",
        onchain_address_no_asset: "Adresse",
        invalid_refund_file: "Ungültiger Rettungsschlüssel",
        invalid_backup_file: "Ungültige Backupdatei",
        invalid_invoice:
            "Bitte eine gültige Lightning-Rechnung, BOLT12 oder LNURL eingeben",
        invalid_0_amount: "Lightning-Rechnungen ohne Betrag nicht unterstützt",
        copy_invoice: "Lightning-Rechnung",
        copy_address: "Adresse",
        copy_amount: "Betrag",
        copy_bip21: "BIP21",
        refund_swap: "Swap Rückerstatten",
        rescue_a_swap_subline:
            "Lade deinen Rettungsschlüssel hoch oder gib ihn ein, um einen Swap zu retten, der nicht im Swap-Verlauf dieses Browsers verfügbar ist.",
        rescue_a_swap_mnemonic:
            "Gib deinen Rettungsschlüssel ein, um einen Swap zu retten, der nicht im Swap-Verlauf dieses Browsers verfügbar ist.",
        refund_past_swaps: "Historische Swaps",
        refund_past_swaps_subline:
            "Swaps, die in deinem Browser gespeichert wurden",
        no_rescuable_swaps:
            "Keine wiederherstellbaren Swaps im Browserverlauf gefunden",
        cant_find_swap: "Swap nicht gefunden?",
        rescue_external_explainer:
            "Versuche einen externen Swap über einen Rettungsschlüssel und andere Notfallmethoden wiederherszustellen.",
        refund_external_scanning_rsk:
            "Scanne nach wiederherstellbaren Swaps in Rootstock-Wallet...",
        connected_wallet_no_swaps:
            "Das verbundene Rootstock Wallet enthält keine wiederherstellbaren Swaps.",
        rescue_external_swap: "Externen Swap Retten",
        history_no_swaps:
            "Es sieht so aus, als hättest du noch nicht geswappt.",
        refund_address_header: "Adresse deines {{ asset }} Wallets eingeben",
        refund_address_header_no_asset: "Adresse deines Wallets eingeben",
        refund_backup: "Backup",
        refund_import: "Backup importieren",
        refund_clear: "Speicher löschen",
        delete_storage:
            "Bist du sicher, dass du deinen Speicher löschen möchtest?\nDeine Swap-Informationen und Rückerstattungsschlüssel gehen dabei verloren.",
        delete_storage_single_swap:
            "Bist du sicher, dass du den Swap {{ id }} aus deinem Speicher löschen möchtest?\nDeine Swap-Informationen und Rückerstattungsschlüssel gehen dabei verloren.",
        delete_logs: "Bist du sicher, dass du deine Logs löschen möchtest?",
        tx_in_mempool: "Transaktion befindet sich im Mempool.",
        tx_in_mempool_subline:
            "Warte auf Bestätigung, um den Swap abzuschließen.",
        tx_in_mempool_warning:
            "Seite nicht schließen, sonst kann Swap nicht abgeschlossen werden!",
        invoice_pending: "Transaktion erhalten, Rechnung wird bezahlt.",
        invoice_pending_pro:
            "Transaktion erhalten, Rechnung in Warteschlange. In manchen Fällen kann der Swap abgebrochen werden.",
        invoice_expired: "Rechnung ist abgelaufen, bitte erneut versuchen!",
        create_invoice_webln: "Rechnung über WebLN erstellen",
        pay_invoice_webln: "Rechnung über WebLN bezahlen",
        select_asset: "{{ direction }} - Asset auswählen",
        select_network: "Netzwerk auswählen",
        search: "Suchen",
        tx_confirmed: "Transaktion bestätigt!",
        tx_ready_to_claim: "Claime die Transaktion jetzt...",
        refunded: "Swap wurde erfolgreich erstattet!",
        locktime_not_satisfied: "Locktime-Anforderung nicht erfüllt.",
        already_refunded: "Swap wurde bereits erstattet!",
        api_offline: "API ist offline",
        api_offline_msg:
            "Konnte keine Verbindung zur Boltz API herstellen. Bitte versuche es später noch einmal.",
        refund_explainer:
            "Du kannst nach dem Timeout eine Rückerstattung beantragen!",
        wasm_not_supported: "Bitte aktiviere WebAssembly in deinem Browser!",
        created: "Erstellt",
        view: "Anzeigen",
        id: "ID",
        headline: "Non-Custodial Bitcoin Bridge",
        headline_pro: "Stacke Sats mit voller Kontrolle",
        subline:
            "Tausche zwischen verschiedenen Bitcoin-Layern und Stablecoins, während du immer die volle Kontrolle behältst.",
        subline_pro:
            "Verdiene Sats für Swaps, die uns helfen unsere Liquidität zu managen.",
        start_swapping: "Starte Swap",
        partners: "Partner",
        integrations: "Integrationen",
        oldest_channel_years: "{{ years }} Jahre",
        oldest_channel: "Ältester Kanal",
        capacity: "Kapazität ({{ denomination }})",
        peers: "Anzahl der Peers",
        num_channels: "Anzahl der Kanäle",
        beta_caution: "BETA - OBACHT!",
        pro: "pro",
        pro_banner: "Möchten Sie Boltz Pro über die API nutzen?",
        warning_return:
            "Kehre nach dem Bezahlen der Rechnung zu dieser Seite zurück! Die Zahlung wird möglicherweise als ausstehend angezeigt, bis du zu dieser Seite zurückkehrst.",
        warning_expiry:
            "Wichtig: Die Transaktion muss innerhalb ~24 Stunden nach Erstellung dieses Swaps bestätigt sein!",
        not_found: "404 - Not Found",
        not_found_subline: "Diese Seite scheint verschwunden zu sein.",
        back_to_home: "Zurück zur Startseite",
        transaction_prompt:
            '"{{ button }}" klicken um das verbundene Wallet zu öffnen und bestätige die angezeigte Transaktion.',
        transaction_prompt_receive:
            '"{{ button }}" klicken um das verbundene Wallet zu öffnen und bestätige die angezeigte Transaktion um {{ asset }} zu empfangen.',
        transaction_failed: "Transaktion fehlgeschlagen: {{ error }}",
        wallet_request_rejected:
            "Die Anfrage wurde in deinem Wallet abgelehnt.",
        invalid_address: "Ungültige {{ asset }} Adresse",
        scan_qr_code: "QR Code scannen",
        version: "Version",
        commithash: "Commit Hash",
        open_in_wallet: "Im Wallet öffnen",
        branding: "Branding",
        regtest: "Regtest",
        broadcasting_claim: "Sende claim transaction...",
        paste_invalid:
            "Zwischenablage enthält ungültige Zeichen oder der maximale Betrag wurde überschritten",
        email: "Email",
        switch_paste:
            "Swap-Richtung/Asset basierend auf eingefügtem Inhalt gewechselt",
        settings: "Einstellungen",
        decimal_separator: "Dezimaltrennzeichen",
        denomination_tooltip:
            "Wähle deine bevorzugte Denomination: BTC oder sats",
        decimal_tooltip:
            "Wähle dein bevorzugtes Dezimaltrennzeichen: Punkt oder Komma",
        show_fiat_rate: "USD-Kurs anzeigen",
        show_fiat_rate_tooltip: "Swap-Betrag in USD anzeigen",
        fiat_rate_not_available: "USD-Kurs nicht verfügbar",
        swap_completed: "Swap {{ id }} erfolgreich abgeschlossen!",
        claim_fail: "Swap {{ id }} konnte nicht geclaimed werden!",
        logs: "Logs",
        logs_tooltip: "Logs der Web App, nützlich für Debugging",
        hide_wallet_address: "Privatsphäre-Modus",
        hide_wallet_address_tooltip:
            "Blendet EVM Wallet-Adresse und Swap ID aus für besser Privatsphäre in Demos und Bildschirmaufnahmen",
        bitcoin_only: "Bitcoin-Only Modus",
        bitcoin_only_tooltip:
            "Nur Bitcoin und Lightning anzeigen, alle anderen Paare ausblenden",
        slippage: "Slippage",
        slippage_tooltip: "Maximale Slippage-Toleranz bei DEX-Swaps",
        gas_topup: "Auto Gas-Aufladung",
        gas_topup_tooltip:
            "Wandelt automatisch einen kleinen Teil deines Swaps in natives Gas um, wenn dein verbundenes Wallet kein Gas hat.",
        gas_topup_label: "Gas ({{ gasToken }}): 0.{{ cost }}",
        oft_messaging_fee_label: "OFT-Gebuehr",
        dex_quote_changed: "DEX-Kurs hat sich geändert",
        zero_conf: "Zero-Conf",
        zero_conf_tooltip:
            "Akzeptiere Transaktionen, die noch nicht in einem Block bestätigt sind",
        on: "an",
        off: "aus",
        invalid_pair: "Ungültiges Paar",
        error_starting_qr_scanner:
            "Konnte nicht auf Kamera zugreifen, bitte Berechtigungen überprüfen!",
        insufficient_balance: "Unzureichendes Guthaben",
        insufficient_balance_line:
            "Du hast nicht genügend Guthaben für diesen Swap.",
        select_wallet: "Wallet auswählen",
        select_derivation_path: "Ableitungspfad auswählen",
        submit_derivation_path: "Senden",
        not_supported_in_browser: "In diesem Browser nicht unterstützt",
        switch_network: "Netzwerk wechseln",
        block: "Block",
        logs_scan_progress: "Scan-Fortschritt {{ value }}%",
        accept: "Akzeptieren",
        wallet_connect_failed:
            "Verbindung zu Wallet fehlgeschlagen: {{ error }}",
        ledger_open_app_prompt: "Ethereum oder RSK app öffnen",
        validate_payment: "Proof of Payment anzeigen",
        no_browser_wallet: "Kein Browser Wallet gefunden",
        sent: "Gesendet",
        will_receive: "Du erhältst",
        refund_available_in: "Rückerstattung möglich in {{ blocks }} Blöcken",
        no_wallet_connected: "Kein Wallet verbunden",
        no_lockup_transaction: "Keine Lockup-Transaktion gefunden",
        routing_fee_limit: "Routing Gebühr Limit",
        download_boltz_rescue_key: "Boltz Rettungsschlüssel",
        download_boltz_rescue_key_subline:
            "Sichere deine Swaps mit einem einzigen Rettungsschlüssel 🙌",
        download_boltz_rescue_key_subline_second:
            "Dieser Schlüssel funktioniert auf jedem Gerät und ist für alle Swaps gültig, die mit ihm erstellt wurden. Speichere den Schlüssel an einem sicheren und dauerhaften Ort.",
        download_boltz_rescue_key_subline_third:
            "Um fortzufahren, lade einen neuen Rettungsschlüssel herunter.",
        download_new_key: "Neuen Schlüssel herunterladen",
        verify_boltz_rescue_key:
            "Existierenden Boltz Rettungsschlüssel verifizieren",
        verify_boltz_rescue_key_subline:
            "Bitte wähle den zuvor heruntergeladenen Boltz Rettungsschlüssel aus, um ihn zu verifizieren.",
        verify_key: "Schlüssel verifizieren",
        verify_key_failed:
            "Die Verifizierung des Boltz Rettungsschlüssels ist fehlgeschlagen. Wir empfehlen, einen neuen Rettungsschlüssel herunterzuladen.",
        rescue_key: "Rettungsschlüssel",
        reset_rescue_key_tooltip:
            "Generiere einen neuen Rettungsschlüssel und lösche alle Swap-Daten",
        reset_rescue_key_prompt:
            "⚠️ WARNUNG: Dies löscht ALLE deine Swap-Daten und generiert einen neuen Rettungsschlüssel.\n\nFahre nur fort, wenn du ein Backup deines aktuellen Rettungsschlüssels hast oder absolut sicher bist, dass du ihn nicht mehr benötigst.\n\nGib 'confirm' ein, um fortzufahren:",
        reset_rescue_key_invalid_confirmation:
            "Ungültige Bestätigung. Bitte gib 'confirm' ein, um fortzufahren.",
        reset_rescue_key_error:
            "Es ist ein Fehler beim Zurücksetzen des Rettungsschlüssels aufgetreten. Bitte versuche es erneut.\n\nFehler: {{ error }}",
        reset_rescue_key_success:
            "Neuer Rettungsschlüssel erfolgreich generiert!",
        no_swaps_found: "Keine Swaps gefunden",
        rif_extra_fee:
            "Wallet enthält nicht genug RBTC, Gebühr um RIF-Relay-Gebühr angepasst!",
        back: "Zurück",
        next: "Weiter",
        pagination_info: "Seite {{ start }} von {{ end }}",
        generate_key: "Neuen Schlüssel generieren",
        backup_boltz_rescue_key: "Boltz Rettungsschlüssel sichern",
        backup_boltz_rescue_key_subline_second:
            "Dieser neue Schlüssel funktioniert auf jedem Gerät und ist für alle Swaps gültig.",
        backup_boltz_rescue_key_subline_third:
            "Bitte schreibe diesen Schlüssel auf oder kopiere ihn und speichere ihn an einem sicheren und dauerhaften Ort.",
        backup_boltz_rescue_key_reminder:
            "Speichere diesen Schlüssel sicher ab. Teile ihn nicht.",
        copy_rescue_key: "Rettungsschlüssel kopieren",
        user_saved_key: "Ich habe den Rettungsschlüssel gespeichert",
        verify_mnemonic_word: {
            start: "Was ist das Wort auf ",
            strong: "Position {{ number }}",
            end: " deines Rettungsschlüssels?",
        },
        incorrect_word:
            "Wort inkorrekt. Bitte überprüfe deinen Rettungsschlüssel.",
        enter_mnemonic: "Rettungsschlüssel eingeben",
        verify_boltz_rescue_key_mnemonic:
            "Bitte gib deinen Rettungsschlüssel unten ein, um ihn zu importieren.",
        hint_paste_mnemonic:
            "Tipp: du kannst alle 12 Wörter gleichzeitig einfügen.",
        swap_opportunities: "Verfügbare Pro-Optionen",
        swap_opportunities_subline:
            "Verdiene Sats oder erhalte einen Rabatt für diese Paare",
        pro_fee: "Progebühr",
        regular_fee: "Normale Gebühr",
        swap_opportunities_accordion: "Pro-Optionen",
        no_opportunities_found: {
            text: "Aktuell keine Pro-Optionen verfügbar. Versuche es später noch einmal.",
            telegram_bot_text_prefix:
                "Für Benachrichtigungen über Progebührenupdates, nutze unseren ",
            telegram_bot_text_middle: " oder ",
            telegram_bot_text_suffix: " bot.",
            telegram_bot: "Telegram",
            simplex: "SimpleX",
        },
        refresh_for_refund:
            "Falls du Bitcoin in diesen Swap gesendet hast, aktualisiere die Seite um eine Rückerstattung zu prüfen.",
        applied_routing_hint:
            "Dein Empfänger unterstützt den direkten Empfang von {{ asset }}. So sparst du Gebühren und der Empfänger bekommt weiterhin den vollen Betrag.",
        optimized_route_amount:
            "Swap-Route optimiert, du sparst ~{{ amount }} {{ denomination }}",
        claim: "Claimen",
        claimed: "Swap wurde erfolgreich geclaimt!",
        rescue: "Retten",
        rescue_swap: "Swap retten",
        claim_swap: "Claim: {{ id }}",
        failed_get_swap: "Swap {{ id }} konnte nicht abgerufen werden",
        failed_get_swap_subline:
            "Bitte gebe den Rettungsschlüssel erneut ein und versuche es noch einmal.",
        in_progress: "In Bearbeitung",
        completed: "Abgeschlossen",
        get_refundable_error:
            "UTXO-Daten konnten nicht geladen werden. Aktualisiere die Seite um es erneut zu versuchen oder überprüfe deine Internetverbindung, falls das Problem weiterhin besteht.",
        min_amount_destination:
            "Mindestbetrag für die Zieladresse ist {{ amount }} {{ denomination }}",
        max_amount_destination:
            "Höchstbetrag für die Zieladresse ist {{ amount }} {{ denomination }}",
        destination: "Zieladresse",
        destination_address: "{{ address }}",

        // Products page
        products: "Produkte",
        products_description:
            "Eine Produktsuite für nahtlose Interoperabilität zwischen Bitcoin-Layern",
        products_plugin_title: "Boltz BTCPay Plugin",
        products_plugin_description:
            "Eine Lösung um Lightning-Zahlungen non-custodial und einfach zu akzeptieren",
        products_client_title: "Boltz Client",
        products_client_description:
            "Unsere Enterpriselösung für Serverintegrationen und Liquiditätsverwaltung",
        products_pro_title: "Boltz Pro",
        products_pro_description:
            "Eine Plattform, die es ermöglicht mit Swaps Sats zu verdienen",
        learn_more: "Mehr erfahren",
        get_started: "Öffne Boltz Pro",
        documentation: "Dokumentation",
        view_on_github: "Auf Github ansehen",
        chat_with_us: "Chatte mit uns",

        // Plugin
        boltz_plugin_name: "Boltz BTCPay Plugin",
        boltz_plugin_description:
            "Non-custodial Lösung für einfache Akzeptierung von Lightning-Zahlungen",
        boltz_plugin_step_install_title: "Plugin hinzufügen",
        boltz_plugin_step_install_description:
            "Installiere das Boltz Plugin auf deinem BTCPay Server",
        boltz_plugin_step_setup_title: "Wallet einrichten",
        boltz_plugin_step_setup_description:
            "Verbinde dein externes Wallet oder erstelle ein neues",
        boltz_plugin_step_paid_title: "Lightning akzeptieren",
        boltz_plugin_step_paid_description:
            "Empfange Lightning-Zahlungen und settle automatisch auf Bitcoin",
        boltz_plugin_features_title: "Was sind die Vorteile?",
        boltz_plugin_features_description:
            "Gebaut für Händler die volle Kontrolle ohne Komplexität wollen",
        boltz_plugin_feature_flexible_title: "Flexibel",
        boltz_plugin_feature_flexible_description:
            "Akzeptiere Lightning-Zahlungen non-custodial ohne einen Knoten zu betreiben oder verwalte die Liquidität eines bestehenden Lightning-Knotens",
        boltz_plugin_feature_liquid_title: "Powered by Liquid",
        boltz_plugin_feature_liquid_description:
            "Nutze die volle Power von Liquid Taproot Swaps für niedrige Gebühren und erhöhte Privatsphäre",
        boltz_plugin_feature_autoswap_title: "Settle auf Bitcoin",
        boltz_plugin_feature_autoswap_description:
            "Autoswap zu Bitcoin basierend auf deinen Präferenzen",
        boltz_plugin_feature_self_custodial_title: "Non-custodial",
        boltz_plugin_feature_self_custodial_description:
            "Behalte jederzeit die volle Kontrolle über deine Bitcoin, powered by Boltz Atomic Swaps",
        boltz_plugin_questions_title: "Fragen?",
        boltz_plugin_questions_subtitle: "Wir würden gerne von dir hören!",
        // Client
        boltz_client_name: "Boltz Client",
        boltz_client_description:
            "Enterprise-Grade Swap-Daemon für Serverintegrationen und Liquiditätsverwaltung",
        boltz_client_features_title: "Gebaut für Unternehmen und Profis",
        boltz_client_features_description:
            "Leistungsstarke Features für professionelle Lightning-Knoten-Betreiber",
        boltz_client_feature_taproot_title: "Taproot-First",
        boltz_client_feature_taproot_description:
            "Nutzt Taproot Swaps für erhöhte Effizienz und Privatsphäre",
        boltz_client_node_agnostic_title: "Knoten-Agnostisch",
        boltz_client_node_agnostic_description:
            "Erstklassige Unterstützung für CLN zusätzlich zu LND, gibt dir Flexibilität in deiner Infrastruktur",
        boltz_client_autoswap_title: "Intelligenter Autoswap",
        boltz_client_autoswap_description:
            "Granulare Kontrolle für automatisches Channel-Rebalancing mit anpassbaren Einstellungen und intelligentem Settlement auf Bitcoin",
        boltz_client_liquid_title: "Liquid-First",
        boltz_client_liquid_description:
            "Optimiert für Channel-Rebalancing mit Liquid-Swaps für niedrige Gebühren, schnelle Ausführung und erhöhte Privatsphäre",
        boltz_client_cli_title: "Leistungsstarke API & CLI",
        boltz_client_cli_first_paragraph:
            "Integriertes Wallet-System und umfassende API für nahtlose Integration in deine Infrastruktur.",
        boltz_client_cli_second_paragraph:
            "Überwache, steuere und automatisiere mit deinen eigenen Anwendungen oder via CLI.",
        boltz_client_cta_title: "Füge Boltz deiner Infrastruktur hinzu!",
        boltz_client_cta_subtitle:
            "Werde Teil der Community von Unternehmen und Node-Betreibern, die Boltz Client benutzen",

        // Pro
        boltz_pro_name: "Boltz Pro",
        boltz_pro_description:
            "Eine Plattform, die es ermöglicht mit Swaps Sats zu verdienen",
        boltz_pro_how_it_works_title: "Wie es funktioniert",
        boltz_pro_how_it_works_description:
            "Du wirst bezahlt für Swaps in Richtungen die uns helfen unsere Liquidität auszugleichen",
        boltz_pro_chart_title: "Boltz Pro Gebührenverlauf Beispiel",
        boltz_pro_chart_y_axis: "Boltz Pro Gebühr",
        boltz_pro_chart_x_axis: "Datum",
        boltz_pro_negative_fee: "Du verdienst Sats",
        boltz_pro_lower_fee: "Du sparst Sats",
        boltz_pro_regular_fee: "Normale Boltz Gebühr",
        boltz_pro_target_audience_title: "Für wen ist Boltz Pro?",
        boltz_pro_target_audience_subtitle:
            "Gebaut für Profis die Sats verdienen wollen, nicht für alltägliche Zahlungen",
        boltz_pro_perfect_for_title: "Gebaut für",
        boltz_pro_perfect_for_1:
            "Lightning-Knoten-Betreiber die überschüssige Inbound-Liquidität reduzieren wollen um Sats zu verdienen",
        boltz_pro_perfect_for_2:
            "Profis die mit externen Knoten-Betreibern zusammenarbeiten um Liquidität zu verwalten",
        boltz_pro_perfect_for_3:
            "Nutzer die Lightning-Wallets innerhalb von Boltz Pro Routing-Limits aufladen wollen",
        boltz_pro_not_designed_for_title: "Nicht geeignet für",
        boltz_pro_not_designed_for_1:
            "Zahlung mit Lightning im Alltag, wie z.B. im Café",
        boltz_pro_not_designed_for_2:
            "Zuverlässige Zahlungen an Ziele mit hohen Routing-Gebühren",
        boltz_pro_not_designed_for_3:
            "Szenarien die garantierte sofortige Zahlungsausführung erfordern",
        boltz_pro_cta_title: "Fange jetzt an Sats zu verdienen!",
        boltz_pro_cta_subtitle:
            "Schaue dir die aktuellen Möglichkeiten Sats zu verdienen an",
        boltz_pro_options_title: "3 Wege Boltz Pro zu nutzen",
        boltz_pro_options_subtitle: "Wähle was am besten zu dir passt",
        boltz_pro_option_client_title: "Boltz Client",
        boltz_pro_option_client_description:
            "Automatisiere Boltz Pro vollständig mit API & CLI",
        boltz_pro_option_web_title: "Web App",
        boltz_pro_option_web_description:
            "Beobachte und swappe mit unserer Boltz Pro Web App",
        boltz_pro_option_chat_title: "Chat-Bots",
        boltz_pro_option_chat_description_prefix:
            "Erhalte Benachrichtigungen in",
        boltz_pro_option_chat_description_middle: "oder",
        boltz_pro_option_chat_description_suffix: ".",

        balance: "Guthaben",
        display: "Anzeige",
        security: "Sicherheit",
        failed: "Fehlgeschlagen",
        swaps_found: "Scanne Swaps ({{ count }} gefunden)",
        claim_scan_required:
            "Um diesen Swap zu claimen, gehe zurück und scanne mit hochgeladener Rescue-Datei.",
        invalid_rescue_key_evm:
            "Dieser Rettungsschlüssel ist nicht mit diesem Swap verbunden. Bitte versuche es erneut mit einem anderen Rettungsschlüssel.",
        error_occurred: "Ein Fehler ist aufgetreten: {{ error }}",
        rsk_rescue_prompt:
            'Wenn du RBTC in einen Boltz-Swap gesendet hast, nutze "Swap erstatten"; wenn du RBTC empfangen hast, nutze "Swap fortsetzen", um einen Swap zu retten, der nicht im Verlauf dieses Browsers verfügbar ist.',
        rsk_rescue_refund_title: "Swap erstatten",
        rsk_rescue_refund_explainer:
            "Verbinde dein Rootstock-Wallet, um nach Swaps zu suchen, die abgelaufen sind und erstattet werden können.",
        rsk_rescue_resume_title: "Swap fortsetzen",
        rsk_rescue_resume_explainer:
            "Nutze deinen Rettungsschlüssel, um ausstehende Swaps zu finden, die fortgesetzt werden können.",
        searching_resumable_swaps:
            "Suche nach fortsetzbaren Swaps... {{ progress }}%",
        unmatched_swaps:
            "Dieses Wallet hat {{ count }} zusätzliche claimbare Swaps. Um darauf zuzugreifen, wechsle bitte zu dem Rettungsschlüssel, mit dem diese Swaps gestartet wurden.",
        approve_erc20: "Freigeben",
        approve_erc20_line: "ERC20-Freigabe für den Swap-Contract festlegen",
    },
    es: {
        language: "Español",
        or: "o",
        status: "Estado",
        fast: "Rápido",
        l2: "Construido en la Capa 2",
        l2_sub: "Boltz utiliza tecnologías de segunda capa como la red de Lightning",
        assets_sub: "Capas de Bitcoin y Stablecoins",
        safe: "Seguro",
        non_custodial: "Sin Custodia",
        non_custodial_sub:
            "Los intercambios en Boltz son atomicos, la criptografía garantiza que los usuarios siempre tienen el control de su Bitcoin",
        node: "Nodos de Lightning",
        error: "Error",
        error_subline: "Respuesta inválida de la API, algo está mal :/",
        error_wasm: "WebAssembly no soportado",
        history: "Historia",
        swap: "Intercambio",
        refund: "Reembolso",
        partner: "Socio",
        support: "Ayuda",
        docs: "Docs",
        onion: "Onion",
        terms: "Términos",
        privacy: "Privacidad",
        blockexplorer: "Ver en {{ typeLabel }}",
        blockexplorer_lockup_address: "Dirección Lockup",
        blockexplorer_lockup_tx: "Transacción de Lockup",
        blockexplorer_claim_tx: "Transacción de Reclamación",
        blockexplorer_refund_tx: "Transacción de Reembolso",
        help: "Ayuda",
        network_fee: "Comisión de red",
        fee: "Comisión de Boltz",
        denomination: "Denominación",
        send: "Enviar",
        continue: "Continuar",
        receive: "Recibir",
        min: "Mín",
        max: "Máx",
        minimum_amount: "La cantidad mínima es {{ amount }} {{ denomination }}",
        maximum_amount: "La cantidad máxima es {{ amount }} {{ denomination }}",
        assets: "Multicapa",
        footer: "Hecho con 🧡 por el equipo de Boltz",
        create_swap: "Crear intercambio atómico",
        create_swap_subline:
            "El pago incluye la comisión de red y servicio de Boltz",
        get_gas_token_for_gas: "Obtén {{ gasToken }} para gas",
        new_swap: "Nuevo intercambio",
        feecheck:
            "La comisión de red se actualizó según la situación de la red. Por favor, confirma los nuevos importes y continúa con el intercambio.",
        create_and_paste:
            "Pega una factura Lightning, una dirección BOLT12 o una LNURL para recibir los fondos",
        congrats: "¡Felicitaciones!",
        successfully_swapped:
            "Has recibido con éxito {{ amount }} {{ denomination }}!",
        timeout_eta: "Tiempo de espera estimado",
        pay_invoice: "Intercambio: {{ id }}",
        pay_swap_404: "¡Intercambio no encontrado!",
        pay_timeout_blockheight:
            "Altura del bloque de tiempo de espera ({{ network }})",
        send_to: "Enviar {{ amount }} {{ denomination }} a",
        send_between: "Enviar entre {{ min }} y {{ max }} {{ denomination }} a",
        pay_invoice_to: "Pague esta factura de {{ amount }} {{ denomination }}",
        no_wallet: "Monedero no está instalado",
        connect_wallet: "Conectar monedero",
        please_connect_wallet: "Por favor, conecte monedero",
        connect_to_address: "Conectar con dirección de intercambio",
        disconnect_address: "Desconectar monedero",
        lockup_failed: "Fallo en el lockup",
        failure_reason: "Motivo del fallo",
        invoice_payment_failure: "No se pudo pagar tu factura Lightning",
        onchain_address:
            "Ingrese una dirección {{ asset }} para recibir los fondos",
        onchain_address_no_asset: "Ingrese la dirección",
        invalid_refund_file: "'Clave de rescate no válido",
        invalid_backup_file: "Archivo de backup no válido",
        invalid_invoice:
            "Por favor, pegue una factura Lightning, BOLT12 o LNURL válida",
        invalid_0_amount: "No se admiten facturas sin importe",
        copy_invoice: "factura Lightning",
        copy_address: "dirección",
        copy_amount: "importe",
        copy_bip21: "BIP21",
        refund_swap: "Reembolsar Intercambio",
        rescue_a_swap_subline:
            "Si enviaste BTC o L-BTC a un intercambio Boltz, carga o introduce tu clave de rescate para rescatar un swap que no esté disponible en el historial de swaps de este navegador",
        rescue_a_swap_mnemonic:
            "Introduce tu clave de rescate para rescatar un intercambio que no está disponible en el historial de este navegador.",
        refund_past_swaps: "Intercambios anteriores",
        refund_past_swaps_subline:
            "Intercambios que se guardaron en el almacenamiento del navegador",
        no_rescuable_swaps:
            "No se han encontrado intercambios rescatables en el historial de tu navegador",
        cant_find_swap: "¿No encuentras tu intercambio?",
        rescue_external_explainer:
            "Intenta rescatar un intercambio externo mediante una clave de rescate y otros métodos de emergencia.",
        refund_external_scanning_rsk:
            "Escaneando en busca de intercambios rescatables en tu monedero Rootstock...",
        connected_wallet_no_swaps:
            "El monedero Rootstock conectado no contiene ningún intercambio rescatable.",
        rescue_external_swap: "Rescatar Intercambio Externo",
        history_no_swaps: "Parece que aún no has realizado ningún intercambio.",
        refund_address_header:
            "Introduce la dirección de tu monedero {{ asset }} para reembolsar",
        refund_address_header_no_asset:
            "Introduce la dirección de tu monedero para reembolsar",
        refund_backup: "Backup",
        refund_import: "Importar Backup",
        refund_clear: "Borrar almacenamiento",
        delete_storage:
            "¿Estás seguro de que deseas borrar tu almacenamiento?\nSe perderán la información de tu intercambio y tus claves de reembolso.",
        delete_storage_single_swap:
            "¿Estás seguro de que deseas borrar el intercambio {{ id }} de tu almacenamiento?\nSe perderán la información de tu intercambio y tus claves privadas de reembolso.",
        delete_logs: "¿Estás seguro de que deseas borrar tus registros?",
        tx_in_mempool: "La transacción está en el mempool.",
        tx_in_mempool_subline:
            "Esperando confirmación para completar el intercambio.",
        tx_in_mempool_warning:
            "Mantenga la página abierta, o el intercambio no se completará!",
        invoice_pending: "Transacción recibida, pagando la factura...",
        invoice_pending_pro:
            "Transacción recibida, factura en cola. En algunas ocasiones, el intercambio podría ser cancelado.",
        invoice_expired: "La factura ha expirado, ¡intente nuevamente!",
        create_invoice_webln: "Crear factura a través de WebLN",
        pay_invoice_webln: "Pagar factura a través de WebLN",
        select_asset: "Seleccionar activo de {{ direction }}",
        select_network: "Seleccionar red",
        search: "Buscar",
        tx_confirmed: "Transacción confirmada!",
        tx_ready_to_claim: "Reclamando la transacción ahora...",
        refunded: "El intercambio ha sido reembolsado!",
        locktime_not_satisfied:
            "No se cumple el requisito de tiempo de bloqueo!",
        already_refunded: "El intercambio ya ha sido reembolsado!",
        api_offline: "API está offline!",
        api_offline_msg:
            "No se pudo conectar a la API de Boltz, por favor inténtelo de nuevo más tarde!",
        refund_explainer:
            "Podrás solicitar un reembolso después del tiempo de espera!",
        wasm_not_supported: "Por favor, activa WebAssembly en tu navegador!",
        created: "Creado",
        view: "Ver",
        id: "ID",
        headline: "Bitcoin Bridge Sin Custodia",
        headline_pro: "Apilar Sats Con Autocustodia",
        subline:
            "Intercambia entre diferentes capas de Bitcoin y Stablecoins mientras mantienes el control total.",
        subline_pro:
            "Gana sats por intercambiar Bitcoin en direcciones que ayudan a equilibrar nuestra liquidez.",
        start_swapping: "Comenzar a intercambiar",
        partners: "Socios",
        integrations: "Integraciones",
        oldest_channel_years: "{{ years }} años",
        oldest_channel: "Canal más antiguo",
        capacity: "Capacidad ({{ denomination }})",
        peers: "Número de peers",
        num_channels: "Número de canales",
        beta_caution: "BETA - ¡ÚSALO CON PRECAUCIÓN!",
        pro: "pro",
        pro_banner: "¿Quieres usar Boltz Pro a través de la API?",
        warning_return:
            "Regresa a esta página después de pagar la factura! El pago puede aparecer como pendiente hasta que vuelvas a esta página.",
        warning_expiry:
            "Importante: Asegúrate de que la transacción se confirme en ~24 horas",
        not_found: "404 - Not Found",
        not_found_subline: "Esta página parece haber desaparecido.",
        back_to_home: "Volver al inicio",
        transaction_prompt:
            'Pulse "{{ button }}" para abrir tu monedero conectado y confirmar la transacción mostrada.',
        transaction_prompt_receive:
            'Pulse "{{ button }}" para abrir tu monedero conectado y confirmar la transacción mostrada para recibir {{ asset }}.',
        transaction_failed: "Transacción fallida: {{ error }}",
        wallet_request_rejected: "La solicitud fue rechazada en tu monedero.",
        invalid_address: "Dirección {{ asset }} inválida",
        scan_qr_code: "Escanear código QR",
        version: "Versión",
        commithash: "Commit Hash",
        open_in_wallet: "Abrir en monedero",
        branding: "Branding",
        regtest: "Regtest",
        broadcasting_claim: "Enviando transacción de reclamación...",
        paste_invalid:
            "El portapapeles contiene caracteres no válidos o se ha excedido el importe máximo",
        email: "Email",
        switch_paste:
            "Cambiado de dirección/activo de intercambio basado en el contenido pegado",
        settings: "Ajustes",
        decimal_separator: "Separador decimal",
        denomination_tooltip: "Elige tu denominación preferida: BTC o sats",
        decimal_tooltip: "Elige tu separador decimal preferido: punto o coma",
        show_fiat_rate: "Mostrar tasa en USD",
        show_fiat_rate_tooltip:
            "Mostrar el equivalente en USD del monto del intercambio",
        fiat_rate_not_available: "Tasa en USD no disponible",
        swap_completed: "¡Intercambio {{ id }} completado con éxito!",
        claim_fail: "¡Error en reclamar el intercambio {{ id }}!",
        logs: "Logs",
        logs_tooltip:
            "Registros de la aplicación web como herramienta de depuración",
        hide_wallet_address: "Modo de Privacidad",
        hide_wallet_address_tooltip:
            "Oculta la dirección del monedero EVM y el ID de Swap para privacidad en demos y grabaciones",
        bitcoin_only: "Modo Bitcoin-Only",
        bitcoin_only_tooltip:
            "Mostrar solo Bitcoin y Lightning, ocultando todos los demás pares",
        slippage: "Slippage",
        slippage_tooltip: "Tolerancia máxima de slippage para swaps en DEX",
        gas_topup: "Recarga automática de gas",
        gas_topup_tooltip:
            "Convierte automáticamente una pequeña parte de tu swap en gas nativo si tu monedero conectado no tiene gas.",
        gas_topup_label: "Gas ({{ gasToken }}): 0.{{ cost }}",
        oft_messaging_fee_label: "Tarifa OFT",
        dex_quote_changed: "La cotización de DEX ha cambiado",
        zero_conf: "Zero-Conf",
        zero_conf_tooltip:
            "Aceptar transacciones que aún no están confirmadas en un bloque",
        on: "on",
        off: "off",
        invalid_pair: "Par no válido",
        error_starting_qr_scanner:
            "No se pudo acceder a la cámara, por favor comprueba los permisos!",
        insufficient_balance: "Saldo insuficiente",
        insufficient_balance_line:
            "No tienes saldo suficiente en tu monedero para este swap.",
        select_wallet: "Seleccionar monedero",
        select_derivation_path: "Seleccionar ruta de derivación",
        submit_derivation_path: "Enviar",
        not_supported_in_browser: "No compatible con este navegador",
        switch_network: "Cambiar red",
        block: "bloque",
        logs_scan_progress: "Progreso del escaneo {{ value }}%",
        accept: "Aceptar",
        wallet_connect_failed: "Fallo en la conexión del monedero: {{ error }}",
        ledger_open_app_prompt: "Abrir aplicación Ethereum o RSK",
        validate_payment: "Mostrar justificante de pago",
        no_browser_wallet: "No se detectó monedero en el navegador",
        sent: "Enviado",
        will_receive: "Recibirá",
        refund_available_in: "Reembolso disponible en {{ blocks }} bloques",
        no_wallet_connected: "No hay monedero conectado",
        no_lockup_transaction: "No se encontró ninguna transacción de lockup",
        routing_fee_limit: "Límite comisión enrutamiento",
        download_boltz_rescue_key: "Clave de rescate Boltz",
        download_boltz_rescue_key_subline:
            "Haz una copia de seguridad de todos tus intercambios con una única clave de rescate 🙌",
        download_boltz_rescue_key_subline_second:
            "Esta clave funciona en cualquier dispositivo y sirve para todos los intercambios creados con ella. Guarda la clave en un lugar seguro y permanente.",
        download_boltz_rescue_key_subline_third:
            "Para continuar, descarga una nueva clave de rescate.",
        download_new_key: "Descargar nueva clave",
        verify_boltz_rescue_key: "Verificar clave de rescate existente",
        verify_boltz_rescue_key_subline:
            "Por favor, selecciona tu clave de rescate Boltz previamente guardada para verificar su validez.",
        verify_key: "Verificar clave",
        verify_key_failed:
            "La verificación de la clave de rescate Boltz ha fallado. Recomendamos descargar una nueva clave para continuar.",
        rescue_key: "Clave de Rescate Boltz",
        reset_rescue_key_tooltip:
            "Generar una nueva clave de rescate y borrar todos los datos de intercambios históricos",
        reset_rescue_key_prompt:
            "⚠️ ADVERTENCIA: Esto eliminará TODOS tus datos de intercambios y generará una nueva clave de rescate.\n\nNo continúes a menos que tengas una copia de seguridad de tu clave de rescate existente o estés absolutamente seguro de que no la necesitarás.\n\nEscribe 'confirm' para continuar:",
        reset_rescue_key_invalid_confirmation:
            "Confirmación no válida. Por favor, escribe 'confirm' para continuar.",
        reset_rescue_key_error:
            "Ocurrió un error al restablecer la clave de rescate. Por favor, intente de nuevo.\n\nError: {{ error }}",
        reset_rescue_key_success: "¡Nueva clave de rescate generada con éxito!",
        no_swaps_found: "No se encontraron intercambios",
        rif_extra_fee:
            "El monedero no contiene suficientes RBTC, comisión ajustada para incluir comisión de RIF Relay!",
        back: "Atrás",
        next: "Siguiente",
        pagination_info: "Página {{ start }} de {{ end }}",
        generate_key: "Generar nueva clave",
        backup_boltz_rescue_key: "Backup clave de rescate Boltz",
        backup_boltz_rescue_key_subline_second:
            "Esta nueva clave funciona en cualquier dispositivo y funciona para todas las transacciones creadas con ella.",
        backup_boltz_rescue_key_subline_third:
            "Por favor, escriba o copie esta clave y almacénela en un lugar seguro y permanente.",
        backup_boltz_rescue_key_reminder:
            "Guarde esta clave con seguridad. No comparta.",
        copy_rescue_key: "Copiar clave de rescate",
        user_saved_key: "He guardado la clave de rescate",
        verify_mnemonic_word: {
            start: "¿Cuál es la palabra en ",
            strong: "la posición {{ number }}",
            end: " de tu clave de rescate?",
        },
        incorrect_word:
            "Palabra incorrecta. Por favor, verifica tu clave de rescate.",
        enter_mnemonic: "Ingrese clave de rescate",
        verify_boltz_rescue_key_mnemonic:
            "Por favor, ingresa tu clave de rescate a continuación para importarla.",
        hint_paste_mnemonic:
            "Consejo: puedes pegar todas las 12 palabras a la vez.",
        swap_opportunities: "Oportunidades Pro Disponibles",
        swap_opportunities_subline:
            "Gana sats o recibe descuentos intercambiando estos pares",
        pro_fee: "Comisión Pro",
        regular_fee: "Comisión Estándar",
        swap_opportunities_accordion: "Oportunidades Pro",
        no_opportunities_found: {
            text: "No hay oportunidades Pro disponibles. Por favor, revisa más tarde.",
            telegram_bot_text_prefix:
                "Para alertas de comisiones, consulta nuestro bot en ",
            telegram_bot_text_middle: " o ",
            telegram_bot_text_suffix: ".",
            telegram_bot: "Telegram",
            simplex: "SimpleX",
        },
        refresh_for_refund:
            "Si has enviado Bitcoin a este intercambio, actualiza la página para comprobar si hay un reembolso disponible.",
        applied_routing_hint:
            "Tu destinatario admite recibir {{ asset }} directamente. Así te ahorras comisiones y ellos siguen recibiendo el importe íntegro.",
        optimized_route_amount:
            "Ruta de intercambio optimizada, ahorrándote ~{{ amount }} {{ denomination }}",
        claim: "Reclamar",
        claimed: "¡El intercambio ha sido reclamado exitosamente!",
        rescue: "Rescatar",
        rescue_swap: "Rescatar Intercambio",
        claim_swap: "Reclamar: {{ id }}",
        failed_get_swap: "No se pudo obtener el intercambio {{ id }}",
        failed_get_swap_subline:
            "Por favor, vuelve a introducir la clave de rescate e inténtalo de nuevo.",
        in_progress: "En progreso",
        completed: "Completado",
        get_refundable_error:
            "No se pudieron cargar los datos de UTXO. Actualiza la página para volver a intentarlo o verifica tu conexión a Internet si el problema persiste.",
        min_amount_destination:
            "La cantidad mínima para la dirección de destino es {{ amount }} {{ denomination }}",
        max_amount_destination:
            "La cantidad máxima para la dirección de destino es {{ amount }} {{ denomination }}",
        destination: "Destino",
        destination_address: "{{ address }}",

        // Products page
        products: "Productos",
        products_description:
            "Una suite de productos para interoperabilidad perfecta entre las capas de Bitcoin",
        products_plugin_title: "Plugin Boltz BTCPay",
        products_plugin_description:
            "Una solución sin custodia para aceptar fácilmente pagos Lightning sin ejecutar un nodo Lightning",
        products_client_title: "Cliente Boltz",
        products_client_description:
            "Daemon de intercambios empresarial para integraciones y gestión de liquidez",
        products_pro_title: "Boltz Pro",
        products_pro_description:
            "Una plataforma que permite ganar sats con intercambios",
        learn_more: "Aprende más",
        get_started: "Abrir Boltz Pro",
        documentation: "Documentación",
        view_on_github: "Ver en Github",
        chat_with_us: "Chatea con nosotros",

        // Plugin
        boltz_plugin_name: "Plugin Boltz BTCPay",
        boltz_plugin_description:
            "Solución sin custodia para aceptar fácilmente pagos Lightning",
        boltz_plugin_step_install_title: "Agregar el plugin",
        boltz_plugin_step_install_description:
            "Instala el plugin Boltz en tu servidor BTCPay",
        boltz_plugin_step_setup_title: "Configurar tu monedero",
        boltz_plugin_step_setup_description:
            "Conecta tu monedero externo o crea uno nuevo",
        boltz_plugin_step_paid_title: "Aceptar Lightning",
        boltz_plugin_step_paid_description:
            "Recibe pagos Lightning con liquidación automática en Bitcoin",
        boltz_plugin_features_title: "¿Por qué usarlo?",
        boltz_plugin_features_description:
            "Construido para comerciantes que quieren control sin complejidad",
        boltz_plugin_feature_flexible_title: "Flexible",
        boltz_plugin_feature_flexible_description:
            "Acepta pagos Lightning sin ejecutar un nodo o gestiona completamente la liquidez de un nodo Lightning existente",
        boltz_plugin_feature_liquid_title: "Impulsado por Liquid",
        boltz_plugin_feature_liquid_description:
            "Aprovecha el poder de los Liquid Taproot Swaps para comisiones bajas y mayor privacidad",
        boltz_plugin_feature_autoswap_title: "Liquidar en Bitcoin",
        boltz_plugin_feature_autoswap_description:
            "Autoswap a Bitcoin mainchain basado en tus preferencias",
        boltz_plugin_feature_self_custodial_title: "Sin custodia",
        boltz_plugin_feature_self_custodial_description:
            "Mantén el control total de tus Bitcoin, impulsado por Boltz Atomic Swaps",

        boltz_plugin_questions_title: "¿Preguntas?",
        boltz_plugin_questions_subtitle: "¡Nos encantaría escucharte!",
        // Client
        boltz_client_name: "Cliente Boltz",
        boltz_client_description:
            "Daemon de intercambios empresarial para integraciones y gestión de liquidez",
        boltz_client_features_title: "Construido para Empresas y Profesionales",
        boltz_client_features_description:
            "Características potentes diseñadas para operadores profesionales de nodos Lightning",
        boltz_client_feature_taproot_title: "Taproot-First",
        boltz_client_feature_taproot_description:
            "Aprovecha los Taproot Swaps para mayor eficiencia y privacidad",
        boltz_client_node_agnostic_title: "Agnóstico de Nodo",
        boltz_client_node_agnostic_description:
            "Soporte de primera clase para CLN además de LND, dándote flexibilidad en tu infraestructura",
        boltz_client_autoswap_title: "Autoswap Inteligente",
        boltz_client_autoswap_description:
            "Control granular para el reequilibrio automático de canales con configuraciones personalizables y liquidación inteligente en Bitcoin",
        boltz_client_liquid_title: "Liquid-First",
        boltz_client_liquid_description:
            "Optimizado para el reequilibrio de canales usando intercambios Liquid para comisiones bajas, ejecución rápida y mayor privacidad",
        boltz_client_cli_title: "API y CLI Potentes",
        boltz_client_cli_first_paragraph:
            "Sistema de monedero integrado y API completa para una integración perfecta en tu infraestructura.",
        boltz_client_cli_second_paragraph:
            "Monitorea, controla y automatiza con tus propias aplicaciones o a través de la CLI.",
        boltz_client_cta_title: "¡Agrega Boltz a tu infraestructura!",
        boltz_client_cta_subtitle:
            "Únete a la comunidad de empresas y operadores de nodos que usan Boltz Client",

        // Pro
        boltz_pro_name: "Boltz Pro",
        boltz_pro_description:
            "Una plataforma que permite ganar sats con intercambios atómicos",
        boltz_pro_how_it_works_title: "Cómo funciona",
        boltz_pro_how_it_works_description:
            "Te pagamos por hacer intercambios en direcciones que nos ayudan a reequilibrar nuestra liquidez",
        boltz_pro_chart_title: "Muestra del Historial de comisiones Boltz Pro",
        boltz_pro_chart_y_axis: "Comisión Boltz Pro",
        boltz_pro_chart_x_axis: "Fecha",
        boltz_pro_negative_fee: "Ganas sats",
        boltz_pro_lower_fee: "Ahorras sats",
        boltz_pro_regular_fee: "Comisión Regular de Boltz",
        boltz_pro_target_audience_title: "¿Para quién es Boltz Pro?",
        boltz_pro_target_audience_subtitle:
            "Construido para profesionales que quieren ganar sats, no para pagos cotidianos",
        boltz_pro_perfect_for_title: "Construido Para",
        boltz_pro_perfect_for_1:
            "Operadores de nodos Lightning que buscan reducir el exceso de liquidez entrante para ganar sats",
        boltz_pro_perfect_for_2:
            "Profesionales que colaboran con operadores de nodos externos para gestionar liquidez",
        boltz_pro_perfect_for_3:
            "Usuarios que recargan monederos Lightning dentro de los límites de enrutamiento de Boltz Pro",
        boltz_pro_not_designed_for_title: "No Adecuado Para",
        boltz_pro_not_designed_for_1:
            "Pagos Lightning cotidianos, como comprar un café",
        boltz_pro_not_designed_for_2:
            "Pagos confiables a destinos con altas comisiones de enrutamiento",
        boltz_pro_not_designed_for_3:
            "Escenarios que requieren ejecución de pago instantánea garantizada",
        boltz_pro_cta_title: "¡Comienza a ganar sats ahora!",
        boltz_pro_cta_subtitle:
            "Descubre las oportunidades actuales para ganar sats",
        boltz_pro_options_title: "3 formas de usar Boltz Pro",
        boltz_pro_options_subtitle: "Elige lo que mejor te convenga",
        boltz_pro_option_client_title: "Cliente Boltz",
        boltz_pro_option_client_description:
            "Automatiza Boltz Pro completamente con API y CLI",
        boltz_pro_option_web_title: "Aplicación Web",
        boltz_pro_option_web_description:
            "Observa y ejecuta intercambios con nuestra aplicación web",
        boltz_pro_option_chat_title: "Bots de chat",
        boltz_pro_option_chat_description_prefix:
            "Recibe alertas instantáneas en",
        boltz_pro_option_chat_description_middle: "o",
        boltz_pro_option_chat_description_suffix: ".",

        balance: "Saldo",
        display: "Pantalla",
        security: "Seguridad",
        failed: "Fallido",
        swaps_found: "Escaneando intercambios ({{ count }} encontrados)",
        claim_scan_required:
            "Para reclamar este intercambio, vuelve y escanea con tu archivo de rescate cargado.",
        invalid_rescue_key_evm:
            "Esta clave de rescate no está asociada con este intercambio. Por favor, intenta de nuevo usando una clave de rescate diferente.",
        error_occurred: "Ocurrió un error: {{ error }}",
        rsk_rescue_prompt:
            'Si enviaste RBTC a un intercambio de Boltz, usa "Reembolsar intercambio"; si estabas recibiendo RBTC, usa "Reanudar intercambio" para rescatar un intercambio que no está disponible en el historial de este navegador.',
        rsk_rescue_refund_title: "Reembolsar intercambio",
        rsk_rescue_refund_explainer:
            "Conecta tu monedero Rootstock para buscar intercambios que han expirado y pueden ser reembolsados.",
        rsk_rescue_resume_title: "Reanudar intercambio",
        rsk_rescue_resume_explainer:
            "Usa tu clave de rescate para encontrar intercambios pendientes que se puedan reanudar.",
        searching_resumable_swaps:
            "Buscando intercambios reanudables... {{ progress }}%",
        unmatched_swaps:
            "Este monedero tiene {{ count }} intercambios adicionales reclamables. Para acceder a ellos, cambia a la clave de rescate usada para iniciar esos intercambios.",
        approve_erc20: "Aprobar",
        approve_erc20_line:
            "Configura la asignación de ERC20 para el contrato de intercambio",
    },
    pt: {
        language: "Português",
        or: "ou",
        status: "Estado",
        fast: "Rápido",
        l2: "Construído na Segunda Camada",
        l2_sub: "A Boltz utiliza tecnologias de segunda camada como a rede Lightning",
        assets_sub: "Camadas de Bitcoin e Stablecoins",
        safe: "Seguro",
        non_custodial: "Não-Custodial",
        non_custodial_sub:
            "As trocas na Boltz são atômicas, a criptografia garante que os usuários sempre tenham controle sobre seu Bitcoin",
        node: "Nós Lightning",
        error: "Erro",
        error_subline: "Resposta inválida da API, algo deu errado.",
        error_wasm: "WebAssembly não suportado",
        history: "Histórico",
        swap: "Trocar",
        refund: "Reembolsar",
        partner: "Parceiro",
        support: "Suporte",
        docs: "Docs",
        onion: "Onion",
        terms: "Termos",
        privacy: "Privacidade",
        blockexplorer: "abrir {{ typeLabel }}",
        blockexplorer_lockup_address: "endereço de lockup",
        blockexplorer_lockup_tx: "transação de lockup",
        blockexplorer_claim_tx: "transação de reivindicação",
        blockexplorer_refund_tx: "transação de reembolso",
        help: "Suporte",
        network_fee: "Taxa da rede",
        fee: "Taxa da Boltz",
        denomination: "Denominação",
        send: "Enviar",
        continue: "Continuar",
        receive: "Receber",
        min: "Mín",
        max: "Máx",
        minimum_amount: "O valor mínimo é {{ amount }} {{ denomination }}",
        maximum_amount: "O valor máximo é {{ amount }} {{ denomination }}",
        assets: "Multi-Camada",
        footer: "Feito com 🧡 pela equipe da Boltz",
        create_swap: "Criar troca atômica",
        create_swap_subline:
            "O pagamento inclui a taxa da rede e a taxa da Boltz",
        get_gas_token_for_gas: "Obtenha {{ gasToken }} para gas",
        new_swap: "Nova troca",
        feecheck:
            "A taxa da rede foi atualizada conforme a situação atual, por favor confirme os novos valores e continue a troca.",
        create_and_paste:
            "Cole um invoice Lightning, um endereço BOLT12 ou um LNURL para receber os fundos",
        congrats: "Parabéns!",
        successfully_swapped:
            "{{ amount }} {{ denomination }} recebidos com sucesso!",
        timeout_eta: "Estimativa de Expiração",
        pay_invoice: "Troca: {{ id }}",
        pay_swap_404: "Troca não encontrada!",
        pay_timeout_blockheight: "Altura do Bloco de Expiração ({{ network }})",
        send_to: "Envie {{ amount }} {{ denomination }} para",
        send_between:
            "Envie entre {{ min }} e {{ max }} {{ denomination }} para",
        pay_invoice_to: "Pague este invoice de {{ amount }} {{ denomination }}",
        no_wallet: "Nenhuma carteira instalada",
        connect_wallet: "Conectar carteira",
        please_connect_wallet: "Por favor, conecte a carteira",
        connect_to_address: "Conectar ao endereço da troca",
        disconnect_address: "Desconectar carteira",
        lockup_failed: "Falha no lockup!",
        failure_reason: "Motivo da falha",
        invoice_payment_failure: "Não foi possível pagar seu invoice Lightning",
        onchain_address:
            "Digite um endereço {{ asset }} para receber os fundos",
        onchain_address_no_asset: "Digite o endereço",
        invalid_refund_file: "Chave de resgate inválida",
        invalid_backup_file: "Arquivo de backup inválido",
        invalid_invoice:
            "Por favor, forneça um invoice Lightning, BOLT12 ou LNURL válido",
        invalid_0_amount: "Invoices sem valor não são suportadas",
        copy_invoice: "invoice lightning",
        copy_address: "endereço",
        copy_amount: "quantia",
        copy_bip21: "BIP21",
        refund_swap: "Reembolsar troca",
        rescue_a_swap_subline:
            "Se enviou BTC ou L-BTC para uma troca Boltz, faça upload ou insira sua chave de resgate para resgatar uma troca que não está no histórico deste navegador.",
        rescue_a_swap_mnemonic:
            "Insira sua chave de resgate para resgatar uma troca que não está no histórico deste navegador.",
        refund_past_swaps: "Trocas passadas",
        refund_past_swaps_subline:
            "Trocas que foram salvas no armazenamento do seu navegador",
        no_rescuable_swaps:
            "Nenhuma troca resgatável encontrada no histórico do navegador",
        cant_find_swap: "Não consegue encontrar sua troca?",
        rescue_external_explainer:
            "Tente resgatar uma troca externa usando a chave de resgate ou outros métodos de emergência.",
        refund_external_scanning_rsk:
            "Procurando trocas resgatáveis na sua carteira Rootstock...",
        connected_wallet_no_swaps:
            "A carteira Rootstock conectada não contém nenhuma troca resgatável.",
        rescue_external_swap: "Resgatar troca externa",
        history_no_swaps: "Parece que ainda não foram feitas trocas.",
        refund_address_header:
            "Informe um endereço {{ asset }} para receber seu reembolso:",
        refund_address_header_no_asset:
            "Informe um endereço para receber seu reembolso:",
        refund_backup: "Backup",
        refund_import: "Importar backup",
        refund_clear: "Apagar armazenamento",
        delete_storage:
            "Tem certeza de que deseja limpar seu armazenamento?\nAs informações das suas trocas e as chaves privadas de reembolso/recebimento serão perdidas.",
        delete_storage_single_swap:
            "Tem certeza de que deseja remover a troca {{ id }} do armazenamento?\nAs informações da troca e as chaves privadas de reembolso/recebimento serão perdidas.",
        delete_logs: "Tem certeza que deseja limpar seus logs?",
        tx_in_mempool: "Transação na mempool",
        tx_in_mempool_subline: "Aguardando confirmação para concluir a troca.",
        tx_in_mempool_warning:
            "Mantenha esta página aberta, senão a troca não termina!",
        invoice_pending: "Transação recebida, a pagar o invoice.",
        invoice_pending_pro:
            "Transação recebida, invoice em fila. Em algumas ocasiões, a troca pode ser cancelada.",
        invoice_expired: "Invoice expirado, tente novamente!",
        create_invoice_webln: "criar invoice via WebLN",
        pay_invoice_webln: "pagar invoice via WebLN",
        select_asset: "Selecionar ativo de {{ direction }}",
        select_network: "Selecionar rede",
        search: "Pesquisar",
        tx_confirmed: "Transação confirmada",
        tx_ready_to_claim: "Reivindicando transação agora...",
        refunded: "Troca reembolsada com sucesso!",
        locktime_not_satisfied: "O prazo de lockup não foi cumprido",
        already_refunded: "A troca já foi reembolsada",
        api_offline: "A API está offline",
        api_offline_msg:
            "Não foi possível conectar à API da Boltz, por favor tente novamente mais tarde",
        refund_explainer:
            "Será possível reembolsar a troca após o prazo de expiração!",
        wasm_not_supported: "Ative o WebAssembly no seu navegador",
        created: "Criado",
        view: "Ver",
        id: "ID",
        headline: "Bitcoin Bridge Não-Custodial",
        headline_pro: "Acumule Sats Com Autocustódia",
        subline:
            "Troque entre as diferentes camadas do Bitcoin e Stablecoins, mantendo controle total.",
        subline_pro:
            "Ganhe sats por trocar Bitcoin em direções que ajudam a balancear nossa liquidez.",
        start_swapping: "Começar a trocar",
        partners: "Parceiros",
        integrations: "Integrações",
        oldest_channel_years: "{{ years }} anos",
        oldest_channel: "Canal mais antigo",
        capacity: "Capacidade ({{ denomination }})",
        peers: "Número de pares",
        num_channels: "Número de canais",
        beta_caution: "BETA - USE COM CUIDADO!",
        pro: "pro",
        pro_banner: "Quer usar a Boltz Pro via API?",
        warning_return:
            "Volte a esta página após pagar o invoice! O pagamento pode aparecer como pendente até que volte a esta página.",
        warning_expiry:
            "Certifique-se de que sua transação seja confirmada em até 24h após a criação da troca!",
        not_found: "404 - Not Found",
        not_found_subline: "Esta página parece ter desaparecido.",
        back_to_home: "Voltar à página inicial",
        transaction_prompt:
            'Pressione "{{ button }}" para abrir sua carteira conectada e confirmar a transação exibida.',
        transaction_prompt_receive:
            'Pressione "{{ button }}" para abrir sua carteira conectada e confirmar a transação para receber {{ asset }}.',
        transaction_failed: "Falha na transação: {{ error }}",
        wallet_request_rejected: "A solicitação foi rejeitada na sua carteira.",
        invalid_address: "Endereço {{ asset }} inválido",
        scan_qr_code: "Ler QR Code",
        version: "Versão",
        commithash: "Hash do Commit",
        open_in_wallet: "Abrir na carteira",
        branding: "Identidade Visual",
        regtest: "Regtest",
        broadcasting_claim: "Transmitindo transação de reivindicação...",
        paste_invalid:
            "Conteúdo da área de transferência inválido ou valor excedido",
        email: "Email",
        switch_paste:
            "Direção/ativo da troca alterado com base no conteúdo colado",
        settings: "Configurações",
        decimal_separator: "Separador decimal",
        denomination_tooltip: "Escolha a denominação preferida: BTC ou sats",
        decimal_tooltip: "Escolha o separador decimal: ponto ou vírgula",
        show_fiat_rate: "Mostrar valor em USD",
        show_fiat_rate_tooltip:
            "Mostrar o equivalente em USD do valor da troca",
        fiat_rate_not_available: "Valor em USD indisponível",
        swap_completed: "Troca {{ id }} concluída com sucesso!",
        claim_fail: "Falha ao reivindicar troca: {{ id }}",
        logs: "Logs",
        logs_tooltip: "Logs do app, útil para debugging",
        hide_wallet_address: "Modo de Privacidade",
        hide_wallet_address_tooltip:
            "Oculta o endereço da carteira EVM e o ID do Swap para privacidade em demos e gravações",
        bitcoin_only: "Modo Bitcoin-Only",
        bitcoin_only_tooltip:
            "Mostrar apenas Bitcoin e Lightning, ocultando todos os outros pares",
        slippage: "Slippage",
        slippage_tooltip: "Tolerância máxima de slippage para trocas em DEX",
        gas_topup: "Recarga automática de gas",
        gas_topup_tooltip:
            "Converte automaticamente uma pequena parte da sua troca em gas nativo se a sua carteira conectada não tiver gas.",
        gas_topup_label: "Gas ({{ gasToken }}): 0.{{ cost }}",
        oft_messaging_fee_label: "Taxa OFT",
        dex_quote_changed: "A cotação da DEX mudou",
        zero_conf: "Zero-Conf",
        zero_conf_tooltip:
            "Aceitar transações que ainda não foram confirmadas num bloco",
        on: "on",
        off: "off",
        invalid_pair: "Par inválido",
        error_starting_qr_scanner:
            "Não foi possível acessar a câmera, verifique as permissões!",
        insufficient_balance: "Saldo insuficiente",
        insufficient_balance_line:
            "Não há saldo suficiente na sua carteira para essa troca.",
        select_wallet: "Selecionar carteira",
        select_derivation_path: "Selecionar caminho de derivação",
        submit_derivation_path: "Enviar",
        not_supported_in_browser: "Não suportado neste navegador",
        switch_network: "Trocar rede",
        block: "bloco",
        logs_scan_progress: "Progresso da varredura {{ value }}%",
        accept: "Aceitar",
        wallet_connect_failed: "Falha ao conectar carteira: {{ error }}",
        ledger_open_app_prompt: "Abra o app Ethereum ou RSK",
        validate_payment: "Mostrar Prova de Pagamento",
        no_browser_wallet: "Nenhuma carteira de navegador detectada",
        sent: "Enviado",
        will_receive: "Você receberá",
        refund_available_in:
            "Reembolso estará disponível em {{ blocks }} blocos",
        no_wallet_connected: "Nenhuma carteira conectada",
        no_lockup_transaction: "Nenhuma transação de lockup encontrada",
        routing_fee_limit: "Limite da taxa de roteamento",
        download_boltz_rescue_key: "Chave de resgate da Boltz",
        download_boltz_rescue_key_subline:
            "Faça backup de todas as suas trocas com uma única chave de resgate 🙌",
        download_boltz_rescue_key_subline_second:
            "Esta chave funciona em qualquer dispositivo e para todas as trocas criadas com ela. Armazene a chave em um local seguro e permanente.",
        download_boltz_rescue_key_subline_third:
            "Para continuar, baixe uma nova chave de resgate.",
        download_new_key: "Baixar nova chave",
        verify_boltz_rescue_key: "Verificar chave de resgate",
        verify_boltz_rescue_key_subline:
            "Selecione sua chave de resgate previamente baixada para verificá-la.",
        verify_key: "Verificar chave",
        verify_key_failed:
            "Falha ao verificar a chave de resgate. Recomendamos baixar uma nova chave.",
        rescue_key: "Chave de resgate",
        reset_rescue_key_tooltip:
            "Gerar uma nova chave de resgate e limpar todos os dados de trocas",
        reset_rescue_key_prompt:
            "⚠️ AVISO: Isso excluirá TODOS os seus dados de trocas e gerará uma nova chave de resgate.\n\nNão prossiga a não ser que você tenha um backup para a chave de resgate existente ou tenha certeza absoluta de que não precisará mais dela.\n\nDigite 'confirm' para continuar:",
        reset_rescue_key_invalid_confirmation:
            "Confirmação inválida. Por favor, digite 'confirm' para continuar.",
        reset_rescue_key_error:
            "Ocorreu um erro ao redefinir a chave de resgate. Por favor, tente novamente.\n\nErro: {{ error }}",
        reset_rescue_key_success: "Nova chave de resgate gerada com sucesso!",
        no_swaps_found: "Nenhuma troca encontrada",
        rif_extra_fee:
            "A carteira não tem RBTC suficiente, taxa ajustada para incluir taxa do RIF Relay!",
        back: "Voltar",
        next: "Próximo",
        pagination_info: "Página {{ start }} de {{ end }}",
        generate_key: "Gerar nova chave",
        backup_boltz_rescue_key: "Backup chave de resgate da Boltz",
        backup_boltz_rescue_key_subline_second:
            "Esta nova chave funciona em qualquer dispositivo e funciona para todas as trocas criadas com ela.",
        backup_boltz_rescue_key_subline_third:
            "Por favor, escreva ou copie esta chave e armazene-a em um local seguro e permanente.",
        backup_boltz_rescue_key_reminder: "Guarde com segurança. Não partilhe.",
        copy_rescue_key: "Copiar chave de resgate",
        user_saved_key: "Eu guardei a chave de resgate",
        verify_mnemonic_word: {
            start: "Qual é a palavra na ",
            strong: "posição {{ number }}",
            end: " da sua chave de resgate?",
        },
        incorrect_word:
            "Palavra incorreta. Por favor, verifique sua chave de resgate.",
        enter_mnemonic: "Digitar chave de resgate",
        verify_boltz_rescue_key_mnemonic:
            "Por favor, digite sua chave de resgate abaixo para importá-la.",
        hint_paste_mnemonic: "Dica: você pode colar as 12 palavras de uma vez.",
        swap_opportunities: "Oportunidades Pro Disponíveis",
        swap_opportunities_subline:
            "Ganhe sats ou obtenha descontos trocando estes pares",
        pro_fee: "Taxa Pro",
        regular_fee: "Taxa Regular",
        swap_opportunities_accordion: "Oportunidades Pro",
        no_opportunities_found: {
            text: "Nenhuma oportunidade Pro encontrada. Verifique novamente mais tarde.",
            telegram_bot_text_prefix:
                "Para alertas de taxas, acesse nosso bot no ",
            telegram_bot_text_middle: " ou ",
            telegram_bot_text_suffix: ".",
            telegram_bot: "Telegram",
            simplex: "SimpleX",
        },
        refresh_for_refund:
            "Se enviou Bitcoin para esta troca, atualize a página para verificar se existe um reembolso.",
        applied_routing_hint:
            "O seu destinatário suporta o recebimento direto de {{ asset }}. Assim, você poupa em taxas e ele continua a receber o valor total.",
        optimized_route_amount:
            "Rota de troca otimizada, poupando-te ~{{ amount }} {{ denomination }}",
        claim: "Reivindicar",
        claimed: "Troca reivindicada com sucesso!",
        rescue: "Resgatar",
        rescue_swap: "Resgatar Troca",
        claim_swap: "Reivindicar: {{ id }}",
        failed_get_swap: "Não foi possível obter a troca {{ id }}",
        failed_get_swap_subline:
            "Por favor, re-insira a chave de resgate e tente novamente.",
        in_progress: "Em curso",
        completed: "Finalizada",
        get_refundable_error:
            "Não foi possível carregar os dados de UTXO. Atualize a página para voltar a tentar ou verifique sua conexão com a Internet se o problema persistir.",
        min_amount_destination:
            "O valor mínimo para o endereço de destino é {{ amount }} {{ denomination }}",
        max_amount_destination:
            "O valor máximo para o endereço de destino é {{ amount }} {{ denomination }}",
        destination: "Destino",
        destination_address: "{{ address }}",

        // Products page
        products: "Produtos",
        products_description:
            "Um conjunto de produtos para integração perfeita entre as camadas do Bitcoin",
        products_plugin_title: "Boltz BTCPay Plugin",
        products_plugin_description:
            "Uma solução não-custodial para aceitar pagamentos Lightning facilmente, sem ter um nó Lightning",
        products_client_title: "Boltz Client",
        products_client_description:
            "Nosso daemon empresarial de trocas, para integrações em servidores e gestão de liquidez",
        products_pro_title: "Boltz Pro",
        products_pro_description:
            "Uma plataforma que permite ganhar sats através de trocas",
        learn_more: "Saiba mais",
        get_started: "Abrir Boltz Pro",
        documentation: "Documentação",
        view_on_github: "Ver no Github",
        chat_with_us: "Converse conosco",

        // Plugin
        boltz_plugin_name: "Plugin Boltz BTCPay",
        boltz_plugin_description:
            "Solução não-custodial para aceitar pagamentos Lightning facilmente",
        boltz_plugin_step_install_title: "Instale o plugin",
        boltz_plugin_step_install_description:
            "Instale o plugin Boltz no seu servidor BTCPay",
        boltz_plugin_step_setup_title: "Configure sua carteira",
        boltz_plugin_step_setup_description:
            "Conecte sua carteira externa ou crie uma nova",
        boltz_plugin_step_paid_title: "Receba Lightning",
        boltz_plugin_step_paid_description:
            "Receba pagamentos Lightning com liquidação automática em Bitcoin mainchain",
        boltz_plugin_features_title: "Por que usar?",
        boltz_plugin_features_description:
            "Feito para comerciantes que querem controle total, sem complexidades",
        boltz_plugin_feature_flexible_title: "Flexível",
        boltz_plugin_feature_flexible_description:
            "Aceite pagamentos Lightning sem ter um nó ou gerencie 100% da liquidez de um nó Lightning existente",
        boltz_plugin_feature_liquid_title: "Impulsionado pela Liquid",
        boltz_plugin_feature_liquid_description:
            "Aproveite o poder de trocas Taproot via Liquid para taxas menores e maior privacidade",
        boltz_plugin_feature_autoswap_title: "Liquidação em Bitcoin",
        boltz_plugin_feature_autoswap_description:
            "Troca automática para Bitcoin mainchain com base nas suas preferências",
        boltz_plugin_feature_self_custodial_title: "Não-custodial",
        boltz_plugin_feature_self_custodial_description:
            "Mantenha o controle total dos seus Bitcoin com o poder das trocas atômicas da Boltz",

        boltz_plugin_questions_title: "Dúvidas?",
        boltz_plugin_questions_subtitle: "Adoraríamos ouvir você!",
        // Client
        boltz_client_name: "Boltz Client",
        boltz_client_description:
            "Daemon empresarial de trocas para integrações em servidores e gestão de liquidez",
        boltz_client_features_title: "Feito para empresas e profissionais",
        boltz_client_features_description:
            "Recursos avançados, projetados para operadores profissionais de nós Lightning",
        boltz_client_feature_taproot_title: "Taproot-First",
        boltz_client_feature_taproot_description:
            "Utiliza trocas Taproot para maior eficiência e privacidade",
        boltz_client_node_agnostic_title: "Agnóstico de Nó",
        boltz_client_node_agnostic_description:
            "Suporte de primeira classe para CLN, além de LND, dando flexibilidade à sua infraestrutura",
        boltz_client_autoswap_title: "Auto-Troca Inteligente",
        boltz_client_autoswap_description:
            "Controle granular para rebalanceamento automático de canais, com configurações ajustáveis e liquidação inteligente em Bitcoin",
        boltz_client_liquid_title: "Liquid-First",
        boltz_client_liquid_description:
            "Otimizado para rebalanceamento de canais usando trocas Liquid para taxas baixas, execução rápida e maior privacidade",
        boltz_client_cli_title: "API e CLI robustas",
        boltz_client_cli_first_paragraph:
            "Carteira integrada e API abrangente para integração perfeita na sua infraestrutura.",
        boltz_client_cli_second_paragraph:
            "Monitore, controle e automatize tudo via linha de comando ou com seus próprios apps.",
        boltz_client_cta_title: "Adicione a Boltz à sua infraestrutura!",
        boltz_client_cta_subtitle:
            "Junte-se à comunidade de empresas e operadores de nós que usam o Boltz Client",

        // Pro
        boltz_pro_name: "Boltz Pro",
        boltz_pro_description:
            "Uma plataforma que permite ganhar sats através de trocas",
        boltz_pro_how_it_works_title: "Como funciona",
        boltz_pro_how_it_works_description:
            "Você é pago por fazer trocas em direções que nos ajudam a reequilibrar nossa liquidez",
        boltz_pro_chart_title: "Amostra de Histórico de Taxas Boltz Pro",
        boltz_pro_chart_y_axis: "Taxa Boltz Pro",
        boltz_pro_chart_x_axis: "Data",
        boltz_pro_negative_fee: "Você ganha sats",
        boltz_pro_lower_fee: "Você economiza sats",
        boltz_pro_regular_fee: "Taxa Regular Boltz",
        boltz_pro_target_audience_title: "Para quem é a Boltz Pro?",
        boltz_pro_target_audience_subtitle:
            "Feita para profissionais que querem ganhar sats, não para pagamentos do dia a dia",
        boltz_pro_perfect_for_title: "Feita para",
        boltz_pro_perfect_for_1:
            "Operadores de nós Lightning que buscam reduzir o excesso de liquidez inbound para ganhar sats",
        boltz_pro_perfect_for_2:
            "Profissionais colaborando com operadores de nós externos para gerenciar liquidez",
        boltz_pro_perfect_for_3:
            "Usuários recarregando carteiras Lightning dentro dos limites de roteamento da Boltz Pro",
        boltz_pro_not_designed_for_title: "Não adequada para",
        boltz_pro_not_designed_for_1:
            "Pagamentos Lightning do dia a dia, como comprar um café",
        boltz_pro_not_designed_for_2:
            "Confiabilidade no pagamento a destinos com altas taxas de roteamento",
        boltz_pro_not_designed_for_3:
            "Cenários que exigem garantia de execução de pagamento instantâneo",
        boltz_pro_cta_title: "Comece a ganhar sats agora!",
        boltz_pro_cta_subtitle:
            "Descubra as oportunidades atuais para ganhar sats",
        boltz_pro_options_title: "3 maneiras de usar a Boltz Pro",
        boltz_pro_options_subtitle: "Escolha a que melhor se adapta a você",
        boltz_pro_option_client_title: "Boltz Client",
        boltz_pro_option_client_description:
            "Automatize completamente a Boltz Pro com API e CLI",
        boltz_pro_option_web_title: "App Web",
        boltz_pro_option_web_description:
            "Observe e execute trocas com nosso app web Boltz Pro",
        boltz_pro_option_chat_title: "Bots de chat",
        boltz_pro_option_chat_description_prefix:
            "Receba alertas instantâneos no",
        boltz_pro_option_chat_description_middle: "ou",
        boltz_pro_option_chat_description_suffix: ".",

        balance: "Saldo",
        display: "Exibição",
        security: "Segurança",
        failed: "Falhou",
        swaps_found: "Buscando trocas ({{ count }} encontradas)",
        claim_scan_required:
            "Para reivindicar esta troca, volte e escaneie com o arquivo de resgate carregado.",
        invalid_rescue_key_evm:
            "Esta chave de resgate não está associada a esta troca. Por favor, tente novamente usando uma chave de resgate diferente.",
        error_occurred: "Ocorreu um erro: {{ error }}",
        rsk_rescue_prompt:
            'Se você enviou RBTC para uma troca da Boltz, use "Reembolsar troca"; se estava recebendo RBTC, use "Continuar troca" para resgatar uma troca que não está disponível no histórico de trocas deste navegador.',
        rsk_rescue_refund_title: "Reembolsar troca",
        rsk_rescue_refund_explainer:
            "Conecte sua carteira Rootstock para procurar trocas que expiraram e podem ser reembolsadas.",
        rsk_rescue_resume_title: "Continuar troca",
        rsk_rescue_resume_explainer:
            "Use sua chave de resgate para encontrar trocas pendentes que podem ser continuadas.",
        searching_resumable_swaps:
            "Buscando trocas retomáveis... {{ progress }}%",
        unmatched_swaps:
            "Esta carteira tem {{ count }} trocas adicionais reivindicáveis. Para acessá-las, mude para a chave de resgate usada para iniciar essas trocas.",
        approve_erc20: "Aprovar",
        approve_erc20_line:
            "Definir a permissão de ERC20 para o contrato de troca",
    },
    zh: {
        language: "中文",
        or: "或",
        status: "状态",
        fast: "快速",
        l2: "建立在二层网络之上",
        l2_sub: "Boltz利用像闪电网络这样的二层网络扩展技术",
        assets_sub: "比特币层和稳定币",
        safe: "安全",
        non_custodial: "非托管",
        non_custodial_sub:
            "Boltz上的交换是原子式,密码学确保用户始终掌握自己的资金",
        node: "闪电网络节点",
        error: "错误",
        error_subline: "API的响应无效，出现异常。",
        error_wasm: "不支持WebAssembly",
        history: "历史",
        swap: "交换",
        refund: "退款",
        partner: "合作伙伴",
        support: "支持",
        docs: "文档",
        onion: "洋葱",
        terms: "条款",
        privacy: "隐私",
        blockexplorer: "打开{{ typeLabel }}",
        blockexplorer_lockup_address: "锁仓地址",
        blockexplorer_lockup_tx: "锁仓交易",
        blockexplorer_claim_tx: "索赔交易",
        blockexplorer_refund_tx: "退款交易",
        help: "支持",
        network_fee: "网络费",
        fee: "Boltz费",
        denomination: "面额",
        send: "发送",
        continue: "继续",
        receive: "接收",
        min: "最小",
        max: "最大",
        minimum_amount: "最小金额为{{ amount }}{{ denomination }}",
        maximum_amount: "最大金额为{{ amount }}{{ denomination }}",
        assets: "多层",
        footer: "Boltz团队倾情🧡制作",
        create_swap: "创建原子交换",
        create_swap_subline: "付款包括网络和Boltz服务费",
        get_gas_token_for_gas: "获取{{ gasToken }}作为 Gas 费",
        new_swap: "新的交换",
        feecheck: "根据网络情况更新了网络费用，请确认新的金额并继续进行交换。",
        create_and_paste: "粘贴闪电发票、BOLT12 地址或 LNURL 以接收资金",
        congrats: "恭喜！",
        successfully_swapped: "您成功收到{{ amount }}{{ denomination }}！",
        timeout_eta: "超过预期时间",
        pay_invoice: "交换：{{ id }}",
        pay_swap_404: "找不到交换！",
        pay_timeout_blockheight: "超时区块高度 ({{ network }})",
        send_to:
            "请将准确的{{ amount }}{{ denomination }}发送到以下地址。您可以使用“BIP21”按钮，并将其粘贴到钱包。",
        send_between: "在 {{ min }} 和 {{ max }} {{ denomination }} 之间发送至",
        pay_invoice_to: "支付金额为{{ amount }}{{ denomination }}的发票",
        no_wallet: "未安装钱包",
        connect_wallet: "连接钱包",
        please_connect_wallet: "请连接钱包",
        connect_to_address: "连接交换地址",
        disconnect_address: "断开钱包",
        lockup_failed: "锁仓失败！",
        failure_reason: "失败原因",
        invoice_payment_failure: "无法支付您的闪电发票",
        onchain_address: "输入{{ asset }}地址以接收资金",
        onchain_address_no_asset: "地址",
        invalid_refund_file: "无效的救援钥匙",
        invalid_backup_file: "无效的备份文件",
        invalid_invoice: "请提供有效的发票,BOLT12或LNURL",
        invalid_0_amount: "不支持没有金额的发票",
        copy_invoice: "闪电网络发票",
        copy_address: "地址",
        copy_amount: "金额",
        copy_bip21: "BIP21",
        refund_swap: "退还交换",
        rescue_a_swap_subline:
            "如果您向 Boltz 交换发送了 BTC 或 L-BTC，请上传或输入您的救援密钥，以恢复在该浏览器的交换历史记录中不可用的交换。",
        rescue_a_swap_mnemonic:
            "输入您的救援密钥以恢复此浏览器交换历史记录中不存在的交换。",
        refund_past_swaps: "过去的交换",
        refund_past_swaps_subline: "保存在浏览器存储中的交换",
        no_rescuable_swaps: "在您的浏览器历史记录中未找到可恢复的交换记录。",
        cant_find_swap: "找不到您的交换？",
        rescue_external_explainer:
            "尝试通过救援密钥和其他紧急方法恢复外部交换分区。",
        refund_external_scanning_rsk: "正在扫描Rootstock钱包中的可恢复交换...",
        connected_wallet_no_swaps:
            "已连接的Rootstock钱包中不包含任何可恢复的交换。",
        rescue_external_swap: "救援外部交换",
        history_no_swaps: "看起来您还没有进行任何交换。",
        refund_address_header: "输入要退款的 {{ asset }} 钱包地址",
        refund_address_header_no_asset: "输入要退款的钱包地址",
        refund_backup: "备份",
        refund_import: "导入备份",
        refund_clear: "删除本地存储",
        delete_storage:
            "您确定要清除本地存储吗？\n您的交换信息和您的退款/索赔私钥将丢失。",
        delete_storage_single_swap: "您确定要从本地存储中清除交换{{ id }}吗",
        delete_logs: "您确定要删除日志吗？",
        tx_in_mempool: "事务在内存池中",
        tx_in_mempool_subline: "等待确认以完成交换",
        tx_in_mempool_warning: "请保持此页打开，否则兑换无法完成！",
        invoice_pending: "收到交易，正在支付发票。",
        invoice_pending_pro:
            "收到交易，发票已排队。在某些情况下，兑换可能会被取消。",
        invoice_expired: "发票已过期，请重试！",
        create_invoice_webln: "通过WebLN创建发票",
        pay_invoice_webln: "通过WebLN支付发票",
        select_asset: "选择{{ direction }}资产",
        select_network: "选择网络",
        search: "搜索",
        tx_confirmed: "交易已确认",
        tx_ready_to_claim: "现在要求交换……",
        refunded: "交换已退还",
        locktime_not_satisfied: "未满足锁定时间要求",
        already_refunded: "交换已经退还",
        api_offline: "API离线",
        api_offline_msg: "无法连接到Boltz API,请稍后重试",
        refund_explainer: "您将能够在超时后退款!",
        wasm_not_supported: "请在您的浏览器中激活WebAssembly",
        created: "已创建",
        view: "查看",
        id: "ID",
        headline: "非托管比特币跨链桥",
        headline_pro: "积累聪，非托管！",
        subline: "在不同比特币层和稳定币之间交换，同时保持完全控制。",
        subline_pro: "通过交换比特币赚取聪，在有助于平衡我们的流动性方向上。",
        start_swapping: "开始交换",
        partners: "合作伙伴",
        integrations: "集成",
        oldest_channel_years: "{{ years }}年",
        oldest_channel: "最老的通道",
        capacity: "容量（{{ denomination }}）",
        peers: "对端数",
        num_channels: "通道数",
        beta_caution: "BETA - 谨慎使用！",
        pro: "pro",
        pro_banner: "想要通过 API 使用 Boltz Pro？",
        warning_return:
            "重要：支付发票后返回此页面！在您返回此页面之前，付款可能显示为待定。",
        warning_expiry: "确保您的交易在创建此交换后的约24小时内确认！",
        not_found: "404 - Not Found",
        not_found_subline: "此页面似乎已经消失。",
        back_to_home: "返回首页",
        transaction_prompt:
            "按“{{ button }}”以打开已连接的钱包并确认显示的交易。",
        transaction_prompt_receive:
            "按“{{ button }}”以打开已连接的钱包并确认显示的交易以便收{{ asset }}。",
        transaction_failed: "交易失败：{{ error }}",
        wallet_request_rejected: "该请求已在您的钱包中被拒绝。",
        invalid_address: "无效的{{ asset }}地址",
        scan_qr_code: "扫描 QR 码",
        version: "版本",
        commithash: "提交哈希",
        open_in_wallet: "在钱包中打开",
        branding: "品牌",
        regtest: "Regtest",
        broadcasting_claim: "正在发送索赔交易...",
        paste_invalid: "剪贴板包含无效字符或超出最大金额",
        email: "邮箱",
        switch_paste: "根据粘贴的内容切换交换方向/资产",
        settings: "设置",
        decimal_separator: "小数分隔符",
        denomination_tooltip: "选择您的首选面额：BTC 或 sats",
        decimal_tooltip: "选择您的首选小数分隔符：点或逗号",
        show_fiat_rate: "显示 USD 汇率",
        show_fiat_rate_tooltip: "显示兑换金额对应的 USD 数值",
        fiat_rate_not_available: "USD 汇率不可用",
        swap_completed: "交换{{ id }} 已成功完成！",
        claim_fail: "交换{{ id }}索赔失败！",
        logs: "日志",
        logs_tooltip: "网络应用程序的日志，用于调试",
        hide_wallet_address: "隐私模式",
        hide_wallet_address_tooltip:
            "在演示和录屏时隐藏EVM钱包地址和交换ID以保护隐私",
        bitcoin_only: "仅比特币模式",
        bitcoin_only_tooltip: "仅显示比特币和闪电网络，隐藏所有其他交易对",
        slippage: "滑点",
        slippage_tooltip: "DEX 交换的最大价格滑点容差",
        gas_topup: "自动补充 Gas",
        gas_topup_tooltip:
            "如果您连接的钱包没有 Gas，将自动把交换的一小部分转换为原生 Gas。",
        gas_topup_label: "Gas ({{ gasToken }}): 0.{{ cost }}",
        oft_messaging_fee_label: "OFT 费用",
        dex_quote_changed: "DEX 报价已变更",
        zero_conf: "零确认",
        zero_conf_tooltip: "接受尚未被区块确认的交易",
        on: "开",
        off: "关",
        invalid_pair: "无效交换对",
        error_starting_qr_scanner: "无法访问摄像头, 请检查权限！",
        insufficient_balance: "余额不足",
        insufficient_balance_line: "您的钱包余额不足以进行此次交换。",
        select_wallet: "选择钱包",
        select_derivation_path: "选择派生路径",
        submit_derivation_path: "提交",
        not_supported_in_browser: "此浏览器不支持",
        switch_network: "转换网络",
        block: "块",
        logs_scan_progress: "扫描进度{{ value }}%",
        accept: "接受",
        wallet_connect_failed: "钱包连接失败：{{ error }}",
        ledger_open_app_prompt: "打开以太坊或 RSK 应用",
        validate_payment: "出示付款证明",
        no_browser_wallet: "未检测到浏览器钱包",
        sent: "已发送",
        will_receive: "将收到",
        refund_available_in: "退款将分 {{ blocks }} 区块提供",
        no_wallet_connected: "未连接钱包",
        no_lockup_transaction: "未找到锁仓交易",
        routing_fee_limit: "最大路由费用",
        download_boltz_rescue_key: "Boltz 救援密钥",
        download_boltz_rescue_key_subline: "用单个救援密钥备份所有交换 🙌",
        download_boltz_rescue_key_subline_second:
            "此密钥可在任何设备上使用，适用于用它创建的所有交换。请将密钥存储在安全且永久的位置。",
        download_boltz_rescue_key_subline_third: "要继续，请下载新的救援密钥。",
        download_new_key: "下载新密钥",
        verify_boltz_rescue_key: "验证博尔茨救援密钥",
        verify_boltz_rescue_key_subline:
            "请选择您之前保存的 Boltz 救援密钥进行验证。",
        verify_key: "验证密钥",
        verify_key_failed:
            "Boltz 救援密钥验证失败。我们建议下载新的 Boltz 救援密钥以继续。",
        rescue_key: "救援密钥",
        reset_rescue_key_tooltip: "生成新的救援密钥并清除所有交换数据",
        reset_rescue_key_prompt:
            "⚠️ 警告：这将删除所有交换数据并生成新的救援密钥。\n\n除非您有现有救援密钥的备份或绝对确定不再需要它，否则请勿继续。\n\n输入 'confirm' 以继续：",
        reset_rescue_key_invalid_confirmation:
            "确认无效。请输入 'confirm' 以继续。",
        reset_rescue_key_error:
            "重置救援密钥时出错。请重试。\n\n错误：{{ error }}",
        reset_rescue_key_success: "新的救援密钥已成功生成！",
        no_swaps_found: "未找到交换",
        rif_extra_fee: "钱包中没有足够的 RBTC，费用已调整为包括 RIF 中继费！",
        back: "回一页",
        next: "下一页",
        pagination_info: "{{ start }} 的 {{ end }} 页",
        generate_key: "生成新密钥",
        backup_boltz_rescue_key: "备份 Boltz 救援密钥",
        backup_boltz_rescue_key_subline_second:
            "这个新密钥适用于任何设备，并可用于所有用其创建的兑换操作。",
        backup_boltz_rescue_key_subline_third:
            "请记下或复制此密钥，并将其保存在安全且永久的位置。",
        backup_boltz_rescue_key_reminder: "请妥善保管。不要分享。",
        copy_rescue_key: "复制救援密钥",
        user_saved_key: "我已保存救援密钥",
        verify_mnemonic_word: {
            start: "你的救援密钥中，",
            strong: "第 {{ number }} 个",
            end: "单词是什么？",
        },
        incorrect_word: "单词不正确。请再次检查你的救援密钥。",
        enter_mnemonic: "输入救援密钥",
        verify_boltz_rescue_key_mnemonic: "请在下方输入你的救援密钥以导入。",
        hint_paste_mnemonic: "提示：你可以一次性粘贴全部 12 个单词。",
        swap_opportunities: "可用Pro机会",
        swap_opportunities_subline: "兑换这些交易对赚取聪或折扣",
        pro_fee: "Pro费率",
        regular_fee: "标准费率",
        swap_opportunities_accordion: "Pro机会",
        no_opportunities_found: {
            text: "当前无专业交易机会，请稍后再试",
            telegram_bot_text_prefix: "获取费率提醒，请查看我们的",
            telegram_bot_text_middle: "或",
            telegram_bot_text_suffix: "机器人。",
            telegram_bot: "Telegram",
            simplex: "SimpleX",
        },
        refresh_for_refund:
            "如果您向本次交换发送了比特币，请刷新页面检查是否有退款。",
        applied_routing_hint:
            "你的收款人支持直接接收 {{ asset }}。这为你节省了手续费，且对方仍会收到全额款项。",
        optimized_route_amount:
            "交换路径已优化，为你节省了约 {{ amount }} {{ denomination }}",
        claim: "索赔",
        claimed: "交换已成功索赔！",
        rescue: "救援",
        rescue_swap: "救援交换",
        claim_swap: "索赔：{{ id }}",
        failed_get_swap: "无法获取交换 {{ id }}",
        failed_get_swap_subline: "请重新插入救援钥匙并再次尝试。",
        in_progress: "进行中",
        completed: "已完成",
        get_refundable_error:
            "无法加载 UTXO 数据。请刷新页面后重试，或检查您的网络连接如果问题仍然存在。",
        min_amount_destination:
            "目标地址的最小金额为{{ amount }}{{ denomination }}",
        max_amount_destination:
            "目标地址的最大金额为{{ amount }}{{ denomination }}",
        destination: "目标地址",
        destination_address: "{{ address }}",

        // Products page
        products: "产品",
        products_description: "一套产品，可实现比特币各层之间的无缝互操作性",
        products_plugin_title: "Boltz BTCPay 插件",
        products_plugin_description:
            "一种非托管解决方案，无需运行 Lightning 节点即可轻松接受 Lightning 支付",
        products_client_title: "Boltz 客户端",
        products_client_description:
            "我们的企业级交换守护程序，用于服务器集成和流动性管理",
        products_pro_title: "Boltz Pro",
        products_pro_description: "通过交换赚取聪的平台",
        learn_more: "了解更多",
        get_started: "打开 Boltz Pro",
        documentation: "文档",
        view_on_github: "在 Github 上查看",
        chat_with_us: "与我们聊天",

        // Plugin
        boltz_plugin_name: "Boltz BTCPay 插件",
        boltz_plugin_description: "非托管解决方案，轻松接受 Lightning 支付",
        boltz_plugin_step_install_title: "添加插件",
        boltz_plugin_step_install_description:
            "在您的 BTCPay 服务器上安装 Boltz 插件",
        boltz_plugin_step_setup_title: "设置您的钱包",
        boltz_plugin_step_setup_description: "连接您的外部钱包或创建一个新钱包",
        boltz_plugin_step_paid_title: "接受 Lightning",
        boltz_plugin_step_paid_description:
            "接收自动结算到主链比特币的 Lightning 支付",
        boltz_plugin_features_title: "为什么使用它？",
        boltz_plugin_features_description:
            "专为希望在没有复杂性的情况下拥有完全控制权的商家而构建",
        boltz_plugin_feature_flexible_title: "灵活",
        boltz_plugin_feature_flexible_description:
            "无需运行节点即可接受 Lightning 支付，或完全管理现有 Lightning 节点的流动性",
        boltz_plugin_feature_liquid_title: "由 Liquid 驱动",
        boltz_plugin_feature_liquid_description:
            "充分利用 Liquid Taproot 交换的强大功能，实现低费用和增强的隐私",
        boltz_plugin_feature_autoswap_title: "在比特币上结算",
        boltz_plugin_feature_autoswap_description:
            "根据您的偏好自动交换到主链比特币",
        boltz_plugin_feature_self_custodial_title: "非托管",
        boltz_plugin_feature_self_custodial_description:
            "保持对您的比特币的完全控制，由 Boltz 原子交换提供支持",

        boltz_plugin_questions_title: "有问题？",
        boltz_plugin_questions_subtitle: "我们很乐意听取您的意见！",
        // Client
        boltz_client_name: "Boltz 客户端",
        boltz_client_description:
            "企业级交换守护程序，用于服务器集成和流动性管理",
        boltz_client_features_title: "专为企业和专业人士打造",
        boltz_client_features_description:
            "为专业 Lightning 节点运营商设计的强大功能",
        boltz_client_feature_taproot_title: "Taproot 优先",
        boltz_client_feature_taproot_description:
            "利用 Taproot 交换提高效率和隐私",
        boltz_client_node_agnostic_title: "节点不可知",
        boltz_client_node_agnostic_description:
            "除 LND 外还提供对 CLN 的一流支持，让您在基础设施中拥有灵活性",
        boltz_client_autoswap_title: "智能自动交换",
        boltz_client_autoswap_description:
            "细粒度控制自动通道再平衡，具有可自定义的配置和比特币智能结算",
        boltz_client_liquid_title: "Liquid 优先",
        boltz_client_liquid_description:
            "针对使用 Liquid 交换进行通道再平衡进行了优化，实现低费用、快速执行和增强隐私",
        boltz_client_cli_title: "强大的 API 和 CLI",
        boltz_client_cli_first_paragraph:
            "内置钱包系统和全面的 API，可无缝集成到您的基础设施中。",
        boltz_client_cli_second_paragraph:
            "通过您自己的应用程序或 CLI 监控、控制和自动化。",
        boltz_client_cta_title: "将 Boltz 添加到您的基础设施！",
        boltz_client_cta_subtitle:
            "加入使用 Boltz Client 的企业和节点运营商社区",

        // Pro
        boltz_pro_name: "Boltz Pro",
        boltz_pro_description: "通过交换赚取聪的平台",
        boltz_pro_how_it_works_title: "工作原理",
        boltz_pro_how_it_works_description:
            "您通过进行帮助我们再平衡流动性方向的交换而获得报酬",
        boltz_pro_chart_title: "Boltz Pro 费用历史样本",
        boltz_pro_chart_y_axis: "Boltz Pro 费用",
        boltz_pro_chart_x_axis: "日期",
        boltz_pro_negative_fee: "您赚取聪",
        boltz_pro_lower_fee: "您节省聪",
        boltz_pro_regular_fee: "常规 Boltz 费用",
        boltz_pro_target_audience_title: "Boltz Pro 适合谁？",
        boltz_pro_target_audience_subtitle:
            "专为想要赚取聪的专业人士打造，而不是日常支付",
        boltz_pro_perfect_for_title: "适用于",
        boltz_pro_perfect_for_1:
            "希望减少过多入站流动性以赚取聪的 Lightning 节点运营商",
        boltz_pro_perfect_for_2: "与外部节点运营商合作管理流动性的专业人士",
        boltz_pro_perfect_for_3:
            "在 Boltz Pro 路由限制内充值 Lightning 钱包的用户",
        boltz_pro_not_designed_for_title: "不适合",
        boltz_pro_not_designed_for_1: "日常 Lightning 支付，如购买咖啡",
        boltz_pro_not_designed_for_2: "向具有高路由费用的目的地进行可靠支付",
        boltz_pro_not_designed_for_3: "需要保证即时支付执行的场景",
        boltz_pro_cta_title: "立即开始赚取聪！",
        boltz_pro_cta_subtitle: "探索当前赚取聪的机会",
        boltz_pro_options_title: "使用 Boltz Pro 的 3 种方式",
        boltz_pro_options_subtitle: "选择最适合您的方式",
        boltz_pro_option_client_title: "Boltz 客户端",
        boltz_pro_option_client_description:
            "通过 API 和 CLI 完全自动化 Boltz Pro",
        boltz_pro_option_web_title: "网络应用",
        boltz_pro_option_web_description:
            "使用我们的 Boltz Pro 网络应用观察和交换",
        boltz_pro_option_chat_title: "聊天机器人",
        boltz_pro_option_chat_description_prefix: "在",
        boltz_pro_option_chat_description_middle: "或",
        boltz_pro_option_chat_description_suffix:
            "中接收有关 Boltz Pro 机会的即时提醒。",

        balance: "余额",
        display: "显示",
        security: "安全",
        failed: "失败",
        swaps_found: "正在扫描交换（已找到 {{ count }} 个）",
        claim_scan_required: "要领取此交换，请返回并在上传救援文件后进行扫描。",
        invalid_rescue_key_evm:
            "此救援密钥与此交换不关联。请使用其他救援密钥重试。",
        error_occurred: "发生错误：{{ error }}",
        rsk_rescue_prompt:
            "如果你向 Boltz 交换发送了 RBTC，请使用“退还交换”；如果你正在接收 RBTC，请使用“继续交换”，以救援一个未在此浏览器交换历史中显示的交换。",
        rsk_rescue_refund_title: "退还交换",
        rsk_rescue_refund_explainer:
            "连接你的 Rootstock 钱包以扫描已过期且可退款的交换。",
        rsk_rescue_resume_title: "继续交换",
        rsk_rescue_resume_explainer:
            "使用你的救援密钥查找可以继续的待处理交换。",
        searching_resumable_swaps: "正在搜索可继续的交换... {{ progress }}%",
        unmatched_swaps:
            "该钱包有 {{ count }} 个额外可领取的交换。要访问它们，请切换到用于发起这些交换的救援密钥。",
        approve_erc20: "授权",
        approve_erc20_line: "为交换合约设置 ERC20 授权额度",
    },
    ja: {
        language: "日本語",
        or: "または",
        status: "ステータス",
        fast: "高速",
        l2: "L2技術を活用",
        l2_sub: "Boltzは、LiquidネットワークやLightningネットワークなどのL2スケーリング技術を利用しています",
        assets_sub: "ビットコインレイヤーとステーブルコイン",
        safe: "安全",
        non_custodial: "ノンカストディアル型",
        non_custodial_sub:
            "Boltzのスワップはノンカストディアル型です。暗号技術により、ユーザーは常に資金を自己管理できます",
        node: "ノード",
        error: "エラー",
        error_subline: "APIからの無効な応答です。何かが間違っています",
        error_wasm: "WebAssemblyはサポートされていません",
        history: "履歴",
        swap: "スワップ",
        refund: "返金",
        partner: "パートナー",
        support: "ヘルプ",
        docs: "ドキュメント",
        onion: "Onion",
        terms: "利用規約",
        privacy: "プライバシー",
        blockexplorer: "ブロックエクスプローラーで表示{{ typeLabel }}",
        blockexplorer_lockup_address: "ロックアップアドレス",
        blockexplorer_lockup_tx: "ロックアップトランザクション",
        blockexplorer_claim_tx: "要求トランザクション",
        blockexplorer_refund_tx: "返金トランザクション",
        help: "ヘルプ",
        network_fee: "ネットワーク手数料",
        fee: "Boltz手数料",
        denomination: "単位",
        send: "送信",
        continue: "続ける",
        receive: "受取",
        min: "最小",
        max: "最大",
        minimum_amount: "最小金額は{{ amount }} {{ denomination }}です",
        maximum_amount: "最大金額は{{ amount }} {{ denomination }}です",
        assets: "アセット",
        footer: "Team Boltzによる🧡で作成されました",
        create_swap: "Atomic Swapの作成",
        create_swap_subline:
            "支払いにはネットワーク手数料とBoltzサービス手数料が含まれます",
        get_gas_token_for_gas: "{{ gasToken }}をガス代として取得",
        new_swap: "新しいスワップ",
        feecheck:
            "ネットワーク手数料はネットワーク状況に基づいて更新されました。新しい金額を確認し、スワップを続行してください",
        create_and_paste:
            "資金を受け取るために、ライトニングインボイス、BOLT12、またはLNURLを貼り付けてください",
        congrats: "おめでとうございます！",
        successfully_swapped: "スワップが正常に完了しました",
        timeout_eta: "タイムアウト予想時間",
        pay_invoice: "スワップ：{{ id }}",
        pay_swap_404: "スワップが見つかりません！",
        pay_timeout_blockheight: "タイムアウトブロック高 ({{ network }})",
        send_to:
            "{{ amount }} {{ denomination }} を以下のアドレスへ送金して下さい",
        send_between:
            "{{ min }} から {{ max }} {{ denomination }} を送信してください",
        pay_invoice_to:
            "このインボイスを支払う {{ amount }} {{ denomination }}",
        no_wallet: "ウォレットがインストールされていません",
        connect_wallet: "ウォレットの接続",
        please_connect_wallet: "ウォレットを接続してください",
        connect_to_address: "スワップアドレスに接続",
        disconnect_address: "ウォレットの接続を",
        lockup_failed: "ロックアップに失敗しました！",
        failure_reason: "失敗の理由",
        invoice_payment_failure: "インボイスを支払うことができませんでした",
        onchain_address:
            "資金を受け取るために、{{ asset }}アドレスを入力してください",
        onchain_address_no_asset: "アドレスを入力してください",
        invalid_refund_file: "無効なレスキューキー",
        invalid_backup_file: "無効なバックアップファイル",
        invalid_invoice: "有効なインボイス、BOLT12、LNURLを入力してください",
        invalid_0_amount: "金額のない空インボイスは対応していません",
        copy_invoice: "インボイスをコピー",
        copy_address: "アドレスをコピー",
        copy_amount: "金額をコピー",
        copy_bip21: "BIP21をコピー",
        refund_swap: "スワップを返金する",
        rescue_a_swap_subline:
            "BTCまたはL-BTCをBoltzスワップに送金した場合、このブラウザのスワップ履歴に表示されないスワップを復旧するには、復旧キーをアップロードまたは入力してください。",
        rescue_a_swap_mnemonic:
            "このブラウザの交換履歴にない交換を復元するには、復元キーを入力してください。",
        refund_past_swaps: "過去のスワップ",
        refund_past_swaps_subline: "ブラウザのストレージに保存されたスワップ",
        no_rescuable_swaps:
            "ブラウザの履歴に復元可能なスワップが見つかりませんでした。",
        cant_find_swap: "スワップが見つからない？",
        rescue_external_explainer:
            "外部スワップをレスキューキーやその他の緊急手段を使用して復旧を試みてください。",
        refund_external_scanning_rsk:
            "Rootstockウォレット内の救済可能なスワップを検索中です...",
        connected_wallet_no_swaps:
            "接続されたRootstockウォレットには、復元可能なスワップは含まれていません。",
        rescue_external_swap: "外部スワップの復旧",
        history_no_swaps: "まだスワップを行っていないようです。",
        refund_address_header:
            "返金用の {{ asset }} ウォレットのアドレスを入力",
        refund_address_header_no_asset: "返金用のウォレットのアドレスを入力",
        refund_backup: "バックアップ",
        refund_import: "バックアップをインポート",
        refund_clear: "ローカルストレージを削除",
        delete_storage:
            "ストレージを削除しても本当にいいですか？\n スワップ情報と、返金、クレーム用の秘密鍵は失われます",
        delete_storage_single_swap:
            "ストレージからスワップ {{ id }} を削除しても本当にいいですか？ \n スワップ情報と、返金、クレーム用の秘密鍵は失われます",
        delete_logs: "ログを削除しても本当にいいですか？",
        tx_in_mempool: "トランザクションがメモリプール内にあります",
        tx_in_mempool_subline: "スワップを完了するために確認を待っています",
        tx_in_mempool_warning:
            "ページを開いたままにしないと、スワップは完了しません！",
        invoice_pending:
            "トランザクションを受け取りました。インボイスを支払っています",
        invoice_pending_pro:
            "トランザクションを受け取りました。インボイスはキューに入りました。場合によっては、スワップがキャンセルされることがあります。",
        invoice_expired:
            "インボイスの有効期限が切れました。もう一度試してください",
        create_invoice_webln: "WebLNを使用してインボイスを作成",
        pay_invoice_webln: "WebLNを使用してインボイスを支払う",
        select_asset: "アセットを選択",
        select_network: "ネットワークを選択",
        search: "検索",
        tx_confirmed: "トランザクションが確認されました",
        tx_ready_to_claim: "トランザクションを実行中...",
        refunded: "このスワップを返金しました",
        locktime_not_satisfied: "ロックタイムの条件を満たしていません",
        already_refunded: "スワップはすでに返金されています",
        api_offline: "APIがオフラインです",
        api_offline_msg:
            "Boltz APIに接続できませんでした。後でもう一度お試しください",
        refund_explainer: "タイムアウト後に返金できます!",
        wasm_not_supported: "ブラウザでWebAssemblyを有効にしてください",
        created: "作成済み",
        view: "表示",
        id: "ID",
        headline:
            "プライバシーファースト、ノンカストディアル型のビットコイン取引所",
        headline_pro: "聪を積み上げる、非托管で！",
        subline:
            "異なるビットコインレイヤーとステーブルコインの間で、完全な管理を保ちながらスワップ。",
        subline_pro:
            "ビットコインをスワップするためサットを稼ぐ、私たちの流動性を調整する方向で。",
        start_swapping: "取引を開始する",
        partners: "パートナー",
        integrations: "インテグレーション",
        oldest_channel_years: "{{ years }}年",
        oldest_channel: "最古のチャネル",
        capacity: "容量（サトシ）",
        peers: "ピアの数",
        num_channels: "チャネルの数",
        beta_caution: "ベータ版の為、ご利用は慎重にお願いします",
        pro: "pro",
        pro_banner: "API経由でBoltz Proを使用したいですか？",
        warning_return:
            "重要：インボイスのお支払い後、このページへ戻ってください！このページに戻るまで、支払いは保留中と表示される場合があります。",
        warning_expiry:
            "必ず24時間以内にトランザクションが承認されるようにしてください",
        not_found: "404 - Not Found",
        not_found_subline: "このページは消えてしまったようです。",
        back_to_home: "ホームに戻る",
        transaction_prompt:
            " 接続したウォレットを開いて、表示されたトランザクションを確認するために　{{ button }} を押してください",
        transaction_prompt_receive:
            " 接続したウォレットを開いて、{{ asset }} を受け取るために表示されたトランザクションを確認するために {{ button }} を押してください",
        transaction_failed: "トランザクションに失敗しました: {{ error }}",
        wallet_request_rejected: "ウォレットでリクエストが拒否されました。",
        invalid_address: "無効な {{ asset }} アドレス",
        scan_qr_code: "QRコードをスキャンする",
        version: "バージョン",
        commithash: "コミットハッシュ",
        open_in_wallet: "ウォレットで開く",
        branding: "ブランディング",
        regtest: "Regtest",
        broadcasting_claim: "クレームトランザクションのブロードキャスト中",
        paste_invalid:
            "クリップボードに無効な文字が含まれるか、最大文字数を超えています",
        email: "Eメール",
        switch_paste: "スワップの方向性/アセットを変更しました",
        settings: "設定",
        decimal_separator: "小数点",
        denomination_tooltip: "希望する単位を選択してください：BTCもしくはSats",
        decimal_tooltip:
            "希望する小数点を選択してください：ドットもしくはコンマ",
        show_fiat_rate: "USDレートを表示",
        show_fiat_rate_tooltip: "スワップ額のUSD換算値を表示",
        fiat_rate_not_available: "USDレートを取得できません",
        swap_completed: " スワップ {{ id }} が無事に成功しました!",
        claim_fail: "クレームのスワップに失敗しました: {{ id }}",
        logs: "ログ",
        logs_tooltip: "ウェブアプリのログ。デバグに便利です",
        hide_wallet_address: "プライバシーモード",
        hide_wallet_address_tooltip:
            "デモや録画時のプライバシー保護のため、EVMウォレットアドレスとスワップIDを非表示にします",
        bitcoin_only: "ビットコイン専用モード",
        bitcoin_only_tooltip:
            "ビットコインとライトニングのみを表示し、他のすべてのペアを非表示にします",
        slippage: "スリッページ",
        slippage_tooltip: "DEXスワップで許容する最大価格スリッページ",
        gas_topup: "ガス自動チャージ",
        gas_topup_tooltip:
            "接続されたウォレットにガスがない場合、スワップの一部を自動的にネイティブガスに変換します。",
        gas_topup_label: "Gas ({{ gasToken }}): 0.{{ cost }}",
        oft_messaging_fee_label: "OFT手数料",
        dex_quote_changed: "DEXのクオートが変更されました",
        zero_conf: "ゼロ確認",
        zero_conf_tooltip: "ブロック内でまだ確認されていない取引を受け入れる",
        on: "オン",
        off: "オフ",
        invalid_pair: "無効なペア",
        error_starting_qr_scanner:
            "カメラにアクセスできませんでした。権限を確認してください！",
        insufficient_balance: "残高不足",
        insufficient_balance_line:
            "このスワップを実行するのに十分な残高がウォレットにありません",
        select_wallet: "ウォレットの選択",
        select_derivation_path: "導出パスの選択",
        submit_derivation_path: "提出",
        not_supported_in_browser: "このブラウザには対応していません",
        switch_network: "ネットワークの切り替え",
        block: "ブロック",
        logs_scan_progress: " 進捗度 {{ value }}%",
        accept: "受入れる",
        wallet_connect_failed: "ウォレット接続の失敗: {{ error }}",
        ledger_open_app_prompt: "イーサリアムもしくはRSKのアプリを開く",
        validate_payment: "支払い証明書の提示",
        no_browser_wallet: "ブラウザのウォレットが検出されない",
        sent: "送信済み",
        will_receive: "受信予定",
        refund_available_in: "返金は {{ blocks }} つのブロックに分かれる",
        no_wallet_connected: "財布はつながっていない！",
        no_lockup_transaction: "ロックアップトランザクションが見つかりません",
        routing_fee_limit: "ルーティング料金の上限",
        download_boltz_rescue_key: "Boltzレスキューキー",
        download_boltz_rescue_key_subline:
            "単一のレスキューキーですべてのスワップをバックアップ 🙌",
        download_boltz_rescue_key_subline_second:
            "このキーはどのデバイスでも動作し、このキーで作成されたすべてのスワップに対応します。キーは安全で永続的な場所に保管してください。",
        download_boltz_rescue_key_subline_third:
            "続行するには、新しいレスキューキーをダウンロードしてください。",
        download_new_key: "新しいキーをダウンロード",
        verify_boltz_rescue_key: "Boltzレスキューキー検証",
        verify_boltz_rescue_key_subline:
            "以前にダウンロードしたBoltzレスキューキーを選択して確認してください。",
        verify_key: "ベリファイキー",
        verify_key_failed:
            "Boltzレスキューキーの検証に失敗しました。続行するには、新しいBoltzレスキューキーをダウンロードすることをお勧めします。",
        rescue_key: "レスキューキー",
        reset_rescue_key_tooltip:
            "新しいレスキューキーを生成し、すべてのスワップデータを削除",
        reset_rescue_key_prompt:
            "⚠️ 警告：これにより、すべてのスワップデータが削除され、新しいレスキューキーが生成されます。\n\n既存のレスキューキーのバックアップがある場合、または絶対に必要ないと確信している場合を除き、続行しないでください。\n\n続行するには 'confirm' と入力してください：",
        reset_rescue_key_invalid_confirmation:
            "無効な確認です。続行するには 'confirm' と入力してください。",
        reset_rescue_key_error:
            "レスキューキーのリセット中にエラーが発生しました。もう一度お試しください。\n\nエラー：{{ error }}",
        reset_rescue_key_success:
            "新しいレスキューキーが正常に生成されました！",
        no_swaps_found: "スワップが見つからない",
        rif_extra_fee:
            "ウォレットに十分なRBTCがないため、RIFリレー手数料を含めて手数料を調整！",
        back: "戻る",
        next: "次へ",
        pagination_info: "{{ end }} ページ中 {{ start }} ページ目",
        generate_key: "新しいキーを生成",
        backup_boltz_rescue_key: "Boltzレスキューキーのバックアップ",
        backup_boltz_rescue_key_subline_second:
            "この新しいキーはどのデバイスでも動作し、このキーで作成されたすべてのスワップに対応します。",
        backup_boltz_rescue_key_subline_third:
            "キーファイルを安全で永続的な場所に保管してください。",
        backup_boltz_rescue_key_reminder:
            "安全に保管してください。共有しないでください。",
        copy_rescue_key: "レスキューキーをコピー",
        user_saved_key: "レスキューキーを保存しました",
        verify_mnemonic_word: {
            start: "あなたのレスキューキーの",
            strong: "{{ number }}番目の単語",
            end: "は何ですか？",
        },
        incorrect_word:
            "間違った単語です。レスキューキーを再確認してください。",
        enter_mnemonic: "レスキューキーを入力",
        verify_boltz_rescue_key_mnemonic:
            "下にレスキューキーを入力してインポートしてください。",
        hint_paste_mnemonic:
            "ヒント：12個の単語を一度に貼り付けることができます。",
        swap_opportunities: "可能なProの機会",
        swap_opportunities_subline:
            "これらのペアをスワップしてサトシを獲得または割引を受ける",
        pro_fee: "Pro料金",
        regular_fee: "通常料金",
        swap_opportunities_accordion: "Pro機会",
        no_opportunities_found: {
            text: "現在利用可能なPro機会はありません。後ほど再度確認してください。。",
            telegram_bot_text_prefix: "手数料アラートは、",
            telegram_bot_text_middle: "または",
            telegram_bot_text_suffix: "のボットをご確認ください。",
            telegram_bot: "Telegram",
            simplex: "SimpleX",
        },
        refresh_for_refund:
            "このスワップにビットコインを送金した場合は、ページを更新して払い戻しを確認してください。",
        applied_routing_hint:
            "受取人は{{ asset }}の直接受け取りに対応しています。これにより手数料が節約でき、相手は引き続き全額を受け取ります。",
        optimized_route_amount:
            "スワップ経路が最適化され、約{{ amount }} {{ denomination }}を節約できました。",
        claim: "クレーム",
        claimed: "スワップが正常にクレームされました！",
        rescue: "救済",
        rescue_swap: "スワップを救済",
        claim_swap: "クレーム：{{ id }}",
        failed_get_swap: "スワップ {{ id }} を取得できませんでした",
        failed_get_swap_subline:
            "レスキューキーを再挿入し、もう一度お試しください。",
        in_progress: "進行中",
        completed: "完了",
        get_refundable_error:
            "UTXO データの読み込みに失敗しました。ページを更新して再試行するか、問題が続く場合はインターネット接続を確認してください。",
        min_amount_destination:
            "宛先アドレスの最小金額は{{ amount }} {{ denomination }}です",
        max_amount_destination:
            "宛先アドレスの最大金額は{{ amount }} {{ denomination }}です",
        destination: "宛先アドレス",
        destination_address: "{{ address }}",

        // Products page
        products: "製品",
        products_description:
            "Bitcoinレイヤー間のシームレスな相互運用性を実現する製品スイート",
        products_plugin_title: "Boltz BTCPayプラグイン",
        products_plugin_description:
            "Lightningノードを実行せずに簡単にLightning決済を受け入れるノンカストディアルソリューション",
        products_client_title: "Boltzクライアント",
        products_client_description:
            "サーバー統合とリクイディティ管理のための当社のエンタープライズグレードのスワップデーモン",
        products_pro_title: "Boltz Pro",
        products_pro_description: "スワップでsatsを稼げるプラットフォーム",
        learn_more: "詳細を見る",
        get_started: "Boltz Proを開く",
        documentation: "ドキュメント",
        view_on_github: "Githubで見る",
        chat_with_us: "チャットする",

        // Plugin
        boltz_plugin_name: "Boltz BTCPayプラグイン",
        boltz_plugin_description:
            "Lightning決済を簡単に受け入れるノンカストディアルソリューション",
        boltz_plugin_step_install_title: "プラグインを追加",
        boltz_plugin_step_install_description:
            "BTCPayサーバーにBoltzプラグインをインストールする",
        boltz_plugin_step_setup_title: "ウォレットを設定",
        boltz_plugin_step_setup_description:
            "外部ウォレットを接続するか、新しいウォレットを作成する",
        boltz_plugin_step_paid_title: "Lightningを受け入れる",
        boltz_plugin_step_paid_description:
            "メインチェーンBitcoinに自動決済されるLightning決済を受け取る",
        boltz_plugin_features_title: "なぜ使うのか？",
        boltz_plugin_features_description:
            "複雑さなしに完全なコントロールを求めるマーチャントのために構築",
        boltz_plugin_feature_flexible_title: "柔軟",
        boltz_plugin_feature_flexible_description:
            "ノードを実行せずにLightning決済を受け入れるか、既存のLightningノードのリクイディティを完全に管理する",
        boltz_plugin_feature_liquid_title: "Liquidで駆動",
        boltz_plugin_feature_liquid_description:
            "低手数料と高いプライバシーのためにLiquid Taproot Swapsのパワーを完全に活用",
        boltz_plugin_feature_autoswap_title: "Bitcoinで決済",
        boltz_plugin_feature_autoswap_description:
            "設定に基づいてメインチェーンBitcoinへ自動スワップ",
        boltz_plugin_feature_self_custodial_title: "ノンカストディアル",
        boltz_plugin_feature_self_custodial_description:
            "Boltz Atomic Swapsによって駆動され、Bitcoinの完全なコントロールを維持",

        boltz_plugin_questions_title: "質問がありますか？",
        boltz_plugin_questions_subtitle: "ぜひお聞かせください！",
        // Client
        boltz_client_name: "Boltzクライアント",
        boltz_client_description:
            "サーバー統合とリクイディティ管理のためのエンタープライズグレードのスワップデーモン",
        boltz_client_features_title: "企業とプロフェッショナル向けに構築",
        boltz_client_features_description:
            "プロフェッショナルLightningノードオペレーター向けに設計された強力な機能",
        boltz_client_feature_taproot_title: "Taproot優先",
        boltz_client_feature_taproot_description:
            "効率性とプライバシーの向上のためにTaproot Swapsを活用",
        boltz_client_node_agnostic_title: "ノード非依存",
        boltz_client_node_agnostic_description:
            "LNDに加えてCLNへのファーストクラスサポート、インフラストラクチャにおける柔軟性を提供",
        boltz_client_autoswap_title: "インテリジェント自動スワップ",
        boltz_client_autoswap_description:
            "カスタマイズ可能な設定とBitcoinでのスマート決済を備えた自動チャネル再バランシングの細かい制御",
        boltz_client_liquid_title: "Liquid優先",
        boltz_client_liquid_description:
            "低手数料、高速実行、プライバシー強化のためにLiquidスワップを使用したチャネル再バランシングに最適化",
        boltz_client_cli_title: "強力なAPIとCLI",
        boltz_client_cli_first_paragraph:
            "インフラストラクチャへのシームレスな統合のための組み込みウォレットシステムと包括的なAPI。",
        boltz_client_cli_second_paragraph:
            "独自のアプリケーションまたはCLI経由で監視、制御、自動化。",
        boltz_client_cta_title: "インフラストラクチャにBoltzを追加！",
        boltz_client_cta_subtitle:
            "Boltz Clientを使用している企業やノードランナーのコミュニティに参加",

        // Pro
        boltz_pro_name: "Boltz Pro",
        boltz_pro_description: "スワップでsatsを稼げるプラットフォーム",
        boltz_pro_how_it_works_title: "仕組み",
        boltz_pro_how_it_works_description:
            "当社のリクイディティの再バランスに役立つ方向にスワップすることで報酬を得る",
        boltz_pro_chart_title: "Boltz Pro手数料履歴サンプル",
        boltz_pro_chart_y_axis: "Boltz Pro手数料",
        boltz_pro_chart_x_axis: "日付",
        boltz_pro_negative_fee: "satsを獲得",
        boltz_pro_lower_fee: "satsを節約",
        boltz_pro_regular_fee: "通常のBoltz手数料",
        boltz_pro_target_audience_title: "Boltz Proは誰のため？",
        boltz_pro_target_audience_subtitle:
            "日常の支払いではなく、satsを稼ぎたいプロフェッショナル向けに構築",
        boltz_pro_perfect_for_title: "最適なのは",
        boltz_pro_perfect_for_1:
            "過剰なインバウンドリクイディティを減らしてsatsを獲得したいLightningノードオペレーター",
        boltz_pro_perfect_for_2:
            "外部ノードオペレーターと協力してリクイディティを管理するプロフェッショナル",
        boltz_pro_perfect_for_3:
            "Boltz Proのルーティング制限内でLightningウォレットをチャージするユーザー",
        boltz_pro_not_designed_for_title: "適していないのは",
        boltz_pro_not_designed_for_1:
            "コーヒーを買うなどの日常的なLightning決済",
        boltz_pro_not_designed_for_2:
            "高いルーティング手数料の宛先への信頼性の高い支払い",
        boltz_pro_not_designed_for_3:
            "即座の支払い実行が保証されることを必要とするシナリオ",
        boltz_pro_cta_title: "今すぐsatsを獲得開始！",
        boltz_pro_cta_subtitle: "現在のsatsを稼ぐ機会を見つける",
        boltz_pro_options_title: "Boltz Proの3つの使用方法",
        boltz_pro_options_subtitle: "最適なものを選択",
        boltz_pro_option_client_title: "Boltzクライアント",
        boltz_pro_option_client_description:
            "APIとCLI経由でBoltz Proを完全に自動化",
        boltz_pro_option_web_title: "Webアプリ",
        boltz_pro_option_web_description:
            "Boltz Pro Webアプリで観察してスワップ",
        boltz_pro_option_chat_title: "チャットボット",
        boltz_pro_option_chat_description_prefix:
            "Boltz Pro の機会に関する即時通知を",
        boltz_pro_option_chat_description_middle: "または",
        boltz_pro_option_chat_description_suffix: "で受け取る。",

        balance: "残高",
        display: "表示",
        security: "セキュリティ",
        failed: "失敗",
        swaps_found: "スワップをスキャン中（{{ count }} 件見つかりました）",
        claim_scan_required:
            "このスワップを請求するには、レスキューファイルをアップロードして戻り、スキャンしてください。",
        invalid_rescue_key_evm:
            "このレスキューキーはこのスワップに関連付けられていません。別のレスキューキーを使用してもう一度お試しください。",
        error_occurred: "エラーが発生しました：{{ error }}",
        rsk_rescue_prompt:
            "Boltz スワップに RBTC を送金した場合は「スワップを返金」を使用し、RBTC を受け取っていた場合は「スワップを再開」を使用して、このブラウザのスワップ履歴にないスワップを救済してください。",
        rsk_rescue_refund_title: "スワップを返金",
        rsk_rescue_refund_explainer:
            "Rootstock ウォレットを接続して、期限切れで返金可能なスワップをスキャンします。",
        rsk_rescue_resume_title: "スワップを再開",
        rsk_rescue_resume_explainer:
            "レスキューキーを使用して、再開できる保留中のスワップを見つけます。",
        searching_resumable_swaps:
            "再開可能なスワップを検索中... {{ progress }}%",
        unmatched_swaps:
            "このウォレットには追加で {{ count }} 件の請求可能なスワップがあります。アクセスするには、これらのスワップの開始に使用したレスキューキーに切り替えてください。",
        approve_erc20: "承認",
        approve_erc20_line: "スワップコントラクトのERC20許可額を設定",
    },
};

type NestedKeyOf<T> = {
    [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
}[keyof T & string];

export type DictKey = NestedKeyOf<typeof dict.en>;

export const rawDict = JSON.parse(JSON.stringify(dict));

Object.entries(dict)
    .filter(([lang]) => lang !== "en")
    .map(([, langDict]) => {
        Object.entries(dict.en).map(([key, enVal]) => {
            if (langDict[key] === undefined) {
                langDict[key] = enVal;
            }
        });
    });

export default dict;
