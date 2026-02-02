/**
 * XID module - 1:1 port of cmd/xid/mod.rs
 *
 * Work with Extensible Identifiers (XID).
 */

// Subcommands
export * as newCmd from "./new.js";
export * as exportCmd from "./export.js";
export * as id from "./id.js";
export * as key from "./key/index.js";
export * as method from "./method/index.js";
export * as delegate from "./delegate/index.js";
export * as service from "./service/index.js";
export * as resolution from "./resolution/index.js";
export * as attachment from "./attachment/index.js";
export * as edge from "./edge/index.js";
export * as provenance from "./provenance/index.js";

// Re-export types for convenience
export { IDFormat } from "./id.js";
export { GeneratorOptions, PrivateOptions } from "./new.js";
export { ExportFormat } from "./export.js";

// Re-export utility types
export type { OutputOptions } from "./output-options.js";
export type { ReadWritePasswordArgs, ReadPasswordArgs, WritePasswordArgs } from "./password-args.js";
export type { VerifyArgs } from "./verify-args.js";
export type { SigningArgs } from "./signing-args.js";
export type { KeyArgsLike } from "./key-args.js";
export type { XIDPrivilege } from "./xid-privilege.js";
export type { ServiceArgsLike } from "./service/service-args.js";
