/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * GSTP - Gordian Sealed Transaction Protocol
 *
 * A secure, authenticated, transport-agnostic data exchange protocol with
 * distributed state management via Encrypted State Continuations (ESC).
 *
 * This is a 1:1 port of the Rust gstp library, maintaining the same
 * API structure and functionality.
 *
 * @module gstp
 */

// Error types
export { GstpError, GstpErrorCode } from "./error";

// Core types
export { Continuation } from "./continuation";

// Sealed message types
export { SealedRequest, type SealedRequestBehavior } from "./sealed-request";

export { SealedResponse, type SealedResponseBehavior } from "./sealed-response";

export { SealedEvent, type SealedEventBehavior } from "./sealed-event";

// Prelude for convenient imports
export * as prelude from "./prelude";

// Version information (matches gstp-rust v0.13.0)
export const VERSION = "0.13.0";
