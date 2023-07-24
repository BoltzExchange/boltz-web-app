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
        refunded: "Swap has been refunded",
        broadcasted: "Refund broadcasted",
        locktime_not_satisfied: "Locktime requirement not satisfied",
        already_refunded: "Swap already refunded",
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
        l2: "L2技術を活用",
        l2_sub: "Boltzは、LiquidネットワークやLightningネットワークなどのL2スケーリング技術を利用しています",
        assets_sub: "Lightning / Bitcoin / Liquid",
        safe: "安全",
        non_custodial: "ノンカストディアル型",
        non_custodial_sub:
            "Boltzのスワップはノンカストディアル型です。暗号技術により、ユーザーは常に資金を自己管理できます",
        node: "ノード",
        lightningnode: "Lightningノードを表示",
        error: "エラー",
        error_subline: "APIからの無効な応答です。何かが間違っています",
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
            "Bolt11インボイス、またはライトニングアドレス、またはLNURL Paylinkを貼り付けてください\n\n金額：{{ amount }} {{ denomination }}",
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
        invoice_payment_failure: "インボイスを支払うことができませんでした",
        onchain_address: "{{ asset }}アドレスを入力してください",
        download_refund_file: "返金ファイルをダウンロード",
        copy_invoice: "インボイスをコピー",
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
            "トランザクションを受け取りました。インボイスを支払っています",
        invoice_expired:
            "インボイスの有効期限が切れました。もう一度試してください",
        swap_expired: "支払いがタイムリーに完了されませんでした",
        create_invoice_webln: "WebLNを使用してインボイスを作成",
        pay_invoice_webln: "WebLNを使用してインボイスを支払う",
        select_asset: "アセットを選択",
        tx_confirmed: "トランザクションが確認されました",
        tx_ready_to_claim: "トランザクションを実行中...",
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
        headline:
            "プライバシーファースト、ノンカストディアル型のビットコイン取引所",
        subline: "誰にも奪われない。常に、お金はあなたの管理下に。",
        start_swapping: "取引を開始する",
        partners: "パートナー",
        integrations: "インテグレーション",
        oldest_channel_years: "{{ years }}年",
        oldest_channel: "最古のチャネル",
        capacity: "容量（サトシ）",
        peers: "ピアの数",
        num_channels: "チャネルの数",
        send_to:
            "{{ amount }} {{ denomination }} を以下のアドレスへ送金して下さい",
        send_to_desc:
            "{{ amount }} {{ denomination }} を過不足なく、{{ blockheight }}ブロック高になる前に送金して下さい",
        beta_caution: "ベータ版の為、ご利用は慎重にお願いします",
        warning_return:
            "重要：インボイスのお支払い後、このページへ戻ってください",
    },
    de: {
        status: "Status",
        feedback: "Feedback? Schreib uns auf",
        fast: "Schnell",
        l2: "Auf Layer-2 gebaut",
        l2_sub: "Boltz nutzt Layer-2 Skalierungstechnologien wie das Liquid- und Lightning-Netzwerk",
        assets_sub: "Lightning / Bitcoin / Liquid",
        safe: "Sicher",
        non_custodial: "Non-Custodial",
        non_custodial_sub:
            "Swaps auf Boltz sind non-custodial; Kryptografie stellt sicher, dass du stets die Kontrolle über deine Bitcoin behältst",
        node: "Knoten",
        lightningnode: "Knoten anzeigen",
        error: "Fehler",
        error_subline:
            "Ungültige Antwort von der API, irgendwas ist hier falsch.",
        history: "Historie",
        swap: "Swap",
        channel: "Kanal",
        refund: "Starte Rückerstattung",
        blog: "Blog",
        documentation: "Dokumentation",
        onion: "Onion",
        blockexplorer: "Im Blockexplorer anzeigen",
        help: "Hilfe",
        network_fee: "Netzwerkgebühr",
        fee: "Boltzgebühr",
        denomination: "Denominierung",
        send: "Sende",
        min: "Min",
        max: "Max",
        minimum_amount: "Mindestbetrag ist {{ amount }} {{ denomination }}",
        maximum_amount: "Höchstbetrag ist {{ amount }} {{ denomination }}",
        assets: "Multi-layer",
        socialmedia: "Folge uns auf",
        footer: "Gemacht mit ❤️ von Team Boltz",
        create_channel: "Erstelle Lightning-Kanal",
        create_channel_subline: "Eingehende oder ausgehende Kapazität",
        create_swap: "Erstelle Atomic Swap",
        create_swap_subline: "Zahlung beinhaltet Netzwerk- und Boltzgebühr",
        cancel_swap: "Swap abbrechen",
        new_swap: "Neuer Swap",
        success_swap: "Swap erfolgreich",
        feecheck:
            "Die Netzwerkgebühr wurde aufgrund der Netzwerksituation aktualisiert. Bitte bestätige die neuen Beträge und fahren mit dem Swap fort.",
        create_and_paste:
            "Füge eine bolt11 Lightning-Rechnung\n eine Lightning-Adresse\n oder einen LNURL Paylink hier ein\n\nBetrag: {{ amount }} {{ denomination }}",
        congrats: "Herzlichen Glückwunsch!",
        successfully_swapped: "Swap erfolgreich!",
        timeout_eta: "Timeout-ETA",
        pay_invoice: "Swap: {{ id }}",
        pay_swap_404: "Swap nicht gefunden!",
        pay_timeout_blockheight: "Timeout Blockhöhe",
        pay_expected_amount: "Erwarteter Betrag",
        send_to: "Sende {{ amount }} {{ denomination }} an",
        send_to_desc:
            "Bitte sende genau {{ amount }} {{ denomination }} vor der Timeout-Blockhöhe {{ blockheight }}",
        pay_address: "Adresse",
        lockup_failed: "Lockup fehlgeschlagen!",
        lockup_failed_subline:
            "Deine Lockup-Transaktion ist fehlgeschlagen, warte auf den Timeout, um eine Rückerstattung zu starten.",
        failure_reason: "Grund für den Fehler",
        invoice_payment_failure:
            "Deine Lightning-Rechung konnte nicht bezahlt werden",
        onchain_address: "{{ asset }}-Adresse eingeben",
        download_refund_file: "Rückerstattungsdatei herunterladen",
        copy_invoice: "Lightning-Rechnung kopieren",
        copy_address: "Adresse kopieren",
        copy_amount: "Betrag kopieren",
        copy_bip21: "BIP21 kopieren",
        copied: "In die Zwischenablage kopiert!",
        refund_a_swap: "Einen Swap erstatten",
        refund_a_swap_subline:
            "Laden deine Rückerstattungsdatei hoch und hole dir deine Bitcoin aus einem fehlgeschlagenen Swap zurück",
        refund_past_swaps: "Historische Swaps",
        refund_past_swaps_subline:
            "Swaps, die in deinem Browser gespeichert wurden",
        history_no_swaps:
            "Es sieht so aus, als hättest du noch nicht geswappt.",
        refund_address_placeholder: "Rückerstattungsadresse",
        refund_clear: "Lokalen Speicher löschen",
        delete_swap: "Swap aus dem lokalen Speicher löschen",
        delete_localstorage:
            "Bist du sicher, dass du deinen lokalen Speicher löschen möchtest?\nDeine Swap-Informationen und Rückerstattungsschlüssel gehen dabei verloren.",
        delete_localstorage_single_swap:
            "Bist du sicher, dass du den Swap {{ id }} aus deinem lokalen Speicher löschen möchtest?\nDeine Swap-Informationen und Rückerstattungsschlüssel gehen dabei verloren.",
        tx_in_mempool: "Transaktion befindet sich im Mempool",
        tx_in_mempool_subline:
            "Warte auf Bestätigung, um den Swap abzuschließen",
        expired: "Swap ist abgelaufen!",
        invoice_pending: "Transaktion erhalten, Rechnung wird bezahlt.",
        invoice_expired: "Rechnung ist abgelaufen, bitte erneut versuchen!",
        swap_expired: "Du hast deine Zahlung nicht rechtzeitig abgeschlossen.",
        create_invoice_webln: "Rechnung über WebLN erstellen",
        pay_invoice_webln: "Rechnung über WebLN bezahlen",
        select_asset: "Asset auswählen",
        tx_confirmed: "Transaktion bestätigt",
        tx_ready_to_claim: "Claime die Transaktion jetzt...",
        transaction_refunded: "Boltz hat die Transaktion erstattet",
        refunded: "Swap wurde erstattet",
        broadcasted: "Rückerstattung gesendet",
        locktime_not_satisfied: "Locktime-Anforderung nicht erfüllt",
        already_refunded: "Swap wurde bereits erstattet",
        api_offline: "API ist offline",
        api_offline_msg:
            "Konnte keine Verbindung zur Boltz API herstellen. Bitte versuche es später noch einmal.",
        refund_explainer:
            "Du kannst nach dem Timeout eine Rückerstattung beantragen",
        swap_not_refundable_yet: "Dein Swap kann noch nicht erstattet werden",
        wasm_not_supported: "Bitte aktivieren Sie WebAssembly in Ihrem Browser",
        ios_image_download:
            'Lange drücken und "In Fotos speichern" auswählen, um die Rückerstattungsdatei herunterzuladen',
        created: "Erstellt",
        delete: "Löschen",
        view: "Anzeigen",
        id: "ID",
        headline: "Privacy First, Non-Custodial Bitcoin Exchange",
        subline: "Du hast volle Kontrolle über dein Geld. Zu jeder Zeit.",
        start_swapping: "Starte Swap",
        partners: "Partner",
        integrations: "Integrationen",
        oldest_channel_years: "{{ years }} Jahre",
        oldest_channel: "Ältester Kanal",
        capacity: "Kapazität (Sats)",
        peers: "Anzahl der Peers",
        num_channels: "Anzahl der Kanäle",
        beta_caution: "BETA - OBACHT!",
        warning_return:
            "Wichtig: Kehre nach dem Bezahlen der Rechnung zu dieser Seite zurück",
    },
};

export default dict;
