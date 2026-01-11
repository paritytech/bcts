# Hubert - Distributed Infrastructure for Secure Multiparty Transactions

> Disclaimer: This package is under active development and APIs may change.

## Introduction

Hubert provides distributed infrastructure for secure multiparty transactions, designed to support FROST threshold signature protocols. It enables distributed key-value storage using ARID (Apparently Random Identifier) addressing with multiple storage backends.

**Key Features:**
- **ARID-based Addressing**: Cryptographic identifiers that appear random but are deterministically derived
- **Multiple Storage Backends**: Mainline DHT, IPFS, Hybrid (DHT+IPFS), and Server modes
- **Write-once Semantics**: Content-addressed storage that cannot be modified once written
- **Data Obfuscation**: ChaCha20 encryption using ARID-derived keys
- **Gordian Envelope**: All data is stored as Gordian Envelope structures

## Rust Reference Implementation

This TypeScript implementation is based on [hubert-rust](https://github.com/ARAiOSdev/hubert-rust) **v0.5.0** ([commit](https://github.com/ARAiOSdev/hubert-rust/tree/main)).

## Installation

```bash
# Using npm
npm install @bcts/hubert

# Using bun
bun add @bcts/hubert
```

## CLI Usage

The `hubert` CLI provides commands for interacting with distributed storage:

```bash
# Generate a new ARID from input data
hubert generate <input>

# Store an envelope to the network
hubert put <arid> <envelope> [--backend mainline|ipfs|hybrid|server]

# Retrieve an envelope from the network
hubert get <arid> [--backend mainline|ipfs|hybrid|server]

# Check if an ARID exists
hubert check <arid> [--backend mainline|ipfs|hybrid|server]

# Run a hubert server
hubert server [--port 8080] [--db sqlite|memory]
```

## Programmatic API

### Basic Usage

```typescript
import { MainlineKv, IpfsKv, HybridKv, ServerKv } from "@bcts/hubert";
import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";

// Create a KV store instance
const kv = new MainlineKv();

// Generate an ARID
const arid = ARID.fromData(Buffer.from("my-unique-key"));

// Create an envelope
const envelope = Envelope.wrap("Hello, World!");

// Store data
await kv.put(arid, envelope);

// Retrieve data
const result = await kv.get(arid);
```

### ARID Derivation

```typescript
import { deriveKey, deriveIpfsKeyName, deriveMainlineKey, obfuscateWithArid } from "@bcts/hubert";

// Derive a key using HKDF
const key = deriveKey(salt, arid, 32);

// Derive IPFS key name (64-char hex)
const ipfsKey = deriveIpfsKeyName(arid);

// Derive Mainline DHT key (20 bytes)
const mainlineKey = deriveMainlineKey(arid);

// Obfuscate data with ChaCha20
const obfuscated = obfuscateWithArid(arid, plaintext);
```

### Storage Backends

```typescript
// Mainline DHT (BEP-44 mutable storage)
import { MainlineKv } from "@bcts/hubert/mainline";
const mainline = new MainlineKv({ bootstrap: [...] });

// IPFS (with IPNS for mutable names)
import { IpfsKv } from "@bcts/hubert/ipfs";
const ipfs = new IpfsKv({ apiUrl: "http://localhost:5001" });

// Hybrid (DHT reference to IPFS content)
import { HybridKv } from "@bcts/hubert/hybrid";
const hybrid = new HybridKv({ mainline, ipfs });

// Server (REST API with SQLite/Memory backend)
import { ServerKv } from "@bcts/hubert/server";
const server = new ServerKv({ baseUrl: "http://localhost:8080" });
```

## Architecture

### KvStore Interface

All storage backends implement the `KvStore` interface:

```typescript
interface KvStore {
  put(arid: ARID, envelope: Envelope, ttlSeconds?: number, verbose?: boolean): Promise<string>;
  get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | undefined>;
  exists(arid: ARID): Promise<boolean>;
}
```

### Storage Backends

| Backend | Protocol | Persistence | Use Case |
|---------|----------|-------------|----------|
| Mainline | BEP-44 DHT | Distributed | Decentralized, censorship-resistant |
| IPFS | IPNS/IPLD | Distributed | Content-addressed, large data |
| Hybrid | DHT + IPFS | Distributed | Best of both: small refs + large content |
| Server | REST API | Centralized | Development, testing, controlled environments |

### ARID Derivation

ARIDs are used to derive storage keys for each backend:

- **IPFS Key Name**: `HKDF(salt="IPFS_KEY_NAME", arid, 32 bytes)` → 64-char hex
- **Mainline Key**: `HKDF(salt="MAINLINE_KEY", arid, 20 bytes)` → DHT info-hash
- **Obfuscation Key**: `HKDF(salt="OBFUSCATION_KEY", arid, 32 bytes)` → ChaCha20 key

## API Reference

See the [TypeDoc documentation](https://bcts.dev/docs/hubert) for complete API reference.

## License

BSD-2-Clause-Patent
