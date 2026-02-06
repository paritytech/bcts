<script setup lang="ts">
import { XIDDocument, XIDPrivateKeyOptions, XIDGeneratorOptions, XIDVerifySignature, Key, Delegate, Service, Privilege, type XIDGenesisMarkOptions, type XIDPrivateKeyEncryptConfig, type XIDGeneratorEncryptConfig } from '@bcts/xid'
import { Envelope, type TreeFormatOptions } from '@bcts/envelope'
import { PrivateKeyBase, KeyDerivationMethod, SignatureScheme, EncapsulationScheme, createKeypair, createEncapsulationKeypair, PrivateKeys, PublicKeys } from '@bcts/components'
import { ProvenanceMarkResolution } from '@bcts/provenance-mark'
import encodeQR from '@paulmillr/qr'

useHead({
  title: 'XID Builder',
  meta: [
    { name: 'description', content: 'Create and inspect XID Documents with identity display and envelope output' }
  ]
})

const toast = useToast()

// Core document state - shallowRef because XIDDocument has private fields that break deep reactivity
const xidDocument = shallowRef<XIDDocument | null>(null)

// Identity display refs
const xidHex = ref('')
const xidUrString = ref('')
const xidBytewords = ref('')
const xidBytemojis = ref('')

// Inception key display
const inceptionKeyReference = ref('')
const inceptionKeyPermissions = ref<string[]>([])
const inceptionKeyIsInception = ref(false)

// Output refs
const treeOutput = ref('')
const hexOutput = ref('')
const notationOutput = ref('')
const diagnosticOutput = ref('')
const digestOutput = ref('')
const envelopeUrOutput = ref('')
const envelopeOutputMode = ref<'notation' | 'hex' | 'diag'>('notation')
const error = ref<string | null>(null)

// QR state
const showQRModal = ref(false)
const qrCodeDataUrl = ref('')
const qrCodeError = ref<string | null>(null)

// Key management state
const docVersion = ref(0)
const keySectionCollapsed = ref(false)

// Add key modal
const showAddKeyModal = ref(false)
const newKeyScheme = ref<'Ed25519' | 'Schnorr' | 'ECDSA' | 'MLDSA44' | 'MLDSA65' | 'MLDSA87'>('Ed25519')
const newKeyEncapsulation = ref<'X25519' | 'MLKEM512' | 'MLKEM768' | 'MLKEM1024'>('X25519')
const newKeyNickname = ref('')
const newKeyAllowPrivileges = ref(new Set<string>(['All']))
const newKeyDenyPrivileges = ref(new Set<string>())

// Inline nickname editing
const editingNicknameKeyRef = ref<string | null>(null)
const editingNicknameValue = ref('')

// Inline permission editing
const editingPermsKeyRef = ref<string | null>(null)
const editingPermsAllow = ref(new Set<string>())
const editingPermsDeny = ref(new Set<string>())

// Endpoint editing
const addingEndpointKeyRef = ref<string | null>(null)
const newEndpointValue = ref('')

// Remove key confirmation
const showRemoveKeyConfirm = ref(false)
const removeKeyTarget = shallowRef<Key | null>(null)
const removeKeyError = ref<string | null>(null)

// Delegate management state
const delegateSectionCollapsed = ref(false)
const showAddDelegateModal = ref(false)
const newDelegateAllowPrivileges = ref(new Set<string>(['All']))
const newDelegateDenyPrivileges = ref(new Set<string>())

// Inline delegate permission editing
const editingDelegatePermsRef = ref<string | null>(null)
const editingDelegatePermsAllow = ref(new Set<string>())
const editingDelegatePermsDeny = ref(new Set<string>())

// Remove delegate confirmation
const showRemoveDelegateConfirm = ref(false)
const removeDelegateTarget = shallowRef<Delegate | null>(null)
const removeDelegateError = ref<string | null>(null)

// Service management state
const serviceSectionCollapsed = ref(false)
const showServiceModal = ref(false)
const serviceModalMode = ref<'add' | 'edit'>('add')
const serviceFormUri = ref('')
const serviceFormName = ref('')
const serviceFormCapability = ref('')
const serviceFormKeyRefs = ref(new Set<string>())
const serviceFormDelegateRefs = ref(new Set<string>())
const serviceFormAllowPrivileges = ref(new Set<string>())
const serviceFormDenyPrivileges = ref(new Set<string>())
const serviceFormError = ref<string | null>(null)

// Remove service confirmation
const showRemoveServiceConfirm = ref(false)
const removeServiceTargetUri = ref<string | null>(null)

// Provenance state
const provenanceSectionCollapsed = ref(false)

// New XID modal (for genesis mark options)
const showNewXIDModal = ref(false)
const newXIDWithProvenance = ref(false)
const newXIDProvenanceMethod = ref<'passphrase' | 'seed'>('passphrase')
const newXIDPassphrase = ref('')
const newXIDResolution = ref<ProvenanceMarkResolution>(ProvenanceMarkResolution.High)
const newXIDDate = ref('')
const newXIDInfo = ref('')

// Advance provenance
const showAdvanceProvenanceModal = ref(false)
const advanceProvenanceDate = ref('')
const advanceProvenanceInfo = ref('')
const advanceProvenanceError = ref<string | null>(null)

// Attachment state
const attachmentSectionCollapsed = ref(false)
const showAddAttachmentModal = ref(false)
const attachmentFormVendor = ref('')
const attachmentFormConformsTo = ref('')
const attachmentFormPayload = ref('')
const attachmentFormError = ref<string | null>(null)

// Edge state
const edgeSectionCollapsed = ref(false)
const showAddEdgeModal = ref(false)
const edgeFormUrString = ref('')
const edgeFormError = ref<string | null>(null)

// Resolution methods state
const resolutionSectionCollapsed = ref(false)
const addingResolutionMethod = ref(false)
const newResolutionMethodValue = ref('')

// Import state
const showImportModal = ref(false)
const importUrString = ref('')
const importPassword = ref('')
const importVerifySignature = ref(false)
const importError = ref<string | null>(null)

// Export state
const showExportModal = ref(false)
const exportPrivateKeyOption = ref<'Omit' | 'Include' | 'Elide' | 'Encrypt'>('Omit')
const exportGeneratorOption = ref<'Omit' | 'Include' | 'Elide' | 'Encrypt'>('Omit')
const exportSigningOption = ref<'none' | 'inception'>('none')
const exportPrivateKeyPassword = ref('')
const exportGeneratorPassword = ref('')
const exportKdfMethod = ref<KeyDerivationMethod>(KeyDerivationMethod.Argon2id)
const exportResult = ref('')
const exportError = ref<string | null>(null)

// Share (public export) state
const showShareModal = ref(false)
const shareResult = ref('')

// Templates state
const showTemplatesModal = ref(false)

// Undo/Redo state
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
const maxHistorySize = 50
let isUndoRedoAction = false

// Attachment envelope type extension
type AttachmentEnvelope = Envelope & {
  attachmentVendor(): string
  attachmentConformsTo(): string | undefined
  attachmentPayload(): Envelope
}

// All privilege values for rendering
const ALL_PRIVILEGES = Object.values(Privilege)

// Reactive key list
const keyList = computed(() => {
  void docVersion.value // dependency trigger
  if (!xidDocument.value) return [] as Key[]
  return xidDocument.value.keys()
})

// Reactive delegate list
const delegateList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as Delegate[]
  return xidDocument.value.delegates()
})

// Reactive service list
const serviceList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as Service[]
  return xidDocument.value.services()
})

// Reactive provenance info
const provenanceMark = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return null
  return xidDocument.value.provenance() ?? null
})

const provenanceGenerator = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return null
  return xidDocument.value.provenanceGenerator() ?? null
})

const provenanceChainIdHex = computed(() => {
  const mark = provenanceMark.value
  if (!mark) return ''
  return Array.from(mark.chainId()).map(b => b.toString(16).padStart(2, '0')).join('')
})

const provenanceResolutionLabel = computed(() => {
  const mark = provenanceMark.value
  if (!mark) return ''
  switch (mark.res()) {
    case ProvenanceMarkResolution.Low: return 'Low'
    case ProvenanceMarkResolution.Medium: return 'Medium'
    case ProvenanceMarkResolution.Quartile: return 'Quartile'
    case ProvenanceMarkResolution.High: return 'High'
    default: return 'Unknown'
  }
})

const generatorStatus = computed((): 'Included' | 'None' => {
  void docVersion.value
  if (!xidDocument.value) return 'None'
  if (xidDocument.value.provenanceGenerator()) return 'Included'
  return 'None'
})

// Reactive attachment list
const attachmentList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as { digestHex: string, envelope: Envelope, vendor: string, conformsTo: string | undefined, payloadPreview: string }[]
  const results: { digestHex: string, envelope: Envelope, vendor: string, conformsTo: string | undefined, payloadPreview: string }[] = []
  for (const [digestHex, envelope] of xidDocument.value.getAttachments().iter()) {
    let vendor = '(unknown)'
    let conformsTo: string | undefined
    let payloadPreview = ''
    try {
      vendor = (envelope as AttachmentEnvelope).attachmentVendor()
    } catch { /* ignore */ }
    try {
      conformsTo = (envelope as AttachmentEnvelope).attachmentConformsTo()
    } catch { /* ignore */ }
    try {
      const payload = (envelope as AttachmentEnvelope).attachmentPayload()
      const text = (payload as unknown as { asText(): string | undefined }).asText()
      payloadPreview = text ?? '(binary data)'
    } catch {
      payloadPreview = '(binary data)'
    }
    results.push({ digestHex, envelope, vendor, conformsTo, payloadPreview })
  }
  return results
})

// Reactive edge list
const edgeList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as { digestHex: string, envelope: Envelope, treePreview: string }[]
  const results: { digestHex: string, envelope: Envelope, treePreview: string }[] = []
  for (const [digestHex, envelope] of xidDocument.value.edges().iter()) {
    let treePreview = ''
    try {
      treePreview = envelope.treeFormat()
    } catch {
      treePreview = digestHex.substring(0, 16) + '...'
    }
    results.push({ digestHex, envelope, treePreview })
  }
  return results
})

// Reactive resolution methods list
const resolutionMethodList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as string[]
  return Array.from(xidDocument.value.resolutionMethods())
})

// ============================================
// Document Creation
// ============================================

function openNewXIDModal() {
  newXIDWithProvenance.value = false
  newXIDProvenanceMethod.value = 'passphrase'
  newXIDPassphrase.value = ''
  newXIDResolution.value = ProvenanceMarkResolution.High
  newXIDDate.value = ''
  newXIDInfo.value = ''
  showNewXIDModal.value = true
}

function createNewXID() {
  try {
    error.value = null

    let markOptions: XIDGenesisMarkOptions = { type: 'none' }

    if (newXIDWithProvenance.value) {
      const date = newXIDDate.value ? new Date(newXIDDate.value) : new Date()

      if (newXIDProvenanceMethod.value === 'passphrase') {
        if (!newXIDPassphrase.value.trim()) {
          toast.add({ title: 'Passphrase is required', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
          return
        }
        markOptions = {
          type: 'passphrase',
          passphrase: newXIDPassphrase.value.trim(),
          resolution: newXIDResolution.value,
          date,
        }
      } else {
        // Random seed
        const seed = new Uint8Array(32)
        crypto.getRandomValues(seed)
        markOptions = {
          type: 'seed',
          seed,
          resolution: newXIDResolution.value,
          date,
        }
      }
    }

    const doc = XIDDocument.new({ type: 'default' }, markOptions)
    xidDocument.value = doc
    showNewXIDModal.value = false
    updateIdentityDisplay()
    updateOutput()
    undoStack.value = []
    redoStack.value = []
    saveToHistory()
    toast.add({ title: 'XID Document created', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create XID document'
  }
}

// ============================================
// Display Updates
// ============================================

function updateIdentityDisplay() {
  const doc = xidDocument.value
  if (!doc) {
    xidHex.value = ''
    xidUrString.value = ''
    xidBytewords.value = ''
    xidBytemojis.value = ''
    inceptionKeyReference.value = ''
    inceptionKeyPermissions.value = []
    inceptionKeyIsInception.value = false
    return
  }

  const xid = doc.xid()
  xidHex.value = xid.toHex()
  xidUrString.value = xid.urString()
  xidBytewords.value = xid.bytewordsIdentifier(true)
  xidBytemojis.value = xid.bytemojisIdentifier(true)

  // Inception key info
  const inceptionKey = doc.inceptionKey()
  if (inceptionKey) {
    inceptionKeyReference.value = inceptionKey.reference().toHex()
    inceptionKeyIsInception.value = true
    const perms = inceptionKey.permissions()
    inceptionKeyPermissions.value = Array.from(perms.allow).map(p => p.toString())
  }
}

function updateOutput() {
  const doc = xidDocument.value
  if (!doc) {
    treeOutput.value = ''
    hexOutput.value = ''
    notationOutput.value = ''
    diagnosticOutput.value = ''
    digestOutput.value = ''
    envelopeUrOutput.value = ''
    error.value = null
    return
  }

  try {
    const envelope: Envelope = doc.toEnvelope(
      XIDPrivateKeyOptions.Omit,
      XIDGeneratorOptions.Omit,
      { type: 'none' }
    )

    const treeOpts: TreeFormatOptions = {}
    treeOutput.value = envelope.treeFormat(treeOpts)
    notationOutput.value = envelope.format()
    diagnosticOutput.value = envelope.diagnostic()

    const bytes = envelope.cborBytes()
    hexOutput.value = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    digestOutput.value = envelope.digest().hex()
    envelopeUrOutput.value = envelope.urString()
    error.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error building envelope'
    treeOutput.value = ''
    hexOutput.value = ''
    notationOutput.value = ''
    diagnosticOutput.value = ''
    digestOutput.value = ''
    envelopeUrOutput.value = ''
  }
}

// ============================================
// Actions
// ============================================

async function copyToClipboard(text: string, label: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: `${label} copied`, color: 'success', icon: 'i-heroicons-clipboard-document-check' })
}

function clearDocument() {
  xidDocument.value = null
  updateIdentityDisplay()
  updateOutput()
  toast.add({ title: 'Document cleared', color: 'neutral', icon: 'i-heroicons-trash' })
}

// ============================================
// Key Management
// ============================================

function refreshDocument() {
  docVersion.value++
  updateIdentityDisplay()
  updateOutput()
}

function getKeyAlgorithm(key: Key): string {
  try {
    return key.publicKeys().signingPublicKey().keyType()
  } catch {
    return 'Unknown'
  }
}

function isKeyInception(key: Key): boolean {
  const doc = xidDocument.value
  if (!doc) return false
  const inception = doc.inceptionKey()
  if (!inception) return false
  return inception.reference().toHex() === key.reference().toHex()
}

function getKeyRefHex(key: Key): string {
  return key.reference().toHex()
}

function openAddKeyModal() {
  newKeyScheme.value = 'Ed25519'
  newKeyEncapsulation.value = 'X25519'
  newKeyNickname.value = ''
  newKeyAllowPrivileges.value = new Set(['All'])
  newKeyDenyPrivileges.value = new Set()
  showAddKeyModal.value = true
}

function togglePrivilege(set: Set<string>, priv: string) {
  if (set.has(priv)) {
    set.delete(priv)
  } else {
    set.add(priv)
  }
}

function getSignatureScheme(scheme: string): SignatureScheme {
  const map: Record<string, SignatureScheme> = {
    'Ed25519': SignatureScheme.Ed25519,
    'Schnorr': SignatureScheme.Schnorr,
    'ECDSA': SignatureScheme.Ecdsa,
    'MLDSA44': SignatureScheme.MLDSA44,
    'MLDSA65': SignatureScheme.MLDSA65,
    'MLDSA87': SignatureScheme.MLDSA87,
  }
  return map[scheme] ?? SignatureScheme.Ed25519
}

function getEncapsulationScheme(scheme: string): EncapsulationScheme {
  const map: Record<string, EncapsulationScheme> = {
    'X25519': EncapsulationScheme.X25519,
    'MLKEM512': EncapsulationScheme.MLKEM512,
    'MLKEM768': EncapsulationScheme.MLKEM768,
    'MLKEM1024': EncapsulationScheme.MLKEM1024,
  }
  return map[scheme] ?? EncapsulationScheme.X25519
}

function addNewKey() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    const sigScheme = getSignatureScheme(newKeyScheme.value)
    const encScheme = getEncapsulationScheme(newKeyEncapsulation.value)

    // Use PrivateKeyBase for classic algorithms with default encapsulation
    const usePrivateKeyBase = ['Ed25519', 'Schnorr', 'ECDSA'].includes(newKeyScheme.value) && newKeyEncapsulation.value === 'X25519'

    let key: Key

    if (usePrivateKeyBase) {
      const pkb = PrivateKeyBase.new()
      switch (newKeyScheme.value) {
        case 'Ed25519':
          key = Key.newWithPrivateKeys(pkb.ed25519PrivateKeys(), pkb.ed25519PublicKeys())
          break
        case 'Schnorr':
          key = Key.newWithPrivateKeys(pkb.schnorrPrivateKeys(), pkb.schnorrPublicKeys())
          break
        case 'ECDSA':
          key = Key.newWithPrivateKeys(pkb.ecdsaPrivateKeys(), pkb.ecdsaPublicKeys())
          break
        default:
          key = Key.newWithPrivateKeys(pkb.ed25519PrivateKeys(), pkb.ed25519PublicKeys())
      }
    } else {
      // Use createKeypair for ML-DSA or non-default encapsulation
      const [sigPriv, sigPub] = createKeypair(sigScheme)
      const [encPriv, encPub] = createEncapsulationKeypair(encScheme)
      const privateKeys = PrivateKeys.withKeys(sigPriv, encPriv)
      const publicKeys = PublicKeys.new(sigPub, encPub)
      key = Key.newWithPrivateKeys(privateKeys, publicKeys)
    }

    for (const p of newKeyAllowPrivileges.value) {
      key.addPermission(p as Privilege)
    }
    const perms = key.permissionsMut()
    for (const p of newKeyDenyPrivileges.value) {
      perms.addDeny(p as Privilege)
    }

    if (newKeyNickname.value.trim()) {
      key.setNickname(newKeyNickname.value.trim())
    }

    doc.addKey(key)
    showAddKeyModal.value = false
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Key added', color: 'success', icon: 'i-heroicons-key' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to add key', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function confirmRemoveKey(key: Key) {
  const doc = xidDocument.value
  if (!doc) return

  if (isKeyInception(key)) {
    toast.add({ title: 'Cannot remove the inception key', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  removeKeyError.value = doc.servicesReferenceKey(key.publicKeys())
    ? 'This key is referenced by a service. Remove the service reference first.'
    : null

  removeKeyTarget.value = key
  showRemoveKeyConfirm.value = true
}

function executeRemoveKey() {
  const doc = xidDocument.value
  const key = removeKeyTarget.value
  if (!doc || !key) return

  try {
    doc.removeKey(key.publicKeys())
    showRemoveKeyConfirm.value = false
    removeKeyTarget.value = null
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Key removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove key', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function startEditNickname(key: Key) {
  editingNicknameKeyRef.value = getKeyRefHex(key)
  editingNicknameValue.value = key.nickname()
}

function saveNickname(key: Key) {
  const doc = xidDocument.value
  if (!doc) return

  try {
    doc.setNameForKey(key.publicKeys(), editingNicknameValue.value.trim())
    editingNicknameKeyRef.value = null
    saveToHistory()
    refreshDocument()
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to update nickname', color: 'error' })
  }
}

function cancelEditNickname() {
  editingNicknameKeyRef.value = null
  editingNicknameValue.value = ''
}

function startEditPermissions(key: Key) {
  editingPermsKeyRef.value = getKeyRefHex(key)
  editingPermsAllow.value = new Set(Array.from(key.permissions().allow).map(String))
  editingPermsDeny.value = new Set(Array.from(key.permissions().deny).map(String))
}

function savePermissions(key: Key) {
  const perms = key.permissionsMut()
  perms.allow.clear()
  perms.deny.clear()
  for (const p of editingPermsAllow.value) {
    perms.addAllow(p as Privilege)
  }
  for (const p of editingPermsDeny.value) {
    perms.addDeny(p as Privilege)
  }
  editingPermsKeyRef.value = null
  saveToHistory()
  refreshDocument()
  toast.add({ title: 'Permissions updated', color: 'success', icon: 'i-heroicons-shield-check' })
}

function cancelEditPermissions() {
  editingPermsKeyRef.value = null
}

function startAddEndpoint(key: Key) {
  addingEndpointKeyRef.value = getKeyRefHex(key)
  newEndpointValue.value = ''
}

function addEndpointToKey(key: Key) {
  const ep = newEndpointValue.value.trim()
  if (!ep) return
  key.addEndpoint(ep)
  newEndpointValue.value = ''
  addingEndpointKeyRef.value = null
  saveToHistory()
  refreshDocument()
  toast.add({ title: 'Endpoint added', color: 'success', icon: 'i-heroicons-link' })
}

function removeEndpointFromKey(key: Key, endpoint: string) {
  key.endpointsMut().delete(endpoint)
  saveToHistory()
  refreshDocument()
  toast.add({ title: 'Endpoint removed', color: 'neutral', icon: 'i-heroicons-trash' })
}

function cancelAddEndpoint() {
  addingEndpointKeyRef.value = null
  newEndpointValue.value = ''
}

// ============================================
// Delegate Management
// ============================================

function getDelegateXidHex(delegate: Delegate): string {
  return delegate.xid().toHex()
}

function openAddDelegateModal() {
  newDelegateAllowPrivileges.value = new Set(['All'])
  newDelegateDenyPrivileges.value = new Set()
  showAddDelegateModal.value = true
}

function addNewDelegate() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    const controllerDoc = XIDDocument.new()
    const delegate = Delegate.new(controllerDoc)

    for (const p of newDelegateAllowPrivileges.value) {
      delegate.permissionsMut().addAllow(p as Privilege)
    }
    for (const p of newDelegateDenyPrivileges.value) {
      delegate.permissionsMut().addDeny(p as Privilege)
    }

    doc.addDelegate(delegate)
    showAddDelegateModal.value = false
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Delegate added', color: 'success', icon: 'i-heroicons-user-plus' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to add delegate', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function confirmRemoveDelegate(delegate: Delegate) {
  const doc = xidDocument.value
  if (!doc) return

  removeDelegateError.value = doc.servicesReferenceDelegate(delegate.xid())
    ? 'This delegate is referenced by a service. Remove the service reference first.'
    : null

  removeDelegateTarget.value = delegate
  showRemoveDelegateConfirm.value = true
}

function executeRemoveDelegate() {
  const doc = xidDocument.value
  const delegate = removeDelegateTarget.value
  if (!doc || !delegate) return

  try {
    doc.removeDelegate(delegate.xid())
    showRemoveDelegateConfirm.value = false
    removeDelegateTarget.value = null
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Delegate removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove delegate', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function startEditDelegatePermissions(delegate: Delegate) {
  editingDelegatePermsRef.value = getDelegateXidHex(delegate)
  editingDelegatePermsAllow.value = new Set(Array.from(delegate.permissions().allow).map(String))
  editingDelegatePermsDeny.value = new Set(Array.from(delegate.permissions().deny).map(String))
}

function saveDelegatePermissions(delegate: Delegate) {
  const perms = delegate.permissionsMut()
  perms.allow.clear()
  perms.deny.clear()
  for (const p of editingDelegatePermsAllow.value) {
    perms.addAllow(p as Privilege)
  }
  for (const p of editingDelegatePermsDeny.value) {
    perms.addDeny(p as Privilege)
  }
  editingDelegatePermsRef.value = null
  saveToHistory()
  refreshDocument()
  toast.add({ title: 'Permissions updated', color: 'success', icon: 'i-heroicons-shield-check' })
}

function cancelEditDelegatePermissions() {
  editingDelegatePermsRef.value = null
}

// ============================================
// Service Management
// ============================================

function getDelegateRefHex(delegate: Delegate): string {
  return delegate.reference().toHex()
}

function getKeyLabelByRef(refHex: string): string {
  const key = keyList.value.find(k => k.reference().toHex() === refHex)
  if (!key) return refHex.substring(0, 8) + '...'
  const nick = key.nickname()
  return nick || `${getKeyAlgorithm(key)} (${refHex.substring(0, 8)}...)`
}

function getDelegateLabelByRef(refHex: string): string {
  const delegate = delegateList.value.find(d => d.reference().toHex() === refHex)
  if (!delegate) return refHex.substring(0, 8) + '...'
  return getDelegateXidHex(delegate).substring(0, 12) + '...'
}

function openAddServiceModal() {
  serviceModalMode.value = 'add'
  serviceFormUri.value = ''
  serviceFormName.value = ''
  serviceFormCapability.value = ''
  serviceFormKeyRefs.value = new Set()
  serviceFormDelegateRefs.value = new Set()
  serviceFormAllowPrivileges.value = new Set()
  serviceFormDenyPrivileges.value = new Set()
  serviceFormError.value = null
  showServiceModal.value = true
}

function openEditServiceModal(service: Service) {
  serviceModalMode.value = 'edit'
  serviceFormUri.value = service.uri()
  serviceFormName.value = service.name()
  serviceFormCapability.value = service.capability()
  serviceFormKeyRefs.value = new Set(service.keyReferences())
  serviceFormDelegateRefs.value = new Set(service.delegateReferences())
  serviceFormAllowPrivileges.value = new Set(Array.from(service.permissions().allow).map(String))
  serviceFormDenyPrivileges.value = new Set(Array.from(service.permissions().deny).map(String))
  serviceFormError.value = null
  showServiceModal.value = true
}

function saveService() {
  const doc = xidDocument.value
  if (!doc) return

  const uri = serviceFormUri.value.trim()
  if (!uri) {
    serviceFormError.value = 'URI is required'
    return
  }

  if (serviceFormKeyRefs.value.size === 0 && serviceFormDelegateRefs.value.size === 0) {
    serviceFormError.value = 'At least one key or delegate reference is required'
    return
  }

  if (serviceFormAllowPrivileges.value.size === 0) {
    serviceFormError.value = 'At least one allowed permission is required'
    return
  }

  try {
    // If editing, remove the old service first
    if (serviceModalMode.value === 'edit') {
      doc.takeService(uri)
    }

    const service = Service.new(uri)

    if (serviceFormName.value.trim()) {
      service.setName(serviceFormName.value.trim())
    }

    if (serviceFormCapability.value.trim()) {
      service.setCapability(serviceFormCapability.value.trim())
    }

    for (const ref of serviceFormKeyRefs.value) {
      service.addKeyReferenceHex(ref)
    }

    for (const ref of serviceFormDelegateRefs.value) {
      service.addDelegateReferenceHex(ref)
    }

    for (const p of serviceFormAllowPrivileges.value) {
      service.permissionsMut().addAllow(p as Privilege)
    }
    for (const p of serviceFormDenyPrivileges.value) {
      service.permissionsMut().addDeny(p as Privilege)
    }

    doc.addService(service)
    showServiceModal.value = false
    saveToHistory()
    refreshDocument()
    toast.add({
      title: serviceModalMode.value === 'add' ? 'Service added' : 'Service updated',
      color: 'success',
      icon: 'i-heroicons-server-stack'
    })
  } catch (e) {
    serviceFormError.value = e instanceof Error ? e.message : 'Failed to save service'
  }
}

function confirmRemoveService(service: Service) {
  removeServiceTargetUri.value = service.uri()
  showRemoveServiceConfirm.value = true
}

function executeRemoveService() {
  const doc = xidDocument.value
  const uri = removeServiceTargetUri.value
  if (!doc || !uri) return

  try {
    doc.removeService(uri)
    showRemoveServiceConfirm.value = false
    removeServiceTargetUri.value = null
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Service removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove service', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

// ============================================
// Provenance Management
// ============================================

function openAdvanceProvenanceModal() {
  advanceProvenanceDate.value = ''
  advanceProvenanceInfo.value = ''
  advanceProvenanceError.value = null
  showAdvanceProvenanceModal.value = true
}

function advanceProvenance() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    const date = advanceProvenanceDate.value ? new Date(advanceProvenanceDate.value) : new Date()
    doc.nextProvenanceMarkWithEmbeddedGenerator(undefined, date)
    showAdvanceProvenanceModal.value = false
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Provenance mark advanced', color: 'success', icon: 'i-heroicons-arrow-path' })
  } catch (e) {
    advanceProvenanceError.value = e instanceof Error ? e.message : 'Failed to advance provenance'
  }
}

// ============================================
// Attachment Management
// ============================================

function openAddAttachmentModal() {
  attachmentFormVendor.value = ''
  attachmentFormConformsTo.value = ''
  attachmentFormPayload.value = ''
  attachmentFormError.value = null
  showAddAttachmentModal.value = true
}

function addAttachment() {
  const doc = xidDocument.value
  if (!doc) return

  const vendor = attachmentFormVendor.value.trim()
  if (!vendor) {
    attachmentFormError.value = 'Vendor is required'
    return
  }

  const payload = attachmentFormPayload.value
  if (!payload) {
    attachmentFormError.value = 'Payload is required'
    return
  }

  try {
    const conformsTo = attachmentFormConformsTo.value.trim() || undefined
    doc.addAttachment(payload, vendor, conformsTo)
    showAddAttachmentModal.value = false
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Attachment added', color: 'success', icon: 'i-heroicons-paper-clip' })
  } catch (e) {
    attachmentFormError.value = e instanceof Error ? e.message : 'Failed to add attachment'
  }
}

function removeAttachment(envelope: Envelope) {
  const doc = xidDocument.value
  if (!doc) return

  try {
    doc.removeAttachment(envelope.digest())
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Attachment removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove attachment', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

// ============================================
// Edge Management
// ============================================

function openAddEdgeModal() {
  edgeFormUrString.value = ''
  edgeFormError.value = null
  showAddEdgeModal.value = true
}

function addEdge() {
  const doc = xidDocument.value
  if (!doc) return

  const urString = edgeFormUrString.value.trim()
  if (!urString) {
    edgeFormError.value = 'Envelope UR string is required'
    return
  }

  try {
    const edgeEnvelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(urString)
    doc.addEdge(edgeEnvelope)
    showAddEdgeModal.value = false
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Edge added', color: 'success', icon: 'i-heroicons-arrow-right' })
  } catch (e) {
    edgeFormError.value = e instanceof Error ? e.message : 'Failed to parse edge envelope'
  }
}

function removeEdge(envelope: Envelope) {
  const doc = xidDocument.value
  if (!doc) return

  try {
    doc.removeEdge(envelope.digest())
    saveToHistory()
    refreshDocument()
    toast.add({ title: 'Edge removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove edge', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

// ============================================
// Resolution Method Management
// ============================================

function startAddResolutionMethod() {
  newResolutionMethodValue.value = ''
  addingResolutionMethod.value = true
}

function addResolutionMethod() {
  const doc = xidDocument.value
  if (!doc) return

  const uri = newResolutionMethodValue.value.trim()
  if (!uri) return

  doc.addResolutionMethod(uri)
  addingResolutionMethod.value = false
  newResolutionMethodValue.value = ''
  saveToHistory()
  refreshDocument()
  toast.add({ title: 'Resolution method added', color: 'success', icon: 'i-heroicons-globe-alt' })
}

function cancelAddResolutionMethod() {
  addingResolutionMethod.value = false
  newResolutionMethodValue.value = ''
}

function removeResolutionMethod(uri: string) {
  const doc = xidDocument.value
  if (!doc) return

  doc.removeResolutionMethod(uri)
  saveToHistory()
  refreshDocument()
  toast.add({ title: 'Resolution method removed', color: 'neutral', icon: 'i-heroicons-trash' })
}

// ============================================
// Import / Export / Signing
// ============================================

function openImportModal() {
  importUrString.value = ''
  importPassword.value = ''
  importVerifySignature.value = false
  importError.value = null
  showImportModal.value = true
}

function importDocument() {
  const urString = importUrString.value.trim()
  if (!urString) {
    importError.value = 'Envelope UR string is required'
    return
  }

  try {
    importError.value = null
    const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(urString)
    const password = importPassword.value ? new TextEncoder().encode(importPassword.value) : undefined
    const verify = importVerifySignature.value ? XIDVerifySignature.Inception : XIDVerifySignature.None
    const doc = XIDDocument.fromEnvelope(envelope, password, verify)
    xidDocument.value = doc
    showImportModal.value = false
    docVersion.value++
    updateIdentityDisplay()
    updateOutput()
    undoStack.value = []
    redoStack.value = []
    saveToHistory()
    toast.add({ title: 'XID Document imported', color: 'success', icon: 'i-heroicons-arrow-down-tray' })
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Failed to import XID document'
  }
}

function openExportModal() {
  exportPrivateKeyOption.value = 'Omit'
  exportGeneratorOption.value = 'Omit'
  exportSigningOption.value = 'none'
  exportPrivateKeyPassword.value = ''
  exportGeneratorPassword.value = ''
  exportKdfMethod.value = KeyDerivationMethod.Argon2id
  exportResult.value = ''
  exportError.value = null
  showExportModal.value = true
}

function executeExport() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    exportError.value = null

    // Build private key options
    let privateKeyOpts: XIDPrivateKeyOptions | XIDPrivateKeyEncryptConfig
    switch (exportPrivateKeyOption.value) {
      case 'Include':
        privateKeyOpts = XIDPrivateKeyOptions.Include
        break
      case 'Elide':
        privateKeyOpts = XIDPrivateKeyOptions.Elide
        break
      case 'Encrypt': {
        if (!exportPrivateKeyPassword.value) {
          exportError.value = 'Password is required for private key encryption'
          return
        }
        privateKeyOpts = {
          type: XIDPrivateKeyOptions.Encrypt,
          password: new TextEncoder().encode(exportPrivateKeyPassword.value),
          method: exportKdfMethod.value,
        }
        break
      }
      default:
        privateKeyOpts = XIDPrivateKeyOptions.Omit
    }

    // Build generator options
    let generatorOpts: XIDGeneratorOptions | XIDGeneratorEncryptConfig
    switch (exportGeneratorOption.value) {
      case 'Include':
        generatorOpts = XIDGeneratorOptions.Include
        break
      case 'Elide':
        generatorOpts = XIDGeneratorOptions.Elide
        break
      case 'Encrypt': {
        if (!exportGeneratorPassword.value) {
          exportError.value = 'Password is required for generator encryption'
          return
        }
        generatorOpts = {
          type: XIDGeneratorOptions.Encrypt,
          password: new TextEncoder().encode(exportGeneratorPassword.value),
          method: exportKdfMethod.value,
        }
        break
      }
      default:
        generatorOpts = XIDGeneratorOptions.Omit
    }

    // Build signing options
    const signingOpts = exportSigningOption.value === 'inception'
      ? { type: 'inception' as const }
      : { type: 'none' as const }

    const envelope = doc.toEnvelope(privateKeyOpts, generatorOpts, signingOpts)
    exportResult.value = envelope.urString()
    toast.add({ title: 'Export generated', color: 'success', icon: 'i-heroicons-arrow-up-tray' })
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Failed to export XID document'
    exportResult.value = ''
  }
}

// ============================================
// QR Code Generation
// ============================================

function generateQRCode() {
  if (!envelopeUrOutput.value) {
    qrCodeError.value = 'No envelope data to encode'
    return
  }

  qrCodeError.value = null

  try {
    const urData = envelopeUrOutput.value.toUpperCase()

    const qrData = encodeQR(urData, 'raw', {
      ecc: 'low',
      border: 2
    })

    const size = qrData.length
    const scale = 4
    const svgSize = size * scale

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="300" height="300">
      <rect width="${svgSize}" height="${svgSize}" fill="#ffffff"/>
      ${qrData.map((row: boolean[], y: number) =>
        row.map((cell: boolean, x: number) =>
          cell ? `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="#000000"/>` : ''
        ).join('')
      ).join('')}
    </svg>`

    qrCodeDataUrl.value = `data:image/svg+xml;base64,${btoa(svg)}`
  } catch (e) {
    console.error('QR code generation error:', e)
    qrCodeError.value = e instanceof Error ? e.message : 'Failed to generate QR code'
  }
}

function openQRModal() {
  if (!envelopeUrOutput.value) {
    toast.add({ title: 'Create an XID document first', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  showQRModal.value = true
  generateQRCode()
}

async function downloadQRCode() {
  if (!qrCodeDataUrl.value) return

  const link = document.createElement('a')
  link.download = 'xid-qr.svg'
  link.href = qrCodeDataUrl.value
  link.click()
}

// ============================================
// Undo / Redo
// ============================================

function saveToHistory() {
  if (isUndoRedoAction) return
  const doc = xidDocument.value
  if (!doc) return

  try {
    const envelope = doc.toEnvelope(
      XIDPrivateKeyOptions.Include,
      XIDGeneratorOptions.Include,
      { type: 'none' }
    )
    const state = envelope.urString()

    if (undoStack.value.length > 0 && undoStack.value[undoStack.value.length - 1] === state) {
      return
    }

    undoStack.value.push(state)
    if (undoStack.value.length > maxHistorySize) {
      undoStack.value.shift()
    }
    redoStack.value = []
  } catch {
    // If serialization fails, skip history save
  }
}

function undo() {
  if (undoStack.value.length <= 1) {
    toast.add({ title: 'Nothing to undo', color: 'warning', icon: 'i-heroicons-arrow-uturn-left' })
    return
  }

  isUndoRedoAction = true
  const currentState = undoStack.value.pop()!
  redoStack.value.push(currentState)

  const previousState = undoStack.value[undoStack.value.length - 1]!
  try {
    const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(previousState)
    const doc = XIDDocument.fromEnvelope(envelope)
    xidDocument.value = doc
    docVersion.value++
    updateIdentityDisplay()
    updateOutput()
    toast.add({ title: 'Undo', color: 'info', icon: 'i-heroicons-arrow-uturn-left' })
  } catch {
    toast.add({ title: 'Failed to undo', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
  isUndoRedoAction = false
}

function redo() {
  if (redoStack.value.length === 0) {
    toast.add({ title: 'Nothing to redo', color: 'warning', icon: 'i-heroicons-arrow-uturn-right' })
    return
  }

  isUndoRedoAction = true
  const nextState = redoStack.value.pop()!
  undoStack.value.push(nextState)

  try {
    const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(nextState)
    const doc = XIDDocument.fromEnvelope(envelope)
    xidDocument.value = doc
    docVersion.value++
    updateIdentityDisplay()
    updateOutput()
    toast.add({ title: 'Redo', color: 'info', icon: 'i-heroicons-arrow-uturn-right' })
  } catch {
    toast.add({ title: 'Failed to redo', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
  isUndoRedoAction = false
}

const canUndo = computed(() => undoStack.value.length > 1)
const canRedo = computed(() => redoStack.value.length > 0)

// ============================================
// Share (Public Export)
// ============================================

async function sharePublicly() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    const envelope = doc.toEnvelope(
      XIDPrivateKeyOptions.Elide,
      XIDGeneratorOptions.Elide,
      { type: 'none' }
    )
    const ur = envelope.urString()
    shareResult.value = ur
    await navigator.clipboard.writeText(ur)
    showShareModal.value = true
    toast.add({ title: 'Public export copied to clipboard', color: 'success', icon: 'i-heroicons-share' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to create public export', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

// ============================================
// Templates
// ============================================

interface XIDTemplate {
  id: string
  name: string
  description: string
  icon: string
  create: () => void
}

const xidTemplates: XIDTemplate[] = [
  {
    id: 'personal',
    name: 'Personal Identity',
    description: 'Ed25519 inception key with provenance chain',
    icon: 'i-heroicons-user',
    create: () => {
      const doc = XIDDocument.new({ type: 'default' }, {
        type: 'seed',
        seed: crypto.getRandomValues(new Uint8Array(32)),
        resolution: ProvenanceMarkResolution.High,
        date: new Date(),
      })
      const inceptionKey = doc.inceptionKey()
      if (inceptionKey) inceptionKey.setNickname('Personal')
      xidDocument.value = doc
    }
  },
  {
    id: 'organization',
    name: 'Organization',
    description: 'Ed25519 inception key with a delegate for team members',
    icon: 'i-heroicons-building-office-2',
    create: () => {
      const doc = XIDDocument.new({ type: 'default' })
      const inceptionKey = doc.inceptionKey()
      if (inceptionKey) inceptionKey.setNickname('Org Admin')
      // Add a delegate
      const controllerDoc = XIDDocument.new()
      const delegate = Delegate.new(controllerDoc)
      delegate.permissionsMut().addAllow(Privilege.Sign)
      delegate.permissionsMut().addAllow(Privilege.Auth)
      delegate.permissionsMut().addAllow(Privilege.Encrypt)
      doc.addDelegate(delegate)
      xidDocument.value = doc
    }
  },
  {
    id: 'iot-device',
    name: 'IoT Device',
    description: 'Ed25519 inception + ML-DSA-44 backup for quantum resistance',
    icon: 'i-heroicons-cpu-chip',
    create: () => {
      const doc = XIDDocument.new({ type: 'default' })
      const inceptionKey = doc.inceptionKey()
      if (inceptionKey) inceptionKey.setNickname('Device Primary')
      // Add ML-DSA backup key
      const [sigPriv, sigPub] = createKeypair(SignatureScheme.MLDSA44)
      const [encPriv, encPub] = createEncapsulationKeypair(EncapsulationScheme.X25519)
      const backupKey = Key.newWithPrivateKeys(PrivateKeys.withKeys(sigPriv, encPriv), PublicKeys.new(sigPub, encPub))
      backupKey.setNickname('PQ Backup')
      backupKey.addPermission(Privilege.Sign)
      backupKey.addPermission(Privilege.Auth)
      doc.addKey(backupKey)
      xidDocument.value = doc
    }
  },
  {
    id: 'service-account',
    name: 'Service Account',
    description: 'ECDSA inception key with service endpoint',
    icon: 'i-heroicons-server-stack',
    create: () => {
      const pkb = PrivateKeyBase.new()
      const doc = XIDDocument.new({ type: 'privateKeys', privateKeys: pkb.ecdsaPrivateKeys(), publicKeys: pkb.ecdsaPublicKeys() })
      const inceptionKey = doc.inceptionKey()
      if (inceptionKey) {
        inceptionKey.setNickname('Service Key')
        inceptionKey.addEndpoint('https://api.example.com')
      }
      // Add a service
      const service = Service.new('https://api.example.com')
      service.setName('API Endpoint')
      service.setCapability('com.example.api')
      if (inceptionKey) service.addKeyReferenceHex(inceptionKey.reference().toHex())
      service.permissionsMut().addAllow(Privilege.Auth)
      service.permissionsMut().addAllow(Privilege.Sign)
      doc.addService(service)
      xidDocument.value = doc
    }
  }
]

function applyTemplate(template: XIDTemplate) {
  saveToHistory()
  template.create()
  showTemplatesModal.value = false
  docVersion.value++
  updateIdentityDisplay()
  updateOutput()
  saveToHistory()
  toast.add({ title: `Template "${template.name}" applied`, color: 'success', icon: 'i-heroicons-document-duplicate' })
}

// ============================================
// Keyboard Shortcuts
// ============================================

defineShortcuts({
  'meta_z': () => undo(),
  'meta_shift_z': () => redo(),
  'meta_y': () => redo(),
})
</script>

<template>
  <UDashboardPanel id="xid-builder">
    <template #header>
      <UDashboardNavbar title="XID Builder">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UTooltip text="Create new XID Document">
            <UButton
              icon="i-heroicons-plus"
              color="primary"
              variant="soft"
              size="sm"
              @click="openNewXIDModal"
            >
              New
            </UButton>
          </UTooltip>
          <UTooltip text="Templates">
            <UButton
              icon="i-heroicons-squares-2x2"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showTemplatesModal = true"
            />
          </UTooltip>
          <UTooltip text="Import XID from UR">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="openImportModal"
            />
          </UTooltip>
          <UTooltip text="Export with options">
            <UButton
              icon="i-heroicons-arrow-up-tray"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!xidDocument"
              @click="openExportModal"
            />
          </UTooltip>
          <UTooltip text="Share publicly (elide private data)">
            <UButton
              icon="i-heroicons-share"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!xidDocument"
              @click="sharePublicly"
            />
          </UTooltip>
          <UTooltip text="Show QR Code">
            <UButton
              icon="i-heroicons-qr-code"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!xidDocument"
              @click="openQRModal"
            />
          </UTooltip>
          <UTooltip text="Undo (Cmd+Z)">
            <UButton
              icon="i-heroicons-arrow-uturn-left"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!canUndo"
              @click="undo"
            />
          </UTooltip>
          <UTooltip text="Redo (Cmd+Shift+Z)">
            <UButton
              icon="i-heroicons-arrow-uturn-right"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!canRedo"
              @click="redo"
            />
          </UTooltip>
          <UTooltip text="Clear document">
            <UButton
              icon="i-heroicons-trash"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!xidDocument"
              @click="clearDocument"
            />
          </UTooltip>
          <UColorModeButton size="sm" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full">
        <!-- Document Panel -->
        <div class="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Document</h3>
            <div v-if="xidDocument" class="flex items-center gap-2">
              <UBadge color="primary" variant="soft" size="xs">
                <UIcon name="i-heroicons-finger-print" class="w-3 h-3 mr-1" />
                {{ digestOutput.substring(0, 8) }}...
              </UBadge>
            </div>
          </div>

          <div class="flex-1 overflow-auto p-4">
            <!-- Empty State -->
            <div v-if="!xidDocument" class="h-full flex flex-col items-center justify-center">
              <div class="text-center max-w-sm">
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-4 inline-block">
                  <UIcon name="i-heroicons-identification" class="w-8 h-8 text-gray-400" />
                </div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">No XID Document</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Create a new XID Document to get started. A default Ed25519 inception key will be generated automatically.
                </p>
                <div class="flex gap-2">
                  <UButton
                    icon="i-heroicons-plus"
                    color="primary"
                    @click="openNewXIDModal"
                  >
                    Create XID Document
                  </UButton>
                  <UButton
                    icon="i-heroicons-squares-2x2"
                    color="neutral"
                    variant="soft"
                    @click="showTemplatesModal = true"
                  >
                    Templates
                  </UButton>
                </div>
              </div>
            </div>

            <!-- Document Content -->
            <div v-else class="space-y-4">
              <!-- Identity Section -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Identity</h4>
                <div class="space-y-2">
                  <!-- UR String -->
                  <div class="flex items-center gap-2">
                    <UBadge color="primary" variant="soft" size="xs">UR</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono break-all text-gray-700 dark:text-gray-300">{{ xidUrString }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidUrString, 'XID UR')"
                    />
                  </div>
                  <!-- Hex -->
                  <div class="flex items-center gap-2">
                    <UBadge color="neutral" variant="soft" size="xs">Hex</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono break-all text-gray-600 dark:text-gray-400">{{ xidHex }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidHex, 'XID Hex')"
                    />
                  </div>
                  <!-- Bytewords -->
                  <div class="flex items-center gap-2">
                    <UBadge color="info" variant="soft" size="xs">Words</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono text-gray-700 dark:text-gray-300">{{ xidBytewords }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidBytewords, 'XID Bytewords')"
                    />
                  </div>
                  <!-- Bytemojis -->
                  <div class="flex items-center gap-2">
                    <UBadge color="warning" variant="soft" size="xs">Emoji</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono text-gray-700 dark:text-gray-300">{{ xidBytemojis }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidBytemojis, 'XID Bytemojis')"
                    />
                  </div>
                </div>
              </div>

              <!-- Inception Key Section -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Inception Key</h4>
                <div class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
                  <div class="flex items-center gap-2">
                    <UBadge v-if="inceptionKeyIsInception" color="success" variant="soft" size="xs">Inception</UBadge>
                    <UBadge color="neutral" variant="soft" size="xs">Ed25519</UBadge>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Reference:</span>
                    <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{{ inceptionKeyReference }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(inceptionKeyReference, 'Key reference')"
                    />
                  </div>
                  <div v-if="inceptionKeyPermissions.length > 0" class="flex items-center gap-1 flex-wrap">
                    <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Permissions:</span>
                    <UBadge
                      v-for="perm in inceptionKeyPermissions"
                      :key="perm"
                      color="primary"
                      variant="soft"
                      size="xs"
                    >
                      {{ perm }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <!-- Keys Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="keySectionCollapsed = !keySectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="keySectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keys</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ keyList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddKeyModal" />
                </div>

                <div v-if="!keySectionCollapsed" class="mt-2 space-y-2">
                  <div
                    v-for="keyItem in keyList"
                    :key="getKeyRefHex(keyItem)"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border"
                    :class="isKeyInception(keyItem) ? 'border-primary-300 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700'"
                  >
                    <!-- Header: badges + actions -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <UBadge v-if="isKeyInception(keyItem)" color="success" variant="soft" size="xs">Inception</UBadge>
                        <UBadge color="neutral" variant="soft" size="xs">{{ getKeyAlgorithm(keyItem) }}</UBadge>
                      </div>
                      <UTooltip v-if="!isKeyInception(keyItem)" text="Remove key">
                        <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="confirmRemoveKey(keyItem)" />
                      </UTooltip>
                    </div>

                    <!-- Nickname -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Name:</span>
                      <template v-if="editingNicknameKeyRef === getKeyRefHex(keyItem)">
                        <input
                          v-model="editingNicknameValue"
                          class="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300"
                          @keyup.enter="saveNickname(keyItem)"
                          @keyup.escape="cancelEditNickname"
                        >
                        <UButton icon="i-heroicons-check" size="xs" color="success" variant="ghost" @click="saveNickname(keyItem)" />
                        <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost" @click="cancelEditNickname" />
                      </template>
                      <template v-else>
                        <span class="flex-1 text-xs text-gray-700 dark:text-gray-300">{{ keyItem.nickname() || '(unnamed)' }}</span>
                        <UButton icon="i-heroicons-pencil" size="xs" color="neutral" variant="ghost" @click="startEditNickname(keyItem)" />
                      </template>
                    </div>

                    <!-- Reference -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Ref:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ getKeyRefHex(keyItem) }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(getKeyRefHex(keyItem), 'Key reference')" />
                    </div>

                    <!-- Permissions (display mode) -->
                    <div v-if="editingPermsKeyRef !== getKeyRefHex(keyItem)">
                      <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Allow:</span>
                        <UBadge v-for="perm in Array.from(keyItem.permissions().allow)" :key="'a-' + perm" color="success" variant="soft" size="xs">{{ perm }}</UBadge>
                        <span v-if="keyItem.permissions().allow.size === 0" class="text-xs text-gray-400 italic">none</span>
                      </div>
                      <div v-if="keyItem.permissions().deny.size > 0" class="flex items-center gap-1 flex-wrap mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Deny:</span>
                        <UBadge v-for="perm in Array.from(keyItem.permissions().deny)" :key="'d-' + perm" color="error" variant="soft" size="xs">{{ perm }}</UBadge>
                      </div>
                      <UButton class="mt-1" icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost" label="Edit permissions" @click="startEditPermissions(keyItem)" />
                    </div>

                    <!-- Permissions (editor mode) -->
                    <div v-else class="space-y-2">
                      <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-white dark:bg-gray-900/50 rounded p-2">
                        <div class="font-medium text-gray-500">Privilege</div>
                        <div class="font-medium text-gray-500 text-center">Allow</div>
                        <div class="font-medium text-gray-500 text-center">Deny</div>
                        <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                          <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                          <div class="text-center"><input type="checkbox" :checked="editingPermsAllow.has(priv)" @change="togglePrivilege(editingPermsAllow, priv)"></div>
                          <div class="text-center"><input type="checkbox" :checked="editingPermsDeny.has(priv)" @change="togglePrivilege(editingPermsDeny, priv)"></div>
                        </template>
                      </div>
                      <div class="flex gap-1">
                        <UButton size="xs" color="primary" variant="soft" @click="savePermissions(keyItem)">Save</UButton>
                        <UButton size="xs" color="neutral" variant="ghost" @click="cancelEditPermissions">Cancel</UButton>
                      </div>
                    </div>

                    <!-- Endpoints -->
                    <div>
                      <div v-if="Array.from(keyItem.endpoints()).length > 0" class="space-y-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Endpoints:</span>
                        <div v-for="ep in Array.from(keyItem.endpoints())" :key="ep" class="flex items-center gap-1 ml-2">
                          <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ ep }}</code>
                          <UButton icon="i-heroicons-x-mark" size="xs" color="error" variant="ghost" @click="removeEndpointFromKey(keyItem, ep)" />
                        </div>
                      </div>
                      <div v-if="addingEndpointKeyRef === getKeyRefHex(keyItem)" class="flex items-center gap-1 mt-1">
                        <input
                          v-model="newEndpointValue"
                          placeholder="https://..."
                          class="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5"
                          @keyup.enter="addEndpointToKey(keyItem)"
                          @keyup.escape="cancelAddEndpoint"
                        >
                        <UButton icon="i-heroicons-check" size="xs" color="success" variant="ghost" @click="addEndpointToKey(keyItem)" />
                        <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost" @click="cancelAddEndpoint" />
                      </div>
                      <UButton
                        v-else
                        class="mt-1"
                        icon="i-heroicons-link"
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        label="Add endpoint"
                        @click="startAddEndpoint(keyItem)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Delegates Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="delegateSectionCollapsed = !delegateSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="delegateSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Delegates</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ delegateList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddDelegateModal" />
                </div>

                <div v-if="!delegateSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="delegateList.length === 0" class="text-xs text-gray-400 italic pl-5">No delegates</div>
                  <div
                    v-for="delegateItem in delegateList"
                    :key="getDelegateXidHex(delegateItem)"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700"
                  >
                    <!-- Header: badge + remove -->
                    <div class="flex items-center justify-between">
                      <UBadge color="info" variant="soft" size="xs">Delegate</UBadge>
                      <UTooltip text="Remove delegate">
                        <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="confirmRemoveDelegate(delegateItem)" />
                      </UTooltip>
                    </div>

                    <!-- Controller XID -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">XID:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ getDelegateXidHex(delegateItem) }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(getDelegateXidHex(delegateItem), 'Delegate XID')" />
                    </div>

                    <!-- Permissions (display mode) -->
                    <div v-if="editingDelegatePermsRef !== getDelegateXidHex(delegateItem)">
                      <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Allow:</span>
                        <UBadge v-for="perm in Array.from(delegateItem.permissions().allow)" :key="'da-' + perm" color="success" variant="soft" size="xs">{{ perm }}</UBadge>
                        <span v-if="delegateItem.permissions().allow.size === 0" class="text-xs text-gray-400 italic">none</span>
                      </div>
                      <div v-if="delegateItem.permissions().deny.size > 0" class="flex items-center gap-1 flex-wrap mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Deny:</span>
                        <UBadge v-for="perm in Array.from(delegateItem.permissions().deny)" :key="'dd-' + perm" color="error" variant="soft" size="xs">{{ perm }}</UBadge>
                      </div>
                      <UButton class="mt-1" icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost" label="Edit permissions" @click="startEditDelegatePermissions(delegateItem)" />
                    </div>

                    <!-- Permissions (editor mode) -->
                    <div v-else class="space-y-2">
                      <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-white dark:bg-gray-900/50 rounded p-2">
                        <div class="font-medium text-gray-500">Privilege</div>
                        <div class="font-medium text-gray-500 text-center">Allow</div>
                        <div class="font-medium text-gray-500 text-center">Deny</div>
                        <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                          <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                          <div class="text-center"><input type="checkbox" :checked="editingDelegatePermsAllow.has(priv)" @change="togglePrivilege(editingDelegatePermsAllow, priv)"></div>
                          <div class="text-center"><input type="checkbox" :checked="editingDelegatePermsDeny.has(priv)" @change="togglePrivilege(editingDelegatePermsDeny, priv)"></div>
                        </template>
                      </div>
                      <div class="flex gap-1">
                        <UButton size="xs" color="primary" variant="soft" @click="saveDelegatePermissions(delegateItem)">Save</UButton>
                        <UButton size="xs" color="neutral" variant="ghost" @click="cancelEditDelegatePermissions">Cancel</UButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Services Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="serviceSectionCollapsed = !serviceSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="serviceSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Services</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ serviceList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddServiceModal" />
                </div>

                <div v-if="!serviceSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="serviceList.length === 0" class="text-xs text-gray-400 italic pl-5">No services</div>
                  <div
                    v-for="serviceItem in serviceList"
                    :key="serviceItem.uri()"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700"
                  >
                    <!-- Header: badges + actions -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <UBadge color="primary" variant="soft" size="xs">Service</UBadge>
                        <UBadge v-if="serviceItem.name()" color="info" variant="soft" size="xs">{{ serviceItem.name() }}</UBadge>
                      </div>
                      <div class="flex items-center gap-1">
                        <UTooltip text="Edit service">
                          <UButton icon="i-heroicons-pencil" size="xs" color="neutral" variant="ghost" @click="openEditServiceModal(serviceItem)" />
                        </UTooltip>
                        <UTooltip text="Remove service">
                          <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="confirmRemoveService(serviceItem)" />
                        </UTooltip>
                      </div>
                    </div>

                    <!-- URI -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">URI:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ serviceItem.uri() }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(serviceItem.uri(), 'Service URI')" />
                    </div>

                    <!-- Capability -->
                    <div v-if="serviceItem.capability()" class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Capability:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ serviceItem.capability() }}</code>
                    </div>

                    <!-- Key References -->
                    <div v-if="serviceItem.keyReferences().size > 0" class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Keys:</span>
                      <UBadge v-for="ref in Array.from(serviceItem.keyReferences())" :key="'sk-' + ref" color="neutral" variant="soft" size="xs">
                        {{ getKeyLabelByRef(ref) }}
                      </UBadge>
                    </div>

                    <!-- Delegate References -->
                    <div v-if="serviceItem.delegateReferences().size > 0" class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Delegates:</span>
                      <UBadge v-for="ref in Array.from(serviceItem.delegateReferences())" :key="'sdr-' + ref" color="info" variant="soft" size="xs">
                        {{ getDelegateLabelByRef(ref) }}
                      </UBadge>
                    </div>

                    <!-- Permissions -->
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Allow:</span>
                      <UBadge v-for="perm in Array.from(serviceItem.permissions().allow)" :key="'sa-' + perm" color="success" variant="soft" size="xs">{{ perm }}</UBadge>
                      <span v-if="serviceItem.permissions().allow.size === 0" class="text-xs text-gray-400 italic">none</span>
                    </div>
                    <div v-if="serviceItem.permissions().deny.size > 0" class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Deny:</span>
                      <UBadge v-for="perm in Array.from(serviceItem.permissions().deny)" :key="'sdp-' + perm" color="error" variant="soft" size="xs">{{ perm }}</UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Provenance Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="provenanceSectionCollapsed = !provenanceSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="provenanceSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provenance</h4>
                    <UBadge v-if="provenanceMark" color="success" variant="soft" size="xs">Seq {{ provenanceMark.seq() }}</UBadge>
                    <UBadge v-else color="neutral" variant="soft" size="xs">None</UBadge>
                  </div>
                </div>

                <div v-if="!provenanceSectionCollapsed" class="mt-2">
                  <div v-if="!provenanceMark" class="text-xs text-gray-400 italic pl-5">
                    No provenance mark. Create a new document with provenance enabled to set a genesis mark.
                  </div>
                  <div v-else class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
                    <!-- Generator status badge -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <UBadge color="primary" variant="soft" size="xs">{{ provenanceResolutionLabel }}</UBadge>
                        <UBadge
                          :color="generatorStatus === 'Included' ? 'success' : 'neutral'"
                          variant="soft"
                          size="xs"
                        >
                          Generator: {{ generatorStatus }}
                        </UBadge>
                      </div>
                      <UTooltip v-if="generatorStatus === 'Included'" text="Advance provenance">
                        <UButton icon="i-heroicons-arrow-path" size="xs" color="primary" variant="ghost" @click.stop="openAdvanceProvenanceModal" />
                      </UTooltip>
                    </div>

                    <!-- Sequence -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Sequence:</span>
                      <span class="text-xs font-mono text-gray-700 dark:text-gray-300">{{ provenanceMark.seq() }}</span>
                      <UBadge v-if="provenanceMark.seq() === 0" color="info" variant="soft" size="xs">Genesis</UBadge>
                    </div>

                    <!-- Chain ID -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Chain ID:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ provenanceChainIdHex }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(provenanceChainIdHex, 'Chain ID')" />
                    </div>

                    <!-- Date -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Date:</span>
                      <span class="text-xs text-gray-700 dark:text-gray-300">{{ provenanceMark.date().toISOString() }}</span>
                    </div>

                    <!-- Mark Identifier -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Mark ID:</span>
                      <code class="text-xs font-mono text-gray-600 dark:text-gray-400">{{ provenanceMark.bytewordsIdentifier(true) }}</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Attachments Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="attachmentSectionCollapsed = !attachmentSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="attachmentSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attachments</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ attachmentList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddAttachmentModal" />
                </div>

                <div v-if="!attachmentSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="attachmentList.length === 0" class="text-xs text-gray-400 italic pl-5">No attachments</div>
                  <div
                    v-for="att in attachmentList"
                    :key="att.digestHex"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <UBadge color="warning" variant="soft" size="xs">Attachment</UBadge>
                        <UBadge color="neutral" variant="soft" size="xs">{{ att.vendor }}</UBadge>
                      </div>
                      <UTooltip text="Remove attachment">
                        <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="removeAttachment(att.envelope)" />
                      </UTooltip>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Vendor:</span>
                      <span class="text-xs text-gray-700 dark:text-gray-300">{{ att.vendor }}</span>
                    </div>
                    <div v-if="att.conformsTo" class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Conforms to:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ att.conformsTo }}</code>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Payload:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ att.payloadPreview }}</code>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Digest:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ att.digestHex.substring(0, 16) }}...</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Edges Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="edgeSectionCollapsed = !edgeSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="edgeSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Edges</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ edgeList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddEdgeModal" />
                </div>

                <div v-if="!edgeSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="edgeList.length === 0" class="text-xs text-gray-400 italic pl-5">No edges</div>
                  <div
                    v-for="edge in edgeList"
                    :key="edge.digestHex"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <UBadge color="info" variant="soft" size="xs">Edge</UBadge>
                      </div>
                      <UTooltip text="Remove edge">
                        <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="removeEdge(edge.envelope)" />
                      </UTooltip>
                    </div>
                    <pre class="text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900/50 rounded p-2 overflow-x-auto whitespace-pre max-h-24 overflow-y-auto">{{ edge.treePreview }}</pre>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Digest:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ edge.digestHex.substring(0, 16) }}...</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Resolution Methods Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="resolutionSectionCollapsed = !resolutionSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="resolutionSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resolution</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ resolutionMethodList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="startAddResolutionMethod" />
                </div>

                <div v-if="!resolutionSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="resolutionMethodList.length === 0 && !addingResolutionMethod" class="text-xs text-gray-400 italic pl-5">No resolution methods</div>
                  <div
                    v-for="method in resolutionMethodList"
                    :key="method"
                    class="flex items-center gap-2 pl-5"
                  >
                    <UBadge color="neutral" variant="soft" size="xs">URI</UBadge>
                    <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ method }}</code>
                    <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(method, 'Resolution URI')" />
                    <UButton icon="i-heroicons-x-mark" size="xs" color="error" variant="ghost" @click="removeResolutionMethod(method)" />
                  </div>
                  <div v-if="addingResolutionMethod" class="flex items-center gap-1 pl-5">
                    <input
                      v-model="newResolutionMethodValue"
                      placeholder="https://example.com/.well-known/xid"
                      class="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5"
                      @keyup.enter="addResolutionMethod"
                      @keyup.escape="cancelAddResolutionMethod"
                    >
                    <UButton icon="i-heroicons-check" size="xs" color="success" variant="ghost" @click="addResolutionMethod" />
                    <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost" @click="cancelAddResolutionMethod" />
                  </div>
                </div>
              </div>

              <!-- Envelope UR Section -->
              <div v-if="envelopeUrOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Envelope UR</h4>
                  <div class="flex items-center gap-1">
                    <UButton
                      icon="i-heroicons-qr-code"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="openQRModal"
                    />
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(envelopeUrOutput, 'Envelope UR')"
                    />
                  </div>
                </div>
                <code class="block text-xs bg-gray-100 dark:bg-gray-800/50 p-2 rounded font-mono break-all text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">{{ envelopeUrOutput }}</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Output Panel -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
          </div>

          <div class="flex-1 overflow-auto p-4 space-y-4">
            <!-- Error Display -->
            <UAlert
              v-if="error"
              color="error"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              :title="error"
            />

            <!-- Empty State -->
            <div v-if="!xidDocument" class="h-full flex flex-col items-center justify-center">
              <div class="text-center max-w-sm">
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-4 inline-block">
                  <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
                </div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">No Output</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Create an XID Document to see its envelope output here.
                </p>
              </div>
            </div>

            <template v-else>
              <!-- Digest Display -->
              <div v-if="digestOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Digest</h4>
                  <UButton
                    icon="i-heroicons-clipboard-document"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="copyToClipboard(digestOutput, 'Digest')"
                  />
                </div>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-2 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                  {{ digestOutput }}
                </div>
              </div>

              <!-- Tree Format Output -->
              <div v-if="treeOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tree Format</h4>
                  <UButton
                    icon="i-heroicons-clipboard-document"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="copyToClipboard(treeOutput, 'Tree format')"
                  />
                </div>
                <pre class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">{{ treeOutput }}</pre>
              </div>

              <!-- Envelope Output (Notation / CBOR Hex / CBOR Diagnostic) -->
              <div v-if="notationOutput || hexOutput || diagnosticOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {{ envelopeOutputMode === 'notation' ? 'Envelope Notation' : envelopeOutputMode === 'hex' ? 'CBOR (Hex)' : 'CBOR Diagnostic' }}
                    <UBadge v-if="envelopeOutputMode === 'hex' && hexOutput" color="neutral" variant="soft" size="xs" class="ml-1">{{ hexOutput.length / 2 }} bytes</UBadge>
                  </h4>
                  <div class="flex items-center gap-1">
                    <select
                      v-model="envelopeOutputMode"
                      class="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5"
                    >
                      <option value="notation">Notation</option>
                      <option value="hex">CBOR Hex</option>
                      <option value="diag">CBOR Diagnostic</option>
                    </select>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(envelopeOutputMode === 'notation' ? notationOutput : envelopeOutputMode === 'hex' ? hexOutput : diagnosticOutput, envelopeOutputMode === 'notation' ? 'Envelope notation' : envelopeOutputMode === 'hex' ? 'CBOR hex' : 'CBOR diagnostic')"
                    />
                  </div>
                </div>
                <pre v-if="envelopeOutputMode === 'notation' && notationOutput" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">{{ notationOutput }}</pre>
                <div v-else-if="envelopeOutputMode === 'hex' && hexOutput" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-h-48 overflow-y-auto">
                  {{ hexOutput }}
                </div>
                <pre v-else-if="envelopeOutputMode === 'diag' && diagnosticOutput" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">{{ diagnosticOutput }}</pre>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- QR Modal -->
      <UModal v-model:open="showQRModal" title="QR Code" description="Scan this QR code to import the XID on another device.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">XID QR Code</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Scan this QR code to import the XID envelope on another device.
            </p>

            <UAlert
              v-if="qrCodeError"
              color="error"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              :title="qrCodeError"
              class="mb-4"
            />

            <div v-if="qrCodeDataUrl" class="flex flex-col items-center">
              <div class="bg-white p-4 rounded-lg mb-4">
                <img :src="qrCodeDataUrl" alt="XID QR Code" class="w-64 h-64">
              </div>

              <p class="text-xs text-gray-500 text-center mb-4">
                Format: UR (Uniform Resource)
              </p>

              <div class="flex gap-2">
                <UButton color="neutral" variant="soft" @click="downloadQRCode">
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
                  Download SVG
                </UButton>
              </div>
            </div>

            <div v-else-if="!qrCodeError" class="flex justify-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
            </div>

            <div class="flex justify-end mt-6">
              <UButton color="neutral" variant="ghost" @click="showQRModal = false">
                Close
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Add Key Modal -->
      <UModal v-model:open="showAddKeyModal" title="Add Key" description="Generate a new cryptographic key for this XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Key</h3>

            <!-- Signing Algorithm -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Signing Algorithm</label>
              <select v-model="newKeyScheme" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                <optgroup label="Classical">
                  <option value="Ed25519">Ed25519 (EdDSA)</option>
                  <option value="Schnorr">Schnorr (secp256k1)</option>
                  <option value="ECDSA">ECDSA (secp256k1)</option>
                </optgroup>
                <optgroup label="Post-Quantum (NIST FIPS 204)">
                  <option value="MLDSA44">ML-DSA-44 (Level 2)</option>
                  <option value="MLDSA65">ML-DSA-65 (Level 3)</option>
                  <option value="MLDSA87">ML-DSA-87 (Level 5)</option>
                </optgroup>
              </select>
            </div>

            <!-- Encapsulation Algorithm -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Encapsulation Algorithm</label>
              <select v-model="newKeyEncapsulation" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                <optgroup label="Classical">
                  <option value="X25519">X25519 (Curve25519)</option>
                </optgroup>
                <optgroup label="Post-Quantum (NIST FIPS 203)">
                  <option value="MLKEM512">ML-KEM-512 (Level 1)</option>
                  <option value="MLKEM768">ML-KEM-768 (Level 3)</option>
                  <option value="MLKEM1024">ML-KEM-1024 (Level 5)</option>
                </optgroup>
              </select>
            </div>

            <!-- Nickname -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nickname (optional)</label>
              <input v-model="newKeyNickname" type="text" placeholder="e.g., Backup Key" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Permissions Grid -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div class="font-medium text-gray-500">Privilege</div>
                <div class="font-medium text-gray-500 text-center">Allow</div>
                <div class="font-medium text-gray-500 text-center">Deny</div>
                <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                  <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                  <div class="text-center"><input type="checkbox" :checked="newKeyAllowPrivileges.has(priv)" @change="togglePrivilege(newKeyAllowPrivileges, priv)"></div>
                  <div class="text-center"><input type="checkbox" :checked="newKeyDenyPrivileges.has(priv)" @change="togglePrivilege(newKeyDenyPrivileges, priv)"></div>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAddKeyModal = false">Cancel</UButton>
              <UButton color="primary" @click="addNewKey">
                <UIcon name="i-heroicons-key" class="w-4 h-4 mr-1" />
                Generate Key
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Remove Key Confirmation -->
      <UModal v-model:open="showRemoveKeyConfirm" title="Remove Key" description="Confirm key removal from the XID document.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Key?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will remove the key from the XID document. This action cannot be undone.
            </p>
            <div v-if="removeKeyTarget" class="text-xs font-mono bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-4 text-gray-600 dark:text-gray-400">
              {{ removeKeyTarget.nickname() || getKeyRefHex(removeKeyTarget) }}
            </div>
            <UAlert v-if="removeKeyError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="removeKeyError" class="mb-4" />
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showRemoveKeyConfirm = false">Cancel</UButton>
              <UButton color="error" :disabled="!!removeKeyError" @click="executeRemoveKey">Remove</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Add Delegate Modal -->
      <UModal v-model:open="showAddDelegateModal" title="Add Delegate" description="Add a new delegate to this XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Delegate</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              A new XID document will be generated for the delegate. Configure its permissions below.
            </p>

            <!-- Permissions Grid -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div class="font-medium text-gray-500">Privilege</div>
                <div class="font-medium text-gray-500 text-center">Allow</div>
                <div class="font-medium text-gray-500 text-center">Deny</div>
                <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                  <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                  <div class="text-center"><input type="checkbox" :checked="newDelegateAllowPrivileges.has(priv)" @change="togglePrivilege(newDelegateAllowPrivileges, priv)"></div>
                  <div class="text-center"><input type="checkbox" :checked="newDelegateDenyPrivileges.has(priv)" @change="togglePrivilege(newDelegateDenyPrivileges, priv)"></div>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAddDelegateModal = false">Cancel</UButton>
              <UButton color="primary" @click="addNewDelegate">
                <UIcon name="i-heroicons-user-plus" class="w-4 h-4 mr-1" />
                Add Delegate
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Remove Delegate Confirmation -->
      <UModal v-model:open="showRemoveDelegateConfirm" title="Remove Delegate" description="Confirm delegate removal from the XID document.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Delegate?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will remove the delegate from the XID document. This action cannot be undone.
            </p>
            <div v-if="removeDelegateTarget" class="text-xs font-mono bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-4 text-gray-600 dark:text-gray-400">
              {{ getDelegateXidHex(removeDelegateTarget) }}
            </div>
            <UAlert v-if="removeDelegateError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="removeDelegateError" class="mb-4" />
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showRemoveDelegateConfirm = false">Cancel</UButton>
              <UButton color="error" :disabled="!!removeDelegateError" @click="executeRemoveDelegate">Remove</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Service Modal (Add/Edit) -->
      <UModal v-model:open="showServiceModal" :title="serviceModalMode === 'add' ? 'Add Service' : 'Edit Service'" :description="serviceModalMode === 'add' ? 'Add a new service endpoint.' : 'Edit service configuration.'">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ serviceModalMode === 'add' ? 'Add Service' : 'Edit Service' }}</h3>

            <UAlert v-if="serviceFormError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="serviceFormError" />

            <!-- URI -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URI</label>
              <input
                v-model="serviceFormUri"
                type="text"
                placeholder="https://example.com/api"
                :disabled="serviceModalMode === 'edit'"
                class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2"
                :class="serviceModalMode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''"
              >
            </div>

            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name (optional)</label>
              <input v-model="serviceFormName" type="text" placeholder="e.g., Messaging Service" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Capability -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capability (optional)</label>
              <input v-model="serviceFormCapability" type="text" placeholder="e.g., com.example.messaging" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Key References -->
            <div v-if="keyList.length > 0">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key References</label>
              <div class="space-y-1 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div v-for="keyItem in keyList" :key="'svc-key-' + getKeyRefHex(keyItem)" class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="serviceFormKeyRefs.has(getKeyRefHex(keyItem))"
                    @change="togglePrivilege(serviceFormKeyRefs, getKeyRefHex(keyItem))"
                  >
                  <UBadge color="neutral" variant="soft" size="xs">{{ getKeyAlgorithm(keyItem) }}</UBadge>
                  <span class="text-xs text-gray-700 dark:text-gray-300">{{ keyItem.nickname() || getKeyRefHex(keyItem).substring(0, 12) + '...' }}</span>
                  <UBadge v-if="isKeyInception(keyItem)" color="success" variant="soft" size="xs">Inception</UBadge>
                </div>
              </div>
            </div>

            <!-- Delegate References -->
            <div v-if="delegateList.length > 0">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delegate References</label>
              <div class="space-y-1 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div v-for="delegateItem in delegateList" :key="'svc-del-' + getDelegateXidHex(delegateItem)" class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="serviceFormDelegateRefs.has(getDelegateRefHex(delegateItem))"
                    @change="togglePrivilege(serviceFormDelegateRefs, getDelegateRefHex(delegateItem))"
                  >
                  <UBadge color="info" variant="soft" size="xs">Delegate</UBadge>
                  <span class="text-xs text-gray-700 dark:text-gray-300 font-mono">{{ getDelegateXidHex(delegateItem).substring(0, 12) }}...</span>
                </div>
              </div>
            </div>

            <!-- Permissions Grid -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div class="font-medium text-gray-500">Privilege</div>
                <div class="font-medium text-gray-500 text-center">Allow</div>
                <div class="font-medium text-gray-500 text-center">Deny</div>
                <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                  <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                  <div class="text-center"><input type="checkbox" :checked="serviceFormAllowPrivileges.has(priv)" @change="togglePrivilege(serviceFormAllowPrivileges, priv)"></div>
                  <div class="text-center"><input type="checkbox" :checked="serviceFormDenyPrivileges.has(priv)" @change="togglePrivilege(serviceFormDenyPrivileges, priv)"></div>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showServiceModal = false">Cancel</UButton>
              <UButton color="primary" @click="saveService">
                <UIcon name="i-heroicons-server-stack" class="w-4 h-4 mr-1" />
                {{ serviceModalMode === 'add' ? 'Add Service' : 'Save Changes' }}
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Remove Service Confirmation -->
      <UModal v-model:open="showRemoveServiceConfirm" title="Remove Service" description="Confirm service removal from the XID document.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Service?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will remove the service from the XID document. This action cannot be undone.
            </p>
            <div v-if="removeServiceTargetUri" class="text-xs font-mono bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-4 text-gray-600 dark:text-gray-400">
              {{ removeServiceTargetUri }}
            </div>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showRemoveServiceConfirm = false">Cancel</UButton>
              <UButton color="error" @click="executeRemoveService">Remove</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- New XID Modal -->
      <UModal v-model:open="showNewXIDModal" title="New XID Document" description="Create a new XID document with optional provenance.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">New XID Document</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              A new Ed25519 inception key will be generated automatically.
            </p>

            <!-- Provenance Toggle -->
            <div class="flex items-center gap-3">
              <input id="provenance-toggle" v-model="newXIDWithProvenance" type="checkbox" class="rounded">
              <label for="provenance-toggle" class="text-sm font-medium text-gray-700 dark:text-gray-300">Create with provenance (genesis mark)</label>
            </div>

            <div v-if="newXIDWithProvenance" class="space-y-3 pl-2 border-l-2 border-primary-200 dark:border-primary-800">
              <!-- Method -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
                <select v-model="newXIDProvenanceMethod" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                  <option value="passphrase">Passphrase</option>
                  <option value="seed">Random Seed</option>
                </select>
              </div>

              <!-- Passphrase -->
              <div v-if="newXIDProvenanceMethod === 'passphrase'">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passphrase</label>
                <input v-model="newXIDPassphrase" type="password" placeholder="Enter a passphrase for the provenance chain" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Used to derive the provenance chain key. Keep this secret.</p>
              </div>

              <div v-else>
                <p class="text-xs text-gray-500 dark:text-gray-400">A random 32-byte seed will be generated for the provenance chain.</p>
              </div>

              <!-- Resolution -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resolution</label>
                <select v-model.number="newXIDResolution" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                  <option :value="0">Low (16 bytes)</option>
                  <option :value="1">Medium (32 bytes)</option>
                  <option :value="2">Quartile (58 bytes)</option>
                  <option :value="3">High (106 bytes)</option>
                </select>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Higher resolution provides more precise date encoding and stronger chain verification.</p>
              </div>

              <!-- Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date (optional)</label>
                <input v-model="newXIDDate" type="datetime-local" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Defaults to current date/time if not set.</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showNewXIDModal = false">Cancel</UButton>
              <UButton color="primary" @click="createNewXID">
                <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                Create
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Advance Provenance Modal -->
      <UModal v-model:open="showAdvanceProvenanceModal" title="Advance Provenance" description="Generate the next provenance mark in the chain.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Advance Provenance</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Generate the next mark in the provenance chain using the embedded generator.
            </p>

            <UAlert v-if="advanceProvenanceError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="advanceProvenanceError" />

            <div v-if="provenanceMark" class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-1 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400">Current sequence:</span>
                <span class="font-mono text-gray-700 dark:text-gray-300">{{ provenanceMark.seq() }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400">Next sequence:</span>
                <span class="font-mono text-gray-700 dark:text-gray-300 font-semibold">{{ provenanceMark.seq() + 1 }}</span>
              </div>
            </div>

            <!-- Date -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date (optional)</label>
              <input v-model="advanceProvenanceDate" type="datetime-local" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Defaults to current date/time if not set.</p>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAdvanceProvenanceModal = false">Cancel</UButton>
              <UButton color="primary" @click="advanceProvenance">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
                Next Mark
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Add Attachment Modal -->
      <UModal v-model:open="showAddAttachmentModal" title="Add Attachment" description="Attach vendor-specific metadata to this XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Attachment</h3>

            <UAlert v-if="attachmentFormError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="attachmentFormError" />

            <!-- Vendor -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
              <input v-model="attachmentFormVendor" type="text" placeholder="com.example" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Reverse domain name identifying the attachment format owner.</p>
            </div>

            <!-- Conforms To -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conforms To (optional)</label>
              <input v-model="attachmentFormConformsTo" type="text" placeholder="https://schema.org/Thing" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">URI identifying the structure/schema of the payload.</p>
            </div>

            <!-- Payload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payload</label>
              <textarea v-model="attachmentFormPayload" rows="3" placeholder="Attachment data..." class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 resize-none" />
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAddAttachmentModal = false">Cancel</UButton>
              <UButton color="primary" @click="addAttachment">
                <UIcon name="i-heroicons-paper-clip" class="w-4 h-4 mr-1" />
                Add Attachment
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Add Edge Modal -->
      <UModal v-model:open="showAddEdgeModal" title="Add Edge" description="Add a verifiable relationship edge to this XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Edge</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Paste an edge envelope UR string. The edge should contain isA, source, and target assertions.
            </p>

            <UAlert v-if="edgeFormError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="edgeFormError" />

            <!-- Edge UR -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Envelope UR</label>
              <textarea v-model="edgeFormUrString" rows="3" placeholder="ur:envelope/..." class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 resize-none font-mono" />
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAddEdgeModal = false">Cancel</UButton>
              <UButton color="primary" @click="addEdge">
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 mr-1" />
                Add Edge
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Import XID Modal -->
      <UModal v-model:open="showImportModal" title="Import XID Document" description="Import an XID document from an envelope UR string.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Import XID Document</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Paste an envelope UR string containing an XID document. This will replace the current document.
            </p>

            <UAlert v-if="importError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="importError" />

            <!-- UR String -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Envelope UR</label>
              <textarea v-model="importUrString" rows="4" placeholder="ur:envelope/..." class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 resize-none font-mono" />
            </div>

            <!-- Password (for encrypted documents) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password (optional)</label>
              <input v-model="importPassword" type="password" placeholder="For decrypting private keys or generator" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Required if private keys or generator are encrypted.</p>
            </div>

            <!-- Verify Signature -->
            <div class="flex items-center gap-3">
              <input id="import-verify" v-model="importVerifySignature" type="checkbox" class="rounded">
              <label for="import-verify" class="text-sm font-medium text-gray-700 dark:text-gray-300">Verify inception signature</label>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showImportModal = false">Cancel</UButton>
              <UButton color="primary" @click="importDocument">
                <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
                Import
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Export XID Modal -->
      <UModal v-model:open="showExportModal" title="Export XID Document" description="Export the XID document with privacy and signing options.">
        <template #content>
          <div class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Export XID Document</h3>

            <UAlert v-if="exportError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="exportError" />

            <!-- Private Key Handling -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Private Key Handling</label>
              <div class="space-y-1.5 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportPrivateKeyOption" type="radio" value="Omit" name="pk-opt">
                  <span class="text-gray-700 dark:text-gray-300">Omit</span>
                  <span class="text-xs text-gray-500">(remove from export)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportPrivateKeyOption" type="radio" value="Include" name="pk-opt">
                  <span class="text-gray-700 dark:text-gray-300">Include</span>
                  <span class="text-xs text-gray-500">(plaintext - use with caution)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportPrivateKeyOption" type="radio" value="Elide" name="pk-opt">
                  <span class="text-gray-700 dark:text-gray-300">Elide</span>
                  <span class="text-xs text-gray-500">(preserves digest tree, hides data)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportPrivateKeyOption" type="radio" value="Encrypt" name="pk-opt">
                  <span class="text-gray-700 dark:text-gray-300">Encrypt</span>
                  <span class="text-xs text-gray-500">(password-protected)</span>
                </label>
              </div>
            </div>

            <!-- Private Key Password (when encrypting) -->
            <div v-if="exportPrivateKeyOption === 'Encrypt'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Private Key Password</label>
              <input v-model="exportPrivateKeyPassword" type="password" placeholder="Password for encrypting private keys" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Generator Handling -->
            <div v-if="generatorStatus === 'Included'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Generator Handling</label>
              <div class="space-y-1.5 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportGeneratorOption" type="radio" value="Omit" name="gen-opt">
                  <span class="text-gray-700 dark:text-gray-300">Omit</span>
                  <span class="text-xs text-gray-500">(remove from export)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportGeneratorOption" type="radio" value="Include" name="gen-opt">
                  <span class="text-gray-700 dark:text-gray-300">Include</span>
                  <span class="text-xs text-gray-500">(plaintext - use with caution)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportGeneratorOption" type="radio" value="Elide" name="gen-opt">
                  <span class="text-gray-700 dark:text-gray-300">Elide</span>
                  <span class="text-xs text-gray-500">(preserves digest tree, hides data)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportGeneratorOption" type="radio" value="Encrypt" name="gen-opt">
                  <span class="text-gray-700 dark:text-gray-300">Encrypt</span>
                  <span class="text-xs text-gray-500">(password-protected)</span>
                </label>
              </div>
            </div>

            <!-- Generator Password (when encrypting) -->
            <div v-if="exportGeneratorOption === 'Encrypt' && generatorStatus === 'Included'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Generator Password</label>
              <input v-model="exportGeneratorPassword" type="password" placeholder="Password for encrypting generator" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- KDF Method (shown when any encryption is active) -->
            <div v-if="exportPrivateKeyOption === 'Encrypt' || (exportGeneratorOption === 'Encrypt' && generatorStatus === 'Included')">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Derivation Function</label>
              <select v-model.number="exportKdfMethod" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                <option :value="3">Argon2id (recommended)</option>
                <option :value="1">PBKDF2</option>
                <option :value="2">Scrypt</option>
              </select>
            </div>

            <!-- Signing -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Signing</label>
              <div class="space-y-1.5 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportSigningOption" type="radio" value="none" name="sign-opt">
                  <span class="text-gray-700 dark:text-gray-300">None</span>
                  <span class="text-xs text-gray-500">(unsigned export)</span>
                </label>
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input v-model="exportSigningOption" type="radio" value="inception" name="sign-opt">
                  <span class="text-gray-700 dark:text-gray-300">Sign with inception key</span>
                  <span class="text-xs text-gray-500">(proves document authenticity)</span>
                </label>
              </div>
            </div>

            <!-- Generate Button -->
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showExportModal = false">Cancel</UButton>
              <UButton color="primary" @click="executeExport">
                <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 mr-1" />
                Generate Export
              </UButton>
            </div>

            <!-- Export Result -->
            <div v-if="exportResult">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Export Result (Envelope UR)</h4>
                <UButton
                  icon="i-heroicons-clipboard-document"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="copyToClipboard(exportResult, 'Export UR')"
                />
              </div>
              <code class="block text-xs bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg font-mono break-all text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">{{ exportResult }}</code>
            </div>
          </div>
        </template>
      </UModal>
      <!-- Share Modal -->
      <UModal v-model:open="showShareModal" title="Public Export" description="Your XID has been exported with private data elided.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Public Export</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Private keys and provenance generator have been elided. The digest tree is preserved for verification.
              The UR has been copied to your clipboard.
            </p>

            <div v-if="shareResult">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Envelope UR (Public)</h4>
                <UButton
                  icon="i-heroicons-clipboard-document"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="copyToClipboard(shareResult, 'Public export UR')"
                />
              </div>
              <code class="block text-xs bg-gray-100 dark:bg-gray-800/50 p-3 rounded-lg font-mono break-all text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">{{ shareResult }}</code>
            </div>

            <div class="flex justify-end">
              <UButton color="neutral" variant="ghost" @click="showShareModal = false">Close</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Templates Modal -->
      <UModal v-model:open="showTemplatesModal" title="XID Templates" description="Choose a template to create a pre-configured XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">XID Templates</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Choose a template to quickly create a pre-configured XID document. This will replace the current document.
            </p>

            <div class="space-y-2">
              <div
                v-for="template in xidTemplates"
                :key="template.id"
                class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                @click="applyTemplate(template)"
              >
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-2">
                  <UIcon :name="template.icon" class="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">{{ template.name }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ template.description }}</div>
                </div>
                <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div class="flex justify-end">
              <UButton color="neutral" variant="ghost" @click="showTemplatesModal = false">Cancel</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
