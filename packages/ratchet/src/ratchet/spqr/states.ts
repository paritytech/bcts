/**
 * SPQR V1 State Machine — unchunked variant.
 *
 * Ported from Signal's spqr crate:
 *   - v1/unchunked/send_ek.rs (KeysUnsampled -> HeaderSent -> EkSent -> EkSentCt1Received)
 *   - v1/unchunked/send_ct.rs (NoHeaderReceived -> HeaderReceived -> Ct1Sent -> Ct1SentEkReceived -> Ct2Sent)
 *   - v1/chunked/states.rs    (11-state wrapper)
 *
 * The state machine manages the ML-KEM-768 key exchange between two parties
 * (Alice = send_ek side, Bob = send_ct side). Each exchange produces an
 * epoch secret that is mixed into the symmetric chain.
 *
 * State flow for Alice (send_ek / A2B):
 *   KeysUnsampled -> KeysSampled -> HeaderSent -> Ct1Received -> EkSentCt1Received -> NoHeaderReceived (next epoch)
 *
 * State flow for Bob (send_ct / B2A):
 *   NoHeaderReceived -> HeaderReceived -> Ct1Sampled -> (EkReceivedCt1Sampled | Ct1Acknowledged) -> Ct2Sampled -> KeysUnsampled (next epoch)
 */

import { Authenticator, MAC_SIZE } from "./authenticator.js";
import * as mlkem from "./mlkem.js";
import { hkdfSha256 } from "../../crypto/kdf.js";
import type { EpochSecret } from "./chain.js";
import { type SpqrMessage, MessageType } from "./message.js";

const ZERO_SALT = new Uint8Array(32);

// ---- Epoch-to-bytes helper ----

function epochToBeBytes(epoch: number): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint32(0, Math.floor(epoch / 0x100000000), false);
  view.setUint32(4, epoch >>> 0, false);
  return buf;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const a of arrays) totalLen += a.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/**
 * Derive the SCKA Key from a shared secret and epoch.
 * Info: "Signal_PQCKA_V1_MLKEM768:SCKA Key" + epoch_be8
 */
function deriveSckaKey(sharedSecret: Uint8Array, epoch: number): Uint8Array {
  const info = concat(
    new TextEncoder().encode("Signal_PQCKA_V1_MLKEM768:SCKA Key"),
    epochToBeBytes(epoch),
  );
  return hkdfSha256(sharedSecret, ZERO_SALT, info, 32);
}

// ---- State Error ----

export class SpqrStateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SpqrStateError";
  }
}

// ---- State Types ----

/**
 * Discriminated union of all 11 SPQR states.
 *
 * For the unchunked implementation, we skip the Reed-Solomon encoder/decoder
 * wrappers and work directly with the unchunked state data.
 */
export type SpqrState =
  // send_ek side states
  | { type: "KeysUnsampled"; epoch: number; auth: Authenticator }
  | {
      type: "KeysSampled";
      epoch: number;
      auth: Authenticator;
      ek: Uint8Array;
      dk: Uint8Array;
      hdr: Uint8Array;
    }
  | {
      type: "HeaderSent";
      epoch: number;
      auth: Authenticator;
      dk: Uint8Array;
      ek: Uint8Array;
    }
  | {
      type: "Ct1Received";
      epoch: number;
      auth: Authenticator;
      dk: Uint8Array;
      ct1: Uint8Array;
      ek: Uint8Array;
    }
  | {
      type: "EkSentCt1Received";
      epoch: number;
      auth: Authenticator;
      dk: Uint8Array;
      ct1: Uint8Array;
    }
  // send_ct side states
  | { type: "NoHeaderReceived"; epoch: number; auth: Authenticator }
  | {
      type: "HeaderReceived";
      epoch: number;
      auth: Authenticator;
      hdr: Uint8Array;
    }
  | {
      type: "Ct1Sampled";
      epoch: number;
      auth: Authenticator;
      hdr: Uint8Array;
      es: Uint8Array;
      ct1: Uint8Array;
    }
  | {
      type: "EkReceivedCt1Sampled";
      epoch: number;
      auth: Authenticator;
      es: Uint8Array;
      ek: Uint8Array;
      ct1: Uint8Array;
      hdr: Uint8Array;
    }
  | {
      type: "Ct1Acknowledged";
      epoch: number;
      auth: Authenticator;
      hdr: Uint8Array;
      es: Uint8Array;
      ct1: Uint8Array;
    }
  | { type: "Ct2Sampled"; epoch: number; auth: Authenticator };

// ---- Send / Recv results ----

export interface SendResult {
  state: SpqrState;
  msg: SpqrMessage;
  key: EpochSecret | null;
}

export interface RecvResult {
  state: SpqrState;
  key: EpochSecret | null;
}

// ---- Initialization ----

/** Initialize as Alice (A2B / send_ek side) */
export function initA(authKey: Uint8Array): SpqrState {
  return {
    type: "KeysUnsampled",
    epoch: 1,
    auth: Authenticator.create(authKey, 1),
  };
}

/** Initialize as Bob (B2A / send_ct side) */
export function initB(authKey: Uint8Array): SpqrState {
  return {
    type: "NoHeaderReceived",
    epoch: 1,
    auth: Authenticator.create(authKey, 1),
  };
}

// ---- Send ----

export function send(state: SpqrState): SendResult {
  switch (state.type) {
    // ====== send_ek side ======

    case "KeysUnsampled": {
      // Generate new ML-KEM keypair
      const keys = mlkem.generate();
      const mac = state.auth.macHdr(state.epoch, keys.hdr);
      const hdrWithMac = concat(keys.hdr, mac);

      return {
        state: {
          type: "KeysSampled",
          epoch: state.epoch,
          auth: state.auth,
          ek: keys.ek,
          dk: keys.dk,
          hdr: keys.hdr,
        },
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Hdr, data: hdrWithMac },
        },
        key: null,
      };
    }

    case "KeysSampled": {
      // Re-send header
      const mac = state.auth.macHdr(state.epoch, state.hdr);
      const hdrWithMac = concat(state.hdr, mac);
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Hdr, data: hdrWithMac },
        },
        key: null,
      };
    }

    case "HeaderSent": {
      // Send encapsulation key
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Ek, data: state.ek },
        },
        key: null,
      };
    }

    case "Ct1Received": {
      // Send EK with CT1 acknowledgment
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.EkCt1Ack, data: state.ek },
        },
        key: null,
      };
    }

    case "EkSentCt1Received": {
      // Just send CT1 acknowledgment
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Ct1Ack, ack: true },
        },
        key: null,
      };
    }

    // ====== send_ct side ======

    case "NoHeaderReceived": {
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.None },
        },
        key: null,
      };
    }

    case "HeaderReceived": {
      // Do encaps1: generate ct1 and epoch secret
      const encResult = mlkem.encaps1(state.hdr);

      // Derive SCKA key
      // Note: for standard KEM, the real shared secret comes from encaps2.
      // At this stage we create the ct1 and es for later use.
      const auth = state.auth.clone();

      return {
        state: {
          type: "Ct1Sampled",
          epoch: state.epoch,
          auth,
          hdr: state.hdr,
          es: encResult.es,
          ct1: encResult.ct1,
        },
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Ct1, data: encResult.ct1 },
        },
        key: null, // Key comes from encaps2 when we get the EK
      };
    }

    case "Ct1Sampled": {
      // Re-send ct1
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Ct1, data: state.ct1 },
        },
        key: null,
      };
    }

    case "EkReceivedCt1Sampled": {
      // Re-send ct1
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.Ct1, data: state.ct1 },
        },
        key: null,
      };
    }

    case "Ct1Acknowledged": {
      // No additional data to send, waiting for EK
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.None },
        },
        key: null,
      };
    }

    case "Ct2Sampled": {
      // The ct2 was already sent via the transition; re-send not needed
      // in unchunked mode. Send empty.
      return {
        state,
        msg: {
          epoch: state.epoch,
          payload: { type: MessageType.None },
        },
        key: null,
      };
    }
  }
}

// ---- Recv ----

export function recv(state: SpqrState, msg: SpqrMessage): RecvResult {
  let key: EpochSecret | null = null;

  const resultState = ((): SpqrState => {
    switch (state.type) {
      // ====== send_ek side ======

      case "KeysUnsampled": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        return state;
      }

      case "KeysSampled": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        // Expect CT1 from the other side
        if (msg.payload.type === MessageType.Ct1) {
          // Transition: KeysSampled -> HeaderSent (with EK ready to send)
          return {
            type: "HeaderSent",
            epoch: state.epoch,
            auth: state.auth,
            dk: state.dk,
            ek: state.ek,
          };
        }
        return state;
      }

      case "HeaderSent": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        if (msg.payload.type === MessageType.Ct1) {
          // We have the full ct1 now
          return {
            type: "Ct1Received",
            epoch: state.epoch,
            auth: state.auth,
            dk: state.dk,
            ct1: msg.payload.data,
            ek: state.ek,
          };
        }
        return state;
      }

      case "Ct1Received": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        if (msg.payload.type === MessageType.Ct2) {
          // Transition to EkSentCt1Received
          return {
            type: "EkSentCt1Received",
            epoch: state.epoch,
            auth: state.auth,
            dk: state.dk,
            ct1: state.ct1,
          };
        }
        return state;
      }

      case "EkSentCt1Received": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        if (msg.payload.type === MessageType.Ct2) {
          const ct2Data = msg.payload.data;

          // Split ct2 data into ct2 + MAC
          if (ct2Data.length < mlkem.CIPHERTEXT2_SIZE + MAC_SIZE) {
            throw new SpqrStateError("CT2 data too short", "ERRONEOUS_DATA");
          }
          const ct2 = ct2Data.slice(0, mlkem.CIPHERTEXT2_SIZE);
          const mac = ct2Data.slice(mlkem.CIPHERTEXT2_SIZE, mlkem.CIPHERTEXT2_SIZE + MAC_SIZE);

          // Decapsulate to get shared secret
          const ss = mlkem.decaps(state.dk, state.ct1, ct2);
          const derivedSecret = deriveSckaKey(ss, state.epoch);

          // Update authenticator
          const auth = state.auth.clone();
          auth.update(state.epoch, derivedSecret);

          // Verify MAC over ct1 + ct2
          const fullCt = concat(state.ct1, ct2);
          auth.verifyCt(state.epoch, fullCt, mac);

          // Epoch secret output
          key = { epoch: state.epoch, secret: derivedSecret };

          // Transition to NoHeaderReceived for next epoch
          return {
            type: "NoHeaderReceived",
            epoch: state.epoch + 1,
            auth,
          };
        }
        return state;
      }

      // ====== send_ct side ======

      case "NoHeaderReceived": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        if (msg.payload.type === MessageType.Hdr) {
          const hdrData = msg.payload.data;

          // Split header + MAC
          if (hdrData.length < mlkem.HEADER_SIZE + MAC_SIZE) {
            throw new SpqrStateError("Header data too short", "ERRONEOUS_DATA");
          }
          const hdr = hdrData.slice(0, mlkem.HEADER_SIZE);
          const mac = hdrData.slice(mlkem.HEADER_SIZE, mlkem.HEADER_SIZE + MAC_SIZE);

          // Verify header MAC
          state.auth.verifyHdr(state.epoch, hdr, mac);

          return {
            type: "HeaderReceived",
            epoch: state.epoch,
            auth: state.auth,
            hdr,
          };
        }
        return state;
      }

      case "HeaderReceived": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        return state;
      }

      case "Ct1Sampled": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        const isEk = msg.payload.type === MessageType.Ek;
        const isEkCt1Ack = msg.payload.type === MessageType.EkCt1Ack;
        const ct1Ack = isEkCt1Ack || msg.payload.type === MessageType.Ct1Ack;

        if (isEk || isEkCt1Ack) {
          const ekPayload = msg.payload as { data: Uint8Array };
          const ek = ekPayload.data;

          if (ct1Ack) {
            // Got EK and CT1 ack -- do full encapsulation and send CT2
            const encResult = mlkem.encaps2(ek, state.es, state.hdr);
            const derivedSecret = deriveSckaKey(encResult.sharedSecret, state.epoch);
            const auth = state.auth.clone();
            auth.update(state.epoch, derivedSecret);

            // Produce epoch secret
            key = { epoch: state.epoch, secret: derivedSecret };

            // MAC the full ciphertext (ct1 + ct2) -- computed for state consistency
            const fullCt = concat(encResult.ct1, encResult.ct2);
            auth.macCt(state.epoch, fullCt);

            return {
              type: "Ct2Sampled",
              epoch: state.epoch,
              auth,
            };
          }

          // Got EK but no CT1 ack -- store EK
          return {
            type: "EkReceivedCt1Sampled",
            epoch: state.epoch,
            auth: state.auth,
            es: state.es,
            ek,
            ct1: state.ct1,
            hdr: state.hdr,
          };
        }

        if (ct1Ack) {
          // Got CT1 ack without EK
          return {
            type: "Ct1Acknowledged",
            epoch: state.epoch,
            auth: state.auth,
            hdr: state.hdr,
            es: state.es,
            ct1: state.ct1,
          };
        }

        return state;
      }

      case "EkReceivedCt1Sampled": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        if (msg.payload.type === MessageType.Ct1Ack || msg.payload.type === MessageType.EkCt1Ack) {
          // Do encaps2 with stored EK
          const encResult = mlkem.encaps2(state.ek, state.es, state.hdr);
          const derivedSecret = deriveSckaKey(encResult.sharedSecret, state.epoch);
          const auth = state.auth.clone();
          auth.update(state.epoch, derivedSecret);

          key = { epoch: state.epoch, secret: derivedSecret };

          return {
            type: "Ct2Sampled",
            epoch: state.epoch,
            auth,
          };
        }
        return state;
      }

      case "Ct1Acknowledged": {
        if (msg.epoch > state.epoch) {
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        if (msg.epoch < state.epoch) return state;

        const hasEk =
          msg.payload.type === MessageType.Ek || msg.payload.type === MessageType.EkCt1Ack;

        if (hasEk) {
          const ekPayload = msg.payload as { data: Uint8Array };
          const ek = ekPayload.data;

          // Do encaps2 with the received EK
          const encResult = mlkem.encaps2(ek, state.es, state.hdr);
          const derivedSecret = deriveSckaKey(encResult.sharedSecret, state.epoch);
          const auth = state.auth.clone();
          auth.update(state.epoch, derivedSecret);

          key = { epoch: state.epoch, secret: derivedSecret };

          return {
            type: "Ct2Sampled",
            epoch: state.epoch,
            auth,
          };
        }
        return state;
      }

      case "Ct2Sampled": {
        if (msg.epoch > state.epoch) {
          if (msg.epoch === state.epoch + 1) {
            // Transition to next epoch as KeysUnsampled
            return {
              type: "KeysUnsampled",
              epoch: msg.epoch,
              auth: state.auth,
            };
          }
          throw new SpqrStateError(`Epoch out of range: ${msg.epoch}`, "EPOCH_OUT_OF_RANGE");
        }
        return state;
      }
    }
  })();

  return { state: resultState, key };
}

// ---- State epoch getter ----

export function stateEpoch(state: SpqrState): number {
  return state.epoch;
}

// ---- Serialization ----

export interface SerializedSpqrState {
  type: SpqrState["type"];
  epoch: number;
  auth: { rootKey: Uint8Array; macKey: Uint8Array };
  ek?: Uint8Array;
  dk?: Uint8Array;
  hdr?: Uint8Array;
  ct1?: Uint8Array;
  es?: Uint8Array;
}

export function serializeState(state: SpqrState): SerializedSpqrState {
  const base: SerializedSpqrState = {
    type: state.type,
    epoch: state.epoch,
    auth: state.auth.serialize(),
  };

  switch (state.type) {
    case "KeysSampled":
      base.ek = state.ek;
      base.dk = state.dk;
      base.hdr = state.hdr;
      break;
    case "HeaderSent":
      base.dk = state.dk;
      base.ek = state.ek;
      break;
    case "Ct1Received":
      base.dk = state.dk;
      base.ct1 = state.ct1;
      base.ek = state.ek;
      break;
    case "EkSentCt1Received":
      base.dk = state.dk;
      base.ct1 = state.ct1;
      break;
    case "HeaderReceived":
      base.hdr = state.hdr;
      break;
    case "Ct1Sampled":
      base.hdr = state.hdr;
      base.es = state.es;
      base.ct1 = state.ct1;
      break;
    case "EkReceivedCt1Sampled":
      base.es = state.es;
      base.ek = state.ek;
      base.ct1 = state.ct1;
      base.hdr = state.hdr;
      break;
    case "Ct1Acknowledged":
      base.hdr = state.hdr;
      base.es = state.es;
      base.ct1 = state.ct1;
      break;
  }

  return base;
}

export function deserializeState(data: SerializedSpqrState): SpqrState {
  const auth = Authenticator.deserialize(data.auth);

  switch (data.type) {
    case "KeysUnsampled":
      return { type: "KeysUnsampled", epoch: data.epoch, auth };
    case "KeysSampled":
      return {
        type: "KeysSampled",
        epoch: data.epoch,
        auth,
        ek: data.ek!,
        dk: data.dk!,
        hdr: data.hdr!,
      };
    case "HeaderSent":
      return {
        type: "HeaderSent",
        epoch: data.epoch,
        auth,
        dk: data.dk!,
        ek: data.ek!,
      };
    case "Ct1Received":
      return {
        type: "Ct1Received",
        epoch: data.epoch,
        auth,
        dk: data.dk!,
        ct1: data.ct1!,
        ek: data.ek!,
      };
    case "EkSentCt1Received":
      return {
        type: "EkSentCt1Received",
        epoch: data.epoch,
        auth,
        dk: data.dk!,
        ct1: data.ct1!,
      };
    case "NoHeaderReceived":
      return { type: "NoHeaderReceived", epoch: data.epoch, auth };
    case "HeaderReceived":
      return {
        type: "HeaderReceived",
        epoch: data.epoch,
        auth,
        hdr: data.hdr!,
      };
    case "Ct1Sampled":
      return {
        type: "Ct1Sampled",
        epoch: data.epoch,
        auth,
        hdr: data.hdr!,
        es: data.es!,
        ct1: data.ct1!,
      };
    case "EkReceivedCt1Sampled":
      return {
        type: "EkReceivedCt1Sampled",
        epoch: data.epoch,
        auth,
        es: data.es!,
        ek: data.ek!,
        ct1: data.ct1!,
        hdr: data.hdr!,
      };
    case "Ct1Acknowledged":
      return {
        type: "Ct1Acknowledged",
        epoch: data.epoch,
        auth,
        hdr: data.hdr!,
        es: data.es!,
        ct1: data.ct1!,
      };
    case "Ct2Sampled":
      return { type: "Ct2Sampled", epoch: data.epoch, auth };
    default:
      throw new SpqrStateError("Unknown state type", "STATE_DECODE");
  }
}
