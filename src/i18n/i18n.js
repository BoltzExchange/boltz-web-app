const dict = {
    en: {
        language: "English",
        status: "Status",
        feedback: "Got Feedback? Join our",
        fast: "Fast",
        l2: "Built on Layer 2",
        l2_sub: "Boltz utilizes second-layer scaling technologies like the Liquid and Lightning Network",
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
        blockexplorer: "open {{ typeLabel }}",
        blockexplorer_lockup_address: "lockup address",
        blockexplorer_claim_tx: "claim transaction",
        blockexplorer_refund_tx: "refund transaction",
        help: "Help",
        network_fee: "Network Fee",
        fee: "Boltz Fee",
        denomination: "Denomination",
        send: "Send",
        receive: "Receive",
        min: "Min",
        max: "Max",
        minimum_amount: "Minimum amount is {{ amount }} {{ denomination }}",
        maximum_amount: "Maximum amount is {{ amount }} {{ denomination }}",
        assets: "Multi-Layer",
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
        send_to: "Send {{ amount }} {{ asset }} to",
        pay_invoice_to:
            "Pay this invoice about {{ amount }} {{ denomination }}",
        pay_address: "Address",
        lockup_failed: "Lockup Failed!",
        lockup_failed_subline:
            "Your lockup transaction failed, wait for the timeout to refund.",
        failure_reason: "Failure reason",
        invoice_payment_failure: "Could not pay your lightning invoice",
        onchain_address: "Enter {{ asset }} address",
        download_refund_file: "Download refund file",
        invalid_refund_file: "Invalid refund file",
        invalid_backup_file: "Invalid backup file",
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
        refund_backup: "Backup",
        refund_import: "Import Backup",
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
        select_asset: "Select {{ direction }} Asset",
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
        warning_expiry:
            "Make sure your transaction confirms within {{ hours }} hours!",
        not_found: "404 - Page Not Found",
        not_found_subline: "The page you are looking for does not exist.",
        back_to_home: "Back to Home",
    },
    de: {
        language: "Deutsch",
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
        refund: "Rückerstattung",
        blog: "Blog",
        documentation: "Docs",
        onion: "Onion",
        blockexplorer: "{{ typeLabel }} anzeigen",
        blockexplorer_lockup_address: "Lockupadresse",
        blockexplorer_claim_tx: "Claimtransaktion",
        blockexplorer_refund_tx: "Rückerstattungstransaktion",
        help: "Hilfe",
        network_fee: "Netzwerkgebühr",
        fee: "Boltzgebühr",
        denomination: "Denominierung",
        send: "Sende",
        receive: "Empfange",
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
        success_swap: "Swap erfolgreich!",
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
        send_to: "Sende {{ amount }} {{ asset }} an",
        pay_invoice_to: "Zahle Rechnung über {{ amount }} {{ denomination }}",
        pay_address: "Adresse",
        lockup_failed: "Lockup fehlgeschlagen!",
        lockup_failed_subline:
            "Deine Lockup-Transaktion ist fehlgeschlagen, warte auf den Timeout, um eine Rückerstattung zu starten.",
        failure_reason: "Grund für den Fehler",
        invoice_payment_failure:
            "Deine Lightning-Rechung konnte nicht bezahlt werden",
        onchain_address: "{{ asset }}-Adresse eingeben",
        download_refund_file: "Rückerstattungsdatei herunterladen",
        invalid_refund_file: "Ungültige Rückerstattungsdatei",
        invalid_backup_file: "Ungültige Backupdatei",
        copy_invoice: "Lightning-Rechnung kopieren",
        copy_address: "Adresse kopieren",
        copy_amount: "Betrag kopieren",
        copy_bip21: "BIP21 kopieren",
        copied: "In die Zwischenablage kopiert!",
        refund_a_swap: "Einen Swap erstatten",
        refund_a_swap_subline:
            "Lade deine Rückerstattungsdatei hoch und hole dir deine Bitcoin aus einem fehlgeschlagenen Swap zurück",
        refund_past_swaps: "Historische Swaps",
        refund_past_swaps_subline:
            "Swaps, die in deinem Browser gespeichert wurden",
        history_no_swaps:
            "Es sieht so aus, als hättest du noch nicht geswappt.",
        refund_address_placeholder: "Rückerstattungsadresse",
        refund_backup: "Backup",
        refund_import: "Backup importieren",
        refund_clear: "Lokalen Speicher löschen",
        delete_swap: "Swap aus dem lokalen Speicher löschen",
        delete_localstorage:
            "Bist du sicher, dass du deinen lokalen Speicher löschen möchtest?\nDeine Swap-Informationen und Rückerstattungsschlüssel gehen dabei verloren.",
        delete_localstorage_single_swap:
            "Bist du sicher, dass du den Swap {{ id }} aus deinem lokalen Speicher löschen möchtest?\nDeine Swap-Informationen und Rückerstattungsschlüssel gehen dabei verloren.",
        tx_in_mempool: "Transaktion befindet sich im Mempool.",
        tx_in_mempool_subline:
            "Warte auf Bestätigung, um den Swap abzuschließen.",
        expired: "Swap ist abgelaufen!",
        invoice_pending: "Transaktion erhalten, Rechnung wird bezahlt.",
        invoice_expired: "Rechnung ist abgelaufen, bitte erneut versuchen!",
        swap_expired: "Du hast deine Zahlung nicht rechtzeitig abgeschlossen.",
        create_invoice_webln: "Rechnung über WebLN erstellen",
        pay_invoice_webln: "Rechnung über WebLN bezahlen",
        select_asset: "{{ direction }} - Asset auswählen",
        tx_confirmed: "Transaktion bestätigt!",
        tx_ready_to_claim: "Claime die Transaktion jetzt...",
        transaction_refunded: "Boltz hat die Transaktion erstattet.",
        refunded: "Swap wurde erstattet.",
        broadcasted: "Rückerstattung gesendet.",
        locktime_not_satisfied: "Locktime-Anforderung nicht erfüllt.",
        already_refunded: "Swap wurde bereits erstattet!",
        api_offline: "API ist offline",
        api_offline_msg:
            "Konnte keine Verbindung zur Boltz API herstellen. Bitte versuche es später noch einmal.",
        refund_explainer:
            "Du kannst nach dem Timeout eine Rückerstattung beantragen",
        swap_not_refundable_yet:
            "Dein Swap kann noch nicht erstattet werden. Warte auf den Timeout, um eine Rückerstattung zu starten.",
        wasm_not_supported:
            "Bitte aktivieren Sie WebAssembly in Ihrem Browser!",
        ios_image_download:
            'Lange drücken und "In Fotos speichern" auswählen, um die Rückerstattungsdatei herunterzuladen',
        created: "Erstellt",
        delete: "Löschen",
        view: "Anzeigen",
        id: "ID",
        headline: "Privacy First, Non-Custodial Bitcoin Exchange",
        subline: "Du hast volle Kontrolle über deine Bitcoin. Zu jeder Zeit.",
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
            "Wichtig: Kehre nach dem Bezahlen der Rechnung zu dieser Seite zurück!",
        warning_expiry:
            "Wichtig: Die Transaktion muss vor {{ hours }} Stunden bestätigt sein!",
        not_found: "404 - Seite nicht gefunden",
        not_found_subline: "Die gesuchte Seite existiert nicht.",
        back_to_home: "Zurück zur Startseite",
    },
    es: {
        language: "Español",
        status: "Estado",
        feedback: "¿Tienes comentarios? Únete a nuestro",
        fast: "Rápido",
        l2: "Construido en la Capa 2",
        l2_sub: "Boltz utiliza tecnologías de segunda capa como la red de Lightning y Liquid",
        assets_sub: "Lightning / Bitcoin / Liquid",
        safe: "Seguro",
        non_custodial: "Sin Custodia",
        non_custodial_sub:
            "Los intercambios en Boltz son sin custodia; la criptografía garantiza que los usuarios siempre tienen el control de su Bitcoin",
        node: "Nodo",
        lightningnode: "Ver nodo Lightning",
        error: "Error",
        error_subline: "Respuesta inválida de la API, algo está mal :/",
        history: "Historia",
        swap: "Intercambio",
        channel: "Canal",
        refund: "Reembolso",
        blog: "Blog",
        documentation: "Docs",
        onion: "Onion",
        blockexplorer: "Ver en {{ typeLabel }}",
        blockexplorer_lockup_address: "Dirección Lockup",
        blockexplorer_claim_tx: "Transacción de Reclamación",
        blockexplorer_refund_tx: "Transacción de Reembolso",
        help: "Ayuda",
        network_fee: "Comisión de red",
        fee: "Comisión de Boltz",
        denomination: "Denominación",
        send: "Enviar",
        receive: "Recibir",
        min: "Mín",
        max: "Máx",
        minimum_amount: "La cantidad mínima es {{ amount }} {{ denomination }}",
        maximum_amount: "La cantidad máxima es {{ amount }} {{ denomination }}",
        assets: "Multicapa",
        socialmedia: "Síguenos en",
        footer: "Hecho con ❤️ por el equipo de Boltz",
        create_channel: "Crear canal Lightning",
        create_channel_subline: "Capacidad del canal entrante o saliente",
        create_swap: "Crear intercambio atómico",
        create_swap_subline:
            "El pago incluye tarifas de red y servicio de Boltz",
        cancel_swap: "Cancelar intercambio",
        new_swap: "Nuevo intercambio",
        success_swap: "Intercambio realizado con éxito!",
        feecheck:
            "La tarifa de red se actualizó según la situación de la red. Por favor, confirma los nuevos montos y continúa con el intercambio.",
        create_and_paste:
            "Pegar una factura Lightning bolt11\n o una dirección Lightning\n o un enlace LNURL Pay\n\nMonto: {{ amount }} {{ denomination }}",
        congrats: "¡Felicitaciones!",
        successfully_swapped: "Su intercambio se realizó con éxito!",
        timeout_eta: "Tiempo de espera estimado",
        pay_invoice: "Intercambio: {{ id }}",
        pay_swap_404: "¡Intercambio no encontrado!",
        pay_timeout_blockheight: "Altura del bloque de tiempo de espera",
        pay_expected_amount: "Monto esperado",
        send_to: "Enviar {{ amount }} {{ asset }} a",
        pay_invoice_to: "Pague esta factura de {{ amount }} {{ denomination }}",
        pay_address: "Dirección",
        lockup_failed: "Fallo en el lockup",
        lockup_failed_subline:
            "Su transacción de lockup falló, espere el tiempo de espera para obtener un reembolso.",
        failure_reason: "Motivo del fallo",
        invoice_payment_failure: "No se pudo pagar su factura Lightning",
        onchain_address: "Ingrese la dirección de {{ asset }}",
        download_refund_file: "Descargar archivo de reembolso",
        invalid_refund_file: "Archivo de reembolso no válido",
        invalid_backup_file: "Archivo de backup no válido",
        copy_invoice: "Copiar factura Lightning",
        copy_address: "Copiar dirección",
        copy_amount: "Copiar monto",
        copy_bip21: "Copiar BIP21",
        copied: "Copiado",
        refund_a_swap: "Reembolsar un intercambio",
        refund_a_swap_subline:
            "Cargue su archivo de reembolso y recupere sus fondos bloqueados",
        refund_past_swaps: "Intercambios anteriores",
        refund_past_swaps_subline:
            "Intercambios que se guardaron en el almacenamiento del navegador",
        history_no_swaps: "Parece que aún no has realizado ningún intercambio.",
        refund_address_placeholder: "Dirección de reembolso",
        refund_backup: "Backup",
        refund_import: "Importar Backup",
        refund_clear: "Borrar almacenamiento local",
        delete_swap: "Eliminar intercambio del almacenamiento local",
        delete_localstorage:
            "¿Estás seguro de que deseas borrar tu almacenamiento local?\nSe perderán la información de su intercambio y sus claves de reembolso.",
        delete_localstorage_single_swap:
            "¿Estás seguro de que deseas borrar el intercambio {{ id }} de tu almacenamiento local?\nSe perderán la información de su intercambio y sus claves privadas de reembolso.",
        tx_in_mempool: "La transacción está en el mempool.",
        tx_in_mempool_subline:
            "Esperando confirmación para completar el intercambio",
        expired: "¡El intercambio ha expirado!",
        invoice_pending: "Transacción recibida, pagando la factura...",
        invoice_expired: "La factura ha expirado, ¡intente nuevamente!",
        swap_expired: "No completaste tu pago a tiempo.",
        create_invoice_webln: "Crear factura a través de WebLN",
        pay_invoice_webln: "Pagar factura a través de WebLN",
        select_asset: "Seleccionar activo de {{ direction }}",
        tx_confirmed: "Transacción confirmada!",
        tx_ready_to_claim: "Reclamando la transacción ahora...",
        transaction_refunded: "Boltz ha reembolsado la transacción!",
        refunded: "El intercambio ha sido reembolsado!",
        broadcasted: "Reembolso transmitido!",
        locktime_not_satisfied:
            "No se cumple el requisito de tiempo de bloqueo!",
        already_refunded: "El intercambio ya ha sido reembolsado!",
        api_offline: "API está offline!",
        api_offline_msg:
            "No se pudo conectar a la API de Boltz, por favor inténtelo de nuevo más tarde!",
        refund_explainer:
            "Podrás solicitar un reembolso después del tiempo de espera.",
        swap_not_refundable_yet:
            "Tu intercambio aún no es reembolsable, por favor inténtelo de nuevo más tarde!",
        wasm_not_supported: "Por favor, activa WebAssembly en tu navegador!",
        ios_image_download:
            'Mantén presionado y selecciona "Guardar en Fotos" para descargar el archivo de reembolso.',
        created: "Creado",
        delete: "Eliminar",
        view: "Ver",
        id: "ID",
        headline: "Intercambio de Bitcoin con privacidad y sin custodia",
        subline: "Tienes el control de tu dinero. Siempre.",
        start_swapping: "Comenzar a intercambiar",
        partners: "Socios",
        integrations: "Integraciones",
        oldest_channel_years: "{{ years }} años",
        oldest_channel: "Canal más antiguo",
        capacity: "Capacidad (sats)",
        peers: "Número de peers",
        num_channels: "Número de canales",
        beta_caution: "BETA - ¡ÚSALO CON PRECAUCIÓN!",
        warning_return:
            "Importante: Regresa a esta página después de pagar la factura!",
        warning_expiry:
            "Importante: Asegúrese de que la transacción se confirma en {{ hours }} horas",
        not_found: "404 - Página no encontrada",
        not_found_subline: "La página buscada no existe.",
        back_to_home: "Volver al inicio",
    },
};

const rawDict = JSON.parse(JSON.stringify(dict));

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
export { rawDict };
