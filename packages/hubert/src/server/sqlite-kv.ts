/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * SQLite-backed key-value store for Gordian Envelopes.
 *
 * Port of server/sqlite_kv.rs from hubert-rust.
 *
 * @module
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

import { type ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { AlreadyExistsError } from "../error.js";
import { type KvStore } from "../kv-store.js";
import { verbosePrintln } from "../logging.js";
import { SqliteError } from "./error.js";

/**
 * SQLite-backed key-value store for Gordian Envelopes.
 *
 * Provides persistent storage with TTL support and automatic cleanup of
 * expired entries.
 *
 * Port of `struct SqliteKv` from server/sqlite_kv.rs lines 16-24.
 *
 * @category Server Backend
 *
 * @example
 * ```typescript
 * const store = new SqliteKv("./hubert.db");
 * const arid = ARID.new();
 * const envelope = Envelope.new("Hello, SQLite!");
 *
 * await store.put(arid, envelope, 3600); // 1 hour TTL
 * const result = await store.get(arid);
 *
 * // Cleanup when done
 * store.close();
 * ```
 */
export class SqliteKv implements KvStore {
  private readonly db: Database.Database;
  private readonly dbPath: string;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Create a new SQLite-backed key-value store.
   *
   * Port of `SqliteKv::new()` from server/sqlite_kv.rs lines 26-67.
   *
   * @param dbPath - Path to the SQLite database file. Will be created if it doesn't exist.
   * @throws {SqliteError} If database initialization fails
   */
  constructor(dbPath: string) {
    this.dbPath = dbPath;

    // Create parent directory if it doesn't exist
    const parentDir = path.dirname(dbPath);
    if (parentDir && parentDir !== "." && !fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    try {
      this.db = new Database(dbPath);

      // Create table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS hubert_store (
          arid TEXT PRIMARY KEY,
          envelope TEXT NOT NULL,
          expires_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_expires_at ON hubert_store(expires_at);
      `);
    } catch (error) {
      throw new SqliteError(
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }

    // Start background cleanup task
    this.startCleanupTask();
  }

  /**
   * Start a background task that prunes expired entries every minute.
   *
   * Port of `start_cleanup_task()` from server/sqlite_kv.rs lines 70-126.
   *
   * @internal
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);

      try {
        // First collect the ARIDs that will be deleted
        const selectStmt = this.db.prepare(
          "SELECT arid FROM hubert_store WHERE expires_at IS NOT NULL AND expires_at <= ?",
        );
        const rows = selectStmt.all(now) as { arid: string }[];
        const arids = rows.map((row) => row.arid);

        if (arids.length > 0) {
          // Now delete them
          const deleteStmt = this.db.prepare(
            "DELETE FROM hubert_store WHERE expires_at IS NOT NULL AND expires_at <= ?",
          );
          deleteStmt.run(now);

          const count = arids.length;
          const aridList = arids.join(" ");
          verbosePrintln(
            `Pruned ${count} expired ${count === 1 ? "entry" : "entries"}: ${aridList}`,
          );
        }
      } catch {
        // Silently ignore cleanup errors
      }
    }, 60 * 1000); // Every 60 seconds
  }

  /**
   * Check if an ARID exists and is not expired.
   *
   * Port of `check_exists()` from server/sqlite_kv.rs lines 129-170.
   *
   * @internal
   */
  private checkExists(arid: ARID): boolean {
    const aridStr = arid.urString();
    const now = Math.floor(Date.now() / 1000);

    try {
      const stmt = this.db.prepare("SELECT expires_at FROM hubert_store WHERE arid = ?");
      const row = stmt.get(aridStr) as { expires_at: number | null } | undefined;

      if (row) {
        // Check if expired
        if (row.expires_at !== null && now >= row.expires_at) {
          // Entry is expired, remove it
          const deleteStmt = this.db.prepare("DELETE FROM hubert_store WHERE arid = ?");
          deleteStmt.run(aridStr);
          return false;
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Store an envelope at the given ARID.
   *
   * Port of `KvStore::put()` implementation from server/sqlite_kv.rs lines 175-236.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async put(
    arid: ARID,
    envelope: Envelope,
    ttlSeconds?: number,
    verbose?: boolean,
  ): Promise<string> {
    // Check if already exists
    if (this.checkExists(arid)) {
      if (verbose) {
        verbosePrintln(`PUT ${arid.urString()} ALREADY_EXISTS`);
      }
      throw new AlreadyExistsError(arid.urString());
    }

    const aridStr = arid.urString();
    const envelopeStr = envelope.urString();

    const expiresAt = ttlSeconds !== undefined ? Math.floor(Date.now() / 1000) + ttlSeconds : null;

    try {
      const stmt = this.db.prepare(
        "INSERT INTO hubert_store (arid, envelope, expires_at) VALUES (?, ?, ?)",
      );
      stmt.run(aridStr, envelopeStr, expiresAt);

      if (verbose) {
        const ttlMsg = ttlSeconds !== undefined ? ` (TTL ${ttlSeconds}s)` : "";
        verbosePrintln(`PUT ${aridStr}${ttlMsg} OK (SQLite: ${this.dbPath})`);
      }

      return `Stored in SQLite: ${this.dbPath}`;
    } catch (error) {
      throw new SqliteError(
        `Failed to insert: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Port of `KvStore::get()` implementation from server/sqlite_kv.rs lines 238-354.
   */
  async get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null> {
    const timeout = timeoutSeconds ?? 30;
    const start = Date.now();
    let firstAttempt = true;
    const aridStr = arid.urString();

    // Dynamic import to avoid circular dependencies
    const { Envelope } = await import("@bcts/envelope");

    while (true) {
      const now = Math.floor(Date.now() / 1000);

      try {
        const stmt = this.db.prepare(
          "SELECT envelope, expires_at FROM hubert_store WHERE arid = ?",
        );
        const row = stmt.get(aridStr) as
          | { envelope: string; expires_at: number | null }
          | undefined;

        if (row) {
          // Check if expired
          if (row.expires_at !== null && now >= row.expires_at) {
            // Entry is expired, remove it
            const deleteStmt = this.db.prepare("DELETE FROM hubert_store WHERE arid = ?");
            deleteStmt.run(aridStr);

            if (verbose) {
              verbosePrintln(`GET ${aridStr} EXPIRED`);
            }
            return null;
          }

          // Entry found and not expired
          const envelope = Envelope.fromUrString(row.envelope);

          if (verbose) {
            verbosePrintln(`GET ${aridStr} OK (SQLite: ${this.dbPath})`);
          }

          return envelope;
        }
      } catch {
        // Query failed, treat as not found
      }

      // Not found yet
      const elapsed = (Date.now() - start) / 1000;
      if (elapsed >= timeout) {
        if (verbose) {
          verbosePrintln(`GET ${aridStr} NOT_FOUND (timeout after ${timeout}s)`);
        }
        return null;
      }

      if (firstAttempt && verbose) {
        verbosePrintln(`Polling for ${aridStr} (timeout: ${timeout}s)`);
        firstAttempt = false;
      } else if (verbose) {
        process.stdout.write(".");
      }

      // Wait 500ms before polling again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Check if an envelope exists at the given ARID.
   *
   * Port of `KvStore::exists()` implementation from server/sqlite_kv.rs lines 356-359.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async exists(arid: ARID): Promise<boolean> {
    return this.checkExists(arid);
  }

  /**
   * Close the database connection and stop the cleanup task.
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.db.close();
  }
}
