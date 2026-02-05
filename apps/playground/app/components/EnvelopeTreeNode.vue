<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

type ValueType = 'string' | 'number' | 'bigint' | 'bytes' | 'bool' | 'null' | 'date' | 'uuid' | 'arid' | 'uri' | 'known'
type PredicateType = 'string' | 'known'
type NodeType = 'subject' | 'assertion' | 'wrapped' | 'signed' | 'encrypted' | 'compressed' | 'elided' | 'salted'

// Known values for display
const knownValueNames: Record<string, string> = {
  isA: 'isA', id: 'id', note: 'note', name: 'name', date: 'date',
  issuer: 'issuer', holder: 'holder', controller: 'controller', entity: 'entity',
  language: 'language', dereferenceVia: 'dereferenceVia', salt: 'salt',
  hasRecipient: 'hasRecipient', validFrom: 'validFrom', validUntil: 'validUntil',
  nickname: 'nickname', vendor: 'vendor', conformsTo: 'conformsTo'
}

interface EnvelopeNode {
  id: string
  type: NodeType
  valueType?: ValueType
  value?: string | number | boolean | null
  predicate?: string
  predicateType?: PredicateType
  predicateKnownValue?: string
  salted?: boolean
  object?: EnvelopeNode
  assertions?: EnvelopeNode[]
  child?: EnvelopeNode
  expanded: boolean
  saltMode?: 'auto' | 'fixed' | 'range'
  saltLength?: number
  saltMin?: number
  saltMax?: number
  recipientCount?: number
  encryptionMode?: 'symmetric' | 'password' | 'recipient'
  signerIds?: string[]
  signingAlgorithm?: 'Ed25519' | 'Schnorr' | 'ECDSA' | 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87'
  signatureNote?: string
  sealed?: boolean
  compressSubjectOnly?: boolean
  elideAction?: 'elide' | 'encrypt' | 'compress'
}

const props = defineProps<{
  node: EnvelopeNode
  depth: number
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  toggle: [node: EnvelopeNode]
  addAssertion: [nodeId: string]
  wrap: [nodeId: string]
  unwrap: [nodeId: string]
  sign: [nodeId: string]
  encrypt: [nodeId: string]
  compress: [nodeId: string]
  elide: [nodeId: string]
  salt: [nodeId: string]
  selectiveElide: [nodeId: string]
  multiEncrypt: [nodeId: string]
  remove: [nodeId: string]
  // Phase 3
  addType: [nodeId: string]
  addAttachment: [nodeId: string]
  createProof: [nodeId: string]
  // Phase 5: Verification
  verifySignature: [nodeId: string]
  // Phase 2: Additional actions
  passwordEncrypt: [nodeId: string]
  seal: [nodeId: string]
  // Phase 3: SSKR and compress subject
  compressSubject: [nodeId: string]
  sskrSplit: [nodeId: string]
  // Phase 4
  reorderAssertions: [nodeId: string, assertions: EnvelopeNode[]]
  unelide: [nodeId: string]
  decrypt: [nodeId: string]
  decompress: [nodeId: string]
}>()

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

function getNodeBgColor(type: NodeType): string {
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
      if (node.valueType === 'date') return `date(${node.value})`
      if (node.valueType === 'uuid') return `uuid(${String(node.value).substring(0, 8)}...)`
      if (node.valueType === 'arid') return `arid(${String(node.value).substring(0, 8)}...)`
      if (node.valueType === 'uri') return String(node.value)
      if (node.valueType === 'known') {
        return knownValueNames[String(node.value)] ? `'${knownValueNames[String(node.value)]}'` : `known(${node.value})`
      }
      return String(node.value).length > 30
        ? `"${String(node.value).substring(0, 30)}..."`
        : `"${node.value}"`
    case 'assertion': {
      const predicateLabel = node.predicateType === 'known' && node.predicateKnownValue
        ? `'${knownValueNames[node.predicateKnownValue] || node.predicateKnownValue}'`
        : node.predicate || ''
      return node.salted ? `${predicateLabel} (salted)` : predicateLabel
    }
    case 'wrapped':
      return 'WRAPPED'
    case 'signed': {
      const parts = ['SIGNED']
      if (node.signingAlgorithm) parts.push(`[${node.signingAlgorithm}]`)
      if (node.signerIds && node.signerIds.length > 1) parts.push(`(${node.signerIds.length} signers)`)
      if (node.signatureNote) parts.push(`"${node.signatureNote}"`)
      return parts.join(' ')
    }
    case 'encrypted': {
      if (node.sealed) return 'SEALED (signed + encrypted)'
      if (node.encryptionMode === 'password') return 'ENCRYPTED (password)'
      if (node.encryptionMode === 'recipient' && node.recipientCount) return `ENCRYPTED (${node.recipientCount} recipients)`
      return node.recipientCount ? `ENCRYPTED (${node.recipientCount} recipients)` : 'ENCRYPTED'
    }
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

function getNodeTypeLabel(type: NodeType): string {
  const n = props.node
  switch (type) {
    case 'wrapped': return 'Wrapped Envelope'
    case 'signed': return n.signingAlgorithm ? `Signed (${n.signingAlgorithm})` : 'Signed Envelope'
    case 'encrypted': {
      if (n.sealed) return 'Sealed Envelope (signed + encrypted)'
      if (n.encryptionMode === 'password') return 'Password-Encrypted Envelope'
      if (n.encryptionMode === 'recipient') return 'Recipient-Encrypted Envelope'
      return 'Encrypted Envelope'
    }
    case 'compressed': return n.compressSubjectOnly ? 'Subject Compressed' : 'Compressed Envelope'
    case 'elided': return 'Elided (digest only)'
    case 'salted': return 'Salted (decorrelated)'
    default: return ''
  }
}

// Check if node can have assertions added
function canAddAssertion(node: EnvelopeNode): boolean {
  if (node.type === 'subject') return true
  if (node.child) return canAddAssertion(node.child)
  return false
}

// Check if node is a transformation that can be removed (unwrapped)
function canUnwrap(node: EnvelopeNode): boolean {
  return node.type === 'wrapped' && !!node.child
}

// Check if node has children to expand
function hasChildren(node: EnvelopeNode): boolean {
  return !!(node.assertions?.length || node.child)
}

const isSelected = computed(() => props.selectedId === props.node.id)

// Local assertions list for drag-and-drop
const localAssertions = computed({
  get: () => props.node.assertions ?? [],
  set: (value: EnvelopeNode[]) => {
    emit('reorderAssertions', props.node.id, value)
  }
})

// Handle drag end
function onDragEnd() {
  emit('reorderAssertions', props.node.id, localAssertions.value)
}

// Build context menu items
const menuItems = computed(() => {
  const items: Array<Array<{ label: string; icon: string; onSelect: () => void; disabled?: boolean }>> = []

  // Actions group
  const actions = []

  if (canAddAssertion(props.node)) {
    actions.push({
      label: 'Add Assertion',
      icon: 'i-heroicons-plus-circle',
      onSelect: () => emit('addAssertion', props.node.id)
    })
  }

  if (actions.length) items.push(actions)

  // Transformations group
  const transforms = [
    {
      label: 'Wrap',
      icon: 'i-heroicons-gift',
      onSelect: () => emit('wrap', props.node.id)
    },
    {
      label: 'Sign',
      icon: 'i-heroicons-pencil-square',
      onSelect: () => emit('sign', props.node.id)
    },
    {
      label: 'Encrypt',
      icon: 'i-heroicons-lock-closed',
      onSelect: () => emit('encrypt', props.node.id)
    },
    {
      label: 'Compress',
      icon: 'i-heroicons-archive-box-arrow-down',
      onSelect: () => emit('compress', props.node.id)
    },
    {
      label: 'Elide',
      icon: 'i-heroicons-eye-slash',
      onSelect: () => emit('elide', props.node.id)
    },
    {
      label: 'Salt',
      icon: 'i-heroicons-sparkles',
      onSelect: () => emit('salt', props.node.id)
    }
  ]

  if (canUnwrap(props.node)) {
    transforms.unshift({
      label: 'Unwrap',
      icon: 'i-heroicons-gift-top',
      onSelect: () => emit('unwrap', props.node.id)
    })
  }

  items.push(transforms)

  // Advanced transformations group
  const advancedTransforms = [
    {
      label: 'Selective Elision',
      icon: 'i-heroicons-adjustments-horizontal',
      onSelect: () => emit('selectiveElide', props.node.id)
    },
    {
      label: 'Multi-Recipient Encrypt',
      icon: 'i-heroicons-user-group',
      onSelect: () => emit('multiEncrypt', props.node.id)
    }
  ]

  // Add password encryption option
  advancedTransforms.push({
    label: 'Password Encrypt',
    icon: 'i-heroicons-key',
    onSelect: () => emit('passwordEncrypt', props.node.id)
  })

  // Add seal option (sign-then-encrypt)
  advancedTransforms.push({
    label: 'Seal (Sign + Encrypt)',
    icon: 'i-heroicons-shield-check',
    onSelect: () => emit('seal', props.node.id)
  })

  // Add compress subject option
  advancedTransforms.push({
    label: 'Compress Subject',
    icon: 'i-heroicons-archive-box-arrow-down',
    onSelect: () => emit('compressSubject', props.node.id)
  })

  // Add SSKR split option
  advancedTransforms.push({
    label: 'SSKR Split',
    icon: 'i-heroicons-puzzle-piece',
    onSelect: () => emit('sskrSplit', props.node.id)
  })

  // Add verify option for signed nodes
  if (props.node.type === 'signed') {
    advancedTransforms.push({
      label: 'Verify Signature',
      icon: 'i-heroicons-shield-check',
      onSelect: () => emit('verifySignature', props.node.id)
    })
  }

  // Phase 4: Unelide option for elided nodes
  if (props.node.type === 'elided') {
    advancedTransforms.push({
      label: 'Unelide',
      icon: 'i-heroicons-eye',
      onSelect: () => emit('unelide', props.node.id)
    })
  }

  // Phase 4: Decrypt option for encrypted nodes
  if (props.node.type === 'encrypted') {
    advancedTransforms.push({
      label: 'Decrypt',
      icon: 'i-heroicons-lock-open',
      onSelect: () => emit('decrypt', props.node.id)
    })
  }

  // Phase 4: Decompress option for compressed nodes
  if (props.node.type === 'compressed') {
    advancedTransforms.push({
      label: 'Decompress',
      icon: 'i-heroicons-archive-box',
      onSelect: () => emit('decompress', props.node.id)
    })
  }

  items.push(advancedTransforms)

  // Phase 3: Metadata group
  const metadataActions = []

  if (canAddAssertion(props.node)) {
    metadataActions.push(
      {
        label: 'Add Type',
        icon: 'i-heroicons-tag',
        onSelect: () => emit('addType', props.node.id)
      },
      {
        label: 'Add Attachment',
        icon: 'i-heroicons-paper-clip',
        onSelect: () => emit('addAttachment', props.node.id)
      }
    )
  }

  metadataActions.push({
    label: 'Create Proof',
    icon: 'i-heroicons-shield-check',
    onSelect: () => emit('createProof', props.node.id)
  })

  items.push(metadataActions)

  // Remove group
  if (props.node.type === 'assertion' || props.depth > 0) {
    items.push([
      {
        label: 'Remove',
        icon: 'i-heroicons-trash',
        onSelect: () => emit('remove', props.node.id)
      }
    ])
  }

  return items
})
</script>

<template>
  <div class="tree-node">
    <!-- Main Node Row -->
    <div
      :class="[
        'group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors',
        isSelected ? 'bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800/50',
        getNodeBgColor(node.type) ? `border ${getNodeBgColor(node.type)}` : ''
      ]"
      :style="{ marginLeft: `${depth * 16}px` }"
      @click="emit('select', node.id)"
    >
      <!-- Expand/Collapse Button -->
      <button
        v-if="hasChildren(node)"
        class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        @click.stop="emit('toggle', node)"
      >
        <UIcon
          :name="node.expanded ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
          class="w-3 h-3"
        />
      </button>
      <div v-else class="w-4" />

      <!-- Node Icon -->
      <UIcon
        :name="getNodeIcon(node.type)"
        :class="['w-4 h-4', getNodeColor(node.type)]"
      />

      <!-- Node Content -->
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <!-- Assertion predicate with arrow -->
        <template v-if="node.type === 'assertion'">
          <span class="text-sm font-medium text-violet-600 dark:text-violet-400">{{ node.predicate }}</span>
          <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 text-gray-400" />
        </template>

        <!-- Transformation label -->
        <template v-else-if="['wrapped', 'signed', 'encrypted', 'compressed', 'elided'].includes(node.type)">
          <span :class="['text-sm font-medium', getNodeColor(node.type)]">{{ getNodeDisplay(node) }}</span>
          <span class="text-xs text-gray-400">{{ getNodeTypeLabel(node.type) }}</span>
        </template>

        <!-- Subject value -->
        <template v-else-if="node.type === 'subject'">
          <span class="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">{{ getNodeDisplay(node) }}</span>
          <UBadge
            v-if="node.valueType"
            :color="
              node.valueType === 'string' ? 'primary' :
              node.valueType === 'number' || node.valueType === 'bigint' ? 'warning' :
              node.valueType === 'date' ? 'info' :
              node.valueType === 'uuid' || node.valueType === 'arid' ? 'success' :
              node.valueType === 'uri' ? 'info' :
              node.valueType === 'known' ? 'error' :
              'neutral'
            "
            variant="soft"
            size="xs"
          >
            {{ node.valueType }}
          </UBadge>
        </template>
      </div>

      <!-- Actions Menu -->
      <UDropdownMenu :items="menuItems" :popper="{ placement: 'bottom-end' }">
        <UButton
          icon="i-heroicons-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="xs"
          class="opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop
        />
      </UDropdownMenu>
    </div>

    <!-- Children (when expanded) -->
    <template v-if="node.expanded">
      <!-- Transformation child -->
      <EnvelopeTreeNode
        v-if="node.child"
        :node="node.child"
        :depth="depth + 1"
        :selected-id="selectedId"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @add-assertion="emit('addAssertion', $event)"
        @wrap="emit('wrap', $event)"
        @unwrap="emit('unwrap', $event)"
        @sign="emit('sign', $event)"
        @encrypt="emit('encrypt', $event)"
        @compress="emit('compress', $event)"
        @elide="emit('elide', $event)"
        @salt="emit('salt', $event)"
        @selective-elide="emit('selectiveElide', $event)"
        @multi-encrypt="emit('multiEncrypt', $event)"
        @remove="emit('remove', $event)"
        @add-type="emit('addType', $event)"
        @add-attachment="emit('addAttachment', $event)"
        @create-proof="emit('createProof', $event)"
            @verify-signature="emit('verifySignature', $event)"
            @password-encrypt="emit('passwordEncrypt', $event)"
            @seal="emit('seal', $event)"
            @compress-subject="emit('compressSubject', $event)"
            @sskr-split="emit('sskrSplit', $event)"
            @unelide="emit('unelide', $event)"
            @decrypt="emit('decrypt', $event)"
            @decompress="emit('decompress', $event)"
            @reorder-assertions="emit('reorderAssertions', $event[0] as string, $event[1] as unknown as EnvelopeNode[])"
      />

      <!-- Assertion object -->
      <EnvelopeTreeNode
        v-if="node.type === 'assertion' && node.object"
        :node="node.object"
        :depth="depth + 1"
        :selected-id="selectedId"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @add-assertion="emit('addAssertion', $event)"
        @wrap="emit('wrap', $event)"
        @unwrap="emit('unwrap', $event)"
        @sign="emit('sign', $event)"
        @encrypt="emit('encrypt', $event)"
        @compress="emit('compress', $event)"
        @elide="emit('elide', $event)"
        @salt="emit('salt', $event)"
        @selective-elide="emit('selectiveElide', $event)"
        @multi-encrypt="emit('multiEncrypt', $event)"
        @remove="emit('remove', $event)"
        @add-type="emit('addType', $event)"
        @add-attachment="emit('addAttachment', $event)"
        @create-proof="emit('createProof', $event)"
            @verify-signature="emit('verifySignature', $event)"
            @password-encrypt="emit('passwordEncrypt', $event)"
            @seal="emit('seal', $event)"
            @compress-subject="emit('compressSubject', $event)"
            @sskr-split="emit('sskrSplit', $event)"
            @unelide="emit('unelide', $event)"
            @decrypt="emit('decrypt', $event)"
            @decompress="emit('decompress', $event)"
            @reorder-assertions="emit('reorderAssertions', $event[0] as string, $event[1] as unknown as EnvelopeNode[])"
      />

      <!-- Subject assertions (draggable) -->
      <VueDraggable
        v-if="node.type === 'subject' && node.assertions?.length"
        v-model="localAssertions"
        handle=".drag-handle"
        ghost-class="opacity-50"
        :animation="200"
        @end="onDragEnd"
      >
        <div v-for="assertion in localAssertions" :key="assertion.id" class="assertion-item relative group/drag">
          <!-- Drag handle -->
          <div
            class="drag-handle absolute left-0 top-1/2 -translate-y-1/2 w-4 h-6 flex items-center justify-center cursor-grab opacity-0 group-hover/drag:opacity-100 transition-opacity"
            :style="{ marginLeft: `${(depth + 1) * 16 - 18}px` }"
          >
            <UIcon name="i-heroicons-bars-2" class="w-3.5 h-3.5 text-gray-400" />
          </div>
          <EnvelopeTreeNode
            :node="assertion"
            :depth="depth + 1"
            :selected-id="selectedId"
            @select="emit('select', $event)"
            @toggle="emit('toggle', $event)"
            @add-assertion="emit('addAssertion', $event)"
            @wrap="emit('wrap', $event)"
            @unwrap="emit('unwrap', $event)"
            @sign="emit('sign', $event)"
            @encrypt="emit('encrypt', $event)"
            @compress="emit('compress', $event)"
            @elide="emit('elide', $event)"
            @salt="emit('salt', $event)"
            @selective-elide="emit('selectiveElide', $event)"
            @multi-encrypt="emit('multiEncrypt', $event)"
            @remove="emit('remove', $event)"
            @add-type="emit('addType', $event)"
            @add-attachment="emit('addAttachment', $event)"
            @create-proof="emit('createProof', $event)"
            @verify-signature="emit('verifySignature', $event)"
            @password-encrypt="emit('passwordEncrypt', $event)"
            @seal="emit('seal', $event)"
            @compress-subject="emit('compressSubject', $event)"
            @sskr-split="emit('sskrSplit', $event)"
            @unelide="emit('unelide', $event)"
            @decrypt="emit('decrypt', $event)"
            @decompress="emit('decompress', $event)"
            @reorder-assertions="emit('reorderAssertions', $event[0] as string, $event[1] as unknown as EnvelopeNode[])"
          />
        </div>
      </VueDraggable>
    </template>
  </div>
</template>
