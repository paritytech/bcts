/// Extension module exports for Gordian Envelope.
///
/// This module provides extended functionality for working with Gordian
/// Envelopes, including type system support, encryption, compression,
/// signatures, and more.

// Type system - IS_A is now imported from @bcts/known-values
// Import types module for side effects (prototype registration)
import "./types";
export { IS_A } from "@bcts/known-values";

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
// Now uses Encrypter/Decrypter interfaces for PQ support (X25519 and MLKEM)
export {
  SealedMessage,
  HAS_RECIPIENT,
  // Legacy exports for backwards compatibility (deprecated)
  PublicKeyBase,
  PrivateKeyBase,
  // Re-export from components
  ComponentsSealedMessage,
  type Encrypter,
  type Decrypter,
} from "./recipient";

// Expression support
export {
  // Classes
  Function,
  Parameter,
  Expression,
  FunctionsStore,
  ParametersStore,
  // Constants and IDs
  FUNCTION_IDS,
  PARAMETER_IDS,
  CBOR_TAG_FUNCTION,
  CBOR_TAG_PARAMETER,
  CBOR_TAG_PLACEHOLDER,
  CBOR_TAG_REPLACEMENT,
  // Well-known function constants
  ADD,
  SUB,
  MUL,
  DIV,
  NEG,
  LT,
  LE,
  GT,
  GE,
  EQ,
  NE,
  AND,
  OR,
  XOR,
  NOT,
  // Raw value constants for functions
  ADD_VALUE,
  SUB_VALUE,
  MUL_VALUE,
  DIV_VALUE,
  NEG_VALUE,
  LT_VALUE,
  LE_VALUE,
  GT_VALUE,
  GE_VALUE,
  EQ_VALUE,
  NE_VALUE,
  AND_VALUE,
  OR_VALUE,
  XOR_VALUE,
  NOT_VALUE,
  // Well-known parameter constants
  BLANK,
  LHS,
  RHS,
  // Raw value constants for parameters
  BLANK_VALUE,
  LHS_VALUE,
  RHS_VALUE,
  // Global stores
  GLOBAL_FUNCTIONS,
  GLOBAL_PARAMETERS,
  // Helper functions
  add,
  sub,
  mul,
  div,
  neg,
  lt,
  le,
  gt,
  ge,
  eq,
  ne,
  and,
  or,
  xor,
  not,
  // Types
  type FunctionID,
  type ParameterID,
  // Lazy initialization helper
  LazyStore,
} from "./expression";

// Proof support (inclusion proofs)
export { registerProofExtension } from "./proof";

// Secret support (password-based locking)
export { registerSecretExtension } from "./secret";

// SSKR support (Sharded Secret Key Reconstruction)
export { registerSskrExtension } from "./sskr";

// Request/Response/Event support (distributed function calls)
export { Request, type RequestBehavior } from "./request";
export { Response, type ResponseBehavior } from "./response";
export { Event, type EventBehavior } from "./event";

// Note: Extension prototype registration is handled by the main index.ts
// to avoid circular dependency issues. The named exports above already
// cause the modules to be loaded; explicit registration calls ensure
// proper initialization order after all modules are ready.
