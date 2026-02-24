/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Serialization bridge between runtime States and PbV1State protobuf.
 *
 * Converts the runtime discriminated-union States objects to/from their
 * protobuf representations so that the top-level API can persist state
 * as opaque bytes.
 */

import type { PbV1State, PbChunkedState } from "../../proto/pq-ratchet-types.js";
import { Authenticator } from "../../authenticator.js";
import { PolyEncoder, PolyDecoder } from "../../encoding/polynomial.js";

// Unchunked state classes
import * as ucSendEk from "../unchunked/send-ek.js";
import * as ucSendCt from "../unchunked/send-ct.js";

// Chunked state classes
import * as sendEk from "./send-ek.js";
import * as sendCt from "./send-ct.js";

import type { States } from "./states.js";
import type { Epoch } from "../../types.js";

// ---------------------------------------------------------------------------
// States -> PbV1State
// ---------------------------------------------------------------------------

/**
 * Serialize a runtime States object into PbV1State for protobuf encoding.
 * Stores the epoch as field 12 so it can be recovered on deserialization.
 */
export function statesToPb(s: States): PbV1State {
  const epoch = s.state.epoch;
  return { innerState: chunkedStateToPb(s), epoch };
}

function chunkedStateToPb(s: States): PbChunkedState {
  switch (s.tag) {
    case "keysUnsampled": {
      const st = s.state;
      return {
        type: "keysUnsampled",
        uc: { auth: st.uc.auth.toProto() },
      };
    }
    case "keysSampled": {
      const st = s.state;
      return {
        type: "keysSampled",
        uc: {
          auth: st.uc.auth.toProto(),
          ek: Uint8Array.from(st.uc.ek),
          dk: Uint8Array.from(st.uc.dk),
          hdr: new Uint8Array(0),
          hdrMac: new Uint8Array(0),
        },
        sendingHdr: st.sendingHdr.toProto(),
      };
    }
    case "headerSent": {
      const st = s.state;
      return {
        type: "headerSent",
        uc: {
          auth: st.uc.auth.toProto(),
          ek: new Uint8Array(0),
          dk: Uint8Array.from(st.uc.dk),
        },
        sendingEk: st.sendingEk.toProto(),
        receivingCt1: st.receivingCt1.toProto(),
      };
    }
    case "ct1Received": {
      const st = s.state;
      return {
        type: "ct1Received",
        uc: {
          auth: st.uc.auth.toProto(),
          dk: Uint8Array.from(st.uc.dk),
          ct1: Uint8Array.from(st.uc.ct1),
        },
        sendingEk: st.sendingEk.toProto(),
      };
    }
    case "ekSentCt1Received": {
      const st = s.state;
      return {
        type: "ekSentCt1Received",
        uc: {
          auth: st.uc.auth.toProto(),
          dk: Uint8Array.from(st.uc.dk),
          ct1: Uint8Array.from(st.uc.ct1),
        },
        receivingCt2: st.receivingCt2.toProto(),
      };
    }
    case "noHeaderReceived": {
      const st = s.state;
      return {
        type: "noHeaderReceived",
        uc: { auth: st.uc.auth.toProto() },
        receivingHdr: st.receivingHdr.toProto(),
      };
    }
    case "headerReceived": {
      const st = s.state;
      return {
        type: "headerReceived",
        uc: {
          auth: st.uc.auth.toProto(),
          hdr: Uint8Array.from(st.uc.hdr),
          es: new Uint8Array(0),
          ct1: new Uint8Array(0),
          ss: new Uint8Array(0),
        },
        receivingEk: st.receivingEk.toProto(),
      };
    }
    case "ct1Sampled": {
      const st = s.state;
      return {
        type: "ct1Sampled",
        uc: {
          auth: st.uc.auth.toProto(),
          hdr: Uint8Array.from(st.uc.hdr),
          es: Uint8Array.from(st.uc.es),
          ct1: Uint8Array.from(st.uc.ct1),
        },
        sendingCt1: st.sendingCt1.toProto(),
        receivingEk: st.receivingEk.toProto(),
      };
    }
    case "ekReceivedCt1Sampled": {
      const st = s.state;
      return {
        type: "ekReceivedCt1Sampled",
        uc: {
          auth: st.uc.auth.toProto(),
          hdr: new Uint8Array(0),
          es: Uint8Array.from(st.uc.es),
          ek: Uint8Array.from(st.uc.ek),
          ct1: Uint8Array.from(st.uc.ct1),
        },
        sendingCt1: st.sendingCt1.toProto(),
      };
    }
    case "ct1Acknowledged": {
      const st = s.state;
      return {
        type: "ct1Acknowledged",
        uc: {
          auth: st.uc.auth.toProto(),
          hdr: Uint8Array.from(st.uc.hdr),
          es: Uint8Array.from(st.uc.es),
          ct1: Uint8Array.from(st.uc.ct1),
        },
        receivingEk: st.receivingEk.toProto(),
      };
    }
    case "ct2Sampled": {
      const st = s.state;
      return {
        type: "ct2Sampled",
        uc: { auth: st.uc.auth.toProto() },
        sendingCt2: st.sendingCt2.toProto(),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// PbV1State -> States
// ---------------------------------------------------------------------------

/**
 * Deserialize a PbV1State back into a runtime States object.
 *
 * @param pb - The protobuf V1 state
 * @returns The reconstructed runtime States
 */
export function statesFromPb(pb: PbV1State): States {
  if (!pb.innerState) {
    throw new Error("PbV1State has no innerState");
  }
  const epoch = pb.epoch ?? 1n;
  return chunkedStateFromPb(pb.innerState, epoch);
}

function chunkedStateFromPb(cs: PbChunkedState, epoch: Epoch): States {
  switch (cs.type) {
    case "keysUnsampled": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendEk.KeysUnsampled(epoch, auth);
      return { tag: "keysUnsampled", state: new sendEk.KeysUnsampled(ucState) };
    }
    case "keysSampled": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendEk.HeaderSent(epoch, auth, cs.uc.ek, cs.uc.dk);
      const encoder = PolyEncoder.fromProto(cs.sendingHdr);
      return { tag: "keysSampled", state: new sendEk.KeysSampled(ucState, encoder) };
    }
    case "headerSent": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendEk.EkSent(epoch, auth, cs.uc.dk);
      const encoder = PolyEncoder.fromProto(cs.sendingEk);
      const decoder = PolyDecoder.fromProto(cs.receivingCt1);
      return { tag: "headerSent", state: new sendEk.HeaderSent(ucState, encoder, decoder) };
    }
    case "ct1Received": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendEk.EkSentCt1Received(epoch, auth, cs.uc.dk, cs.uc.ct1);
      const encoder = PolyEncoder.fromProto(cs.sendingEk);
      return { tag: "ct1Received", state: new sendEk.Ct1Received(ucState, encoder) };
    }
    case "ekSentCt1Received": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendEk.EkSentCt1Received(epoch, auth, cs.uc.dk, cs.uc.ct1);
      const decoder = PolyDecoder.fromProto(cs.receivingCt2);
      return { tag: "ekSentCt1Received", state: new sendEk.EkSentCt1Received(ucState, decoder) };
    }
    case "noHeaderReceived": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendCt.NoHeaderReceived(epoch, auth);
      const decoder = PolyDecoder.fromProto(cs.receivingHdr);
      return { tag: "noHeaderReceived", state: new sendCt.NoHeaderReceived(ucState, decoder) };
    }
    case "headerReceived": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendCt.HeaderReceived(epoch, auth, cs.uc.hdr);
      const decoder = PolyDecoder.fromProto(cs.receivingEk);
      return { tag: "headerReceived", state: new sendCt.HeaderReceived(ucState, decoder) };
    }
    case "ct1Sampled": {
      const auth = authFromPb(cs.uc.auth);
      // Ct1Sent stores (epoch, auth, hdr, es, ct1) -- ct1 needed for MAC in sendCt2
      const ucState = new ucSendCt.Ct1Sent(epoch, auth, cs.uc.hdr, cs.uc.es, cs.uc.ct1);
      const encoder = PolyEncoder.fromProto(cs.sendingCt1);
      const decoder = PolyDecoder.fromProto(cs.receivingEk);
      return { tag: "ct1Sampled", state: new sendCt.Ct1Sampled(ucState, encoder, decoder) };
    }
    case "ekReceivedCt1Sampled": {
      const auth = authFromPb(cs.uc.auth);
      // Ct1SentEkReceived stores (epoch, auth, es, ek, ct1) -- ct1 needed for MAC in sendCt2
      const ucState = new ucSendCt.Ct1SentEkReceived(epoch, auth, cs.uc.es, cs.uc.ek, cs.uc.ct1);
      const encoder = PolyEncoder.fromProto(cs.sendingCt1);
      return {
        tag: "ekReceivedCt1Sampled",
        state: new sendCt.EkReceivedCt1Sampled(ucState, encoder),
      };
    }
    case "ct1Acknowledged": {
      const auth = authFromPb(cs.uc.auth);
      // Ct1Sent stores (epoch, auth, hdr, es, ct1) -- ct1 needed for MAC in sendCt2
      const ucState = new ucSendCt.Ct1Sent(epoch, auth, cs.uc.hdr, cs.uc.es, cs.uc.ct1);
      const decoder = PolyDecoder.fromProto(cs.receivingEk);
      return { tag: "ct1Acknowledged", state: new sendCt.Ct1Acknowledged(ucState, decoder) };
    }
    case "ct2Sampled": {
      const auth = authFromPb(cs.uc.auth);
      const ucState = new ucSendCt.Ct2Sent(epoch, auth);
      const encoder = PolyEncoder.fromProto(cs.sendingCt2);
      return { tag: "ct2Sampled", state: new sendCt.Ct2Sampled(ucState, encoder) };
    }
  }
}

function authFromPb(pb: { rootKey: Uint8Array; macKey: Uint8Array } | undefined): Authenticator {
  if (!pb) {
    return Authenticator.fromProto({
      rootKey: new Uint8Array(32),
      macKey: new Uint8Array(32),
    });
  }
  return Authenticator.fromProto(pb);
}
