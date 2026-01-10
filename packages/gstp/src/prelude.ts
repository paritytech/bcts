/**
 * GSTP Prelude - Convenient re-exports for common usage
 *
 * Import from this module for a curated set of commonly used types:
 *
 * ```typescript
 * import { SealedRequest, SealedResponse, Continuation } from '@bcts/gstp/prelude';
 * ```
 *
 * Ported from gstp-rust/src/prelude.rs
 */

// Error types
export { GstpError, GstpErrorCode } from "./error";

// Core types
export { Continuation } from "./continuation";

// Sealed message types
export { SealedRequest, type SealedRequestBehavior } from "./sealed-request";

export { SealedResponse, type SealedResponseBehavior } from "./sealed-response";

export { SealedEvent, type SealedEventBehavior } from "./sealed-event";
