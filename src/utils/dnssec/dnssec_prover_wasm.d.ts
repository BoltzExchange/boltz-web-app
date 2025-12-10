/* tslint:disable */
/* eslint-disable */

export class WASMProofBuilder {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
}

/**
 * Gets the next query (if any) that should be sent to the resolver for the given proof builder.
 *
 * Once the resolver responds [`process_query_response`] should be called with the response.
 */
export function get_next_query(proof_builder: WASMProofBuilder): Uint8Array | undefined;

/**
 * Gets the final, unverified, proof once all queries fetched via [`get_next_query`] have
 * completed and their responses passed to [`process_query_response`].
 */
export function get_unverified_proof(proof_builder: WASMProofBuilder): Uint8Array;

/**
 * Builds a proof builder which can generate a proof for records of the given `ty`pe at the given
 * `name`.
 *
 * After calling this [`get_next_query`] should be called to fetch the initial query.
 */
export function init_proof_builder(name: string, ty: number): WASMProofBuilder | undefined;

/**
 * Processes a response to a query previously fetched from [`get_next_query`].
 *
 * After calling this, [`get_next_query`] should be called until pending queries are exhausted and
 * no more pending queries exist, at which point [`get_unverified_proof`] should be called.
 */
export function process_query_response(proof_builder: WASMProofBuilder, response: Uint8Array): void;

/**
 * Verifies an RFC 9102-formatted proof and returns verified records matching the given name
 * (resolving any C/DNAMEs as required).
 */
export function verify_byte_stream(stream: Uint8Array, name_to_resolve: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmproofbuilder_free: (a: number, b: number) => void;
  readonly get_next_query: (a: number) => [number, number];
  readonly get_unverified_proof: (a: number) => [number, number, number, number];
  readonly init_proof_builder: (a: number, b: number, c: number) => number;
  readonly process_query_response: (a: number, b: number, c: number) => void;
  readonly verify_byte_stream: (a: number, b: number, c: number, d: number) => [number, number];
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
