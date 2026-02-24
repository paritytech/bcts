/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/xid - XID Document Library
 *
 * TypeScript implementation of Blockchain Commons' XID specification
 * for eXtensible IDentifiers and XID Documents.
 *
 * Ported from bc-xid-rust
 */

// Re-export XID from components for convenience
export { XID } from "@bcts/components";

// Error handling
export { XIDError, XIDErrorCode, type XIDResult } from "./error";

// Privilege system
export {
  Privilege,
  privilegeToKnownValue,
  privilegeFromKnownValue,
  privilegeToEnvelope,
  privilegeFromEnvelope,
} from "./privilege";

// Permissions
export { Permissions, type HasPermissions, HasPermissionsMixin } from "./permissions";

// Name/Nickname
export { type HasNickname, HasNicknameMixin } from "./name";

// Shared reference wrapper
export { Shared } from "./shared";

// Key types
export {
  Key,
  XIDPrivateKeyOptions,
  type XIDPrivateKeyEncryptConfig,
  type XIDPrivateKeyOptionsValue,
  type PrivateKeyData,
} from "./key";

// Service
export { Service } from "./service";

// Delegate
export { Delegate, registerXIDDocumentClass, type XIDDocumentType } from "./delegate";

// Provenance
export {
  Provenance,
  XIDGeneratorOptions,
  type XIDGeneratorEncryptConfig,
  type XIDGeneratorOptionsValue,
  type GeneratorData,
} from "./provenance";

// XID Document (main export)
export {
  XIDDocument,
  type XIDInceptionKeyOptions,
  type XIDGenesisMarkOptions,
  type XIDSigningOptions,
  XIDVerifySignature,
} from "./xid-document";

// Re-export Attachments and Edges from envelope for convenience
export { Attachments, Edges, type Edgeable } from "@bcts/envelope";

// Version information
export const VERSION = "1.0.0-alpha.3";
