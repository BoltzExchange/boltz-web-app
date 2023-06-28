const dict = {
    en: {
        status: "Status",
        feedback: "Got Feedback? Join our",
        fast: "Fast",
        l2: "Built on Layer 2",
        l2_sub: "Boltz utilizes second-layer scaling technologies like the Liquid and Lightning Networks",
        assets_sub: "Lightning / Bitcoin / Liquid",
        safe: "Safe",
        non_custodial: "Non-Custodial",
        non_custodial_sub:
            "Swaps on Boltz are non-custodial; cryptography ensures that users are always in control of their money",
        node: "Node",
        lightningnode: "view lightning node",
        error: "Error",
        error_subline: "Invalid response from the API, something is wrong.",
        history: "History",
        swap: "Swap",
        channel: "Channel",
        refund: "Refund",
        blog: "Blog",
        documentation: "Docs",
        onion: "Onion",
        blockexplorer: "View in block explorer",
        help: "Help",
        network_fee: "Network Fee",
        fee: "Boltz Fee",
        denomination: "Denomination",
        send: "Send",
        min: "Min",
        max: "Max",
        minimum_amount: "Minimum amount is {{ amount }} {{ denomination }}",
        maximum_amount: "Maximum amount is {{ amount }} {{ denomination }}",
        assets: "Assets",
        socialmedia: "Follow us on",
        footer: "Made with ❤️ by Team Boltz",
        create_channel: "Create Lightning Channel",
        create_channel_subline: "Channel Inbound or Outbound Capacity",
        create_swap: "Create Atomic Swap",
        create_swap_subline: "Payment includes network and boltz service fees",
        cancel_swap: "Cancel Swap",
        new_swap: "New Swap",
        success_swap: "Swap Success",
        feecheck:
            "Network fee was updated based on network situation, please confirm new amounts and continue with swap.",
        create_and_paste:
            "Paste a bolt11 lightning invoice\n or a Lightning address\nor a LNURL Paylink\n\nAmount: {{ amount }} {{ denomination }}",
        congrats: "Congratulations!",
        successfully_swapped: "Your swap completed successfully",
        timeout_eta: "Timeout ETA",
        pay_invoice: "Swap: {{ id }}",
        pay_swap_404: "Swap not found!",
        pay_timeout_blockheight: "Timeout block height",
        pay_expected_amount: "Expected amount",
        send_to: "Send {{ amount }} {{ denomination }} to",
        send_to_desc:
            "Please send exactly {{ amount }} {{ denomination }} before timeout block height {{ blockheight }}",
        pay_address: "Address",
        lockup_failed: "Lockup Failed!",
        lockup_failed_subline:
            "Your lockup transaction failed, wait for the timeout to refund.",
        failure_reason: "Failure reason",
        invoice_payment_failure: "Could not pay your lightning invoice",
        onchain_address: "Enter {{ asset }} address",
        download_refund_file: "Download refund file",
        copy_invoice: "Copy lightning invoice",
        copy_address: "Copy address",
        copy_amount: "Copy amount",
        copy_bip21: "Copy BIP21",
        copied: "Copied to clipboard!",
        refund_a_swap: "Refund a swap",
        refund_a_swap_subline:
            "Upload your refund file and reclaim your locked funds",
        refund_past_swaps: "Past swaps",
        refund_past_swaps_subline:
            "Swaps that got saved into your browsers storage",
        history_no_swaps: "Looks like you didn't do any swaps yet.",
        refund_address_placeholder: "Refund address",
        refund_clear: "Delete localstorage",
        delete_swap: "Delete swap from localstorage",
        delete_localstorage:
            "Are you sure you want to clear your localstorage?\nYour swap information and you refund / claim privatekeys will be lost.",
        delete_localstorage_single_swap:
            "Are you sure you want to clear Swap {{ id }} from your localstorage?\nYour swap information and you refund / claim privatekeys will be lost.",
        tx_in_mempool: "Transaction is in mempool",
        tx_in_mempool_subline: "waiting for confirmation to complete the swap",
        expired: "Swap expired!",
        invoice_pending: "Transaction received, paying invoice.",
        invoice_expired: "Invoice expired, try again!",
        swap_expired: "You did not complete your payment in time.",
        create_invoice_webln: "create invoice via WebLN",
        pay_invoice_webln: "pay invoice via WebLN",
        select_asset: "Select Asset",
        tx_confirmed: "Transaction confirmed",
        tx_ready_to_claim: "claiming transaction now...",
        transaction_refunded: "Boltz has refunded the Transaction",
        refunded: "You have refunded this swap",
        api_offline: "API is offline",
        api_offline_msg:
            "Could not connect to the Boltz API, please try again later",
        refund_explainer: "You will be able to refund after the timeout",
        swap_not_refundable_yet: "Your swap is not refundable yet",
        wasm_not_supported: "Please activate WebAssembly in your browser",
        ios_image_download:
            'Long press and select "Save to Photos" to download refund file',
        created: "Created",
        delete: "Delete",
        view: "View",
        id: "ID",
        headline: "Privacy First, Non-Custodial Bitcoin Exchange",
        subline: "Can't be evil. You are in control of your money. Always.",
        start_swapping: "Start Swapping",
        partners: "Partners",
        integrations: "Integrations",
        oldest_channel_years: "{{ years }} yrs",
        oldest_channel: "Oldest Channel",
        capacity: "Capacity (sats)",
        peers: "Number of Peers",
        num_channels: "Number of Channels",
        beta_caution: "BETA - USE WITH CAUTION!",
        warning_return: "Important: Return to this page after paying invoice",
    },
    ja: {
        status: "ステータス",
        feedback: "フィードバックはこちらへ",
        fast: "高速",
        l2: "第2層に基づく",
        l2_sub: "Boltzは、LiquidネットワークやLightningネットワークなどの第2層スケーリング技術を利用しています",
        assets_sub: "Lightning / Bitcoin / Liquid",
        safe: "安全",
        non_custodial: "非預託型",
        non_custodial_sub:
            "Boltzのスワップは非預託型です。暗号技術により、ユーザーは常に資金を自己管理できます",
        node: "ノード",
        lightningnode: "Lightningノードを表示",
        error: "エラー",
        error_subline: "APIからの無効な応答、何かが間違っています",
        history: "履歴",
        swap: "スワップ",
        channel: "チャネル",
        refund: "返金",
        blog: "ブログ",
        documentation: "ドキュメント",
        onion: "Onion",
        blockexplorer: "ブロックエクスプローラーで表示",
        help: "ヘルプ",
        network_fee: "ネットワーク手数料",
        fee: "Boltz手数料",
        denomination: "単位",
        send: "送信",
        min: "最小",
        max: "最大",
        minimum_amount: "最小金額は{{ amount }} {{ denomination }}です",
        maximum_amount: "最大金額は{{ amount }} {{ denomination }}です",
        assets: "アセット",
        socialmedia: "ソーシャルメディアでフォロー",
        footer: "Team Boltzによる❤️で作成されました",
        create_channel: "Lightningチャネルの作成",
        create_channel_subline:
            "チャネルのインバウンドまたはアウトバウンド容量",
        create_swap: "Atomic Swapの作成",
        create_swap_subline:
            "支払いにはネットワーク手数料とBoltzサービス手数料が含まれます",
        cancel_swap: "スワップのキャンセル",
        new_swap: "新しいスワップ",
        success_swap: "スワップが成功しました",
        feecheck:
            "ネットワーク手数料はネットワーク状況に基づいて更新されました。新しい金額を確認し、スワップを続行してください",
        create_and_paste:
            "Bolt11ライトニング請求書、またはライトニングアドレス、またはLNURL Paylinkを貼り付けてください\n\n金額：{{ amount }} {{ denomination }}",
        congrats: "おめでとうございます！",
        successfully_swapped: "スワップが正常に完了しました",
        timeout_eta: "タイムアウト予想時間",
        pay_invoice: "スワップ：{{ id }}",
        pay_swap_404: "スワップが見つかりません！",
        pay_timeout_blockheight: "タイムアウトブロック高",
        pay_expected_amount: "予想金額",
        pay_address: "アドレス",
        lockup_failed: "ロックアップに失敗しました！",
        lockup_failed_subline:
            "ロックアップトランザクションが失敗しました。タイムアウトまで待って返金してください",
        failure_reason: "失敗の理由",
        invoice_payment_failure:
            "ライトニング請求書を支払うことができませんでした",
        onchain_address: "{{ asset }}アドレスを入力してください",
        download_refund_file: "返金ファイルをダウンロード",
        copy_invoice: "ライトニング請求書をコピー",
        copy_address: "アドレスをコピー",
        copy_amount: "金額をコピー",
        copy_bip21: "BIP21をコピー",
        copied: "クリップボードにコピーしました！",
        refund_a_swap: "スワップを返金する",
        refund_a_swap_subline:
            "返金ファイルをアップロードし、ロックされた資金を回収します",
        refund_past_swaps: "過去のスワップ",
        refund_past_swaps_subline: "ブラウザのストレージに保存されたスワップ",
        history_no_swaps: "まだスワップを行っていないようです。",
        refund_address_placeholder: "返金先アドレス",
        refund_clear: "ローカルストレージを削除",
        delete_swap: "ローカルストレージからスワップを削除",
        delete_localstorage:
            "ローカルストレージをクリアしてもよろしいですか？\nスワップ情報と返金/請求の秘密鍵が失われます。",
        delete_localstorage_single_swap:
            "Swap {{ id }}をローカルストレージから削除してもよろしいですか？\nスワップ情報と返金/請求の秘密鍵が失われます。",
        tx_in_mempool: "トランザクションがメモリプール内にあります",
        tx_in_mempool_subline: "スワップを完了するために確認を待っています",
        expired: "スワップが期限切れです！",
        invoice_pending:
            "トランザクションを受け取りました。請求書を支払っています",
        invoice_expired: "請求書の有効期限が切れました。もう一度試してください",
        swap_expired: "支払いがタイムリーに完了されませんでした",
        create_invoice_webln: "WebLNを使用して請求書を作成",
        pay_invoice_webln: "WebLNを使用して請求書を支払う",
        select_asset: "アセットを選択",
        tx_confirmed: "トランザクションが確認されました",
        tx_ready_to_claim: "請求トランザクションを実行中...",
        transaction_refunded: "Boltzがトランザクションを返金しました",
        refunded: "このスワップを返金しました",
        api_offline: "APIがオフラインです",
        api_offline_msg:
            "Boltz APIに接続できませんでした。後でもう一度お試しください",
        refund_explainer: "タイムアウト後に返金できます",
        swap_not_refundable_yet: "まだスワップは返金できません",
        wasm_not_supported: "ブラウザでWebAssemblyを有効にしてください",
        ios_image_download:
            "長押しして「「写真に保存」を選択して返金ファイルをダウンロードしてください",
        created: "作成済み",
        delete: "削除",
        view: "表示",
        id: "ID",
        headline: "プライバシーファースト、非預託型のビットコイン取引所",
        subline: "悪者になれない。お金はあなたがコントロールします。常に。",
        start_swapping: "スワッピングを開始する",
        partners: "パートナー",
        integrations: "インテグレーション",
        oldest_channel_years: "{{ years }}年",
        oldest_channel: "最古のチャネル",
        capacity: "容量（サトシ）",
        peers: "ピアの数",
        num_channels: "チャネルの数",
    },
};

export default dict;
