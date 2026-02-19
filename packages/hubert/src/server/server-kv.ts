/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Server-side key-value storage backend union type.
 *
 * Port of server/server_kv.rs from hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { type KvStore } from "../kv-store.js";
import { MemoryKv } from "./memory-kv.js";
import { type SqliteKv } from "./sqlite-kv.js";

/**
 * Server-side key-value storage backend.
 *
 * This type allows selecting between in-memory and SQLite storage
 * at server setup time.
 *
 * Port of `enum ServerKv` from server/server_kv.rs lines 7-15.
 *
 * @category Server Backend
 */
export type ServerKv = MemoryKv | SqliteKv;

/**
 * Create a new in-memory server KV store.
 *
 * Port of `ServerKv::memory()` from server/server_kv.rs line 19.
 *
 * @returns A new MemoryKv instance
 * @category Server Backend
 */
export function createMemoryKv(): MemoryKv {
  return new MemoryKv();
}

/**
 * Create a new SQLite-backed server KV store.
 *
 * Port of `ServerKv::sqlite()` from server/server_kv.rs line 22.
 *
 * @param store - The SqliteKv instance to use
 * @returns The same SqliteKv instance
 * @category Server Backend
 */
export function createSqliteKv(store: SqliteKv): SqliteKv {
  return store;
}

/**
 * Synchronously put an envelope into the store.
 *
 * This function wraps the async KvStore trait implementation for use
 * in synchronous HTTP handlers.
 *
 * Port of `put_sync()` from server/server_kv.rs lines 27-52.
 *
 * @param store - The KvStore to use
 * @param arid - The ARID to store at
 * @param envelope - The envelope to store
 * @param ttlSeconds - TTL in seconds
 * @returns Promise that resolves when storage is complete
 * @internal
 */
export async function putSync(
  store: KvStore,
  arid: ARID,
  envelope: Envelope,
  ttlSeconds: number,
): Promise<void> {
  await store.put(arid, envelope, ttlSeconds, false);
}

/**
 * Synchronously get an envelope from the store.
 *
 * This function wraps the async KvStore trait implementation for use
 * in synchronous HTTP handlers.
 *
 * Port of `get_sync()` from server/server_kv.rs lines 58-71.
 *
 * @param store - The KvStore to use
 * @param arid - The ARID to retrieve
 * @returns The envelope if found, or null
 * @internal
 */
export async function getSync(store: KvStore, arid: ARID): Promise<Envelope | null> {
  return await store.get(arid, 0, false);
}
