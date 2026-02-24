/**
 * Error types for the Signal Protocol ratchet implementation.
 */

export class RatchetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatchetError";
  }
}

export class SessionNotFoundError extends RatchetError {
  constructor(address: string) {
    super(`Session not found for ${address}`);
    this.name = "SessionNotFoundError";
  }
}

export class InvalidMessageError extends RatchetError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageError";
  }
}

export class DuplicateMessageError extends RatchetError {
  readonly chainIndex: number;
  readonly counter: number;

  constructor(chainIndex: number, counter: number) {
    super(`Duplicate message: chain index ${chainIndex}, counter ${counter}`);
    this.name = "DuplicateMessageError";
    this.chainIndex = chainIndex;
    this.counter = counter;
  }
}

export class UntrustedIdentityError extends RatchetError {
  constructor(address: string) {
    super(`Untrusted identity for ${address}`);
    this.name = "UntrustedIdentityError";
  }
}

export class InvalidKeyError extends RatchetError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidKeyError";
  }
}

export class InvalidSessionError extends RatchetError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSessionError";
  }
}

export class SignatureValidationError extends RatchetError {
  constructor() {
    super("Signature validation failed");
    this.name = "SignatureValidationError";
  }
}

export class InvalidKeyIdError extends RatchetError {
  constructor(keyType: string, id: number) {
    super(`Invalid ${keyType} key ID: ${id}`);
    this.name = "InvalidKeyIdError";
  }
}

export class InvalidStateError extends RatchetError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class NoKeyPairError extends RatchetError {
  constructor(message: string) {
    super(message);
    this.name = "NoKeyPairError";
  }
}

export class InvalidRegistrationIdError extends RatchetError {
  readonly address: string;
  readonly id: number;
  constructor(address: string, id: number) {
    super(`Session for ${address} has invalid registration ID 0x${id.toString(16).toUpperCase()}`);
    this.name = "InvalidRegistrationIdError";
    this.address = address;
    this.id = id;
  }
}

export class BadKEMKeyTypeError extends RatchetError {
  readonly type: number;
  constructor(keyType: number) {
    super(`Bad KEM key type: 0x${keyType.toString(16).padStart(2, "0")}`);
    this.name = "BadKEMKeyTypeError";
    this.type = keyType;
  }
}

export class BadKEMKeyLengthError extends RatchetError {
  readonly keyType: string;
  readonly length: number;
  constructor(kemType: string, length: number) {
    super(`Bad KEM key length for ${kemType}: ${length}`);
    this.name = "BadKEMKeyLengthError";
    this.keyType = kemType;
    this.length = length;
  }
}

export class BadKEMCiphertextLengthError extends RatchetError {
  readonly keyType: string;
  readonly length: number;
  constructor(kemType: string, length: number) {
    super(`Bad KEM ciphertext length for ${kemType}: ${length}`);
    this.name = "BadKEMCiphertextLengthError";
    this.keyType = kemType;
    this.length = length;
  }
}

export class InvalidKyberPreKeyIdError extends RatchetError {
  constructor() {
    super("Invalid Kyber prekey identifier");
    this.name = "InvalidKyberPreKeyIdError";
  }
}

export class WrongKEMKeyTypeError extends RatchetError {
  readonly expected: string;
  readonly actual: string;
  constructor(expected: string, actual: string) {
    super(`Unexpected KEM key type <${actual}> (expected <${expected}>)`);
    this.name = "WrongKEMKeyTypeError";
    this.expected = expected;
    this.actual = actual;
  }
}

export class UnknownSealedSenderServerCertificateIdError extends RatchetError {
  readonly id: number;
  constructor(id: number) {
    super(`Unknown server certificate ID: ${id}`);
    this.name = "UnknownSealedSenderServerCertificateIdError";
    this.id = id;
  }
}

export class InvalidProtocolAddressError extends RatchetError {
  readonly address: string;
  constructor(address: string) {
    super(`Protocol address is invalid: ${address}`);
    this.name = "InvalidProtocolAddressError";
    this.address = address;
  }
}

export class UnrecognizedMessageVersionError extends RatchetError {
  readonly version: number;
  constructor(version: number) {
    super(`Unrecognized message version: ${version}`);
    this.name = "UnrecognizedMessageVersionError";
    this.version = version;
  }
}

export class InvalidProtobufError extends RatchetError {
  constructor(message: string) {
    super(`Invalid protobuf: ${message}`);
    this.name = "InvalidProtobufError";
  }
}

export class LegacyCiphertextVersionError extends RatchetError {
  readonly version: number;
  constructor(version: number) {
    super(`Legacy ciphertext version: ${version}`);
    this.name = "LegacyCiphertextVersionError";
    this.version = version;
  }
}

export class UnrecognizedCiphertextVersionError extends RatchetError {
  readonly version: number;
  constructor(version: number) {
    super(`Unrecognized ciphertext version: ${version}`);
    this.name = "UnrecognizedCiphertextVersionError";
    this.version = version;
  }
}

export class CiphertextMessageTooShortError extends RatchetError {
  readonly length: number;
  constructor(length: number) {
    super(`Ciphertext serialized bytes were too short: ${length}`);
    this.name = "CiphertextMessageTooShortError";
    this.length = length;
  }
}

export class InvalidMacKeyLengthError extends RatchetError {
  readonly length: number;
  constructor(length: number) {
    super(`Invalid MAC key length: ${length}`);
    this.name = "InvalidMacKeyLengthError";
    this.length = length;
  }
}

export class NoSenderKeyStateError extends RatchetError {
  readonly distributionId: string;
  constructor(distributionId: string) {
    super(`Missing sender key state for distribution ID ${distributionId}`);
    this.name = "NoSenderKeyStateError";
    this.distributionId = distributionId;
  }
}

export class InvalidSenderKeySessionError extends RatchetError {
  readonly distributionId: string;
  constructor(distributionId: string) {
    super(`Invalid sender key session with distribution ID ${distributionId}`);
    this.name = "InvalidSenderKeySessionError";
    this.distributionId = distributionId;
  }
}

export class InvalidSealedSenderMessageError extends RatchetError {
  constructor(message: string) {
    super(`Invalid sealed sender message: ${message}`);
    this.name = "InvalidSealedSenderMessageError";
  }
}

export class UnknownSealedSenderVersionError extends RatchetError {
  readonly version: number;
  constructor(version: number) {
    super(`Unknown sealed sender message version: ${version}`);
    this.name = "UnknownSealedSenderVersionError";
    this.version = version;
  }
}

export class SealedSenderSelfSendError extends RatchetError {
  constructor() {
    super("Self send of a sealed sender message");
    this.name = "SealedSenderSelfSendError";
  }
}

export class FingerprintVersionMismatchError extends RatchetError {
  readonly theirs: number;
  readonly ours: number;
  constructor(theirs: number, ours: number) {
    super(`Fingerprint version mismatch: theirs=${theirs}, ours=${ours}`);
    this.name = "FingerprintVersionMismatchError";
    this.theirs = theirs;
    this.ours = ours;
  }
}

export class FingerprintParsingError extends RatchetError {
  constructor(message: string) {
    super(`Fingerprint parsing error: ${message}`);
    this.name = "FingerprintParsingError";
  }
}
