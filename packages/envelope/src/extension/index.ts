/// Extension module exports for Gordian Envelope.
///
/// This module provides extended functionality for working with Gordian
/// Envelopes, including type system support, encryption, compression,
/// signatures, and more.

// Type system
export { IS_A } from "./types";

// Salt support
export { SALT } from "./salt";

// Compression support
export { Compressed, registerCompressExtension } from "./compress";

// Encryption support
export { SymmetricKey, EncryptedMessage, registerEncryptExtension } from "./encrypt";

// Signature support
export {
  Signature,
  SigningPrivateKey,
  SigningPublicKey,
  SignatureMetadata,
  type Signer,
  type Verifier,
  SIGNED,
  VERIFIED_BY,
  NOTE,
} from "./signature";

// Attachment support
export { Attachments, ATTACHMENT, VENDOR, CONFORMS_TO } from "./attachment";

// Recipient support (public-key encryption)
export { PublicKeyBase, PrivateKeyBase, SealedMessage, HAS_RECIPIENT } from "./recipient";

// Expression support
export {
  Function,
  Parameter,
  Expression,
  FUNCTION_IDS,
  PARAMETER_IDS,
  CBOR_TAG_FUNCTION,
  CBOR_TAG_PARAMETER,
  CBOR_TAG_PLACEHOLDER,
  CBOR_TAG_REPLACEMENT,
  add,
  sub,
  mul,
  div,
  neg,
  lt,
  gt,
  eq,
  and,
  or,
  not,
  type FunctionID,
  type ParameterID,
} from "./expression";

// Secret support (password-based locking)
export { registerSecretExtension } from "./secret";

// SSKR support (Sharded Secret Key Reconstruction)
export { registerSskrExtension } from "./sskr";

// Import side-effect modules to register prototype extensions
import "./types";
import "./salt";
import "./compress";
import "./encrypt";
import "./signature";
import "./attachment";
import "./recipient";
import "./proof";
import "./secret";
import "./sskr";
