/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Hubert HTTP server implementation.
 *
 * Port of server/server.rs from hubert-rust.
 *
 * @module
 */

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";

import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";

import { verbosePrintln } from "../logging.js";
import { MemoryKv } from "./memory-kv.js";
import { type ServerKv, getSync, putSync } from "./server-kv.js";
import { type SqliteKv } from "./sqlite-kv.js";

/**
 * Package version for health endpoint.
 */
const VERSION = "1.0.0-alpha.1";

/**
 * Configuration for the Hubert server.
 *
 * Port of `struct ServerConfig` from server/server.rs lines 19-30.
 *
 * @category Server
 */
export interface ServerConfig {
  /** Port to listen on */
  port: number;
  /**
   * Maximum TTL in seconds allowed.
   * If a put() specifies a TTL higher than this, it will be clamped.
   * If put() specifies None, this value will be used.
   * Hubert is intended for coordination, not long-term storage.
   */
  maxTtl: number;
  /** Enable verbose logging with timestamps */
  verbose: boolean;
}

/**
 * Default server configuration.
 *
 * Port of `impl Default for ServerConfig` from server/server.rs lines 32-40.
 */
export const defaultServerConfig: ServerConfig = {
  port: 45678,
  maxTtl: 86400, // 24 hours max (and default)
  verbose: false,
};

/**
 * Shared server state.
 *
 * Port of `struct ServerState` from server/server.rs lines 43-47.
 *
 * @internal
 */
class ServerState {
  storage: ServerKv;
  config: ServerConfig;

  constructor(config: ServerConfig, storage: ServerKv) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * Put an envelope into storage.
   *
   * Port of `ServerState::put()` from server/server.rs lines 54-101.
   */
  async put(
    arid: ARID,
    envelope: Envelope,
    requestedTtl: number | undefined,
    clientIp: string | undefined,
  ): Promise<void> {
    // Determine effective TTL:
    // - If requested, use it (clamped to maxTtl)
    // - If undefined requested, use maxTtl
    // All entries expire (hubert is for coordination, not long-term storage)
    const maxTtl = this.config.maxTtl;
    let ttl: number;
    if (requestedTtl !== undefined) {
      ttl = requestedTtl > maxTtl ? maxTtl : requestedTtl;
    } else {
      ttl = maxTtl;
    }

    try {
      await putSync(this.storage, arid, envelope, ttl);

      if (this.config.verbose) {
        const ipStr = clientIp ? `${clientIp}: ` : "";
        verbosePrintln(`${ipStr}PUT ${arid.urString()} (TTL ${ttl}s) OK`);
      }
    } catch (error) {
      if (this.config.verbose) {
        const ipStr = clientIp ? `${clientIp}: ` : "";
        const errorMsg = error instanceof Error ? error.message : String(error);
        verbosePrintln(`${ipStr}PUT ${arid.urString()} (TTL ${ttl}s) ERROR: ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * Get an envelope from storage.
   *
   * Port of `ServerState::get()` from server/server.rs lines 103-126.
   */
  async get(arid: ARID, clientIp: string | undefined): Promise<Envelope | null> {
    const result = await getSync(this.storage, arid);

    if (this.config.verbose) {
      const ipStr = clientIp ? `${clientIp}: ` : "";
      const status = result ? "OK" : "NOT_FOUND";
      verbosePrintln(`${ipStr}GET ${arid.urString()} ${status}`);
    }

    return result;
  }
}

/**
 * Hubert HTTP server.
 *
 * Port of `struct Server` from server/server.rs lines 128-133.
 *
 * @category Server
 *
 * @example
 * ```typescript
 * const server = Server.newMemory({ port: 8080, maxTtl: 3600, verbose: true });
 * await server.run();
 * ```
 */
export class Server {
  private readonly config: ServerConfig;
  private readonly state: ServerState;
  private readonly fastify: FastifyInstance;

  /**
   * Create a new server with the given configuration and storage backend.
   *
   * Port of `Server::new()` from server/server.rs lines 135-139.
   */
  constructor(config: ServerConfig, storage: ServerKv) {
    this.config = config;
    this.state = new ServerState(config, storage);
    this.fastify = Fastify({ logger: false });
    this.setupRoutes();
  }

  /**
   * Create a new server with in-memory storage.
   *
   * Port of `Server::new_memory()` from server/server.rs lines 142-144.
   */
  static newMemory(config: Partial<ServerConfig> = {}): Server {
    const fullConfig = { ...defaultServerConfig, ...config };
    return new Server(fullConfig, new MemoryKv());
  }

  /**
   * Create a new server with SQLite storage.
   *
   * Port of `Server::new_sqlite()` from server/server.rs lines 147-149.
   */
  static newSqlite(config: Partial<ServerConfig> = {}, storage: SqliteKv): Server {
    const fullConfig = { ...defaultServerConfig, ...config };
    return new Server(fullConfig, storage);
  }

  /**
   * Setup HTTP routes.
   * @internal
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.fastify.get("/health", this.handleHealth.bind(this));

    // PUT endpoint
    this.fastify.post("/put", this.handlePut.bind(this));

    // GET endpoint
    this.fastify.post("/get", this.handleGet.bind(this));
  }

  /**
   * Handle health check requests.
   *
   * Port of `handle_health()` from server/server.rs lines 179-187.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async handleHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send({
      server: "hubert",
      version: VERSION,
      status: "ok",
    });
  }

  /**
   * Handle PUT requests.
   *
   * Port of `handle_put()` from server/server.rs lines 195-238.
   */
  private async handlePut(
    request: FastifyRequest<{ Body: string }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const bodyStr = request.body;
      if (typeof bodyStr !== "string") {
        reply.status(400).send("Expected text body");
        return;
      }

      const lines = bodyStr.split("\n");
      if (lines.length < 2) {
        reply.status(400).send("Expected at least 2 lines: ur:arid and ur:envelope");
        return;
      }

      // Parse ARID
      let arid: ARID;
      try {
        arid = ARID.fromUrString(lines[0]);
      } catch {
        reply.status(400).send("Invalid ur:arid");
        return;
      }

      // Parse Envelope
      let envelope: Envelope;
      try {
        envelope = Envelope.fromUrString(lines[1]);
      } catch {
        reply.status(400).send("Invalid ur:envelope");
        return;
      }

      // Parse optional TTL
      let ttl: number | undefined;
      if (lines.length > 2 && lines[2].trim() !== "") {
        const parsed = parseInt(lines[2], 10);
        if (isNaN(parsed)) {
          reply.status(400).send("Invalid TTL");
          return;
        }
        ttl = parsed;
      }

      // Get client IP
      const clientIp = request.ip;

      // Store the envelope
      await this.state.put(arid, envelope, ttl, clientIp);

      reply.status(200).send("OK");
    } catch (error) {
      // Check if it's an AlreadyExists error
      if (error instanceof Error && error.name === "AlreadyExistsError") {
        reply.status(409).send(error.message);
      } else {
        reply.status(500).send(error instanceof Error ? error.message : "Internal server error");
      }
    }
  }

  /**
   * Handle GET requests.
   *
   * Port of `handle_get()` from server/server.rs lines 244-269.
   */
  private async handleGet(
    request: FastifyRequest<{ Body: string }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const bodyStr = request.body;
      if (typeof bodyStr !== "string") {
        reply.status(400).send("Expected text body");
        return;
      }

      const aridStr = bodyStr.trim();
      if (aridStr === "") {
        reply.status(400).send("Expected ur:arid");
        return;
      }

      // Parse ARID
      let arid: ARID;
      try {
        arid = ARID.fromUrString(aridStr);
      } catch {
        reply.status(400).send("Invalid ur:arid");
        return;
      }

      // Get client IP
      const clientIp = request.ip;

      // Retrieve the envelope
      const envelope = await this.state.get(arid, clientIp);

      if (envelope) {
        reply.status(200).send(envelope.urString());
      } else {
        reply.status(404).send("Not found");
      }
    } catch (error) {
      reply.status(500).send(error instanceof Error ? error.message : "Internal server error");
    }
  }

  /**
   * Run the server.
   *
   * Port of `Server::run()` from server/server.rs lines 152-170.
   */
  async run(): Promise<void> {
    const addr = `127.0.0.1:${this.config.port}`;

    // Configure Fastify to parse plain text bodies
    this.fastify.addContentTypeParser(
      "text/plain",
      { parseAs: "string" },
      (_request, payload, done) => {
        done(null, payload);
      },
    );

    // Also handle application/octet-stream and no content-type
    this.fastify.addContentTypeParser(
      "application/octet-stream",
      { parseAs: "string" },
      (_request, payload, done) => {
        done(null, payload);
      },
    );

    await this.fastify.listen({ port: this.config.port, host: "127.0.0.1" });
    console.log(`✓ Hubert server listening on ${addr}`);
  }

  /**
   * Get the port the server is configured to listen on.
   *
   * Port of `Server::port()` from server/server.rs line 173.
   */
  port(): number {
    return this.config.port;
  }

  /**
   * Stop the server.
   */
  async close(): Promise<void> {
    await this.fastify.close();
  }
}
