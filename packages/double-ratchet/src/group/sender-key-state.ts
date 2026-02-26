/**
 * SenderKeyState -- state for a single sender key chain.
 *
 * Reference: libsignal/rust/protocol/src/sender_keys.rs (SenderKeyState)
 */

import { SenderChainKey } from "./sender-chain-key.js";
import { SenderMessageKey } from "./sender-message-key.js";
import type { SenderKeyStateStructureProto } from "../protocol/proto.js";
import { MAX_MESSAGE_KEYS } from "../constants.js";

export class SenderKeyState {
  private readonly _messageVersion: number;
  private readonly _chainId: number;
  private _senderChainKey: SenderChainKey | undefined;
  private readonly _signingKeyPublic: Uint8Array;
  private readonly _signingKeyPrivate: Uint8Array | undefined;
  private readonly _messageKeys: SenderMessageKey[];

  constructor(
    messageVersion: number,
    chainId: number,
    iteration: number,
    chainKey: Uint8Array,
    signingKeyPublic: Uint8Array,
    signingKeyPrivate?: Uint8Array,
  ) {
    this._messageVersion = messageVersion;
    this._chainId = chainId;
    this._senderChainKey = new SenderChainKey(iteration, chainKey);
    this._signingKeyPublic = signingKeyPublic;
    this._signingKeyPrivate = signingKeyPrivate;
    this._messageKeys = [];
  }

  static fromProtobuf(proto: SenderKeyStateStructureProto): SenderKeyState {
    // Strip 0x05 prefix from signing key if present
    let pubKey = proto.senderSigningKey?.publicKey ?? new Uint8Array(0);
    if (pubKey.length === 33 && pubKey[0] === 0x05) {
      pubKey = pubKey.slice(1);
    }

    const state = new SenderKeyState(
      proto.messageVersion ?? 3,
      proto.chainId ?? 0,
      proto.senderChainKey?.iteration ?? 0,
      proto.senderChainKey?.seed ?? new Uint8Array(32),
      pubKey,
      (proto.senderSigningKey?.privateKey?.length ?? 0) > 0
        ? proto.senderSigningKey?.privateKey
        : undefined,
    );

    // Restore cached message keys
    if (proto.senderMessageKeys != null) {
      for (const smk of proto.senderMessageKeys) {
        state._messageKeys.push(
          new SenderMessageKey(smk.iteration ?? 0, smk.seed ?? new Uint8Array(0)),
        );
      }
    }

    return state;
  }

  get messageVersion(): number {
    return this._messageVersion === 0 ? 3 : this._messageVersion;
  }

  get chainId(): number {
    return this._chainId;
  }

  senderChainKey(): SenderChainKey | undefined {
    return this._senderChainKey;
  }

  setSenderChainKey(chainKey: SenderChainKey): void {
    this._senderChainKey = chainKey;
  }

  signingKeyPublic(): Uint8Array {
    return this._signingKeyPublic;
  }

  signingKeyPrivate(): Uint8Array | undefined {
    return this._signingKeyPrivate;
  }

  addSenderMessageKey(key: SenderMessageKey): void {
    this._messageKeys.push(key);
    while (this._messageKeys.length > MAX_MESSAGE_KEYS) {
      this._messageKeys.shift();
    }
  }

  removeSenderMessageKey(iteration: number): SenderMessageKey | undefined {
    const idx = this._messageKeys.findIndex((k) => k.iteration === iteration);
    if (idx === -1) return undefined;
    return this._messageKeys.splice(idx, 1)[0];
  }

  toProtobuf(): SenderKeyStateStructureProto {
    // Serialize signing key with 0x05 prefix
    const pubKey =
      this._signingKeyPublic.length === 32
        ? (() => {
            const buf = new Uint8Array(33);
            buf[0] = 0x05;
            buf.set(this._signingKeyPublic, 1);
            return buf;
          })()
        : this._signingKeyPublic;

    const result: SenderKeyStateStructureProto = {
      messageVersion: this._messageVersion,
      chainId: this._chainId,
      senderSigningKey: {
        publicKey: pubKey,
        privateKey: this._signingKeyPrivate ?? new Uint8Array(0),
      },
      senderMessageKeys: this._messageKeys.map((mk) => ({
        iteration: mk.iteration,
        seed: mk.seed,
      })),
    };
    if (this._senderChainKey != null) {
      result.senderChainKey = {
        iteration: this._senderChainKey.iteration,
        seed: this._senderChainKey.seed,
      };
    }
    return result;
  }
}
