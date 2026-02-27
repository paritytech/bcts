/**
 * Error types for the triple ratchet protocol.
 */

export enum TripleRatchetErrorCode {
  PQRatchetSendError = "PQ_RATCHET_SEND_ERROR",
  PQRatchetRecvError = "PQ_RATCHET_RECV_ERROR",
  PQRatchetStateDecode = "PQ_RATCHET_STATE_DECODE",
  MissingKyberPreKey = "MISSING_KYBER_PRE_KEY",
  MissingKyberCiphertext = "MISSING_KYBER_CIPHERTEXT",
  X3DHNoLongerSupported = "X3DH_NO_LONGER_SUPPORTED",
  InvalidPQRatchetVersion = "INVALID_PQ_RATCHET_VERSION",
  InvalidState = "INVALID_STATE",
  InvalidMessage = "INVALID_MESSAGE",
}

export class TripleRatchetError extends Error {
  constructor(
    message: string,
    public readonly code: TripleRatchetErrorCode,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "TripleRatchetError";
  }
}
