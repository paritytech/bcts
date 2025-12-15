<script setup lang="ts">
import { ref, computed, watch, onMounted, inject, type Ref } from 'vue'
import { decodeCbor, cborData, cbor, hexToBytes, hexOpt, diagnosticOpt, MajorType, type Cbor } from '@bcts/dcbor'
import { UR, decodeBytewords, encodeBytewords, BytewordsStyle } from '@bcts/uniform-resources'
import { envelopeFromCbor } from '@bcts/envelope'
import { ENVELOPE } from '@bcts/tags'

useHead({
  title: 'Gordian Playground | BCTS',
  meta: [{ name: 'description', content: 'Parse and visualize dCBOR data with annotated hex and diagnostic notation' }],
})

// Types
type InputFormat = 'auto' | 'ur' | 'bytewords' | 'hex'
type ViewMode = 'input' | 'hex' | 'diagnostic' | 'ur' | 'bytewords' | 'envelope'

interface TabState {
  id: string
  name: string
  hexInput: string
  error: string | null
  parsedCbor: Cbor | null
  annotatedHex: string
  diagnosticNotation: string
  envelopeFormat: string
  urOutput: string
  bytewordsOutput: string
  isEnvelopeInput: boolean
  viewMode: ViewMode
}

interface PaneState {
  id: string
  tabs: TabState[]
  activeTabId: string
}

// Storage key
const STORAGE_KEY = 'bcts-playground-state'

// Serializable state for localStorage (without computed/parsed fields)
interface SerializableTabState {
  id: string
  name: string
  hexInput: string
  viewMode: ViewMode
}

interface SerializablePaneState {
  id: string
  tabs: SerializableTabState[]
  activeTabId: string
}

interface SerializableState {
  panes: SerializablePaneState[]
  activePaneId: string
  paneCounter: number
  tabCounter: number
}

// Pane and Tab management
let paneCounter = 1
let tabCounter = 1
const panes = ref<PaneState[]>([])
const activePaneId = ref<string>('')
const editingTabId = ref<string | null>(null)
const editingTabName = ref<string>('')

// Start editing a tab name
function startEditingTab(tabId: string, currentName: string) {
  editingTabId.value = tabId
  editingTabName.value = currentName
  nextTick(() => {
    const input = document.querySelector(`input[data-tab-input="${tabId}"]`) as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// Finish editing a tab name
function finishEditingTab(paneId: string, tabId: string) {
  // Guard against double execution (e.g., Enter followed by blur)
  if (editingTabId.value !== tabId) return

  const newName = editingTabName.value.trim() || 'Untitled'
  editingTabId.value = null
  editingTabName.value = ''

  const pane = panes.value.find(p => p.id === paneId)
  if (pane) {
    const tab = pane.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.name = newName
    }
  }
}

// Save state to localStorage
function saveState() {
  const state: SerializableState = {
    panes: panes.value.map(pane => ({
      id: pane.id,
      tabs: pane.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        hexInput: tab.hexInput,
        viewMode: tab.viewMode
      })),
      activeTabId: pane.activeTabId
    })),
    activePaneId: activePaneId.value,
    paneCounter,
    tabCounter
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Load state from localStorage
function loadState(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false

    const state: SerializableState = JSON.parse(saved)
    if (!state.panes || state.panes.length === 0) return false

    // Restore counters
    paneCounter = state.paneCounter || 1
    tabCounter = state.tabCounter || 1

    // Restore panes and tabs
    panes.value = state.panes.map(pane => ({
      id: pane.id,
      tabs: pane.tabs.map(tab => ({
        id: tab.id,
        name: tab.name,
        hexInput: tab.hexInput,
        error: null,
        parsedCbor: null,
        annotatedHex: '',
        diagnosticNotation: '',
        envelopeFormat: '',
        urOutput: '',
        bytewordsOutput: '',
        isEnvelopeInput: false,
        viewMode: tab.viewMode || 'input'
      })),
      activeTabId: pane.activeTabId
    }))
    activePaneId.value = state.activePaneId

    return true
  } catch (e) {
    console.error('Failed to load state from localStorage:', e)
    return false
  }
}

// Create a new tab
function createTab(name?: string, initialInput?: string): TabState {
  const id = `tab-${tabCounter++}`
  return {
    id,
    name: name || `Tab ${tabCounter - 1}`,
    hexInput: initialInput || 'a2626964187b646e616d65684a6f686e20446f65',
    error: null,
    parsedCbor: null,
    annotatedHex: '',
    diagnosticNotation: '',
    envelopeFormat: '',
    urOutput: '',
    bytewordsOutput: '',
    isEnvelopeInput: false,
    viewMode: 'input',
  }
}

// Create a new pane
function createPane(): PaneState {
  const id = `pane-${paneCounter++}`
  const initialTab = createTab('Untitled')
  return {
    id,
    tabs: [initialTab],
    activeTabId: initialTab.id,
  }
}

// Add a new pane (split view)
function addPane() {
  const newPane = createPane()
  panes.value.push(newPane)
  activePaneId.value = newPane.id
  // Parse the initial tab content
  nextTick(() => parseTabCbor(newPane.id, newPane.activeTabId))
}

// Close a pane
function closePane(paneId: string) {
  const index = panes.value.findIndex(p => p.id === paneId)
  if (index === -1) return

  // Don't close if it's the last pane
  if (panes.value.length === 1) return

  panes.value.splice(index, 1)

  // If we closed the active pane, select another one
  if (activePaneId.value === paneId && panes.value.length > 0) {
    const newIndex = Math.min(index, panes.value.length - 1)
    activePaneId.value = panes.value[newIndex]!.id
  }
}

// Add a new tab to a pane
function addTab(paneId: string) {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  const newTab = createTab()
  pane.tabs.push(newTab)
  pane.activeTabId = newTab.id
  activePaneId.value = paneId

  // Parse the new tab's content
  nextTick(() => parseTabCbor(paneId, newTab.id))
}

// Close a tab
function closeTab(paneId: string, tabId: string) {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  const index = pane.tabs.findIndex(t => t.id === tabId)
  if (index === -1) return

  // If it's the last tab in the pane, close the pane instead (if not the last pane)
  if (pane.tabs.length === 1) {
    if (panes.value.length > 1) {
      closePane(paneId)
    }
    return
  }

  pane.tabs.splice(index, 1)

  // If we closed the active tab, select another one
  if (pane.activeTabId === tabId && pane.tabs.length > 0) {
    const newIndex = Math.min(index, pane.tabs.length - 1)
    pane.activeTabId = pane.tabs[newIndex]!.id
  }
}

// Get active tab for a pane
function getActiveTab(paneId: string): TabState | undefined {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return undefined
  return pane.tabs.find(t => t.id === pane.activeTabId) as TabState | undefined
}

// Get active pane
const activePane = computed(() => panes.value.find(p => p.id === activePaneId.value))

// Detect input format automatically
function detectFormat(input: string): InputFormat {
  const trimmed = input.trim().toLowerCase()

  if (trimmed.startsWith('ur:')) {
    return 'ur'
  }

  let cleanHex = input.replace(/\s/g, '')
  if (cleanHex.toLowerCase().startsWith('0x')) {
    cleanHex = cleanHex.slice(2)
  }
  if (/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return 'hex'
  }

  if (/^[a-z\s-]+$/i.test(trimmed)) {
    return 'bytewords'
  }

  return 'hex'
}

// Parse input based on format
function parseInput(input: string, format: InputFormat): Uint8Array {
  const effectiveFormat = format === 'auto' ? detectFormat(input) : format

  switch (effectiveFormat) {
    case 'ur': {
      if (!input.toLowerCase().startsWith('ur:')) {
        throw new Error('UR string must start with "ur:"')
      }

      const afterScheme = input.substring(3)
      const firstSlash = afterScheme.indexOf('/')

      if (firstSlash === -1) {
        throw new Error('Invalid UR format: missing type/data separator')
      }

      const urType = afterScheme.substring(0, firstSlash).toLowerCase()
      const data = afterScheme.substring(firstSlash + 1)

      if (urType === 'envelope') {
        const untaggedBytes = decodeBytewords(data, BytewordsStyle.Minimal)
        const untaggedCbor = decodeCbor(untaggedBytes)
        const taggedCbor = cbor({ tag: ENVELOPE.value, value: untaggedCbor })
        return cborData(taggedCbor)
      }

      const ur = UR.fromURString(input)
      return ur.cbor().toData()
    }

    case 'bytewords': {
      const trimmed = input.trim()

      if (trimmed.includes(' ')) {
        return decodeBytewords(trimmed, BytewordsStyle.Standard)
      } else if (trimmed.includes('-')) {
        return decodeBytewords(trimmed, BytewordsStyle.Uri)
      } else {
        return decodeBytewords(trimmed, BytewordsStyle.Minimal)
      }
    }

    case 'hex':
    default: {
      let cleanHex = input.replace(/\s/g, '')
      if (cleanHex.toLowerCase().startsWith('0x')) {
        cleanHex = cleanHex.slice(2)
      }
      if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
        throw new Error('Invalid hex characters')
      }
      if (cleanHex.length % 2 !== 0) {
        throw new Error('Hex string must have even length')
      }
      return hexToBytes(cleanHex)
    }
  }
}

// Helper function to check if bytes start with a specific CBOR tag
function startsWithCborTag(bytes: Uint8Array, tagValue: number | bigint): boolean {
  if (typeof tagValue === 'bigint' && tagValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    console.warn('CBOR tag value exceeds Number.MAX_SAFE_INTEGER, precision may be lost')
  }
  const tag = typeof tagValue === 'bigint' ? Number(tagValue) : tagValue
  if (bytes.length < 2) return false

  if (tag >= 24 && tag < 256) {
    return bytes[0] === 0xd8 && bytes[1] === tag
  }

  if (tag < 24) {
    return bytes[0] === (0xc0 | tag)
  }

  if (tag >= 256 && tag < 65536) {
    if (bytes.length < 3) return false
    return bytes[0] === 0xd9 && bytes[1] === ((tag >> 8) & 0xff) && bytes[2] === (tag & 0xff)
  }

  return false
}

// Convert bytes to UR string
function bytesToUR(bytes: Uint8Array): string {
  try {
    const isEnvelope = startsWithCborTag(bytes, ENVELOPE.value)

    if (isEnvelope) {
      const untaggedBytes = bytes.slice(2)
      return 'ur:envelope/' + encodeBytewords(untaggedBytes, BytewordsStyle.Minimal)
    }

    const cbor = decodeCbor(bytes)
    const ur = UR.new('dcbor', cbor)
    return ur.string()
  } catch {
    throw new Error('Cannot convert to UR: bytes do not represent valid CBOR data')
  }
}

// Convert bytes to bytewords string
function bytesToBytewords(bytes: Uint8Array): string {
  return encodeBytewords(bytes, BytewordsStyle.Standard)
}

// Parse CBOR for a specific tab in a pane
function parseTabCbor(paneId: string, tabId: string) {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  const tab = pane.tabs.find(t => t.id === tabId)
  if (!tab) return

  tab.error = null
  tab.parsedCbor = null
  tab.annotatedHex = ''
  tab.diagnosticNotation = ''
  tab.envelopeFormat = ''
  tab.urOutput = ''
  tab.bytewordsOutput = ''
  tab.isEnvelopeInput = false

  const input = tab.hexInput.trim()
  if (!input) {
    tab.error = 'Please enter data to parse'
    return
  }

  try {
    // Always use auto-detect
    const cborBytes = parseInput(input, 'auto')
    const cbor = decodeCbor(cborBytes)
    tab.parsedCbor = cbor

    tab.isEnvelopeInput = cbor.type === MajorType.Tagged && cbor.tag === ENVELOPE.value

    tab.annotatedHex = hexOpt(cbor, { annotate: true })
    tab.diagnosticNotation = diagnosticOpt(cbor, { flat: false })

    // Generate UR output
    try {
      tab.urOutput = bytesToUR(cborBytes)
    } catch {
      tab.urOutput = '// Could not convert to UR format'
    }

    // Generate Bytewords output
    try {
      tab.bytewordsOutput = bytesToBytewords(cborBytes)
    } catch {
      tab.bytewordsOutput = '// Could not convert to Bytewords format'
    }

    if (tab.isEnvelopeInput) {
      try {
        const freshCbor = decodeCbor(cborBytes)
        const envelope = envelopeFromCbor(freshCbor)
        tab.envelopeFormat = envelope.treeFormat()
      } catch (err) {
        console.error('Failed to parse envelope structure:', err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        tab.envelopeFormat = [
          '❌ Envelope Parsing Error',
          '',
          errorMsg,
          '',
          '⚠️  The CBOR data has the envelope tag (200) but does not conform to the Gordian Envelope specification.',
          '',
          '✓ The Annotated Hex and Diagnostic views show the underlying CBOR structure correctly.',
          '✓ Use those views to inspect the raw data and identify structural issues.',
        ].join('\n')
      }
    }
  } catch (err) {
    tab.error = err instanceof Error ? err.message : String(err)
  }
}

// Compute byte count for a tab
function getByteCount(tab: TabState): number {
  const input = tab.hexInput.trim()
  if (!input) return 0

  const detectedFormat = detectFormat(input)

  if (detectedFormat === 'hex') {
    let cleanHex = input.replace(/\s/g, '')
    if (cleanHex.toLowerCase().startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    return Math.ceil(cleanHex.length / 2)
  }

  try {
    const bytes = parseInput(input, 'auto')
    return bytes.length
  } catch {
    return Math.ceil(input.length / 2)
  }
}

// Watch for input changes on all tabs (debounced)
const parseTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleTabParse(paneId: string, tabId: string) {
  const key = `${paneId}-${tabId}`
  if (parseTimeouts.has(key)) {
    clearTimeout(parseTimeouts.get(key))
  }
  parseTimeouts.set(key, setTimeout(() => {
    parseTabCbor(paneId, tabId)
    parseTimeouts.delete(key)
  }, 300))
}

// Watch all panes for changes
watch(panes, () => {
  for (const pane of panes.value) {
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId)
    if (activeTab) {
      scheduleTabParse(pane.id, activeTab.id)
    }
  }
}, { deep: true })

// Handle example selection from sidebar (injected from layout)
const selectedExample = inject<Ref<{ name: string, format: 'hex' | 'ur', value: string } | null>>('selectedExample')

// Watch for example selection from sidebar
watch(selectedExample!, (example) => {
  if (example && activePane.value) {
    // Create a new tab with the example content
    const newTab = createTab(example.name, example.value)
    activePane.value.tabs.push(newTab)
    activePane.value.activeTabId = newTab.id

    // Parse the new tab's content
    nextTick(() => parseTabCbor(activePane.value!.id, newTab.id))

    // Reset the selected example to allow re-selecting the same example
    selectedExample!.value = null
  }
})

// Initialize with one pane
onMounted(() => {
  // Try to load saved state from localStorage
  const loaded = loadState()

  if (loaded) {
    // Parse all tabs from the loaded state
    nextTick(() => {
      for (const pane of panes.value) {
        for (const tab of pane.tabs) {
          parseTabCbor(pane.id, tab.id)
        }
      }
    })
  } else {
    // No saved state, create initial pane
    const initialPane = createPane()
    panes.value.push(initialPane)
    activePaneId.value = initialPane.id
    nextTick(() => parseTabCbor(initialPane.id, initialPane.activeTabId))
  }
})

// Watch for changes and save to localStorage
watch(
  panes,
  () => {
    saveState()
  },
  { deep: true }
)

watch(activePaneId, () => {
  saveState()
})
</script>

<template>
  <UDashboardPanel id="playground">
    <template #header>
      <UDashboardNavbar title="Gordian Playground">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UTooltip text="Split View">
            <UButton
              icon="i-heroicons-view-columns"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Add Split View"
              @click="addPane"
            />
          </UTooltip>
          <UColorModeButton size="sm" />
          <UButton
            to="https://github.com/leonardocustodio/bcts"
            target="_blank"
            icon="i-simple-icons-github"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="GitHub Repository"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Split View Container -->
      <div class="w-full h-full flex overflow-hidden">
        <!-- Each Pane -->
        <div
          v-for="(pane, paneIndex) in panes"
          :key="pane.id"
          :class="[
            'flex flex-col overflow-hidden h-full',
            paneIndex > 0 ? 'border-l-2 border-gray-300 dark:border-gray-700' : '',
            panes.length > 1 ? 'flex-1 min-w-0' : 'w-full'
          ]"
          @click="activePaneId = pane.id"
        >
          <!-- Tab Bar -->
          <div
            :class="[
              'flex items-center border-b border-gray-200 dark:border-gray-800',
              activePaneId === pane.id ? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800'
            ]"
          >
            <div class="flex-1 flex items-center overflow-x-auto">
              <div
                v-for="tab in pane.tabs"
                :key="tab.id"
                :class="[
                  'group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-200 dark:border-gray-800 min-w-[100px] max-w-[160px]',
                  pane.activeTabId === tab.id
                    ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                ]"
                @click.stop="pane.activeTabId = tab.id; activePaneId = pane.id"
              >
                <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5 flex-shrink-0" />
                <input
                  v-if="editingTabId === tab.id"
                  v-model="editingTabName"
                  :data-tab-input="tab.id"
                  type="text"
                  class="truncate flex-1 bg-transparent border-none outline-none text-xs p-0 m-0 w-full"
                  @blur="finishEditingTab(pane.id, tab.id)"
                  @keydown.enter="finishEditingTab(pane.id, tab.id)"
                  @keydown.escape="editingTabId = null"
                  @click.stop
                >
                <span
                  v-else
                  class="truncate flex-1"
                  @dblclick.stop="startEditingTab(tab.id, tab.name)"
                >{{ tab.name }}</span>
                <UButton
                  icon="i-heroicons-x-mark"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="opacity-0 group-hover:opacity-100 -mr-1"
                  :ui="{ base: 'p-0' }"
                  @click.stop="closeTab(pane.id, tab.id)"
                />
              </div>
            </div>
            <div class="flex items-center">
              <UButton
                icon="i-heroicons-plus"
                size="xs"
                color="neutral"
                variant="ghost"
                class="mx-1"
                @click.stop="addTab(pane.id)"
              />
              <UButton
                v-if="panes.length > 1"
                icon="i-heroicons-x-mark"
                size="xs"
                color="neutral"
                variant="ghost"
                class="mr-1"
                @click.stop="closePane(pane.id)"
              />
            </div>
          </div>

          <!-- Active Tab Content -->
          <template v-if="getActiveTab(pane.id)">
            <div
              v-for="tab in pane.tabs"
              v-show="tab.id === pane.activeTabId"
              :key="tab.id"
              class="flex-1 flex flex-col overflow-hidden"
            >
              <!-- Error Display -->
              <div v-if="tab.error && tab.viewMode !== 'input'" class="px-3 py-1.5">
                <UAlert
                  color="error"
                  variant="solid"
                  icon="i-heroicons-exclamation-triangle"
                  :title="tab.error"
                  :ui="{ title: 'text-xs' }"
                />
              </div>

              <!-- Main Content: Single Container -->
              <div class="flex-1 flex flex-col overflow-hidden">
                <!-- Input View -->
                <div v-if="tab.viewMode === 'input'" class="flex-1 min-h-0 min-w-0 overflow-hidden bg-white dark:bg-gray-950">
                  <textarea
                    v-model="tab.hexInput"
                    placeholder="Enter data (hex, UR, or bytewords)"
                    class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-950 p-3 focus:outline-none overflow-auto"
                    style="word-break: break-all;"
                  />
                </div>

                <!-- Output Views -->
                <div v-else class="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
                  <div v-if="tab.parsedCbor" class="flex-1 min-h-0 min-w-0 overflow-auto p-3">
                    <pre v-if="tab.viewMode === 'hex'" class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200 max-w-full">{{ tab.annotatedHex }}</pre>
                    <pre v-else-if="tab.viewMode === 'diagnostic'" class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200 max-w-full">{{ tab.diagnosticNotation }}</pre>
                    <pre v-else-if="tab.viewMode === 'ur'" class="font-mono text-xs whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200 max-w-full">{{ tab.urOutput }}</pre>
                    <pre v-else-if="tab.viewMode === 'bytewords'" class="font-mono text-xs whitespace-pre-wrap text-gray-800 dark:text-gray-200 max-w-full">{{ tab.bytewordsOutput }}</pre>
                    <pre v-else-if="tab.viewMode === 'envelope'" class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200 max-w-full">{{ tab.envelopeFormat }}</pre>
                  </div>

                  <!-- Empty State -->
                  <div v-else class="flex-1 flex items-center justify-center p-4">
                    <div class="text-center">
                      <div class="bg-gray-100 dark:bg-gray-800 rounded-full p-3 mb-2 inline-block">
                        <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-gray-400 dark:text-gray-600" />
                      </div>
                      <h3 class="text-xs font-semibold text-gray-900 dark:text-white mb-1">No data</h3>
                      <p class="text-xs text-gray-600 dark:text-gray-400">Enter data in the Input view</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Status Bar -->
              <div class="flex items-center justify-between px-2 py-0.5 border-t border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-3">
                  <span>{{ getByteCount(tab) }} bytes</span>
                  <span v-if="tab.parsedCbor">CBOR</span>
                  <span v-if="tab.isEnvelopeInput" class="text-blue-600 dark:text-blue-400">Envelope</span>
                </div>
                <UTabs
                  v-model="tab.viewMode"
                  :items="[
                    { label: 'Input', value: 'input' },
                    { label: 'Hex', value: 'hex' },
                    { label: 'UR', value: 'ur' },
                    { label: 'Bytewords', value: 'bytewords' },
                    ...(tab.isEnvelopeInput ? [{ label: 'Envelope', value: 'envelope' }] : []),
                    { label: 'Diagnostic', value: 'diagnostic' }
                  ]"
                  size="xs"
                  class="w-auto"
                  :ui="{ root: 'gap-0', list: 'p-0' }"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
