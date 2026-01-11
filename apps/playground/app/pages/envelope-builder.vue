<script setup lang="ts">
import { Envelope, SigningPrivateKey, SymmetricKey, PrivateKeyBase } from '@bcts/envelope'
import encodeQR from '@paulmillr/qr'

useHead({
  title: 'Envelope Builder | BCTS IDE - Blockchain Commons TypeScript',
  meta: [
    { name: 'description', content: 'Build Gordian Envelopes layer by layer with a visual tree builder' }
  ]
})

// Types
type ValueType = 'string' | 'number' | 'bigint' | 'bytes' | 'bool' | 'null'
type NodeType = 'subject' | 'assertion' | 'wrapped' | 'signed' | 'encrypted' | 'compressed' | 'elided' | 'salted'

interface EnvelopeNode {
  id: string
  type: NodeType
  valueType?: ValueType
  value?: string | number | boolean | null
  predicate?: string
  object?: EnvelopeNode
  assertions?: EnvelopeNode[]
  child?: EnvelopeNode
  expanded: boolean
  // Phase 2: Salt metadata
  saltMode?: 'auto' | 'fixed' | 'range'
  saltLength?: number
  saltMin?: number
  saltMax?: number
  // Phase 2: Recipient encryption metadata
  recipientCount?: number
  recipientIds?: string[] // Track which recipients this was encrypted for
}

// Recipient key pair interface
interface RecipientKey {
  id: string
  name: string
  privateKey: PrivateKeyBase
  publicKeyHex: string // Pre-computed for display
}

// Phase 3: Signing key interface
interface SigningKey {
  id: string
  name: string
  privateKey: SigningPrivateKey
  publicKeyHex: string
}

// Phase 3: Symmetric key interface
interface EncryptionKey {
  id: string
  name: string
  key: SymmetricKey
  keyHex: string
}

// Phase 3: Template interface
interface EnvelopeTemplate {
  id: string
  name: string
  description: string
  icon: string
  create: () => EnvelopeNode
}

// Phase 3: Export format type
type ExportFormat = 'hex' | 'base64' | 'tree' | 'ur'

// Platform detection (SSR-safe)
const isMac = computed(() => {
  if (import.meta.client) {
    return navigator.platform?.includes('Mac') ?? false
  }
  return false
})

// State
const root = ref<EnvelopeNode | null>(null)
const selectedNodeId = ref<string | null>(null)
const treeOutput = ref('')
const hexOutput = ref('')
const digestOutput = ref('')
const error = ref<string | null>(null)

// Output mode
const outputMode = ref<'tree' | 'hex' | 'both'>('tree')

// Modal states
const showSubjectModal = ref(false)
const showAssertionModal = ref(false)
const _showNestedEnvelopeModal = ref(false)
const showSaltModal = ref(false)
const showElideSelectModal = ref(false)
const showRecipientsModal = ref(false)
// Phase 3 modals
const showKeyManagementModal = ref(false)
const showExportModal = ref(false)
const showImportModal = ref(false)
const showTemplatesModal = ref(false)
const showTypeModal = ref(false)
const showAttachmentModal = ref(false)
const showProofModal = ref(false)

// Form states
const subjectValueType = ref<ValueType>('string')
const subjectValue = ref('')
const assertionPredicate = ref('')
const assertionValueType = ref<ValueType>('string')
const assertionValue = ref('')
const assertionIsEnvelope = ref(false)

// Salt form states
const saltMode = ref<'auto' | 'fixed' | 'range'>('auto')
const saltLength = ref(16)
const saltMin = ref(8)
const saltMax = ref(32)
const saltTargetNodeId = ref<string | null>(null)

// Elide selection states
const elideMode = ref<'remove' | 'reveal'>('reveal')
const elideSelections = ref<Record<string, boolean>>({})
const elideTargetNodeId = ref<string | null>(null)

// Recipients encryption states
const recipients = shallowRef<RecipientKey[]>([])
const encryptTargetNodeId = ref<string | null>(null)
const encryptMode = ref<'subject' | 'entire'>('entire')
const selectedRecipientIds = ref<string[]>([])

// Demo keys (generated once for session)
// Using shallowRef to preserve class private fields
const demoSigningKey = shallowRef<SigningPrivateKey | null>(null)
const demoEncryptionKey = shallowRef<SymmetricKey | null>(null)

// Phase 3: Key management state
const signingKeys = shallowRef<SigningKey[]>([])
const encryptionKeys = shallowRef<EncryptionKey[]>([])
const activeSigningKeyId = ref<string | null>(null)
const activeEncryptionKeyId = ref<string | null>(null)
const _showKeyPanel = ref(false)

// Phase 3: Export/Import state
const exportFormat = ref<ExportFormat>('hex')
const importInput = ref('')
const importFormat = ref<ExportFormat>('hex')
const importError = ref<string | null>(null)

// Phase 3: Type system state
const typeTargetNodeId = ref<string | null>(null)
const typeValue = ref('')

// Phase 3: Attachment state
const attachmentTargetNodeId = ref<string | null>(null)
const attachmentPayload = ref('')
const attachmentVendor = ref('')
const attachmentConformsTo = ref('')

// Phase 3: Proof state
const proofTargetNodeId = ref<string | null>(null)
const proofOutput = ref('')
const proofTreeOutput = ref('')
const proofHexOutput = ref('')
const proofTargetDisplay = ref('')
const proofVerified = ref(false)
const proofError = ref<string | null>(null)

// Phase 4: Undo/Redo state
const undoStack = ref<string[]>([]) // JSON stringified states
const redoStack = ref<string[]>([])
const maxHistorySize = 50

// Phase 4: Wizard state
const showWizardModal = ref(false)
const wizardStep = ref(1)
const wizardTotalSteps = 4
const wizardEnvelopeType = ref<'identity' | 'document' | 'custom'>('custom')
const wizardSubjectValue = ref('')
const wizardAssertions = ref<Array<{ predicate: string; value: string }>>([])

// Phase 4: QR Code state
const showQRModal = ref(false)
const qrCodeDataUrl = ref('')
const qrCodeError = ref<string | null>(null)

// Toast notifications
const toast = useToast()

// Helper to create a recipient with pre-computed public key hex
function createRecipient(name: string): RecipientKey {
  const privateKey = PrivateKeyBase.generate()
  // Get hex representation of public key for display
  const publicKeyHex = privateKey.publicKeys().reference().shortReference("hex")
  return {
    id: generateId(),
    name,
    privateKey,
    publicKeyHex
  }
}

// Phase 3: Helper to create signing key
function createSigningKey(name: string): SigningKey {
  const privateKey = SigningPrivateKey.random()
  const publicKeyHex = privateKey.publicKey().toString()
  return {
    id: generateId(),
    name,
    privateKey,
    publicKeyHex
  }
}

// Phase 3: Helper to create encryption key
function createEncryptionKey(name: string): EncryptionKey {
  const key = SymmetricKey.new()
  // Generate a display-only hex identifier (SymmetricKey doesn't expose .hex())
  const keyHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return {
    id: generateId(),
    name,
    key,
    keyHex
  }
}

onMounted(() => {
  demoSigningKey.value = SigningPrivateKey.random()
  demoEncryptionKey.value = SymmetricKey.new()
  // Initialize with demo recipients
  recipients.value = [
    createRecipient('Alice'),
    createRecipient('Bob')
  ]
  // Phase 3: Initialize with demo signing and encryption keys
  const defaultSigningKey = createSigningKey('Default Signer')
  signingKeys.value = [defaultSigningKey]
  activeSigningKeyId.value = defaultSigningKey.id

  const defaultEncryptionKey = createEncryptionKey('Default Key')
  encryptionKeys.value = [defaultEncryptionKey]
  activeEncryptionKeyId.value = defaultEncryptionKey.id

  loadState()
})

// Generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// Save/Load state
function saveState() {
  if (root.value) {
    localStorage.setItem('envelope-builder-state', JSON.stringify(root.value))
  } else {
    localStorage.removeItem('envelope-builder-state')
  }
}

function loadState() {
  const saved = localStorage.getItem('envelope-builder-state')
  if (saved) {
    try {
      root.value = JSON.parse(saved)
      updateOutput()
    } catch {
      // Ignore invalid state
    }
  }
}

// Watch for changes and update output
watch(root, () => {
  saveState()
  updateOutput()
}, { deep: true })

// Build actual Envelope from tree
function buildEnvelope(node: EnvelopeNode): Envelope | null {
  try {
    switch (node.type) {
      case 'subject': {
        const value = parseValue(node.valueType, node.value)
        let env = Envelope.new(value)

        // Add assertions
        for (const assertion of node.assertions ?? []) {
          if (assertion.type === 'assertion' && assertion.object) {
            const objEnv = buildEnvelope(assertion.object)
            if (objEnv) {
              env = env.addAssertion(assertion.predicate!, objEnv)
            }
          }
        }
        return env
      }

      case 'wrapped':
        if (node.child) {
          const childEnv = buildEnvelope(node.child)
          if (childEnv) {
            return Envelope.newWrapped(childEnv)
          }
        }
        return null

      case 'signed':
        if (node.child && demoSigningKey.value) {
          const childEnv = buildEnvelope(node.child)
          if (childEnv) {
            return childEnv.addSignature(demoSigningKey.value)
          }
        }
        return null

      case 'encrypted':
        if (node.child && demoEncryptionKey.value) {
          const childEnv = buildEnvelope(node.child)
          if (childEnv) {
            return childEnv.encrypt(demoEncryptionKey.value)
          }
        }
        return null

      case 'compressed':
        if (node.child) {
          const childEnv = buildEnvelope(node.child)
          if (childEnv) {
            return childEnv.compress()
          }
        }
        return null

      case 'elided':
        if (node.child) {
          const childEnv = buildEnvelope(node.child)
          if (childEnv) {
            return childEnv.elide()
          }
        }
        return null

      case 'salted':
        if (node.child) {
          const childEnv = buildEnvelope(node.child)
          if (childEnv) {
            switch (node.saltMode) {
              case 'fixed':
                return childEnv.addSaltWithLength(node.saltLength ?? 16)
              case 'range':
                return childEnv.addSaltInRange(node.saltMin ?? 8, node.saltMax ?? 32)
              default:
                return childEnv.addSalt()
            }
          }
        }
        return null

      default:
        return null
    }
  } catch (e) {
    console.error('Error building envelope:', e)
    return null
  }
}

type EnvelopeValue = string | number | bigint | boolean | null | Uint8Array

function parseValue(type: ValueType | undefined, value: unknown): EnvelopeValue {
  switch (type) {
    case 'number':
      return Number(value)
    case 'bigint':
      return BigInt(String(value).replace(/n$/, ''))
    case 'bool':
      return value === 'true' || value === true
    case 'null':
      return null
    case 'bytes': {
      const hex = String(value).replace(/^0x/, '')
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
      }
      return bytes
    }
    default:
      return String(value)
  }
}

function updateOutput() {
  if (!root.value) {
    treeOutput.value = ''
    hexOutput.value = ''
    digestOutput.value = ''
    error.value = null
    return
  }

  try {
    const envelope = buildEnvelope(root.value)
    if (envelope) {
      treeOutput.value = envelope.treeFormat()
      const bytes = envelope.cborBytes()
      hexOutput.value = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      digestOutput.value = envelope.digest().hex()
      error.value = null
    } else {
      treeOutput.value = ''
      hexOutput.value = ''
      digestOutput.value = ''
      error.value = 'Failed to build envelope'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error'
    treeOutput.value = ''
    hexOutput.value = ''
    digestOutput.value = ''
  }
}

// ============================================
// Phase 4: Undo/Redo Functions
// ============================================

let isUndoRedoAction = false // Flag to prevent saving during undo/redo

function saveToHistory() {
  if (isUndoRedoAction) return

  const state = JSON.stringify(root.value)

  // Don't save if it's the same as the last state
  if (undoStack.value.length > 0 && undoStack.value[undoStack.value.length - 1] === state) {
    return
  }

  undoStack.value.push(state)

  // Limit history size
  if (undoStack.value.length > maxHistorySize) {
    undoStack.value.shift()
  }

  // Clear redo stack when new action is performed
  redoStack.value = []
}

function undo() {
  if (undoStack.value.length <= 1) {
    toast.add({ title: 'Nothing to undo', color: 'warning', icon: 'i-heroicons-arrow-uturn-left' })
    return
  }

  isUndoRedoAction = true

  // Save current state to redo stack
  const currentState = undoStack.value.pop()!
  redoStack.value.push(currentState)

  // Restore previous state
  const previousState = undoStack.value[undoStack.value.length - 1]
  root.value = previousState ? JSON.parse(previousState) : null

  updateOutput()
  isUndoRedoAction = false

  toast.add({ title: 'Undo', color: 'info', icon: 'i-heroicons-arrow-uturn-left' })
}

function redo() {
  if (redoStack.value.length === 0) {
    toast.add({ title: 'Nothing to redo', color: 'warning', icon: 'i-heroicons-arrow-uturn-right' })
    return
  }

  isUndoRedoAction = true

  // Get state from redo stack
  const nextState = redoStack.value.pop()!
  undoStack.value.push(nextState)

  // Restore state
  root.value = JSON.parse(nextState)

  updateOutput()
  isUndoRedoAction = false

  toast.add({ title: 'Redo', color: 'info', icon: 'i-heroicons-arrow-uturn-right' })
}

const canUndo = computed(() => undoStack.value.length > 1)
const canRedo = computed(() => redoStack.value.length > 0)

// ============================================
// Phase 4: Keyboard Shortcuts
// ============================================

defineShortcuts({
  'meta_z': () => undo(),
  'meta_shift_z': () => redo(),
  'meta_y': () => redo(),
  'meta_n': () => {
    if (!root.value) openSubjectModal()
  },
  'meta_e': () => {
    if (root.value) openExportModal()
  },
  'meta_i': () => openImportModal(),
  'meta_t': () => showTemplatesModal.value = true,
  'meta_k': () => showKeyManagementModal.value = true,
  'escape': () => {
    // Close all modals
    showSubjectModal.value = false
    showAssertionModal.value = false
    showSaltModal.value = false
    showElideSelectModal.value = false
    showRecipientsModal.value = false
    showKeyManagementModal.value = false
    showExportModal.value = false
    showImportModal.value = false
    showTemplatesModal.value = false
    showTypeModal.value = false
    showAttachmentModal.value = false
    showProofModal.value = false
    showWizardModal.value = false
    showQRModal.value = false
  },
  'delete': () => {
    if (selectedNodeId.value && root.value) {
      // If selected node is root, clear it
      if (selectedNodeId.value === root.value.id) {
        saveToHistory()
        root.value = null
        selectedNodeId.value = null
        updateOutput()
        toast.add({ title: 'Envelope cleared', color: 'success' })
      }
    }
  }
})

// ============================================
// Phase 4: QR Code Generation
// ============================================

function generateQRCode() {
  if (!hexOutput.value) {
    qrCodeError.value = 'No envelope data to encode'
    return
  }

  qrCodeError.value = null

  try {
    // Create UR-encoded data for QR code (uppercase for alphanumeric mode efficiency)
    const urData = `ur:envelope/${hexOutput.value.toLowerCase()}`.toUpperCase()

    // Generate QR code using @paulmillr/qr
    const qrData = encodeQR(urData, 'raw', {
      ecc: 'low',
      border: 2
    })

    // Convert QR matrix to SVG
    const size = qrData.length
    const scale = 4
    const svgSize = size * scale

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="300" height="300">
      <rect width="${svgSize}" height="${svgSize}" fill="#ffffff"/>
      ${qrData.map((row, y) =>
        row.map((cell, x) =>
          cell ? `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="#000000"/>` : ''
        ).join('')
      ).join('')}
    </svg>`

    // Convert SVG to data URL
    qrCodeDataUrl.value = `data:image/svg+xml;base64,${btoa(svg)}`
  } catch (e) {
    console.error('QR code generation error:', e)
    qrCodeError.value = e instanceof Error ? e.message : 'Failed to generate QR code'
  }
}

function openQRModal() {
  if (!hexOutput.value) {
    toast.add({ title: 'Create an envelope first', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  showQRModal.value = true
  generateQRCode()
}

async function downloadQRCode() {
  if (!qrCodeDataUrl.value) return

  const link = document.createElement('a')
  link.download = 'envelope-qr.png'
  link.href = qrCodeDataUrl.value
  link.click()

  toast.add({ title: 'QR code downloaded', color: 'success', icon: 'i-heroicons-arrow-down-tray' })
}

// ============================================
// Phase 4: Guided Wizard Functions
// ============================================

function openWizard() {
  wizardStep.value = 1
  wizardEnvelopeType.value = 'custom'
  wizardSubjectValue.value = ''
  wizardAssertions.value = []
  showWizardModal.value = true
}

function wizardNext() {
  if (wizardStep.value < wizardTotalSteps) {
    wizardStep.value++
  }
}

function wizardBack() {
  if (wizardStep.value > 1) {
    wizardStep.value--
  }
}

function wizardAddAssertion() {
  wizardAssertions.value.push({ predicate: '', value: '' })
}

function wizardRemoveAssertion(index: number) {
  wizardAssertions.value.splice(index, 1)
}

function wizardComplete() {
  saveToHistory()

  // Create the envelope based on wizard input
  const newRoot: EnvelopeNode = {
    id: generateId(),
    type: 'subject',
    valueType: 'string',
    value: wizardSubjectValue.value || 'New Envelope',
    assertions: [],
    expanded: true
  }

  // Add assertions
  for (const assertion of wizardAssertions.value) {
    if (assertion.predicate.trim()) {
      newRoot.assertions!.push({
        id: generateId(),
        type: 'assertion',
        predicate: assertion.predicate,
        object: {
          id: generateId(),
          type: 'subject',
          valueType: 'string',
          value: assertion.value,
          expanded: true
        },
        expanded: true
      })
    }
  }

  root.value = newRoot
  showWizardModal.value = false
  updateOutput()
  saveToHistory()

  toast.add({ title: 'Envelope created with wizard', color: 'success', icon: 'i-heroicons-sparkles' })
}

// Subject creation
function openSubjectModal() {
  subjectValueType.value = 'string'
  subjectValue.value = ''
  showSubjectModal.value = true
}

function createSubject() {
  saveToHistory()
  root.value = {
    id: generateId(),
    type: 'subject',
    valueType: subjectValueType.value,
    value: subjectValue.value,
    assertions: [],
    expanded: true
  }
  showSubjectModal.value = false
  updateOutput()
  saveToHistory()
  toast.add({ title: 'Subject created', color: 'success', icon: 'i-heroicons-check-circle' })
}

// Assertion creation
function openAssertionModal(nodeId: string) {
  selectedNodeId.value = nodeId
  assertionPredicate.value = ''
  assertionValueType.value = 'string'
  assertionValue.value = ''
  assertionIsEnvelope.value = false
  showAssertionModal.value = true
}

function addAssertion() {
  if (!root.value || !selectedNodeId.value) return

  const targetNode = findNodeToAddAssertion(root.value, selectedNodeId.value)
  if (!targetNode) return

  saveToHistory()

  const assertion: EnvelopeNode = {
    id: generateId(),
    type: 'assertion',
    predicate: assertionPredicate.value,
    object: {
      id: generateId(),
      type: 'subject',
      valueType: assertionValueType.value,
      value: assertionValue.value,
      expanded: true
    },
    expanded: true
  }

  if (!targetNode.assertions) {
    targetNode.assertions = []
  }
  targetNode.assertions.push(assertion)

  showAssertionModal.value = false
  updateOutput()
  saveToHistory()
  toast.add({ title: 'Assertion added', color: 'success', icon: 'i-heroicons-check-circle' })
}

// Phase 4: Reorder assertions via drag-and-drop
function reorderAssertions(nodeId: string, newOrder: EnvelopeNode[]) {
  if (!root.value) return

  const targetNode = findNode(root.value, nodeId)
  if (!targetNode || targetNode.type !== 'subject') return

  saveToHistory()
  targetNode.assertions = newOrder
  updateOutput()
  toast.add({ title: 'Assertions reordered', color: 'success', icon: 'i-heroicons-arrows-up-down' })
}

// Find the subject node that can have assertions added
function findNodeToAddAssertion(node: EnvelopeNode, id: string): EnvelopeNode | null {
  // If this is the target
  if (node.id === id) {
    // Can only add assertions to subject nodes
    if (node.type === 'subject') return node
    // If it's a transformation, find the innermost subject
    if (node.child) return findInnermostSubject(node.child)
    return null
  }

  // Search in child
  if (node.child) {
    const found = findNodeToAddAssertion(node.child, id)
    if (found) return found
  }

  // Search in assertions
  for (const assertion of node.assertions ?? []) {
    if (assertion.id === id || assertion.object?.id === id) {
      if (assertion.object?.type === 'subject') return assertion.object
    }
    if (assertion.object) {
      const found = findNodeToAddAssertion(assertion.object, id)
      if (found) return found
    }
  }

  return null
}

function findInnermostSubject(node: EnvelopeNode): EnvelopeNode | null {
  if (node.type === 'subject') return node
  if (node.child) return findInnermostSubject(node.child)
  return null
}

// Find node by ID
function findNode(node: EnvelopeNode, id: string): EnvelopeNode | null {
  if (node.id === id) return node

  if (node.child) {
    const found = findNode(node.child, id)
    if (found) return found
  }

  for (const assertion of node.assertions ?? []) {
    const found = findNode(assertion, id)
    if (found) return found
    if (assertion.object) {
      const foundObj = findNode(assertion.object, id)
      if (foundObj) return foundObj
    }
  }

  return null
}

// Find parent node
interface ParentResult {
  parent: EnvelopeNode | null
  isChild: boolean
  assertionIndex: number
  isAssertionObject: boolean
}

function findParent(node: EnvelopeNode, targetId: string, parent: EnvelopeNode | null = null): ParentResult | null {
  if (node.id === targetId) {
    const isChild = parent?.child?.id === targetId
    const isAssertionObject = parent?.object?.id === targetId
    return { parent, isChild, assertionIndex: -1, isAssertionObject }
  }

  if (node.child) {
    if (node.child.id === targetId) {
      return { parent: node, isChild: true, assertionIndex: -1, isAssertionObject: false }
    }
    const found = findParent(node.child, targetId, node)
    if (found) return found
  }

  // Check assertion object directly
  if (node.object) {
    if (node.object.id === targetId) {
      return { parent: node, isChild: false, assertionIndex: -1, isAssertionObject: true }
    }
    const found = findParent(node.object, targetId, node)
    if (found) return found
  }

  if (node.assertions) {
    for (let i = 0; i < node.assertions.length; i++) {
      const assertion = node.assertions[i]
      if (assertion && assertion.id === targetId) {
        return { parent: node, isChild: false, assertionIndex: i, isAssertionObject: false }
      }
      if (assertion?.object) {
        if (assertion.object.id === targetId) {
          return { parent: assertion, isChild: false, assertionIndex: -1, isAssertionObject: true }
        }
        const found = findParent(assertion.object, targetId, assertion)
        if (found) return found
      }
    }
  }

  return null
}

// Transformations - now work on any node
function applyTransformation(nodeId: string, transformType: NodeType) {
  if (!root.value) return

  const node = findNode(root.value, nodeId)
  if (!node) return

  // Check if node is already this transformation type - if so, reverse it (unwrap/un-elide/etc)
  if (node.type === transformType && node.child) {
    reverseTransformation(nodeId)
    return
  }

  // If transforming root
  if (root.value.id === nodeId) {
    root.value = {
      id: generateId(),
      type: transformType,
      child: root.value,
      expanded: true
    }
    return
  }

  // Find the node and its parent
  const result = findParent(root.value, nodeId)
  if (!result || !result.parent) return

  const transformedNode: EnvelopeNode = {
    id: generateId(),
    type: transformType,
    child: node,
    expanded: true
  }

  if (result.isChild) {
    result.parent.child = transformedNode
  } else if (result.isAssertionObject) {
    // Transform assertion's object
    result.parent.object = transformedNode
  } else if (result.assertionIndex >= 0 && result.parent.assertions) {
    const assertion = result.parent.assertions[result.assertionIndex]
    if (assertion) {
      // Check if we're transforming the assertion itself
      if (assertion.id === nodeId) {
        // Replace the assertion with a transformed version
        result.parent.assertions[result.assertionIndex] = {
          id: generateId(),
          type: transformType,
          child: assertion,
          expanded: true
        }
      } else if (assertion.object?.id === nodeId) {
        // Transform assertion's object
        assertion.object = transformedNode
      }
    }
  }
}

// Reverse a transformation (unwrap, un-elide, decompress, etc.)
function reverseTransformation(nodeId: string) {
  if (!root.value) return

  const node = findNode(root.value, nodeId)
  if (!node || !node.child) return

  // If reversing root transformation
  if (root.value.id === nodeId) {
    root.value = node.child
    return
  }

  // Find the node and its parent
  const result = findParent(root.value, nodeId)
  if (!result || !result.parent) return

  if (result.isChild) {
    result.parent.child = node.child
  } else if (result.isAssertionObject) {
    result.parent.object = node.child
  } else if (result.assertionIndex >= 0 && result.parent.assertions) {
    // Restore the original assertion
    result.parent.assertions[result.assertionIndex] = node.child
  }
}

function wrapNode(nodeId: string) {
  const node = findNode(root.value!, nodeId)
  const isReversing = node?.type === 'wrapped' && !!node.child
  applyTransformation(nodeId, 'wrapped')
  toast.add({
    title: isReversing ? 'Envelope unwrapped' : 'Envelope wrapped',
    color: 'success',
    icon: isReversing ? 'i-heroicons-gift-top' : 'i-heroicons-gift'
  })
}

function unwrapNode(nodeId: string) {
  if (!root.value) return

  const node = findNode(root.value, nodeId)
  if (!node || node.type !== 'wrapped' || !node.child) return

  // If unwrapping root
  if (root.value.id === nodeId) {
    root.value = node.child
    toast.add({ title: 'Envelope unwrapped', color: 'success', icon: 'i-heroicons-gift-top' })
    return
  }

  // Find parent and replace wrapped node with its child
  const result = findParent(root.value, nodeId)
  if (!result || !result.parent) return

  if (result.isChild) {
    result.parent.child = node.child
  }
  toast.add({ title: 'Envelope unwrapped', color: 'success', icon: 'i-heroicons-gift-top' })
}

function signNode(nodeId: string) {
  if (!demoSigningKey.value) return
  const node = findNode(root.value!, nodeId)
  const isReversing = node?.type === 'signed' && !!node.child
  applyTransformation(nodeId, 'signed')
  toast.add({
    title: isReversing ? 'Signature removed' : 'Envelope signed',
    color: 'success',
    icon: 'i-heroicons-pencil-square'
  })
}

function encryptNode(nodeId: string) {
  if (!demoEncryptionKey.value) return
  const node = findNode(root.value!, nodeId)
  const isReversing = node?.type === 'encrypted' && !!node.child
  applyTransformation(nodeId, 'encrypted')
  toast.add({
    title: isReversing ? 'Envelope decrypted' : 'Envelope encrypted',
    color: 'success',
    icon: isReversing ? 'i-heroicons-lock-open' : 'i-heroicons-lock-closed'
  })
}

function compressNode(nodeId: string) {
  const node = findNode(root.value!, nodeId)
  const isReversing = node?.type === 'compressed' && !!node.child
  applyTransformation(nodeId, 'compressed')
  toast.add({
    title: isReversing ? 'Envelope decompressed' : 'Envelope compressed',
    color: 'success',
    icon: 'i-heroicons-archive-box-arrow-down'
  })
}

function elideNode(nodeId: string) {
  const node = findNode(root.value!, nodeId)
  const isReversing = node?.type === 'elided' && !!node.child
  applyTransformation(nodeId, 'elided')
  toast.add({
    title: isReversing ? 'Element revealed' : 'Element elided',
    color: 'success',
    icon: isReversing ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'
  })
}

// ============================================
// Phase 2: Salt Functions
// ============================================

function openSaltModal(nodeId: string) {
  saltTargetNodeId.value = nodeId
  saltMode.value = 'auto'
  saltLength.value = 16
  saltMin.value = 8
  saltMax.value = 32
  showSaltModal.value = true
}

function addSaltToNode() {
  if (!saltTargetNodeId.value || !root.value) return

  // Apply salt as a transformation
  const targetId = saltTargetNodeId.value

  if (root.value.id === targetId) {
    root.value = {
      id: generateId(),
      type: 'salted',
      child: root.value,
      expanded: true,
      saltMode: saltMode.value,
      saltLength: saltMode.value === 'fixed' ? saltLength.value : undefined,
      saltMin: saltMode.value === 'range' ? saltMin.value : undefined,
      saltMax: saltMode.value === 'range' ? saltMax.value : undefined
    }
  } else {
    const result = findParent(root.value, targetId)
    if (!result || !result.parent) return

    const node = findNode(root.value, targetId)
    if (!node) return

    const saltedNode: EnvelopeNode = {
      id: generateId(),
      type: 'salted',
      child: node,
      expanded: true,
      saltMode: saltMode.value,
      saltLength: saltMode.value === 'fixed' ? saltLength.value : undefined,
      saltMin: saltMode.value === 'range' ? saltMin.value : undefined,
      saltMax: saltMode.value === 'range' ? saltMax.value : undefined
    }

    if (result.isChild) {
      result.parent.child = saltedNode
    } else if (result.assertionIndex >= 0 && result.parent.assertions) {
      const assertion = result.parent.assertions[result.assertionIndex]
      if (assertion && assertion.object?.id === targetId) {
        assertion.object = saltedNode
      }
    }
  }

  showSaltModal.value = false
  toast.add({ title: 'Salt added', color: 'success', icon: 'i-heroicons-sparkles' })
}

// ============================================
// Phase 2: Selective Elision Functions
// ============================================

function openElideSelectModal(nodeId: string) {
  elideTargetNodeId.value = nodeId
  elideMode.value = 'reveal'
  elideSelections.value = {}

  // Initialize selections based on current state (elided nodes = unchecked in reveal mode)
  if (root.value) {
    initElideSelections(root.value)
  }

  showElideSelectModal.value = true
}

function initElideSelections(node: EnvelopeNode) {
  // In reveal mode: elided nodes should be unchecked, visible nodes should be checked
  // A node is "revealed" (checked) if it's not of type 'elided'
  const isElided = node.type === 'elided'
  elideSelections.value[node.id] = !isElided

  if (node.child) {
    initElideSelections(node.child)
  }

  for (const assertion of node.assertions ?? []) {
    const assertionIsElided = assertion.type === 'elided'
    elideSelections.value[assertion.id] = !assertionIsElided
    if (assertion.object) {
      initElideSelections(assertion.object)
    }
    // Also check the child of elided assertions (the original assertion)
    if (assertion.child) {
      initElideSelections(assertion.child)
    }
  }
}

function toggleElideSelection(nodeId: string) {
  elideSelections.value[nodeId] = !elideSelections.value[nodeId]
}

function applySelectiveElision() {
  if (!root.value) return

  // Create a deep copy and apply elision based on selections
  const newRoot = applyElisionToTree(JSON.parse(JSON.stringify(root.value)))
  if (newRoot) {
    root.value = newRoot
  }

  showElideSelectModal.value = false
  toast.add({ title: 'Selective elision applied', color: 'success', icon: 'i-heroicons-eye-slash' })
}

function applyElisionToTree(node: EnvelopeNode): EnvelopeNode | null {
  const shouldReveal = elideSelections.value[node.id]

  // If in "reveal" mode: selected items are revealed, others are elided
  // If in "remove" mode: selected items are elided, others are revealed
  const shouldElide = elideMode.value === 'reveal' ? !shouldReveal : shouldReveal

  // Handle UN-ELIDING: If node is currently elided but should be revealed, restore the original
  if (node.type === 'elided' && !shouldElide && node.child) {
    // Restore the original node and continue processing it
    const restoredNode = node.child
    return applyElisionToTree(restoredNode)
  }

  // Handle ELIDING: If node should be elided and isn't already
  if (shouldElide && node.type === 'subject') {
    // Elide this node
    return {
      id: generateId(),
      type: 'elided',
      child: node,
      expanded: true
    }
  }

  // Process assertions
  if (node.assertions) {
    node.assertions = node.assertions.map(assertion => {
      const assertionShouldReveal = elideSelections.value[assertion.id]
      const assertionShouldElide = elideMode.value === 'reveal' ? !assertionShouldReveal : assertionShouldReveal

      // UN-ELIDE assertion if it's currently elided but should be revealed
      if (assertion.type === 'elided' && !assertionShouldElide && assertion.child) {
        const restoredAssertion = assertion.child
        // Process the restored assertion's object
        if (restoredAssertion.object) {
          restoredAssertion.object = applyElisionToTree(restoredAssertion.object) ?? restoredAssertion.object
        }
        return restoredAssertion
      }

      // ELIDE assertion if it should be elided and isn't already
      if (assertionShouldElide && assertion.type !== 'elided') {
        return {
          ...assertion,
          id: generateId(),
          type: 'elided' as NodeType,
          child: assertion,
          object: undefined
        }
      }

      // Process assertion's object recursively
      if (assertion.object) {
        assertion.object = applyElisionToTree(assertion.object) ?? assertion.object
      }
      return assertion
    })
  }

  // Process child
  if (node.child) {
    node.child = applyElisionToTree(node.child) ?? node.child
  }

  return node
}

// Get all selectable nodes for elision UI
function getSelectableNodes(node: EnvelopeNode, depth: number = 0): Array<{ id: string; label: string; depth: number; type: NodeType; isElided: boolean }> {
  const nodes: Array<{ id: string; label: string; depth: number; type: NodeType; isElided: boolean }> = []

  // Add current node
  nodes.push({
    id: node.id,
    label: getNodeDisplayLabel(node),
    depth,
    type: node.type,
    isElided: node.type === 'elided'
  })

  // Add child (including elided node's original content)
  if (node.child) {
    nodes.push(...getSelectableNodes(node.child, depth + 1))
  }

  // Add assertions
  for (const assertion of node.assertions ?? []) {
    const isAssertionElided = assertion.type === 'elided'
    // For elided assertions, show the original predicate from the child
    const originalAssertion = isAssertionElided && assertion.child ? assertion.child : assertion
    const label = originalAssertion.predicate
      ? `${originalAssertion.predicate}: ${originalAssertion.object ? getNodeDisplayLabel(originalAssertion.object) : ''}`
      : getNodeDisplayLabel(assertion)

    nodes.push({
      id: assertion.id,
      label: isAssertionElided ? `[ELIDED] ${label}` : label,
      depth: depth + 1,
      type: isAssertionElided ? 'elided' : 'assertion',
      isElided: isAssertionElided
    })

    if (assertion.object) {
      nodes.push(...getSelectableNodes(assertion.object, depth + 2))
    }
    // Also include children of elided assertions
    if (assertion.child?.object) {
      nodes.push(...getSelectableNodes(assertion.child.object, depth + 2))
    }
  }

  return nodes
}

function getNodeDisplayLabel(node: EnvelopeNode): string {
  // For elided nodes, show the original content label with [ELIDED] prefix
  if (node.type === 'elided' && node.child) {
    return `[ELIDED] ${getNodeDisplayLabel(node.child)}`
  }
  if (node.type === 'subject') {
    if (node.valueType === 'null') return 'null'
    if (node.valueType === 'bool') return String(node.value)
    if (node.valueType === 'string') return `"${String(node.value).substring(0, 20)}${String(node.value).length > 20 ? '...' : ''}"`
    return String(node.value)
  }
  return node.type.toUpperCase()
}

// ============================================
// Phase 2: Multi-Recipient Encryption Functions
// ============================================

function openRecipientsModal(nodeId: string) {
  encryptTargetNodeId.value = nodeId
  encryptMode.value = 'entire'

  // Check if node is already encrypted with recipients - pre-select them
  if (root.value) {
    const node = findNode(root.value, nodeId)
    if (node?.type === 'encrypted' && node.recipientIds) {
      selectedRecipientIds.value = [...node.recipientIds]
    } else {
      selectedRecipientIds.value = []
    }
  } else {
    selectedRecipientIds.value = []
  }

  showRecipientsModal.value = true
}

function addRecipient() {
  const newRecipient = createRecipient(`Recipient ${recipients.value.length + 1}`)
  recipients.value = [...recipients.value, newRecipient]
  toast.add({ title: 'Recipient added', color: 'success', icon: 'i-heroicons-user-plus' })
}

function removeRecipient(recipientId: string) {
  recipients.value = recipients.value.filter(r => r.id !== recipientId)
  selectedRecipientIds.value = selectedRecipientIds.value.filter(id => id !== recipientId)
}

function toggleRecipientSelection(recipientId: string) {
  if (selectedRecipientIds.value.includes(recipientId)) {
    selectedRecipientIds.value = selectedRecipientIds.value.filter(id => id !== recipientId)
  } else {
    selectedRecipientIds.value = [...selectedRecipientIds.value, recipientId]
  }
}

function encryptToRecipients() {
  if (!encryptTargetNodeId.value || !root.value) return

  const targetId = encryptTargetNodeId.value
  const node = findNode(root.value, targetId)
  if (!node) return

  // If no recipients selected and node is already encrypted, decrypt it
  if (selectedRecipientIds.value.length === 0) {
    if (node.type === 'encrypted' && node.child) {
      // Decrypt by reversing the transformation
      reverseTransformation(targetId)
      showRecipientsModal.value = false
      toast.add({
        title: 'Envelope decrypted',
        color: 'success',
        icon: 'i-heroicons-lock-open'
      })
    } else {
      // Nothing to do - no recipients selected and not encrypted
      showRecipientsModal.value = false
    }
    return
  }

  // If the node is already encrypted, update the recipient list in place
  if (node.type === 'encrypted') {
    node.recipientCount = selectedRecipientIds.value.length
    node.recipientIds = [...selectedRecipientIds.value]
    showRecipientsModal.value = false
    toast.add({
      title: `Updated to ${selectedRecipientIds.value.length} recipient(s)`,
      color: 'success',
      icon: 'i-heroicons-lock-closed'
    })
    return
  }

  // Encrypt the node for the first time
  const encryptedNode: EnvelopeNode = {
    id: generateId(),
    type: 'encrypted',
    child: node,
    expanded: true,
    recipientCount: selectedRecipientIds.value.length,
    recipientIds: [...selectedRecipientIds.value]
  }

  if (root.value.id === targetId) {
    root.value = encryptedNode
  } else {
    const result = findParent(root.value, targetId)
    if (!result || !result.parent) return

    if (result.isChild) {
      result.parent.child = encryptedNode
    } else if (result.isAssertionObject) {
      result.parent.object = encryptedNode
    } else if (result.assertionIndex >= 0 && result.parent.assertions) {
      const assertion = result.parent.assertions[result.assertionIndex]
      if (assertion && assertion.object?.id === targetId) {
        assertion.object = encryptedNode
      }
    }
  }

  showRecipientsModal.value = false
  toast.add({
    title: `Encrypted for ${selectedRecipientIds.value.length} recipient(s)`,
    color: 'success',
    icon: 'i-heroicons-lock-closed'
  })
}

function removeNode(nodeId: string) {
  if (!root.value) return

  if (root.value.id === nodeId) {
    if (root.value.child) {
      root.value = root.value.child
    } else {
      root.value = null
    }
    toast.add({ title: 'Node removed', color: 'neutral', icon: 'i-heroicons-trash' })
    return
  }

  const result = findParent(root.value, nodeId)
  if (!result || !result.parent) return

  if (result.isChild && result.parent.child) {
    // If removing a transformation's child, remove the transformation instead
    // This is handled by removing the transformation node itself
  } else if (result.assertionIndex >= 0 && result.parent.assertions) {
    result.parent.assertions.splice(result.assertionIndex, 1)
    toast.add({ title: 'Assertion removed', color: 'neutral', icon: 'i-heroicons-trash' })
  }
}

// Clear all
function clearAll() {
  saveToHistory()
  root.value = null
  selectedNodeId.value = null
  updateOutput()
  saveToHistory()
  toast.add({ title: 'Envelope cleared', color: 'neutral', icon: 'i-heroicons-trash' })
}

// Copy to clipboard
async function copyToClipboard(text: string, label: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: `${label} copied`, color: 'success', icon: 'i-heroicons-clipboard-document-check' })
}

// Node display helpers
function getNodeIcon(type: NodeType): string {
  switch (type) {
    case 'subject': return 'i-heroicons-cube'
    case 'assertion': return 'i-heroicons-tag'
    case 'wrapped': return 'i-heroicons-gift'
    case 'signed': return 'i-heroicons-pencil-square'
    case 'encrypted': return 'i-heroicons-lock-closed'
    case 'compressed': return 'i-heroicons-archive-box-arrow-down'
    case 'elided': return 'i-heroicons-eye-slash'
    case 'salted': return 'i-heroicons-sparkles'
    default: return 'i-heroicons-document'
  }
}

function getNodeColor(type: NodeType): string {
  switch (type) {
    case 'subject': return 'text-primary-500'
    case 'assertion': return 'text-violet-500'
    case 'wrapped': return 'text-amber-500'
    case 'signed': return 'text-green-500'
    case 'encrypted': return 'text-blue-500'
    case 'compressed': return 'text-purple-500'
    case 'elided': return 'text-gray-400'
    case 'salted': return 'text-orange-500'
    default: return 'text-gray-500'
  }
}

function _getNodeBgColor(type: NodeType): string {
  switch (type) {
    case 'signed': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    case 'encrypted': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    case 'compressed': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
    case 'elided': return 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-700'
    case 'wrapped': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    case 'salted': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
    default: return ''
  }
}

function getNodeDisplay(node: EnvelopeNode): string {
  switch (node.type) {
    case 'subject':
      if (node.valueType === 'null') return 'null'
      if (node.valueType === 'bool') return String(node.value)
      if (node.valueType === 'bigint') return `${node.value}n`
      if (node.valueType === 'bytes') return `bytes(${String(node.value).length / 2})`
      if (node.valueType === 'number') return String(node.value)
      return String(node.value).length > 30
        ? `"${String(node.value).substring(0, 30)}..."`
        : `"${node.value}"`
    case 'assertion':
      return node.predicate || ''
    case 'wrapped':
      return 'WRAPPED'
    case 'signed':
      return 'SIGNED'
    case 'encrypted':
      return node.recipientCount ? `ENCRYPTED (${node.recipientCount} recipients)` : 'ENCRYPTED'
    case 'compressed':
      return 'COMPRESSED'
    case 'elided':
      return 'ELIDED'
    case 'salted':
      return 'SALTED'
    default:
      return ''
  }
}

function _getNodeLabel(type: NodeType): string {
  switch (type) {
    case 'wrapped': return 'Wrapped Envelope'
    case 'signed': return 'Signed Envelope'
    case 'encrypted': return 'Encrypted Envelope'
    case 'compressed': return 'Compressed Envelope'
    case 'elided': return 'Elided (digest only)'
    case 'salted': return 'Salted (decorrelated)'
    default: return ''
  }
}

// Check if node can have assertions added
function _canAddAssertion(node: EnvelopeNode): boolean {
  if (node.type === 'subject') return true
  if (node.child) return _canAddAssertion(node.child)
  return false
}

// Check if node is a transformation that can be removed (unwrapped)
function _canUnwrap(node: EnvelopeNode): boolean {
  return node.type === 'wrapped' && !!node.child
}

// Toggle node expansion
function toggleExpand(node: EnvelopeNode) {
  node.expanded = !node.expanded
}

// Check if node has children to expand
function _hasChildren(node: EnvelopeNode): boolean {
  return !!(node.assertions?.length || node.child)
}

// ============================================
// Phase 3: Key Management Functions
// ============================================

function addSigningKey() {
  const newKey = createSigningKey(`Signer ${signingKeys.value.length + 1}`)
  signingKeys.value = [...signingKeys.value, newKey]
  toast.add({ title: 'Signing key created', color: 'success', icon: 'i-heroicons-key' })
}

function removeSigningKey(keyId: string) {
  signingKeys.value = signingKeys.value.filter(k => k.id !== keyId)
  if (activeSigningKeyId.value === keyId) {
    activeSigningKeyId.value = signingKeys.value[0]?.id || null
  }
}

function addEncryptionKey() {
  const newKey = createEncryptionKey(`Key ${encryptionKeys.value.length + 1}`)
  encryptionKeys.value = [...encryptionKeys.value, newKey]
  toast.add({ title: 'Encryption key created', color: 'success', icon: 'i-heroicons-key' })
}

function removeEncryptionKey(keyId: string) {
  encryptionKeys.value = encryptionKeys.value.filter(k => k.id !== keyId)
  if (activeEncryptionKeyId.value === keyId) {
    activeEncryptionKeyId.value = encryptionKeys.value[0]?.id || null
  }
}

// Get active keys
const _activeSigningKey = computed(() =>
  signingKeys.value.find(k => k.id === activeSigningKeyId.value) || null
)

const _activeEncryptionKey = computed(() =>
  encryptionKeys.value.find(k => k.id === activeEncryptionKeyId.value) || null
)

// ============================================
// Phase 3: Import/Export Functions
// ============================================

function openExportModal() {
  exportFormat.value = 'hex'
  showExportModal.value = true
}

function getExportData(): string {
  if (!hexOutput.value) return ''

  switch (exportFormat.value) {
    case 'hex':
      return hexOutput.value
    case 'base64': {
      // Convert hex to base64
      const bytes = new Uint8Array(hexOutput.value.match(/.{2}/g)?.map(b => parseInt(b, 16)) || [])
      return btoa(String.fromCharCode(...bytes))
    }
    case 'tree':
      return treeOutput.value
    case 'ur': {
      // UR format: ur:envelope/<base64url>
      const urBytes = new Uint8Array(hexOutput.value.match(/.{2}/g)?.map(b => parseInt(b, 16)) || [])
      const base64url = btoa(String.fromCharCode(...urBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      return `ur:envelope/${base64url}`
    }
    default:
      return hexOutput.value
  }
}

async function copyExport() {
  const data = getExportData()
  await navigator.clipboard.writeText(data)
  toast.add({ title: `${exportFormat.value.toUpperCase()} copied`, color: 'success', icon: 'i-heroicons-clipboard-document-check' })
}

function downloadExport() {
  const data = getExportData()
  const blob = new Blob([data], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `envelope.${exportFormat.value === 'ur' ? 'ur' : exportFormat.value === 'tree' ? 'txt' : exportFormat.value}`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'File downloaded', color: 'success', icon: 'i-heroicons-arrow-down-tray' })
}

function openImportModal() {
  importInput.value = ''
  importFormat.value = 'hex'
  importError.value = null
  showImportModal.value = true
}

function importEnvelope() {
  if (!importInput.value.trim()) {
    importError.value = 'Please enter data to import'
    return
  }

  try {
    let hexData: string

    switch (importFormat.value) {
      case 'hex':
        hexData = importInput.value.trim().replace(/^0x/, '')
        break
      case 'base64': {
        const decoded = atob(importInput.value.trim())
        hexData = Array.from(decoded).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        break
      }
      case 'ur': {
        // Parse UR format: ur:envelope/<base64url>
        const urMatch = importInput.value.trim().match(/^ur:envelope\/(.+)$/i)
        if (!urMatch?.[1]) {
          importError.value = 'Invalid UR format. Expected: ur:envelope/<data>'
          return
        }
        const base64url = urMatch[1].replace(/-/g, '+').replace(/_/g, '/')
        const padding = '='.repeat((4 - base64url.length % 4) % 4)
        const urDecoded = atob(base64url + padding)
        hexData = Array.from(urDecoded).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
        break
      }
      default:
        importError.value = 'Unsupported import format'
        return
    }

    // Validate hex
    if (!/^[0-9a-fA-F]+$/.test(hexData)) {
      importError.value = 'Invalid hex data'
      return
    }

    // For now, just store the hex and show it in the output
    // TODO: Parse CBOR and reconstruct the tree (requires deeper integration)
    toast.add({
      title: 'Import successful',
      description: 'Hex data imported. Tree reconstruction not yet implemented.',
      color: 'warning',
      icon: 'i-heroicons-exclamation-triangle'
    })

    showImportModal.value = false
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Import failed'
  }
}

// ============================================
// Phase 3: Templates
// ============================================

const templates: EnvelopeTemplate[] = [
  {
    id: 'identity',
    name: 'Identity Card',
    description: 'Personal identity with name, age, and email',
    icon: 'i-heroicons-identification',
    create: () => ({
      id: generateId(),
      type: 'subject',
      valueType: 'string',
      value: 'John Smith',
      expanded: true,
      assertions: [
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'age',
          object: { id: generateId(), type: 'subject', valueType: 'number', value: 30, expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'email',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'john@example.com', expanded: true },
          expanded: true
        }
      ]
    })
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Simple invoice with amount and date',
    icon: 'i-heroicons-document-text',
    create: () => ({
      id: generateId(),
      type: 'subject',
      valueType: 'string',
      value: 'Invoice #12345',
      expanded: true,
      assertions: [
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'amount',
          object: { id: generateId(), type: 'subject', valueType: 'number', value: 1500, expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'currency',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'USD', expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'date',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: new Date().toISOString().split('T')[0], expanded: true },
          expanded: true
        }
      ]
    })
  },
  {
    id: 'certificate',
    name: 'Certificate',
    description: 'Credential certificate with issuer',
    icon: 'i-heroicons-academic-cap',
    create: () => ({
      id: generateId(),
      type: 'subject',
      valueType: 'string',
      value: 'Certificate of Completion',
      expanded: true,
      assertions: [
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'recipient',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'Alice Johnson', expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'issuer',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'Academy Inc.', expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'course',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'Blockchain Fundamentals', expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'issuedDate',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: new Date().toISOString().split('T')[0], expanded: true },
          expanded: true
        }
      ]
    })
  },
  {
    id: 'access-token',
    name: 'Access Token',
    description: 'Authorization token with permissions',
    icon: 'i-heroicons-key',
    create: () => ({
      id: generateId(),
      type: 'subject',
      valueType: 'string',
      value: 'access_token_v1',
      expanded: true,
      assertions: [
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'subject',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'user:12345', expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'permissions',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: 'read,write', expanded: true },
          expanded: true
        },
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'expiresAt',
          object: { id: generateId(), type: 'subject', valueType: 'string', value: new Date(Date.now() + 3600000).toISOString(), expanded: true },
          expanded: true
        }
      ]
    })
  }
]

function applyTemplate(template: EnvelopeTemplate) {
  saveToHistory()
  root.value = template.create()
  showTemplatesModal.value = false
  updateOutput()
  saveToHistory()
  toast.add({ title: `Template "${template.name}" applied`, color: 'success', icon: 'i-heroicons-document-duplicate' })
}

// ============================================
// Phase 3: Type System Functions
// ============================================

function openTypeModal(nodeId: string) {
  typeTargetNodeId.value = nodeId
  typeValue.value = ''
  showTypeModal.value = true
}

function addTypeToNode() {
  if (!typeTargetNodeId.value || !root.value || !typeValue.value.trim()) return

  const targetNode = findNodeToAddAssertion(root.value, typeTargetNodeId.value)
  if (!targetNode) return

  // Add type as a special assertion with 'isA' predicate
  const typeAssertion: EnvelopeNode = {
    id: generateId(),
    type: 'assertion',
    predicate: 'isA',
    object: {
      id: generateId(),
      type: 'subject',
      valueType: 'string',
      value: typeValue.value.trim(),
      expanded: true
    },
    expanded: true
  }

  if (!targetNode.assertions) {
    targetNode.assertions = []
  }
  targetNode.assertions.unshift(typeAssertion) // Add at beginning

  showTypeModal.value = false
  toast.add({ title: `Type "${typeValue.value}" added`, color: 'success', icon: 'i-heroicons-tag' })
}

// ============================================
// Phase 3: Attachments Functions
// ============================================

function openAttachmentModal(nodeId: string) {
  attachmentTargetNodeId.value = nodeId
  attachmentPayload.value = ''
  attachmentVendor.value = ''
  attachmentConformsTo.value = ''
  showAttachmentModal.value = true
}

function addAttachmentToNode() {
  if (!attachmentTargetNodeId.value || !root.value || !attachmentPayload.value.trim() || !attachmentVendor.value.trim()) return

  const targetNode = findNodeToAddAssertion(root.value, attachmentTargetNodeId.value)
  if (!targetNode) return

  // Add attachment as assertion with vendor predicate
  const attachmentAssertion: EnvelopeNode = {
    id: generateId(),
    type: 'assertion',
    predicate: `attachment:${attachmentVendor.value.trim()}`,
    object: {
      id: generateId(),
      type: 'subject',
      valueType: 'string',
      value: attachmentPayload.value.trim(),
      expanded: true,
      assertions: attachmentConformsTo.value.trim() ? [
        {
          id: generateId(),
          type: 'assertion',
          predicate: 'conformsTo',
          object: {
            id: generateId(),
            type: 'subject',
            valueType: 'string',
            value: attachmentConformsTo.value.trim(),
            expanded: true
          },
          expanded: true
        }
      ] : []
    },
    expanded: true
  }

  if (!targetNode.assertions) {
    targetNode.assertions = []
  }
  targetNode.assertions.push(attachmentAssertion)

  showAttachmentModal.value = false
  toast.add({ title: 'Attachment added', color: 'success', icon: 'i-heroicons-paper-clip' })
}

// ============================================
// Phase 3: Inclusion Proof Functions
// ============================================

// Build a target envelope from just the node itself (for proof generation)
function buildTargetEnvelope(node: EnvelopeNode): Envelope | null {
  try {
    switch (node.type) {
      case 'subject': {
        const value = parseValue(node.valueType, node.value)
        return Envelope.new(value)
      }
      case 'assertion': {
        if (node.predicate && node.object) {
          const objectEnv = buildTargetEnvelope(node.object)
          if (objectEnv) {
            return Envelope.newAssertion(node.predicate, objectEnv)
          }
        }
        return null
      }
      default:
        // For wrapped, signed, encrypted, etc., build the full envelope
        return buildEnvelope(node)
    }
  } catch (e) {
    console.error('Error building target envelope:', e)
    return null
  }
}

function openProofModal(nodeId: string) {
  proofTargetNodeId.value = nodeId
  proofOutput.value = ''
  proofTreeOutput.value = ''
  proofHexOutput.value = ''
  proofTargetDisplay.value = ''
  proofVerified.value = false
  proofError.value = null

  if (!root.value) {
    proofError.value = 'No envelope to generate proof from'
    showProofModal.value = true
    return
  }

  const targetNode = findNode(root.value, nodeId)
  if (!targetNode) {
    proofError.value = 'Target node not found'
    showProofModal.value = true
    return
  }

  // Build the full envelope
  const envelope = buildEnvelope(root.value)
  if (!envelope) {
    proofError.value = 'Failed to build envelope'
    showProofModal.value = true
    return
  }

  // Build the target envelope (just the element we want to prove exists)
  const targetEnvelope = buildTargetEnvelope(targetNode)
  if (!targetEnvelope) {
    proofError.value = 'Failed to build target envelope'
    showProofModal.value = true
    return
  }

  // Set target display info
  proofTargetDisplay.value = getNodeDisplay(targetNode)

  try {
    // Generate the cryptographic proof
    const proof = envelope.proofContainsTarget(targetEnvelope)

    if (!proof) {
      proofError.value = 'Could not generate proof - target may not be directly provable'
      // Fall back to displaying basic info
      proofOutput.value = `Target: ${getNodeDisplay(targetNode)}\n` +
        `Target Type: ${targetNode.type}\n` +
        `Root Digest: ${digestOutput.value}\n\n` +
        `Note: This element cannot be proven with a standard inclusion proof. ` +
        `This may occur for nested elements or transformed envelopes.`
      showProofModal.value = true
      return
    }

    // Get proof in tree and hex formats
    proofTreeOutput.value = proof.treeFormat()
    const proofBytes = proof.cborBytes()
    proofHexOutput.value = Array.from(proofBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Verify the proof
    const rootOnly = envelope.elide() // Create root-only reference
    proofVerified.value = rootOnly.confirmContainsTarget(targetEnvelope, proof)

    // Build combined output for legacy display
    proofOutput.value = `✓ Inclusion Proof Generated\n\n` +
      `Target: ${getNodeDisplay(targetNode)}\n` +
      `Root Digest: ${digestOutput.value}\n` +
      `Proof Digest: ${proof.digest().hex()}\n` +
      `Verified: ${proofVerified.value ? '✓ Yes' : '✗ No'}\n\n` +
      `--- Proof Structure ---\n${proofTreeOutput.value}`

  } catch (e) {
    console.error('Error generating proof:', e)
    proofError.value = `Error generating proof: ${e instanceof Error ? e.message : String(e)}`
  }

  showProofModal.value = true
}

async function copyProofTree() {
  if (proofTreeOutput.value) {
    await navigator.clipboard.writeText(proofTreeOutput.value)
    toast.add({ title: 'Proof tree copied', color: 'success', icon: 'i-heroicons-clipboard-document-check' })
  }
}

async function copyProofHex() {
  if (proofHexOutput.value) {
    await navigator.clipboard.writeText(proofHexOutput.value)
    toast.add({ title: 'Proof hex copied', color: 'success', icon: 'i-heroicons-clipboard-document-check' })
  }
}

async function copyProof() {
  if (proofOutput.value) {
    await navigator.clipboard.writeText(proofOutput.value)
    toast.add({ title: 'Proof copied', color: 'success', icon: 'i-heroicons-clipboard-document-check' })
  }
}
</script>

<template>
  <UDashboardPanel id="envelope-builder">
    <template #header>
      <UDashboardNavbar title="Envelope Builder">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <!-- Phase 4: Wizard -->
          <UTooltip text="Wizard (Create step-by-step)">
            <UButton
              icon="i-heroicons-sparkles"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="openWizard"
            />
          </UTooltip>
          <!-- Phase 4: Undo -->
          <UTooltip :text="`Undo (${isMac ? '⌘' : 'Ctrl'}+Z)`">
            <UButton
              icon="i-heroicons-arrow-uturn-left"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!canUndo"
              @click="undo"
            />
          </UTooltip>
          <!-- Phase 4: Redo -->
          <UTooltip :text="`Redo (${isMac ? '⌘' : 'Ctrl'}+Shift+Z)`">
            <UButton
              icon="i-heroicons-arrow-uturn-right"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!canRedo"
              @click="redo"
            />
          </UTooltip>
          <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <!-- Phase 3: Templates -->
          <UTooltip text="Templates">
            <UButton
              icon="i-heroicons-document-duplicate"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showTemplatesModal = true"
            />
          </UTooltip>
          <!-- Phase 3: Import -->
          <UTooltip text="Import">
            <UButton
              icon="i-heroicons-arrow-up-tray"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="openImportModal"
            />
          </UTooltip>
          <!-- Phase 3: Export -->
          <UTooltip text="Export">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!root"
              @click="openExportModal"
            />
          </UTooltip>
          <!-- Phase 4: QR Code -->
          <UTooltip text="Generate QR Code">
            <UButton
              icon="i-heroicons-qr-code"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!root"
              @click="openQRModal"
            />
          </UTooltip>
          <!-- Phase 3: Key Management -->
          <UTooltip text="Key Management">
            <UButton
              icon="i-heroicons-key"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showKeyManagementModal = true"
            />
          </UTooltip>
          <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <UFieldGroup>
            <UButton
              :color="outputMode === 'tree' ? 'primary' : 'neutral'"
              variant="soft"
              size="xs"
              @click="outputMode = 'tree'"
            >
              Tree
            </UButton>
            <UButton
              :color="outputMode === 'hex' ? 'primary' : 'neutral'"
              variant="soft"
              size="xs"
              @click="outputMode = 'hex'"
            >
              Hex
            </UButton>
            <UButton
              :color="outputMode === 'both' ? 'primary' : 'neutral'"
              variant="soft"
              size="xs"
              @click="outputMode = 'both'"
            >
              Both
            </UButton>
          </UFieldGroup>
          <UTooltip text="Clear All">
            <UButton
              icon="i-heroicons-trash"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!root"
              @click="clearAll"
            />
          </UTooltip>
          <UColorModeButton size="sm" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full">
        <!-- Builder Panel -->
        <div class="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Envelope Structure</h3>
            <div v-if="root" class="flex items-center gap-2">
              <UBadge color="primary" variant="soft" size="xs">
                <UIcon name="i-heroicons-finger-print" class="w-3 h-3 mr-1" />
                {{ digestOutput.substring(0, 8) }}...
              </UBadge>
            </div>
          </div>

          <div class="flex-1 overflow-auto p-4">
            <!-- Empty State -->
            <div v-if="!root" class="h-full flex flex-col items-center justify-center">
              <div class="text-center max-w-sm">
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-4 inline-block">
                  <UIcon name="i-heroicons-cube-transparent" class="w-8 h-8 text-gray-400" />
                </div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">No Envelope</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Start building your envelope by creating a subject or use a template
                </p>
                <div class="flex gap-2 justify-center">
                  <UButton
                    icon="i-heroicons-plus"
                    color="primary"
                    @click="openSubjectModal"
                  >
                    Add Subject
                  </UButton>
                  <UButton
                    icon="i-heroicons-document-duplicate"
                    color="neutral"
                    variant="soft"
                    @click="showTemplatesModal = true"
                  >
                    From Template
                  </UButton>
                </div>
              </div>
            </div>

            <!-- Tree View (Recursive) -->
            <div v-else class="space-y-1">
              <EnvelopeTreeNode
                :node="root"
                :depth="0"
                :selected-id="selectedNodeId"
                @select="selectedNodeId = $event"
                @toggle="toggleExpand"
                @add-assertion="openAssertionModal"
                @wrap="wrapNode"
                @unwrap="unwrapNode"
                @sign="signNode"
                @encrypt="encryptNode"
                @compress="compressNode"
                @elide="elideNode"
                @salt="openSaltModal"
                @selective-elide="openElideSelectModal"
                @multi-encrypt="openRecipientsModal"
                @remove="removeNode"
                @add-type="openTypeModal"
                @add-attachment="openAttachmentModal"
                @create-proof="openProofModal"
                @reorder-assertions="reorderAssertions"
              />
            </div>
          </div>

          <!-- Quick Actions -->
          <div v-if="root" class="px-4 py-2 border-t border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50">
            <div class="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span>Quick:</span>
              <UButton size="xs" variant="soft" color="neutral" @click="wrapNode(root.id)">
                <UIcon name="i-heroicons-gift" class="w-3 h-3 mr-1" />
                Wrap
              </UButton>
              <UButton size="xs" variant="soft" color="neutral" @click="signNode(root.id)">
                <UIcon name="i-heroicons-pencil-square" class="w-3 h-3 mr-1" />
                Sign
              </UButton>
              <UButton size="xs" variant="soft" color="neutral" @click="encryptNode(root.id)">
                <UIcon name="i-heroicons-lock-closed" class="w-3 h-3 mr-1" />
                Encrypt
              </UButton>
              <UButton size="xs" variant="soft" color="neutral" @click="openSaltModal(root.id)">
                <UIcon name="i-heroicons-sparkles" class="w-3 h-3 mr-1" />
                Salt
              </UButton>
              <UButton size="xs" variant="soft" color="neutral" @click="openElideSelectModal(root.id)">
                <UIcon name="i-heroicons-eye-slash" class="w-3 h-3 mr-1" />
                Selective Elide
              </UButton>
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

            <!-- Digest Display -->
            <div v-if="digestOutput && !error">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Digest (SHA-256)</h4>
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
            <div v-if="treeOutput && (outputMode === 'tree' || outputMode === 'both')">
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

            <!-- Hex Output -->
            <div v-if="hexOutput && (outputMode === 'hex' || outputMode === 'both')">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CBOR (Hex)</h4>
                <div class="flex items-center gap-1">
                  <UBadge color="neutral" variant="soft" size="xs">{{ hexOutput.length / 2 }} bytes</UBadge>
                  <UButton
                    icon="i-heroicons-clipboard-document"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="copyToClipboard(hexOutput, 'CBOR hex')"
                  />
                </div>
              </div>
              <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-h-48 overflow-y-auto">
                {{ hexOutput }}
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="!treeOutput && !hexOutput && !error" class="h-full flex items-center justify-center">
              <div class="text-center text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-document-text" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p class="text-sm">Build an envelope to see output</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Subject Modal -->
      <UModal v-model:open="showSubjectModal" title="Create Subject">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Subject</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <USelectMenu
                  v-model="subjectValueType"
                  :items="[
                    { label: 'String', value: 'string' },
                    { label: 'Number', value: 'number' },
                    { label: 'BigInt', value: 'bigint' },
                    { label: 'Boolean', value: 'bool' },
                    { label: 'Bytes (hex)', value: 'bytes' },
                    { label: 'Null', value: 'null' }
                  ]"
                  value-key="value"
                />
              </div>

              <div v-if="subjectValueType !== 'null'">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                <template v-if="subjectValueType === 'bool'">
                  <USelectMenu
                    v-model="subjectValue"
                    :items="[
                      { label: 'true', value: 'true' },
                      { label: 'false', value: 'false' }
                    ]"
                    value-key="value"
                  />
                </template>
                <template v-else>
                  <UInput
                    v-model="subjectValue"
                    :type="subjectValueType === 'number' ? 'number' : 'text'"
                    :placeholder="
                      subjectValueType === 'bytes' ? 'Hex string (e.g., deadbeef)' :
                      subjectValueType === 'bigint' ? 'Large integer (e.g., 9007199254740993)' :
                      'Enter value'
                    "
                  />
                </template>
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showSubjectModal = false">
                Cancel
              </UButton>
              <UButton color="primary" @click="createSubject">
                Create
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Assertion Modal -->
      <UModal v-model:open="showAssertionModal" title="Add Assertion">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Assertion</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Predicate</label>
                <UInput
                  v-model="assertionPredicate"
                  placeholder="e.g., name, age, email"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Object Type</label>
                <USelectMenu
                  v-model="assertionValueType"
                  :items="[
                    { label: 'String', value: 'string' },
                    { label: 'Number', value: 'number' },
                    { label: 'BigInt', value: 'bigint' },
                    { label: 'Boolean', value: 'bool' },
                    { label: 'Bytes (hex)', value: 'bytes' },
                    { label: 'Null', value: 'null' }
                  ]"
                  value-key="value"
                />
              </div>

              <div v-if="assertionValueType !== 'null'">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Object Value</label>
                <template v-if="assertionValueType === 'bool'">
                  <USelectMenu
                    v-model="assertionValue"
                    :items="[
                      { label: 'true', value: 'true' },
                      { label: 'false', value: 'false' }
                    ]"
                    value-key="value"
                  />
                </template>
                <template v-else>
                  <UInput
                    v-model="assertionValue"
                    :type="assertionValueType === 'number' ? 'number' : 'text'"
                    :placeholder="
                      assertionValueType === 'bytes' ? 'Hex string (e.g., deadbeef)' :
                      assertionValueType === 'bigint' ? 'Large integer' :
                      'Enter value'
                    "
                  />
                </template>
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showAssertionModal = false">
                Cancel
              </UButton>
              <UButton color="primary" :disabled="!assertionPredicate" @click="addAssertion">
                Add
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Salt Modal -->
      <UModal v-model:open="showSaltModal" title="Add Salt">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Salt</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Salt adds random data to decorrelate the envelope's digest, preventing correlation attacks.
            </p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Salt Mode</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" :class="{ 'border-primary-500 bg-primary-50 dark:bg-primary-900/20': saltMode === 'auto' }">
                    <input v-model="saltMode" type="radio" value="auto" class="sr-only" >
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-white">Auto</div>
                      <div class="text-xs text-gray-500">Let the library choose salt length automatically</div>
                    </div>
                    <UIcon v-if="saltMode === 'auto'" name="i-heroicons-check-circle-solid" class="w-5 h-5 text-primary-500" />
                  </label>

                  <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" :class="{ 'border-primary-500 bg-primary-50 dark:bg-primary-900/20': saltMode === 'fixed' }">
                    <input v-model="saltMode" type="radio" value="fixed" class="sr-only" >
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-white">Fixed Length</div>
                      <div class="text-xs text-gray-500">Specify exact salt length in bytes</div>
                    </div>
                    <UIcon v-if="saltMode === 'fixed'" name="i-heroicons-check-circle-solid" class="w-5 h-5 text-primary-500" />
                  </label>

                  <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" :class="{ 'border-primary-500 bg-primary-50 dark:bg-primary-900/20': saltMode === 'range' }">
                    <input v-model="saltMode" type="radio" value="range" class="sr-only" >
                    <div class="flex-1">
                      <div class="font-medium text-gray-900 dark:text-white">Range</div>
                      <div class="text-xs text-gray-500">Random length within min/max bounds</div>
                    </div>
                    <UIcon v-if="saltMode === 'range'" name="i-heroicons-check-circle-solid" class="w-5 h-5 text-primary-500" />
                  </label>
                </div>
              </div>

              <div v-if="saltMode === 'fixed'">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salt Length (bytes)</label>
                <UInput v-model.number="saltLength" type="number" min="1" max="256" />
              </div>

              <div v-if="saltMode === 'range'" class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Length</label>
                  <UInput v-model.number="saltMin" type="number" min="1" max="256" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Length</label>
                  <UInput v-model.number="saltMax" type="number" min="1" max="256" />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showSaltModal = false">
                Cancel
              </UButton>
              <UButton color="primary" @click="addSaltToNode">
                <UIcon name="i-heroicons-sparkles" class="w-4 h-4 mr-1" />
                Add Salt
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Elide Selection Modal -->
      <UModal v-model:open="showElideSelectModal" title="Selective Elision">
        <template #content>
          <div class="p-6 max-h-[80vh] flex flex-col">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Selective Elision</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose which parts of the envelope to reveal or hide. Elided parts become digest-only.
            </p>

            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode</label>
              <div class="flex gap-2">
                <UButton
                  :color="elideMode === 'reveal' ? 'primary' : 'neutral'"
                  :variant="elideMode === 'reveal' ? 'solid' : 'soft'"
                  size="sm"
                  @click="elideMode = 'reveal'"
                >
                  <UIcon name="i-heroicons-eye" class="w-4 h-4 mr-1" />
                  Reveal Selected
                </UButton>
                <UButton
                  :color="elideMode === 'remove' ? 'primary' : 'neutral'"
                  :variant="elideMode === 'remove' ? 'solid' : 'soft'"
                  size="sm"
                  @click="elideMode = 'remove'"
                >
                  <UIcon name="i-heroicons-eye-slash" class="w-4 h-4 mr-1" />
                  Hide Selected
                </UButton>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                {{ elideMode === 'reveal' ? 'Check items to keep visible, unchecked will be elided' : 'Check items to elide, unchecked will remain visible' }}
              </p>
            </div>

            <div class="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-900/50">
              <template v-if="root">
                <div
                  v-for="node in getSelectableNodes(root)"
                  :key="node.id"
                  :style="{ paddingLeft: `${node.depth * 16}px` }"
                  :class="[
                    'flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer',
                    node.isElided
                      ? 'bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700/80'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  ]"
                  @click="toggleElideSelection(node.id)"
                >
                  <UCheckbox
                    :model-value="elideSelections[node.id]"
                    @update:model-value="toggleElideSelection(node.id)"
                    @click.stop
                  />
                  <UIcon :name="getNodeIcon(node.type)" :class="['w-4 h-4', getNodeColor(node.type)]" />
                  <span :class="['text-sm truncate', node.isElided ? 'text-gray-400 dark:text-gray-500 italic' : 'text-gray-700 dark:text-gray-300']">
                    {{ node.label }}
                  </span>
                </div>
              </template>
            </div>

            <div class="flex justify-end gap-2 mt-4">
              <UButton color="neutral" variant="ghost" @click="showElideSelectModal = false">
                Cancel
              </UButton>
              <UButton color="primary" @click="applySelectiveElision">
                <UIcon name="i-heroicons-eye-slash" class="w-4 h-4 mr-1" />
                Apply Elision
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Recipients Modal -->
      <UModal v-model:open="showRecipientsModal" title="Multi-Recipient Encryption">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Multi-Recipient Encryption</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Encrypt the envelope so multiple recipients can decrypt it with their private keys.
            </p>

            <div class="space-y-4">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Recipients</label>
                  <UButton size="xs" variant="soft" color="primary" @click="addRecipient">
                    <UIcon name="i-heroicons-user-plus" class="w-3 h-3 mr-1" />
                    Add
                  </UButton>
                </div>
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  <div
                    v-for="recipient in recipients"
                    :key="recipient.id"
                    class="flex items-center gap-3 p-3"
                  >
                    <UCheckbox
                      :model-value="selectedRecipientIds.includes(recipient.id)"
                      @update:model-value="toggleRecipientSelection(recipient.id)"
                    />
                    <div class="flex-1">
                      <div class="font-medium text-sm text-gray-900 dark:text-white">{{ recipient.name }}</div>
                      <div class="text-xs font-mono text-gray-500 truncate">
                        {{ recipient.publicKeyHex.substring(0, 24) }}...
                      </div>
                    </div>
                    <UButton
                      icon="i-heroicons-trash"
                      size="xs"
                      color="error"
                      variant="ghost"
                      @click="removeRecipient(recipient.id)"
                    />
                  </div>
                  <div v-if="recipients.length === 0" class="p-4 text-center text-sm text-gray-500">
                    No recipients. Add recipients to enable encryption.
                  </div>
                </div>
              </div>

              <UAlert
                v-if="selectedRecipientIds.length === 0 && !(encryptTargetNodeId && root && findNode(root, encryptTargetNodeId)?.type === 'encrypted')"
                color="warning"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                title="Select at least one recipient to encrypt"
              />
              <UAlert
                v-else-if="selectedRecipientIds.length === 0 && encryptTargetNodeId && root && findNode(root, encryptTargetNodeId)?.type === 'encrypted'"
                color="info"
                variant="soft"
                icon="i-heroicons-information-circle"
                title="Unselecting all recipients will decrypt the envelope"
              />
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showRecipientsModal = false">
                Cancel
              </UButton>
              <!-- Decrypt button when already encrypted but all recipients unselected -->
              <UButton
                v-if="encryptTargetNodeId && root && findNode(root, encryptTargetNodeId)?.type === 'encrypted' && selectedRecipientIds.length === 0"
                color="warning"
                @click="encryptToRecipients"
              >
                <UIcon name="i-heroicons-lock-open" class="w-4 h-4 mr-1" />
                Decrypt
              </UButton>
              <!-- Update button when already encrypted with recipients selected -->
              <UButton
                v-else-if="encryptTargetNodeId && root && findNode(root, encryptTargetNodeId)?.type === 'encrypted' && selectedRecipientIds.length > 0"
                color="primary"
                @click="encryptToRecipients"
              >
                <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 mr-1" />
                Update ({{ selectedRecipientIds.length }})
              </UButton>
              <!-- Encrypt button for new encryption -->
              <UButton
                v-else
                color="primary"
                :disabled="selectedRecipientIds.length === 0"
                @click="encryptToRecipients"
              >
                <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 mr-1" />
                Encrypt ({{ selectedRecipientIds.length }})
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Key Management Modal -->
      <UModal v-model:open="showKeyManagementModal" title="Key Management">
        <template #content>
          <div class="p-6 max-w-lg">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Key Management</h3>

            <!-- Signing Keys -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Signing Keys</h4>
                <UButton size="xs" variant="soft" color="primary" @click="addSigningKey">
                  <UIcon name="i-heroicons-plus" class="w-3 h-3 mr-1" />
                  Add
                </UButton>
              </div>
              <div class="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                <div
                  v-for="key in signingKeys"
                  :key="key.id"
                  class="flex items-center gap-3 p-3"
                >
                  <input
                    v-model="activeSigningKeyId"
                    type="radio"
                    :value="key.id"
                    class="text-primary-500"
                  >
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-gray-900 dark:text-white">{{ key.name }}</div>
                    <div class="text-xs font-mono text-gray-500 truncate">
                      {{ key.publicKeyHex.substring(0, 32) }}...
                    </div>
                  </div>
                  <UButton
                    icon="i-heroicons-trash"
                    size="xs"
                    color="error"
                    variant="ghost"
                    :disabled="signingKeys.length === 1"
                    @click="removeSigningKey(key.id)"
                  />
                </div>
              </div>
            </div>

            <!-- Encryption Keys -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Encryption Keys (Symmetric)</h4>
                <UButton size="xs" variant="soft" color="primary" @click="addEncryptionKey">
                  <UIcon name="i-heroicons-plus" class="w-3 h-3 mr-1" />
                  Add
                </UButton>
              </div>
              <div class="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                <div
                  v-for="key in encryptionKeys"
                  :key="key.id"
                  class="flex items-center gap-3 p-3"
                >
                  <input
                    v-model="activeEncryptionKeyId"
                    type="radio"
                    :value="key.id"
                    class="text-primary-500"
                  >
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-gray-900 dark:text-white">{{ key.name }}</div>
                    <div class="text-xs font-mono text-gray-500 truncate">
                      {{ key.keyHex.substring(0, 32) }}...
                    </div>
                  </div>
                  <UButton
                    icon="i-heroicons-trash"
                    size="xs"
                    color="error"
                    variant="ghost"
                    :disabled="encryptionKeys.length === 1"
                    @click="removeEncryptionKey(key.id)"
                  />
                </div>
              </div>
            </div>

            <!-- Recipients (for multi-recipient encryption) -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Recipients (Public Keys)</h4>
                <UButton size="xs" variant="soft" color="primary" @click="addRecipient">
                  <UIcon name="i-heroicons-plus" class="w-3 h-3 mr-1" />
                  Add
                </UButton>
              </div>
              <div class="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-40 overflow-y-auto">
                <div
                  v-for="recipient in recipients"
                  :key="recipient.id"
                  class="flex items-center gap-3 p-3"
                >
                  <UIcon name="i-heroicons-user" class="w-4 h-4 text-gray-400" />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-gray-900 dark:text-white">{{ recipient.name }}</div>
                    <div class="text-xs font-mono text-gray-500 truncate">
                      {{ recipient.publicKeyHex.substring(0, 24) }}...
                    </div>
                  </div>
                  <UButton
                    icon="i-heroicons-trash"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="removeRecipient(recipient.id)"
                  />
                </div>
                <div v-if="recipients.length === 0" class="p-3 text-center text-sm text-gray-500">
                  No recipients configured
                </div>
              </div>
            </div>

            <div class="flex justify-end mt-6">
              <UButton color="primary" @click="showKeyManagementModal = false">
                Done
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Export Modal -->
      <UModal v-model:open="showExportModal" title="Export Envelope">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Envelope</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="format in ['hex', 'base64', 'tree', 'ur']"
                    :key="format"
                    :class="[
                      'p-3 rounded-lg border text-left transition-colors',
                      exportFormat === format
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    ]"
                    @click="exportFormat = format as ExportFormat"
                  >
                    <div class="font-medium text-sm text-gray-900 dark:text-white">{{ format.toUpperCase() }}</div>
                    <div class="text-xs text-gray-500">
                      {{ format === 'hex' ? 'Hexadecimal CBOR' : format === 'base64' ? 'Base64 encoded' : format === 'tree' ? 'Tree format text' : 'Uniform Resource' }}
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Output</label>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-h-40 overflow-y-auto">
                  {{ getExportData() || 'No data to export' }}
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showExportModal = false">
                Close
              </UButton>
              <UButton color="neutral" variant="soft" :disabled="!hexOutput" @click="downloadExport">
                <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
                Download
              </UButton>
              <UButton color="primary" :disabled="!hexOutput" @click="copyExport">
                <UIcon name="i-heroicons-clipboard-document" class="w-4 h-4 mr-1" />
                Copy
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Import Modal -->
      <UModal v-model:open="showImportModal" title="Import Envelope">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Envelope</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
                <UFieldGroup class="w-full">
                  <UButton
                    v-for="format in ['hex', 'base64', 'ur']"
                    :key="format"
                    :color="importFormat === format ? 'primary' : 'neutral'"
                    :variant="importFormat === format ? 'solid' : 'soft'"
                    class="flex-1"
                    @click="importFormat = format as ExportFormat"
                  >
                    {{ format.toUpperCase() }}
                  </UButton>
                </UFieldGroup>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                <UTextarea
                  v-model="importInput"
                  :placeholder="
                    importFormat === 'hex' ? 'Enter hex-encoded CBOR...' :
                    importFormat === 'base64' ? 'Enter base64-encoded data...' :
                    'Enter UR (ur:envelope/...)'"
                  :rows="5"
                />
              </div>

              <UAlert
                v-if="importError"
                color="error"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                :title="importError"
              />
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showImportModal = false">
                Cancel
              </UButton>
              <UButton color="primary" :disabled="!importInput.trim()" @click="importEnvelope">
                <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 mr-1" />
                Import
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Templates Modal -->
      <UModal v-model:open="showTemplatesModal" title="Envelope Templates">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Envelope Templates</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose a template to quickly create a pre-structured envelope.
            </p>

            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="template in templates"
                :key="template.id"
                class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
                @click="applyTemplate(template)"
              >
                <UIcon :name="template.icon" class="w-8 h-8 text-primary-500 mb-2" />
                <div class="font-medium text-gray-900 dark:text-white">{{ template.name }}</div>
                <div class="text-xs text-gray-500 mt-1">{{ template.description }}</div>
              </button>
            </div>

            <div class="flex justify-end mt-6">
              <UButton color="neutral" variant="ghost" @click="showTemplatesModal = false">
                Cancel
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Type Modal -->
      <UModal v-model:open="showTypeModal" title="Add Type">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Type</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add a semantic type classification to the envelope (e.g., Person, Invoice, Certificate).
            </p>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type Name</label>
              <UInput
                v-model="typeValue"
                placeholder="e.g., Person, Invoice, Certificate"
              />
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showTypeModal = false">
                Cancel
              </UButton>
              <UButton color="primary" :disabled="!typeValue.trim()" @click="addTypeToNode">
                <UIcon name="i-heroicons-tag" class="w-4 h-4 mr-1" />
                Add Type
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Attachment Modal -->
      <UModal v-model:open="showAttachmentModal" title="Add Attachment">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Attachment</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add vendor-specific metadata as an attachment.
            </p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor ID</label>
                <UInput
                  v-model="attachmentVendor"
                  placeholder="e.g., com.example, org.mycompany"
                />
                <p class="text-xs text-gray-500 mt-1">Use reverse domain notation</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payload</label>
                <UTextarea
                  v-model="attachmentPayload"
                  placeholder="Enter attachment content..."
                  :rows="3"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conforms To (optional)</label>
                <UInput
                  v-model="attachmentConformsTo"
                  placeholder="e.g., https://example.com/schema/v1"
                />
                <p class="text-xs text-gray-500 mt-1">URI of the schema or format specification</p>
              </div>
            </div>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showAttachmentModal = false">
                Cancel
              </UButton>
              <UButton color="primary" :disabled="!attachmentPayload.trim() || !attachmentVendor.trim()" @click="addAttachmentToNode">
                <UIcon name="i-heroicons-paper-clip" class="w-4 h-4 mr-1" />
                Add Attachment
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 3: Proof Modal -->
      <UModal v-model:open="showProofModal" title="Inclusion Proof">
        <template #content>
          <div class="p-6 max-w-2xl">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Inclusion Proof</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Cryptographic proof that an element exists in the envelope without revealing the full contents.
            </p>

            <!-- Error State -->
            <UAlert
              v-if="proofError"
              color="warning"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              :title="proofError"
              class="mb-4"
            />

            <!-- Success State -->
            <template v-if="proofTreeOutput">
              <!-- Verification Badge -->
              <div class="flex items-center gap-2 mb-4">
                <UBadge
                  :color="proofVerified ? 'success' : 'error'"
                  variant="soft"
                  size="lg"
                >
                  <UIcon :name="proofVerified ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" class="w-4 h-4 mr-1" />
                  {{ proofVerified ? 'Proof Verified' : 'Verification Failed' }}
                </UBadge>
              </div>

              <!-- Target Info -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Element</label>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-2 text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                  {{ proofTargetDisplay }}
                </div>
              </div>

              <!-- Proof Tree -->
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Proof Structure</label>
                  <UButton size="xs" color="neutral" variant="ghost" @click="copyProofTree">
                    <UIcon name="i-heroicons-clipboard-document" class="w-3 h-3 mr-1" />
                    Copy
                  </UButton>
                </div>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {{ proofTreeOutput }}
                </div>
              </div>

              <!-- Proof Hex -->
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Proof CBOR (Hex)</label>
                  <UButton size="xs" color="neutral" variant="ghost" @click="copyProofHex">
                    <UIcon name="i-heroicons-clipboard-document" class="w-3 h-3 mr-1" />
                    Copy
                  </UButton>
                </div>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300 break-all max-h-24 overflow-y-auto">
                  {{ proofHexOutput }}
                </div>
              </div>

              <!-- Root Digest Reference -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Root Digest (for verification)</label>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-2 text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                  {{ digestOutput }}
                </div>
              </div>

              <UAlert
                color="info"
                variant="soft"
                icon="i-heroicons-information-circle"
                class="mb-4"
              >
                <template #title>How to verify</template>
                <template #description>
                  Share the proof hex and root digest. The verifier can confirm the target element exists without seeing the full envelope contents.
                </template>
              </UAlert>
            </template>

            <!-- Fallback for non-provable elements -->
            <template v-else-if="proofOutput && !proofTreeOutput">
              <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
                {{ proofOutput }}
              </div>
            </template>

            <div class="flex justify-end gap-2 mt-6">
              <UButton color="neutral" variant="ghost" @click="showProofModal = false">
                Close
              </UButton>
              <UButton color="primary" :disabled="!proofOutput" @click="copyProof">
                <UIcon name="i-heroicons-clipboard-document" class="w-4 h-4 mr-1" />
                Copy All
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Phase 4: QR Code Modal -->
      <UModal v-model:open="showQRModal" title="QR Code">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Envelope QR Code</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Scan this QR code to import the envelope on another device.
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
                <img :src="qrCodeDataUrl" alt="Envelope QR Code" class="w-64 h-64" >
              </div>

              <p class="text-xs text-gray-500 text-center mb-4">
                Format: UR (Uniform Resource)
              </p>

              <div class="flex gap-2">
                <UButton color="neutral" variant="soft" @click="downloadQRCode">
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
                  Download PNG
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

      <!-- Phase 4: Wizard Modal -->
      <UModal v-model:open="showWizardModal" title="Create Envelope">
        <template #content>
          <div class="p-6 min-w-[400px]">
            <!-- Progress indicator -->
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-2">
                <div
                  v-for="step in wizardTotalSteps"
                  :key="step"
                  class="flex items-center"
                >
                  <div
                    :class="[
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                      step < wizardStep ? 'bg-primary-500 text-white' :
                      step === wizardStep ? 'bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-900' :
                      'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    ]"
                  >
                    <UIcon v-if="step < wizardStep" name="i-heroicons-check" class="w-4 h-4" />
                    <span v-else>{{ step }}</span>
                  </div>
                  <div
                    v-if="step < wizardTotalSteps"
                    :class="[
                      'w-8 h-0.5 mx-1',
                      step < wizardStep ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                    ]"
                  />
                </div>
              </div>
            </div>

            <!-- Step 1: Choose Type -->
            <div v-if="wizardStep === 1">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Choose Envelope Type</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                What kind of envelope are you creating?
              </p>

              <div class="grid grid-cols-3 gap-3">
                <button
                  v-for="type in [
                    { id: 'identity', label: 'Identity', icon: 'i-heroicons-user', desc: 'Person or entity' },
                    { id: 'document', label: 'Document', icon: 'i-heroicons-document-text', desc: 'Certificate or record' },
                    { id: 'custom', label: 'Custom', icon: 'i-heroicons-cog-6-tooth', desc: 'Build from scratch' }
                  ]"
                  :key="type.id"
                  :class="[
                    'p-4 rounded-lg border text-center transition-colors',
                    wizardEnvelopeType === type.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                  ]"
                  @click="wizardEnvelopeType = type.id as 'identity' | 'document' | 'custom'"
                >
                  <UIcon :name="type.icon" class="w-8 h-8 mx-auto mb-2 text-primary-500" />
                  <div class="font-medium text-gray-900 dark:text-white">{{ type.label }}</div>
                  <div class="text-xs text-gray-500 mt-1">{{ type.desc }}</div>
                </button>
              </div>
            </div>

            <!-- Step 2: Subject -->
            <div v-if="wizardStep === 2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Define Subject</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter the main value for your envelope.
              </p>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ wizardEnvelopeType === 'identity' ? 'Name' : wizardEnvelopeType === 'document' ? 'Title' : 'Subject Value' }}
                </label>
                <UInput
                  v-model="wizardSubjectValue"
                  :placeholder="wizardEnvelopeType === 'identity' ? 'e.g., John Smith' : wizardEnvelopeType === 'document' ? 'e.g., Certificate of Completion' : 'Enter subject value'"
                  size="lg"
                />
              </div>
            </div>

            <!-- Step 3: Assertions -->
            <div v-if="wizardStep === 3">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add Claims</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Add key-value pairs to describe your envelope (optional).
              </p>

              <div class="space-y-3 max-h-64 overflow-y-auto">
                <div
                  v-for="(assertion, index) in wizardAssertions"
                  :key="index"
                  class="flex gap-2 items-start"
                >
                  <UInput
                    v-model="assertion.predicate"
                    placeholder="Key (e.g., email)"
                    class="flex-1"
                  />
                  <UInput
                    v-model="assertion.value"
                    placeholder="Value"
                    class="flex-1"
                  />
                  <UButton
                    icon="i-heroicons-x-mark"
                    color="error"
                    variant="ghost"
                    size="sm"
                    @click="wizardRemoveAssertion(index)"
                  />
                </div>
              </div>

              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                class="mt-3"
                @click="wizardAddAssertion"
              >
                <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                Add Claim
              </UButton>
            </div>

            <!-- Step 4: Review -->
            <div v-if="wizardStep === 4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Review & Create</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Review your envelope before creating it.
              </p>

              <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div>
                  <span class="text-xs text-gray-500 uppercase">Type</span>
                  <p class="font-medium text-gray-900 dark:text-white capitalize">{{ wizardEnvelopeType }}</p>
                </div>
                <div>
                  <span class="text-xs text-gray-500 uppercase">Subject</span>
                  <p class="font-medium text-gray-900 dark:text-white">{{ wizardSubjectValue || '(empty)' }}</p>
                </div>
                <div v-if="wizardAssertions.length > 0">
                  <span class="text-xs text-gray-500 uppercase">Claims</span>
                  <ul class="mt-1 space-y-1">
                    <li
                      v-for="(a, i) in wizardAssertions.filter(x => x.predicate.trim())"
                      :key="i"
                      class="text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span class="font-medium">{{ a.predicate }}:</span> {{ a.value }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Navigation -->
            <div class="flex justify-between mt-6">
              <UButton
                v-if="wizardStep > 1"
                color="neutral"
                variant="ghost"
                @click="wizardBack"
              >
                <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
                Back
              </UButton>
              <div v-else />

              <div class="flex gap-2">
                <UButton color="neutral" variant="ghost" @click="showWizardModal = false">
                  Cancel
                </UButton>
                <UButton
                  v-if="wizardStep < wizardTotalSteps"
                  color="primary"
                  @click="wizardNext"
                >
                  Next
                  <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 ml-1" />
                </UButton>
                <UButton
                  v-else
                  color="primary"
                  @click="wizardComplete"
                >
                  <UIcon name="i-heroicons-sparkles" class="w-4 h-4 mr-1" />
                  Create Envelope
                </UButton>
              </div>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
