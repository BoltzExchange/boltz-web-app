import type { RoutingInfo } from "bolt11";
import bolt11 from "bolt11";
import log from "loglevel";

export const lbtcAssetHash =
    "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d";
const magicRoutingHintConstant = "0846c900051c0000";

export const findMagicRoutingHint = (
    invoice: string,
): RoutingInfo[number] | undefined => {
    try {
        const decodedInvoice = bolt11.decode(invoice);

        const routingInfo = decodedInvoice.tags.find(
            (tag) => tag.tagName === "routing_info",
        );

        const magicRoutingHint = (
            routingInfo.data as unknown as RoutingInfo
        ).find((hint) => hint.short_channel_id === magicRoutingHintConstant);

        return magicRoutingHint;
    } catch (e) {
        log.warn("No magic routing hint found:  ", e);
        return undefined;
    }
};
