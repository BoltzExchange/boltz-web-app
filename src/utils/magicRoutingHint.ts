import bolt11 from "bolt11";
import type { RoutingInfo } from "bolt11";
import log from "loglevel";

const magicRoutingHintConstant = "0846c900051c0000";

export const findMagicRoutingHint = (invoice: string) => {
    try {
        const decodedInvoice = bolt11.decode(invoice);
        const routingInfo = decodedInvoice.tags.find(
            (tag) => tag.tagName === "routing_info",
        );

        if (!routingInfo) {
            return undefined;
        }

        const magicRoutingHint = (
            routingInfo.data as unknown as RoutingInfo
        ).find((hint) => hint.short_channel_id === magicRoutingHintConstant);

        return magicRoutingHint;
    } catch (e) {
        log.error("Failed to decode invoice", e);
        return undefined;
    }
};
