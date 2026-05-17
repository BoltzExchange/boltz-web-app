import { base64 } from "@scure/base";

export const decodeBase64 = (value: string): Uint8Array => base64.decode(value);
