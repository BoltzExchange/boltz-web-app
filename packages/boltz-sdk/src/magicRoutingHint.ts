import bolt11 from "bolt11";
import type { RoutingInfo } from "bolt11";

/**
 * Well-known short channel ID used by Boltz as a "magic" routing hint
 * to signal that the invoice was created by the service.
 */
const magicRoutingHintConstant = "0846c900051c0000";

/**
 * Search a BOLT-11 invoice for the Boltz magic routing hint.
 *
 * The magic routing hint is identified by a specific
 * `short_channel_id` constant embedded in the invoice's routing info tag.
 *
 * @param invoice - BOLT-11 encoded payment request.
 * @returns The matching routing hint entry, or `undefined` if not found.
 */
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
    } catch {
        return undefined;
    }
};
