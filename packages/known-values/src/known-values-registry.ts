import { KnownValue } from "./known-value";
import { getAndLockConfig, loadFromConfig } from "./directory-loader";
import { KnownValuesStore } from "./known-values-store";

// For definitions see: https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2023-002-known-value.md#appendix-a-registry

// =============================================================================
// Raw Value Constants (_RAW)
// =============================================================================
// These constants provide direct access to the raw numeric values for pattern
// matching scenarios. They mirror the Rust implementation which creates both
// XXX_RAW and XXX constants for each known value.

// General
export const UNIT_RAW = 0n;
export const IS_A_RAW = 1n;
export const ID_RAW = 2n;
export const SIGNED_RAW = 3n;
export const NOTE_RAW = 4n;
export const HAS_RECIPIENT_RAW = 5n;
export const SSKR_SHARE_RAW = 6n;
export const CONTROLLER_RAW = 7n;
export const KEY_RAW = 8n;
export const DEREFERENCE_VIA_RAW = 9n;
export const ENTITY_RAW = 10n;
export const NAME_RAW = 11n;
export const LANGUAGE_RAW = 12n;
export const ISSUER_RAW = 13n;
export const HOLDER_RAW = 14n;
export const SALT_RAW = 15n;
export const DATE_RAW = 16n;
export const UNKNOWN_VALUE_RAW = 17n;
export const VERSION_VALUE_RAW = 18n;
export const HAS_SECRET_RAW = 19n;
export const DIFF_EDITS_RAW = 20n;
export const VALID_FROM_RAW = 21n;
export const VALID_UNTIL_RAW = 22n;
export const POSITION_RAW = 23n;
export const NICKNAME_RAW = 24n;

// Attachments
export const ATTACHMENT_RAW = 50n;
export const VENDOR_RAW = 51n;
export const CONFORMS_TO_RAW = 52n;

// XID Documents
export const ALLOW_RAW = 60n;
export const DENY_RAW = 61n;
export const ENDPOINT_RAW = 62n;
export const DELEGATE_RAW = 63n;
export const PROVENANCE_RAW = 64n;
export const PRIVATE_KEY_RAW = 65n;
export const SERVICE_RAW = 66n;
export const CAPABILITY_RAW = 67n;
export const PROVENANCE_GENERATOR_RAW = 68n;

// XID Privileges
export const PRIVILEGE_ALL_RAW = 70n;
export const PRIVILEGE_AUTH_RAW = 71n;
export const PRIVILEGE_SIGN_RAW = 72n;
export const PRIVILEGE_ENCRYPT_RAW = 73n;
export const PRIVILEGE_ELIDE_RAW = 74n;
export const PRIVILEGE_ISSUE_RAW = 75n;
export const PRIVILEGE_ACCESS_RAW = 76n;
export const PRIVILEGE_DELEGATE_RAW = 80n;
export const PRIVILEGE_VERIFY_RAW = 81n;
export const PRIVILEGE_UPDATE_RAW = 82n;
export const PRIVILEGE_TRANSFER_RAW = 83n;
export const PRIVILEGE_ELECT_RAW = 84n;
export const PRIVILEGE_BURN_RAW = 85n;
export const PRIVILEGE_REVOKE_RAW = 86n;

// Expression and Function Calls
export const BODY_RAW = 100n;
export const RESULT_RAW = 101n;
export const ERROR_RAW = 102n;
export const OK_VALUE_RAW = 103n;
export const PROCESSING_VALUE_RAW = 104n;
export const SENDER_RAW = 105n;
export const SENDER_CONTINUATION_RAW = 106n;
export const RECIPIENT_CONTINUATION_RAW = 107n;
export const CONTENT_RAW = 108n;

// Cryptography
export const SEED_TYPE_RAW = 200n;
export const PRIVATE_KEY_TYPE_RAW = 201n;
export const PUBLIC_KEY_TYPE_RAW = 202n;
export const MASTER_KEY_TYPE_RAW = 203n;

// Cryptocurrency Assets
export const ASSET_RAW = 300n;
export const BITCOIN_VALUE_RAW = 301n;
export const ETHEREUM_VALUE_RAW = 302n;
export const TEZOS_VALUE_RAW = 303n;

// Cryptocurrency Networks
export const NETWORK_RAW = 400n;
export const MAIN_NET_VALUE_RAW = 401n;
export const TEST_NET_VALUE_RAW = 402n;

// Bitcoin
export const BIP32_KEY_TYPE_RAW = 500n;
export const CHAIN_CODE_RAW = 501n;
export const DERIVATION_PATH_TYPE_RAW = 502n;
export const PARENT_PATH_RAW = 503n;
export const CHILDREN_PATH_RAW = 504n;
export const PARENT_FINGERPRINT_RAW = 505n;
export const PSBT_TYPE_RAW = 506n;
export const OUTPUT_DESCRIPTOR_TYPE_RAW = 507n;
export const OUTPUT_DESCRIPTOR_RAW = 508n;

// Graphs
export const GRAPH_RAW = 600n;
export const SOURCE_TARGET_GRAPH_RAW = 601n;
export const PARENT_CHILD_GRAPH_RAW = 602n;
export const DIGRAPH_RAW = 603n;
export const ACYCLIC_GRAPH_RAW = 604n;
export const MULTIGRAPH_RAW = 605n;
export const PSEUDOGRAPH_RAW = 606n;
export const GRAPH_FRAGMENT_RAW = 607n;
export const DAG_RAW = 608n;
export const TREE_RAW = 609n;
export const FOREST_RAW = 610n;
export const COMPOUND_GRAPH_RAW = 611n;
export const HYPERGRAPH_RAW = 612n;
export const DIHYPERGRAPH_RAW = 613n;
export const NODE_RAW = 700n;
export const EDGE_RAW = 701n;
export const SOURCE_RAW = 702n;
export const TARGET_RAW = 703n;
export const PARENT_RAW = 704n;
export const CHILD_RAW = 705n;

// =============================================================================
// KnownValue Constants
// =============================================================================

//
// General
//

export const UNIT = new KnownValue(0, "");
export const IS_A = new KnownValue(1, "isA");
export const ID = new KnownValue(2, "id");
export const SIGNED = new KnownValue(3, "signed");
export const NOTE = new KnownValue(4, "note");
export const HAS_RECIPIENT = new KnownValue(5, "hasRecipient");
export const SSKR_SHARE = new KnownValue(6, "sskrShare");
export const CONTROLLER = new KnownValue(7, "controller");
export const KEY = new KnownValue(8, "key");
export const DEREFERENCE_VIA = new KnownValue(9, "dereferenceVia");
export const ENTITY = new KnownValue(10, "entity");
export const NAME = new KnownValue(11, "name");
export const LANGUAGE = new KnownValue(12, "language");
export const ISSUER = new KnownValue(13, "issuer");
export const HOLDER = new KnownValue(14, "holder");
export const SALT = new KnownValue(15, "salt");
export const DATE = new KnownValue(16, "date");
export const UNKNOWN_VALUE = new KnownValue(17, "Unknown");
export const VERSION_VALUE = new KnownValue(18, "version");
export const HAS_SECRET = new KnownValue(19, "hasSecret");
export const DIFF_EDITS = new KnownValue(20, "edits");
export const VALID_FROM = new KnownValue(21, "validFrom");
export const VALID_UNTIL = new KnownValue(22, "validUntil");
export const POSITION = new KnownValue(23, "position");
export const NICKNAME = new KnownValue(24, "nickname");
// 25-49 *unassigned*

//
// Attachments
//

export const ATTACHMENT = new KnownValue(50, "attachment");
export const VENDOR = new KnownValue(51, "vendor");
export const CONFORMS_TO = new KnownValue(52, "conformsTo");
// 53-59 *unassigned*

//
// XID Documents
//

export const ALLOW = new KnownValue(60, "allow");
export const DENY = new KnownValue(61, "deny");
export const ENDPOINT = new KnownValue(62, "endpoint");
export const DELEGATE = new KnownValue(63, "delegate");
export const PROVENANCE = new KnownValue(64, "provenance");
export const PRIVATE_KEY = new KnownValue(65, "privateKey");
export const SERVICE = new KnownValue(66, "service");
export const CAPABILITY = new KnownValue(67, "capability");
export const PROVENANCE_GENERATOR = new KnownValue(68, "provenanceGenerator");
// 68-69 *unassigned*

//
// XID Privileges
//

export const PRIVILEGE_ALL = new KnownValue(70, "All");
export const PRIVILEGE_AUTH = new KnownValue(71, "Auth");
export const PRIVILEGE_SIGN = new KnownValue(72, "Sign");
export const PRIVILEGE_ENCRYPT = new KnownValue(73, "Encrypt");
export const PRIVILEGE_ELIDE = new KnownValue(74, "Elide");
export const PRIVILEGE_ISSUE = new KnownValue(75, "Issue");
export const PRIVILEGE_ACCESS = new KnownValue(76, "Access");
// 77-79 *unassigned*
export const PRIVILEGE_DELEGATE = new KnownValue(80, "Delegate");
export const PRIVILEGE_VERIFY = new KnownValue(81, "Verify");
export const PRIVILEGE_UPDATE = new KnownValue(82, "Update");
export const PRIVILEGE_TRANSFER = new KnownValue(83, "Transfer");
export const PRIVILEGE_ELECT = new KnownValue(84, "Elect");
export const PRIVILEGE_BURN = new KnownValue(85, "Burn");
export const PRIVILEGE_REVOKE = new KnownValue(86, "Revoke");
// 87-99 *unassigned*

//
// Expression and Function Calls
//

export const BODY = new KnownValue(100, "body");
export const RESULT = new KnownValue(101, "result");
export const ERROR = new KnownValue(102, "error");
export const OK_VALUE = new KnownValue(103, "OK");
export const PROCESSING_VALUE = new KnownValue(104, "Processing");
export const SENDER = new KnownValue(105, "sender");
export const SENDER_CONTINUATION = new KnownValue(106, "senderContinuation");
export const RECIPIENT_CONTINUATION = new KnownValue(107, "recipientContinuation");
export const CONTENT = new KnownValue(108, "content");
// 109-199 *unassigned*

//
// Cryptography
//

export const SEED_TYPE = new KnownValue(200, "Seed");
export const PRIVATE_KEY_TYPE = new KnownValue(201, "PrivateKey");
export const PUBLIC_KEY_TYPE = new KnownValue(202, "PublicKey");
export const MASTER_KEY_TYPE = new KnownValue(203, "MasterKey");
// 204-299 *unassigned*

//
// Cryptocurrency Assets
//

export const ASSET = new KnownValue(300, "asset");
export const BITCOIN_VALUE = new KnownValue(301, "BTC");
export const ETHEREUM_VALUE = new KnownValue(302, "ETH");
export const TEZOS_VALUE = new KnownValue(303, "XTZ");
// 304-399 *unassigned*

//
// Cryptocurrency Networks
//

export const NETWORK = new KnownValue(400, "network");
export const MAIN_NET_VALUE = new KnownValue(401, "MainNet");
export const TEST_NET_VALUE = new KnownValue(402, "TestNet");
// 403-499 *unassigned*

//
// Bitcoin
//

export const BIP32_KEY_TYPE = new KnownValue(500, "BIP32Key");
export const CHAIN_CODE = new KnownValue(501, "chainCode");
export const DERIVATION_PATH_TYPE = new KnownValue(502, "DerivationPath");
export const PARENT_PATH = new KnownValue(503, "parent");
export const CHILDREN_PATH = new KnownValue(504, "children");
export const PARENT_FINGERPRINT = new KnownValue(505, "parentFingerprint");
export const PSBT_TYPE = new KnownValue(506, "PSBT");
export const OUTPUT_DESCRIPTOR_TYPE = new KnownValue(507, "OutputDescriptor");
export const OUTPUT_DESCRIPTOR = new KnownValue(508, "outputDescriptor");
// 509-599 *unassigned*

//
// Graphs
//

export const GRAPH = new KnownValue(600, "graph");
export const SOURCE_TARGET_GRAPH = new KnownValue(601, "SourceTargetGraph");
export const PARENT_CHILD_GRAPH = new KnownValue(602, "ParentChildGraph");
export const DIGRAPH = new KnownValue(603, "Digraph");
export const ACYCLIC_GRAPH = new KnownValue(604, "AcyclicGraph");
export const MULTIGRAPH = new KnownValue(605, "Multigraph");
export const PSEUDOGRAPH = new KnownValue(606, "Pseudograph");
export const GRAPH_FRAGMENT = new KnownValue(607, "GraphFragment");
export const DAG = new KnownValue(608, "DAG");
export const TREE = new KnownValue(609, "Tree");
export const FOREST = new KnownValue(610, "Forest");
export const COMPOUND_GRAPH = new KnownValue(611, "CompoundGraph");
export const HYPERGRAPH = new KnownValue(612, "Hypergraph");
export const DIHYPERGRAPH = new KnownValue(613, "Dihypergraph");
// 614-699 *unassigned*
export const NODE = new KnownValue(700, "node");
export const EDGE = new KnownValue(701, "edge");
export const SOURCE = new KnownValue(702, "source");
export const TARGET = new KnownValue(703, "target");
export const PARENT = new KnownValue(704, "parent");
export const CHILD = new KnownValue(705, "child");
export const SELF_RAW = 706n;
export const SELF = new KnownValue(706, "Self");
// 707-... *unassigned*

/**
 * A lazily initialized singleton that holds the global registry of known
 * values.
 *
 * This class provides thread-safe, lazy initialization of the global
 * KnownValuesStore that contains all the predefined Known Values in the
 * registry. The store is created only when first accessed, and subsequent
 * accesses reuse the same instance.
 *
 * This is used internally by the crate and should not typically be needed by
 * users of the API, who should access Known Values through the constants
 * exposed in the `known_values` module.
 */
export class LazyKnownValues {
  private _data: KnownValuesStore | undefined;

  /**
   * Gets the global KnownValuesStore, initializing it if necessary.
   *
   * This method guarantees that initialization occurs exactly once.
   */
  get(): KnownValuesStore {
    if (this._data === undefined) {
      const store = new KnownValuesStore([
        UNIT,
        IS_A,
        ID,
        SIGNED,
        NOTE,
        HAS_RECIPIENT,
        SSKR_SHARE,
        CONTROLLER,
        KEY,
        DEREFERENCE_VIA,
        ENTITY,
        NAME,
        LANGUAGE,
        ISSUER,
        HOLDER,
        SALT,
        DATE,
        UNKNOWN_VALUE,
        VERSION_VALUE,
        HAS_SECRET,
        DIFF_EDITS,
        VALID_FROM,
        VALID_UNTIL,
        POSITION,
        NICKNAME,
        ATTACHMENT,
        VENDOR,
        CONFORMS_TO,
        ALLOW,
        DENY,
        ENDPOINT,
        DELEGATE,
        PROVENANCE,
        PRIVATE_KEY,
        SERVICE,
        CAPABILITY,
        PROVENANCE_GENERATOR,
        PRIVILEGE_ALL,
        PRIVILEGE_AUTH,
        PRIVILEGE_SIGN,
        PRIVILEGE_ENCRYPT,
        PRIVILEGE_ELIDE,
        PRIVILEGE_ISSUE,
        PRIVILEGE_ACCESS,
        PRIVILEGE_DELEGATE,
        PRIVILEGE_VERIFY,
        PRIVILEGE_UPDATE,
        PRIVILEGE_TRANSFER,
        PRIVILEGE_ELECT,
        PRIVILEGE_BURN,
        PRIVILEGE_REVOKE,
        BODY,
        RESULT,
        ERROR,
        OK_VALUE,
        PROCESSING_VALUE,
        SENDER,
        SENDER_CONTINUATION,
        RECIPIENT_CONTINUATION,
        CONTENT,
        SEED_TYPE,
        PRIVATE_KEY_TYPE,
        PUBLIC_KEY_TYPE,
        MASTER_KEY_TYPE,
        ASSET,
        BITCOIN_VALUE,
        ETHEREUM_VALUE,
        TEZOS_VALUE,
        NETWORK,
        MAIN_NET_VALUE,
        TEST_NET_VALUE,
        BIP32_KEY_TYPE,
        CHAIN_CODE,
        DERIVATION_PATH_TYPE,
        PARENT_PATH,
        CHILDREN_PATH,
        PARENT_FINGERPRINT,
        PSBT_TYPE,
        OUTPUT_DESCRIPTOR_TYPE,
        OUTPUT_DESCRIPTOR,
        GRAPH,
        SOURCE_TARGET_GRAPH,
        PARENT_CHILD_GRAPH,
        DIGRAPH,
        ACYCLIC_GRAPH,
        MULTIGRAPH,
        PSEUDOGRAPH,
        GRAPH_FRAGMENT,
        DAG,
        TREE,
        FOREST,
        COMPOUND_GRAPH,
        HYPERGRAPH,
        DIHYPERGRAPH,
        NODE,
        EDGE,
        SOURCE,
        TARGET,
        PARENT,
        CHILD,
      ]);

      // Load additional values from configured directories.
      // Values from directories override hardcoded values when codepoints match.
      const config = getAndLockConfig();
      const result = loadFromConfig(config);
      for (const value of result.intoValues()) {
        store.insert(value);
      }

      this._data = store;
    }
    return this._data;
  }
}

/**
 * The global registry of Known Values.
 *
 * This static instance provides access to all standard Known Values defined in
 * the registry specification. It is lazily initialized on first access.
 *
 * Most users should not need to interact with this directly, as the predefined
 * Known Values are exposed as constants in the `known_values` module.
 *
 * @example
 * ```typescript
 * import { KNOWN_VALUES } from '@bcts/known-values';
 *
 * // Access the global store
 * const knownValues = KNOWN_VALUES.get();
 *
 * // Look up a Known Value by name
 * const isA = knownValues.knownValueNamed('isA');
 * console.log(isA?.value()); // 1
 * ```
 */
export const KNOWN_VALUES = new LazyKnownValues();
