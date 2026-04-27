import { XIDPrivateKeyOptions, XIDGeneratorOptions, Service, Privilege, type Key } from "@bcts/xid";
import type { Envelope } from "@bcts/envelope";
import type { IdentityName, IdentitySlot } from "@/utils/xid-tutorial/types";
import { TUTORIAL_SECTIONS } from "@/utils/xid-tutorial/sections";
import {
  createEncryptedXid,
  exportPublicEnvelope,
  privateKeyOptions,
  generatorOptions,
  addSideKeyToXid,
  generateSideKey,
  loadXidFromUr,
  verifyInceptionSignature,
  sshPublicKeyText,
  type TutorialScheme,
} from "@/utils/xid-tutorial/identity";

type AttachmentEnvelope = Envelope & {
  attachmentVendor(): string;
  attachmentConformsTo(): string | undefined;
  attachmentPayload(): Envelope;
};

const STORAGE_KEY = "xid-tutorial-state-v2";
const LEGACY_STORAGE_KEY = "xid-tutorial-state";

/** Each identity is a full workspace slot — active identity is the one step components operate on. */
function emptySlot(
  name: IdentityName,
  displayName: string,
  role: string,
  color: string,
): IdentitySlot {
  return {
    name,
    displayName,
    role,
    color,
    document: null,
    password: "",
    attestationKey: null,
    sshKey: null,
    contractKey: null,
  };
}

const identities = shallowRef<Record<IdentityName, IdentitySlot>>({
  amira: emptySlot(
    "amira",
    "Amira (BRadvoc8)",
    "Software developer, pseudonymous contributor",
    "primary",
  ),
  charlene: emptySlot("charlene", "Charlene", "Friend, character endorser", "emerald"),
  devreviewer: emptySlot(
    "devreviewer",
    "DevReviewer",
    "Head security programmer @ SisterSpaces",
    "violet",
  ),
  ben: emptySlot("ben", "Ben", "SisterSpaces project manager", "amber"),
});
const activeIdentity = ref<IdentityName>("amira");
const docVersion = ref(0);
const currentSection = ref(0);
const sectionsCompleted = ref<boolean[]>(new Array(TUTORIAL_SECTIONS.length).fill(false));
const error = ref<string | null>(null);

// Cross-step artifact handoff: each step can stash a UR string under a stable
// key so a later step can pre-fill a textarea instead of asking the user to
// paste it manually. Persisted alongside identities.
const artifacts = ref<Record<string, string>>({});

const xidHex = ref("");
const xidUrString = ref("");
const xidBytewords = ref("");
const xidBytemojis = ref("");
const treeOutput = ref("");
const hexOutput = ref("");
const notationOutput = ref("");
const diagnosticOutput = ref("");
const envelopeUrOutput = ref("");

let restored = false;

// Encrypted-private-envelope cache. Building one runs Argon2id (~700ms in-browser),
// so we hold onto the result until secret material actually changes.
// Keyed by identity name; cleared whenever the document, keys, or generator mutate.
const cachedPrivateEnvelopes = new Map<IdentityName, Envelope>();
function invalidatePrivateEnvelope(name: IdentityName) {
  cachedPrivateEnvelopes.delete(name);
}

// Debounce handle for saveState — multiple rapid mutations coalesce into one write.
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function useXidTutorial() {
  const activeSlot = computed(() => identities.value[activeIdentity.value]);
  const activeDoc = computed(() => {
    void docVersion.value;
    return activeSlot.value.document;
  });
  const keyList = computed(() => {
    void docVersion.value;
    return activeDoc.value?.keys() ?? [];
  });
  const resolutionMethodList = computed(() => {
    void docVersion.value;
    // `XIDDocument.resolutionMethods()` now returns `Set<URI>` (mirrors
    // Rust). The composable surfaces a string view for the existing
    // template bindings.
    return activeDoc.value
      ? Array.from(activeDoc.value.resolutionMethods()).map((uri) => uri.toString())
      : [];
  });
  const attachmentList = computed(() => {
    void docVersion.value;
    const doc = activeDoc.value;
    if (!doc) return [] as { digestHex: string; vendor: string; payloadPreview: string }[];
    const out: { digestHex: string; vendor: string; payloadPreview: string }[] = [];
    for (const [digestHex, envelope] of doc.getAttachments().iter()) {
      let vendor = "(unknown)";
      let payloadPreview = "";
      try {
        vendor = (envelope as AttachmentEnvelope).attachmentVendor();
      } catch {
        /* */
      }
      try {
        const payload = (envelope as AttachmentEnvelope).attachmentPayload();
        const text = (payload as unknown as { asText(): string | undefined }).asText();
        payloadPreview = text ?? "(binary data)";
      } catch {
        payloadPreview = "(binary data)";
      }
      out.push({ digestHex, vendor, payloadPreview });
    }
    return out;
  });
  const serviceList = computed(() => {
    void docVersion.value;
    return activeDoc.value?.services() ?? [];
  });
  const edgeList = computed(() => {
    void docVersion.value;
    const doc = activeDoc.value;
    if (!doc) return [] as { digestHex: string; envelope: Envelope }[];
    const out: { digestHex: string; envelope: Envelope }[] = [];
    for (const [hex, env] of doc.edges().iter()) {
      out.push({ digestHex: hex, envelope: env });
    }
    return out;
  });
  const provenanceMark = computed(() => {
    void docVersion.value;
    return activeDoc.value?.provenance() ?? null;
  });
  const currentSectionMeta = computed(() => TUTORIAL_SECTIONS[currentSection.value] ?? null);
  const progress = computed(() => {
    const done = sectionsCompleted.value.filter(Boolean).length;
    return { done, total: TUTORIAL_SECTIONS.length };
  });

  if (import.meta.client && !restored) {
    restored = true;
    restoreState();
  }

  // ---- Display ----
  function clearIdentityDisplay() {
    xidHex.value = "";
    xidUrString.value = "";
    xidBytewords.value = "";
    xidBytemojis.value = "";
  }
  function clearOutput() {
    treeOutput.value = "";
    hexOutput.value = "";
    notationOutput.value = "";
    diagnosticOutput.value = "";
    envelopeUrOutput.value = "";
  }

  function refreshDisplay() {
    const slot = activeSlot.value;
    const doc = slot.document;
    if (!doc) {
      clearIdentityDisplay();
      clearOutput();
      return;
    }
    const xid = doc.xid();
    xidHex.value = xid.toHex();
    xidUrString.value = xid.urString();
    xidBytewords.value = xid.bytewordsIdentifier(true);
    xidBytemojis.value = xid.bytemojisIdentifier(true);

    try {
      const envelope = doc.toEnvelope(
        XIDPrivateKeyOptions.Elide,
        XIDGeneratorOptions.Elide,
        slot.password ? { type: "inception" } : { type: "none" },
      );
      treeOutput.value = envelope.treeFormat();
      notationOutput.value = envelope.format();
      diagnosticOutput.value = envelope.diagnostic();
      hexOutput.value = Array.from(envelope.cborBytes())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      envelopeUrOutput.value = envelope.urString();
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to build envelope";
      clearOutput();
    }
  }

  function bumpDoc() {
    docVersion.value++;
    refreshDisplay();
  }

  // ---- Identity lifecycle ----
  function setActive(name: IdentityName) {
    activeIdentity.value = name;
    bumpDoc();
  }

  function createIdentity(
    name: IdentityName,
    nickname: string,
    scheme: TutorialScheme,
    password: string,
    withProvenance: boolean,
  ) {
    try {
      error.value = null;
      const doc = createEncryptedXid(nickname, scheme, password, withProvenance);
      const slot = identities.value[name];
      slot.document = doc;
      slot.password = password;
      identities.value = { ...identities.value, [name]: slot };
      activeIdentity.value = name;
      invalidatePrivateEnvelope(name);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to create identity";
    }
  }

  function loadIdentityFromUr(name: IdentityName, ur: string, password?: string) {
    try {
      error.value = null;
      const doc = loadXidFromUr(ur, password);
      const slot = identities.value[name];
      slot.document = doc;
      if (password !== undefined) slot.password = password;
      identities.value = { ...identities.value, [name]: slot };
      activeIdentity.value = name;
      invalidatePrivateEnvelope(name);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load identity";
    }
  }

  function forgetIdentity(name: IdentityName) {
    const slot = emptySlot(
      name,
      identities.value[name].displayName,
      identities.value[name].role,
      identities.value[name].color,
    );
    identities.value = { ...identities.value, [name]: slot };
    invalidatePrivateEnvelope(name);
    bumpDoc();
    saveState();
  }

  // ---- Keys ----
  function addSideKey(
    slotName: IdentityName,
    kind: "attestation" | "ssh" | "contract",
    scheme: TutorialScheme,
    allow: Privilege[],
  ) {
    try {
      error.value = null;
      const slot = identities.value[slotName];
      if (!slot.document) throw new Error("No identity document to add a key to");
      const side = generateSideKey(
        kind === "attestation"
          ? "attestation-key"
          : kind === "ssh"
            ? "ssh-signing-key"
            : "contract-key",
        scheme,
      );
      addSideKeyToXid(slot.document, side, allow);
      // Replace the slot with a fresh object — mutating in place keeps the
      // same reference, which makes the `activeSlot` computed return an
      // unchanged value and dependent computeds (e.g. `hasAttestationKey`)
      // never re-run.
      const updatedSlot: IdentitySlot = {
        ...slot,
        attestationKey: kind === "attestation" ? side : slot.attestationKey,
        sshKey: kind === "ssh" ? side : slot.sshKey,
        contractKey: kind === "contract" ? side : slot.contractKey,
      };
      identities.value = { ...identities.value, [slotName]: updatedSlot };
      invalidatePrivateEnvelope(slotName);
      bumpDoc();
      saveState();
      return side;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to add key";
      return null;
    }
  }

  // Generate an SSH signing keypair *without* registering it as a sub-key on
  // the XID — matches the upstream XID-Quickstart §3.1, where the SSH key is
  // standalone (its public counterpart is embedded inside the edge target
  // sub-envelope, and the key signs the edge directly). The previous flow
  // tried to register it via `addSideKeyToXid`, which is what was silently
  // failing on click.
  function generateSshKey(slotName: IdentityName) {
    try {
      error.value = null;
      const slot = identities.value[slotName];
      if (!slot.document) throw new Error("No identity document loaded");
      const side = generateSideKey("ssh-signing-key", "SshEd25519");
      const updatedSlot: IdentitySlot = { ...slot, sshKey: side };
      identities.value = { ...identities.value, [slotName]: updatedSlot };
      saveState();
      return side;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to generate SSH key";
      return null;
    }
  }

  // ---- Resolution ----
  function addResolutionMethod(uri: string) {
    const doc = activeDoc.value;
    if (!doc) return;
    try {
      doc.addResolutionMethod(uri);
      invalidatePrivateEnvelope(activeIdentity.value);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to add resolution method";
    }
  }
  function removeResolutionMethodUri(uri: string) {
    const doc = activeDoc.value;
    if (!doc) return;
    doc.removeResolutionMethod(uri);
    invalidatePrivateEnvelope(activeIdentity.value);
    bumpDoc();
    saveState();
  }

  // ---- Provenance ----
  function advanceProvenance() {
    const slot = activeSlot.value;
    const doc = slot.document;
    if (!doc) return;
    try {
      const pw = slot.password ? new TextEncoder().encode(slot.password) : undefined;
      doc.nextProvenanceMarkWithEmbeddedGenerator(pw, new Date());
      invalidatePrivateEnvelope(activeIdentity.value);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to advance provenance";
    }
  }

  // ---- Attachments & services (kept for backwards compat with earlier screens) ----
  function addAttachment(payload: string, vendor: string, conformsTo?: string) {
    const doc = activeDoc.value;
    if (!doc) return;
    try {
      doc.addAttachment(payload, vendor, conformsTo);
      invalidatePrivateEnvelope(activeIdentity.value);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to add attachment";
    }
  }
  function addService(uri: string, name: string, capability: string, keyRefHex?: string) {
    const doc = activeDoc.value;
    if (!doc) return;
    try {
      const service = Service.new(uri);
      if (name) service.setName(name);
      if (capability) service.setCapability(capability);
      if (keyRefHex) {
        service.addKeyReferenceHex(keyRefHex);
        service.permissionsMut().addAllow(Privilege.All);
      }
      doc.addService(service);
      invalidatePrivateEnvelope(activeIdentity.value);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to add service";
    }
  }

  // ---- Edges ----
  function attachEdgeToActive(edgeEnvelope: Envelope) {
    const doc = activeDoc.value;
    if (!doc) return;
    try {
      doc.addEdge(edgeEnvelope);
      invalidatePrivateEnvelope(activeIdentity.value);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to attach edge";
    }
  }
  function removeEdgeFromActive(edgeEnvelope: Envelope) {
    const doc = activeDoc.value;
    if (!doc) return;
    try {
      doc.removeEdge(edgeEnvelope.digest());
      invalidatePrivateEnvelope(activeIdentity.value);
      bumpDoc();
      saveState();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to remove edge";
    }
  }

  // ---- Views / serialization ----
  function getPrivateEnvelope(name?: IdentityName): Envelope | null {
    const slotName: IdentityName = name ?? activeIdentity.value;
    const slot = identities.value[slotName];
    if (!slot.document) return null;
    const cached = cachedPrivateEnvelopes.get(slotName);
    if (cached) return cached;
    try {
      const env = slot.document.toEnvelope(
        privateKeyOptions(slot.password),
        generatorOptions(slot.password),
        { type: "inception" },
      );
      cachedPrivateEnvelopes.set(slotName, env);
      return env;
    } catch {
      return null;
    }
  }
  // Autosave envelope: plaintext-private (Include). No Argon2id — the same password
  // is already stored in plaintext in localStorage, so encrypting at this boundary
  // adds no protection. Encrypt is reserved for user-initiated downloads.
  function getPersistEnvelope(name?: IdentityName): Envelope | null {
    const slotName: IdentityName = name ?? activeIdentity.value;
    const slot = identities.value[slotName];
    if (!slot.document) return null;
    try {
      return slot.document.toEnvelope(XIDPrivateKeyOptions.Include, XIDGeneratorOptions.Include, {
        type: "inception",
      });
    } catch {
      return null;
    }
  }
  function getPublicEnvelope(name?: IdentityName): Envelope | null {
    const slot = name ? identities.value[name] : activeSlot.value;
    if (!slot.document) return null;
    try {
      return exportPublicEnvelope(slot.document);
    } catch {
      return null;
    }
  }
  function verifySignature(): boolean {
    const env = getPublicEnvelope();
    if (!env) return false;
    return verifyInceptionSignature(env.urString());
  }

  // ---- Cross-step artifacts ----
  function setArtifact(key: string, ur: string) {
    artifacts.value = { ...artifacts.value, [key]: ur };
    saveState();
  }
  function getArtifact(key: string): string | undefined {
    return artifacts.value[key];
  }

  // ---- Step progression ----
  function completeSection(index: number) {
    if (index >= 0 && index < TUTORIAL_SECTIONS.length) {
      const arr = [...sectionsCompleted.value];
      arr[index] = true;
      sectionsCompleted.value = arr;
      saveState();
    }
  }
  function completeAndAdvance(index: number) {
    completeSection(index);
    if (index < TUTORIAL_SECTIONS.length - 1) currentSection.value = index + 1;
  }
  function goToSection(index: number) {
    if (index >= 0 && index < TUTORIAL_SECTIONS.length) {
      currentSection.value = index;
      bumpDoc();
    }
  }
  function resetTutorial() {
    for (const name of Object.keys(identities.value) as IdentityName[]) forgetIdentity(name);
    currentSection.value = 0;
    sectionsCompleted.value = new Array(TUTORIAL_SECTIONS.length).fill(false);
    artifacts.value = {};
    error.value = null;
    if (import.meta.client) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    bumpDoc();
  }

  // ---- Persistence ----
  type PersistedSlot = { ur?: string; password?: string };
  type Persisted = {
    version: 2;
    currentSection: number;
    sectionsCompleted: boolean[];
    activeIdentity: IdentityName;
    identities: Partial<Record<IdentityName, PersistedSlot>>;
    artifacts?: Record<string, string>;
  };

  function saveState() {
    if (!import.meta.client) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistNow();
    }, 300);
  }

  function persistNow() {
    try {
      const persisted: Persisted = {
        version: 2,
        currentSection: currentSection.value,
        sectionsCompleted: sectionsCompleted.value,
        activeIdentity: activeIdentity.value,
        identities: {},
        artifacts: artifacts.value,
      };
      for (const key of Object.keys(identities.value) as IdentityName[]) {
        const slot = identities.value[key];
        if (!slot.document) continue;
        const env = getPersistEnvelope(key);
        if (!env) continue;
        persisted.identities[key] = {
          ur: env.urString(),
          password: slot.password,
        };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      /* localStorage unavailable */
    }
  }

  function restoreState() {
    if (!import.meta.client) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        if (p.version !== 2) return;
        currentSection.value = p.currentSection ?? 0;
        sectionsCompleted.value =
          p.sectionsCompleted ?? new Array(TUTORIAL_SECTIONS.length).fill(false);
        activeIdentity.value = p.activeIdentity ?? "amira";
        artifacts.value = p.artifacts ?? {};
        for (const [name, data] of Object.entries(p.identities)) {
          if (!data?.ur) continue;
          const slot = identities.value[name as IdentityName];
          try {
            slot.document = loadXidFromUr(data.ur, data.password);
            slot.password = data.password ?? "";
          } catch {
            /* bad data */
          }
        }
        bumpDoc();
        return;
      }
      // Legacy v1 migration
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const old = JSON.parse(legacy) as {
          step?: number;
          stepsCompleted?: boolean[];
          xidUr?: string;
        };
        if (old.xidUr) {
          const doc = loadXidFromUr(old.xidUr);
          identities.value.amira.document = doc;
        }
        bumpDoc();
      }
    } catch {
      /* restore failed */
    }
  }

  // ---- Utility ----
  function getKeyAlgorithm(key: Key): string {
    try {
      return key.publicKeys().signingPublicKey().keyType();
    } catch {
      return "Unknown";
    }
  }
  function getKeyRefHex(key: Key): string {
    return key.reference().toHex();
  }

  return {
    // state
    identities,
    activeIdentity,
    activeSlot,
    activeDoc,
    docVersion,
    currentSection,
    currentSectionMeta,
    sectionsCompleted,
    progress,
    error,
    // display
    xidHex,
    xidUrString,
    xidBytewords,
    xidBytemojis,
    treeOutput,
    hexOutput,
    notationOutput,
    diagnosticOutput,
    envelopeUrOutput,
    refreshDisplay,
    bumpDoc,
    // computed lists
    keyList,
    resolutionMethodList,
    attachmentList,
    serviceList,
    edgeList,
    provenanceMark,
    // identity lifecycle
    setActive,
    createIdentity,
    loadIdentityFromUr,
    forgetIdentity,
    // keys
    addSideKey,
    generateSshKey,
    // resolution
    addResolutionMethod,
    removeResolutionMethodUri,
    // provenance
    advanceProvenance,
    // attachments/services (legacy)
    addAttachment,
    addService,
    // edges
    attachEdgeToActive,
    removeEdgeFromActive,
    // cross-step artifacts
    setArtifact,
    getArtifact,
    // serialization
    getPrivateEnvelope,
    getPublicEnvelope,
    verifySignature,
    sshPublicKeyText,
    // progression
    completeSection,
    completeAndAdvance,
    goToSection,
    resetTutorial,
    // utility
    getKeyAlgorithm,
    getKeyRefHex,
  };
}
