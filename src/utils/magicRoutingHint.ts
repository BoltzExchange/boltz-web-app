import type { RoutingInfo } from "bolt11";
import bolt11 from "bolt11";

export const lbtcAssetHash =
    "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d";
const magicRoutingHintConstant = "0846c900051c0000";

export const findMagicRoutingHint = (invoice: string) => {
    const decodedInvoice = bolt11.decode(invoice);
    const routingInfo = decodedInvoice.tags.find(
        (tag) => tag.tagName === "routing_info",
    );

    if (routingInfo === undefined) {
        return { decodedInvoice };
    }

    const magicRoutingHint = (routingInfo.data as unknown as RoutingInfo).find(
        (hint) => hint.short_channel_id === magicRoutingHintConstant,
    );

    if (magicRoutingHint === undefined) {
        return { decodedInvoice };
    }

    return { magicRoutingHint, decodedInvoice };
};
