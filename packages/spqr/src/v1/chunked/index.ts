/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Chunked state machine for SPQR V1.
 *
 * Provides erasure-coded chunk-by-chunk data transfer wrapping the
 * unchunked V1 state machine.
 */

// Wire up the circular dependency factory before any re-exports
import { _setCreateSendCtNoHeaderReceived } from "./send-ek.js";
import { NoHeaderReceived } from "./send-ct.js";
import type { PolyDecoder } from "../../encoding/polynomial.js";
import type * as unchunkedSendCt from "../unchunked/send-ct.js";

_setCreateSendCtNoHeaderReceived(
  (uc: unchunkedSendCt.NoHeaderReceived, receivingHdr: PolyDecoder) =>
    new NoHeaderReceived(uc, receivingHdr),
);

// States dispatcher
export {
  type States,
  type Message,
  type MessagePayload,
  type SendResult,
  type RecvResult,
  initA,
  initB,
  send,
  recv,
} from "./states.js";

// Message serialization
export { serializeMessage, deserializeMessage } from "./message.js";

// Chunked send_ek states
export {
  KeysUnsampled,
  KeysSampled,
  HeaderSent,
  Ct1Received,
  EkSentCt1Received,
  type HeaderSentRecvChunk,
  type EkSentCt1ReceivedRecvChunk,
} from "./send-ek.js";

// Chunked send_ct states
export {
  NoHeaderReceived,
  HeaderReceived,
  Ct1Sampled,
  EkReceivedCt1Sampled,
  Ct1Acknowledged,
  Ct2Sampled,
  type NoHeaderReceivedRecvChunk,
  type Ct1SampledRecvChunk,
  type Ct1AcknowledgedRecvChunk,
} from "./send-ct.js";
