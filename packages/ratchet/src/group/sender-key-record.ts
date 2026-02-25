/**
 * SenderKeyRecord -- collection of sender key states.
 *
 * Reference: libsignal/rust/protocol/src/sender_keys.rs (SenderKeyRecord)
 */

import { SenderKeyState } from "./sender-key-state.js";
import { MAX_SENDER_KEY_STATES } from "../constants.js";
import {
  encodeSenderKeyRecordStructure,
  decodeSenderKeyRecordStructure,
} from "../protocol/proto.js";

export class SenderKeyRecord {
  private _states: SenderKeyState[];

  constructor() {
    this._states = [];
  }

  static deserialize(data: Uint8Array): SenderKeyRecord {
    const proto = decodeSenderKeyRecordStructure(data);
    const record = new SenderKeyRecord();
    if (proto.senderKeyStates != null) {
      for (const state of proto.senderKeyStates) {
        record._states.push(SenderKeyState.fromProtobuf(state));
      }
    }
    return record;
  }

  serialize(): Uint8Array {
    return encodeSenderKeyRecordStructure({
      senderKeyStates: this._states.map((s) => s.toProtobuf()),
    });
  }

  senderKeyState(): SenderKeyState | undefined {
    return this._states.length > 0 ? this._states[0] : undefined;
  }

  senderKeyStateForChainId(chainId: number): SenderKeyState | undefined {
    return this._states.find((s) => s.chainId === chainId);
  }

  addSenderKeyState(
    messageVersion: number,
    chainId: number,
    iteration: number,
    chainKey: Uint8Array,
    signingKeyPublic: Uint8Array,
    signingKeyPrivate?: Uint8Array,
  ): void {
    // Remove existing state with same chainId and signingKey
    const existingIdx = this._states.findIndex(
      (s) => s.chainId === chainId && bytesEqual(s.signingKeyPublic(), signingKeyPublic),
    );
    let existingState: SenderKeyState | undefined;
    if (existingIdx !== -1) {
      existingState = this._states.splice(existingIdx, 1)[0];
    }

    // Remove any other states with same chainId but different key
    this._states = this._states.filter((s) => s.chainId !== chainId);

    const state =
      existingState ??
      new SenderKeyState(
        messageVersion,
        chainId,
        iteration,
        chainKey,
        signingKeyPublic,
        signingKeyPrivate,
      );

    // Evict oldest if at capacity
    while (this._states.length >= MAX_SENDER_KEY_STATES) {
      this._states.pop();
    }

    this._states.unshift(state);
  }

  isEmpty(): boolean {
    return this._states.length === 0;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
