<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, inject, type Ref } from 'vue'
import { decodeCbor, cborData, cbor, hexToBytes, hexOpt, diagnosticOpt, MajorType, type Cbor } from '@bcts/dcbor'
import { UR, decodeBytewords, encodeBytewords, BytewordsStyle } from '@bcts/uniform-resources'
import { envelopeFromCbor } from '@bcts/envelope'
import { ENVELOPE } from '@bcts/tags'

useHead({
  title: 'Gordian Playground | BCTS',
  meta: [{ name: 'description', content: 'Parse and visualize dCBOR data with annotated hex and diagnostic notation' }],
})

// Input format options
type InputFormat = 'auto' | 'ur' | 'bytewords' | 'hex'
type OutputView = 'hex' | 'diagnostic' | 'envelope'

const inputFormatOptions = [
  { label: 'Auto-detect format', value: 'auto', icon: 'i-heroicons-sparkles' },
  { label: 'Single UR', value: 'ur', icon: 'i-heroicons-qr-code' },
  { label: 'Bytewords', value: 'bytewords', icon: 'i-heroicons-language' },
  { label: 'Hex', value: 'hex', icon: 'i-heroicons-code-bracket' },
]

// State
const inputFormat = ref<InputFormat>('auto')
const hexInput = ref('a2626964187b646e616d65684a6f686e20446f65')
const error = ref<string | null>(null)
const parsedCbor = shallowRef<Cbor | null>(null)
const annotatedHex = ref<string>('')
const diagnosticNotation = ref<string>('')
const envelopeFormat = ref<string>('')
const isEnvelopeInput = ref<boolean>(false)
const outputView = ref<OutputView>('hex')
const isInputCollapsed = ref(false)

// Detect input format automatically
function detectFormat(input: string): InputFormat {
  const trimmed = input.trim().toLowerCase()

  // Check for UR format
  if (trimmed.startsWith('ur:')) {
    return 'ur'
  }

  // Check for hex (only hex characters, optionally with 0x prefix)
  let cleanHex = input.replace(/\s/g, '')
  if (cleanHex.toLowerCase().startsWith('0x')) {
    cleanHex = cleanHex.slice(2)
  }
  if (/^[0-9a-fA-F]+$/.test(cleanHex)) {
    return 'hex'
  }

  // Check for bytewords (only lowercase letters, spaces, and hyphens)
  if (/^[a-z\s-]+$/i.test(trimmed)) {
    return 'bytewords'
  }

  return 'hex' // Default to hex
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

// Convert bytes to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
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

// Parse CBOR from input
function parseCbor() {
  error.value = null
  parsedCbor.value = null
  annotatedHex.value = ''
  diagnosticNotation.value = ''
  envelopeFormat.value = ''
  isEnvelopeInput.value = false

  const input = hexInput.value.trim()
  if (!input) {
    error.value = 'Please enter data to parse'
    return
  }

  try {
    const cborBytes = parseInput(input, inputFormat.value)
    const cbor = decodeCbor(cborBytes)
    parsedCbor.value = cbor

    isEnvelopeInput.value = cbor.type === MajorType.Tagged && cbor.tag === ENVELOPE.value

    annotatedHex.value = hexOpt(cbor, { annotate: true })
    diagnosticNotation.value = diagnosticOpt(cbor, { flat: false })

    if (isEnvelopeInput.value) {
      try {
        const freshCbor = decodeCbor(cborBytes)
        const envelope = envelopeFromCbor(freshCbor)
        envelopeFormat.value = envelope.treeFormat()
      } catch (err) {
        console.error('Failed to parse envelope structure:', err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        envelopeFormat.value = [
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
    error.value = err instanceof Error ? err.message : String(err)
  }
}

// Compute byte count from raw input
const byteCount = computed(() => {
  const input = hexInput.value.trim()
  if (!input) return 0

  const effectiveFormat = inputFormat.value === 'auto' ? detectFormat(input) : inputFormat.value

  if (effectiveFormat === 'hex') {
    let cleanHex = input.replace(/\s/g, '')
    if (cleanHex.toLowerCase().startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    return Math.ceil(cleanHex.length / 2)
  }

  try {
    const bytes = parseInput(input, inputFormat.value)
    return bytes.length
  } catch {
    return Math.ceil(input.length / 2)
  }
})

// Auto-convert input when format changes
watch(inputFormat, (newFormat, oldFormat) => {
  if (!oldFormat) return
  if (newFormat === 'auto') return
  if (newFormat === oldFormat) return

  const input = hexInput.value.trim()
  if (!input) return

  try {
    const sourceFormat = oldFormat === 'auto' ? detectFormat(input) : oldFormat
    if (sourceFormat === newFormat) return

    const bytes = parseInput(input, sourceFormat)

    let converted: string
    switch (newFormat) {
      case 'hex':
        converted = bytesToHex(bytes)
        break
      case 'ur':
        converted = bytesToUR(bytes)
        break
      case 'bytewords':
        converted = bytesToBytewords(bytes)
        break
      default:
        return
    }

    hexInput.value = converted
  } catch (err) {
    console.error('Format conversion failed:', err)
  }
})

// Auto-parse when input or format changes (debounced)
let parseTimeout: ReturnType<typeof setTimeout> | null = null
watch([hexInput, inputFormat], () => {
  if (parseTimeout) clearTimeout(parseTimeout)
  parseTimeout = setTimeout(() => {
    try {
      parseCbor()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }, 300)
})

// Handle example selection from sidebar (injected from layout)
const selectedExample = inject<Ref<{ format: 'hex' | 'ur', value: string } | null>>('selectedExample')

// Watch for example selection from sidebar
watch(selectedExample!, (example) => {
  if (example) {
    inputFormat.value = example.format
    hexInput.value = example.value
  }
})

// Handle input collapse toggle
function toggleInputCollapse() {
  isInputCollapsed.value = !isInputCollapsed.value
}

// Parse on mount
onMounted(() => {
  try {
    parseCbor()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
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
            <UColorModeButton />
            <UButton
              to="https://github.com/leonardocustodio/bcts"
              target="_blank"
              icon="i-simple-icons-github"
              color="neutral"
              variant="ghost"
              aria-label="GitHub Repository"
            />
          </template>
        </UDashboardNavbar>

        <UDashboardToolbar>
          <template #left>
            <div
              :title="isInputCollapsed ? 'Expand input panel' : 'Collapse input panel'"
              class="flex items-center justify-between gap-3 cursor-pointer hover:opacity-80 transition-opacity px-4 h-full w-full bg-blue-50 dark:bg-blue-950/30"
              @click="toggleInputCollapse"
            >
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h2 class="font-semibold text-sm text-blue-900 dark:text-blue-300">Input</h2>
                </div>
                <span class="text-xs text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">{{ byteCount }} bytes</span>
              </div>
              <UIcon v-if="isInputCollapsed" name="i-heroicons-chevron-down" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <UIcon v-else name="i-heroicons-chevron-up" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </template>

          <template #right>
            <div class="flex items-center justify-between gap-3 px-4 h-full w-full bg-green-50 dark:bg-green-950/30">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 text-green-600 dark:text-green-400" />
                <h2 class="font-semibold text-sm text-green-900 dark:text-green-300">Output</h2>
              </div>
              <UTabs
                v-model="outputView"
                :items="[
                  { label: 'Annotated Hex', value: 'hex' },
                  { label: 'Diagnostic', value: 'diagnostic' },
                  ...(isEnvelopeInput ? [{ label: 'Envelope', value: 'envelope' }] : [])
                ]"
                size="xs"
                class="w-auto"
                :ui="{ root: 'gap-0', list: 'p-0.5' }"
              />
            </div>
          </template>
        </UDashboardToolbar>
      </template>

      <template #body>
        <div :class="['w-full h-full grid overflow-hidden', isInputCollapsed ? 'grid-cols-1' : 'grid-cols-2']">
          <!-- Error Display (Top Bar) - spans both columns -->
          <div v-if="error" class="col-span-2 px-4 py-2 lg:hidden">
            <UAlert
              color="error"
              variant="solid"
              icon="i-heroicons-exclamation-triangle"
              :title="error"
            />
          </div>

          <!-- Left Panel: Input -->
          <div v-if="!isInputCollapsed" class="flex flex-col overflow-hidden bg-white dark:bg-gray-950 h-full border-r border-gray-200 dark:border-gray-800">
            <div class="px-4 pt-4 flex-shrink-0">
              <USelectMenu
                v-model="inputFormat"
                :items="inputFormatOptions"
                value-key="value"
                :search-input="false"
                :content="{ side: 'bottom', align: 'start', sideOffset: 4 }"
                class="w-full"
              />
            </div>

            <!-- Error (between selector and textarea) -->
            <div v-if="error" class="hidden lg:block px-4 pt-3">
              <UAlert
                color="error"
                variant="solid"
                icon="i-heroicons-exclamation-triangle"
                :title="error"
              />
            </div>

            <div class="flex-1 px-4 pt-3 pb-4 min-h-0 min-w-0 overflow-hidden">
              <textarea
                v-model="hexInput"
                :placeholder="inputFormat === 'ur' ? 'Enter UR string (e.g., ur:link3/...)' :
                              inputFormat === 'bytewords' ? 'Enter bytewords (e.g., able acid also...)' :
                              inputFormat === 'hex' ? 'Enter hex data (e.g., a2626964...)' :
                              'Enter data in any format (hex, UR, or bytewords)'"
                class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent overflow-auto"
                style="word-break: break-all;"
              />
            </div>
          </div>

          <!-- Right Panel: Output -->
          <div class="flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900 h-full">
            <!-- Content -->
            <div v-if="parsedCbor" class="flex-1 min-h-0 min-w-0 overflow-auto p-4">
              <pre v-if="outputView === 'hex'" class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200 max-w-full">{{ annotatedHex }}</pre>
              <pre v-else-if="outputView === 'diagnostic'" class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200 max-w-full">{{ diagnosticNotation }}</pre>
              <pre v-else-if="outputView === 'envelope'" class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200 max-w-full">{{ envelopeFormat }}</pre>
            </div>

            <!-- Empty State -->
            <div v-else class="flex-1 flex items-center justify-center p-8">
              <div class="text-center">
                <div class="bg-gray-100 dark:bg-gray-800 rounded-full p-4 mb-4 inline-block">
                  <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400 dark:text-gray-600" />
                </div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">No CBOR data parsed</h3>
                <p class="text-xs text-gray-600 dark:text-gray-400">Enter data in the input panel or select an example from the sidebar</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UDashboardPanel>
</template>
