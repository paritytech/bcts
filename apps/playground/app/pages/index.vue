<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import { decodeCbor, hexToBytes, hexOpt, diagnosticOpt, MajorType, type Cbor } from '@blockchain-commons/dcbor'
import { UR, decodeBytewords, encodeBytewords, BytewordsStyle } from '@blockchain-commons/uniform-resources'
import { envelopeFromCbor } from '@blockchain-commons/envelope'
import { ENVELOPE } from '@blockchain-commons/tags'

useHead({
  title: 'dCBOR Playground | Blockchain Commons',
  meta: [{ name: 'description', content: 'Parse and visualize dCBOR data with annotated hex and diagnostic notation' }],
})

// Input format options
type InputFormat = 'auto' | 'ur' | 'bytewords' | 'hex'

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

// Output view toggle
type OutputView = 'hex' | 'diagnostic' | 'envelope'
const outputView = ref<OutputView>('hex')

// Input panel collapse state
const isInputCollapsed = ref(false)

// Sidebar state for mobile
const isSidebarOpen = ref(false)

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

      // For envelope URs, decode bytewords directly to preserve the envelope tag (200)
      // The UR class decodes CBOR which strips the tag, but envelopes need the tag intact
      const lowercased = input.toLowerCase()
      const afterScheme = lowercased.substring(3) // Remove 'ur:'
      const [urType, ...dataParts] = afterScheme.split('/')
      const data = dataParts.join('/')

      if (urType === 'envelope') {
        // For envelope URs, the bytewords-encoded data does NOT include tag 200
        // The UR type 'envelope' implies tag 200, so we need to add it
        // This matches the Rust bc-ur behavior where UR payloads use untagged CBOR
        // and the tag is implied by the UR type
        const untaggedBytes = decodeBytewords(data, BytewordsStyle.Minimal)
        // Prepend envelope tag 200 (CBOR encoding: 0xd8 0xc8)
        const taggedBytes = new Uint8Array(2 + untaggedBytes.length)
        taggedBytes[0] = 0xd8 // Tag indicator for values 24-255
        taggedBytes[1] = 0xc8 // 200 = envelope tag
        taggedBytes.set(untaggedBytes, 2)
        return taggedBytes
      }

      // For other UR types, use the standard UR decoding
      const ur = UR.fromURString(input)
      return ur.cbor().toData()
    }

    case 'bytewords': {
      // Try different bytewords styles
      const trimmed = input.trim()

      // Detect style based on input format
      if (trimmed.includes(' ')) {
        // Standard style: words separated by spaces
        return decodeBytewords(trimmed, BytewordsStyle.Standard)
      } else if (trimmed.includes('-')) {
        // URI style: words separated by hyphens
        return decodeBytewords(trimmed, BytewordsStyle.Uri)
      } else {
        // Minimal style: 2-letter abbreviations
        return decodeBytewords(trimmed, BytewordsStyle.Minimal)
      }
    }

    case 'hex':
    default: {
      let cleanHex = input.replace(/\s/g, '')
      // Remove 0x prefix if present
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
function startsWithCborTag(bytes: Uint8Array, tagValue: number): boolean {
  if (bytes.length < 2) return false

  // CBOR tag encoding for values 24-255: 0xD8 followed by the tag value
  if (tagValue >= 24 && tagValue < 256) {
    return bytes[0] === 0xd8 && bytes[1] === tagValue
  }

  // CBOR tag encoding for values 0-23: 0xC0 | tagValue
  if (tagValue < 24) {
    return bytes[0] === (0xc0 | tagValue)
  }

  // CBOR tag encoding for values 256-65535: 0xD9 followed by two bytes
  if (tagValue >= 256 && tagValue < 65536) {
    if (bytes.length < 3) return false
    return bytes[0] === 0xd9 && bytes[1] === ((tagValue >> 8) & 0xff) && bytes[2] === (tagValue & 0xff)
  }

  return false
}

// Convert bytes to UR string
function bytesToUR(bytes: Uint8Array): string {
  try {
    // Check if bytes start with envelope tag using the ENVELOPE tag from @blockchain-commons/tags
    const isEnvelope = startsWithCborTag(bytes, ENVELOPE.value)

    if (isEnvelope) {
      // For envelopes, strip the tag 200 prefix (d8 c8) since the UR type 'envelope' implies it
      // This matches the Rust bc-ur behavior where UR payloads use untagged CBOR
      const untaggedBytes = bytes.slice(2) // Remove the 2-byte tag prefix
      return 'ur:envelope/' + encodeBytewords(untaggedBytes, BytewordsStyle.Minimal)
    }

    // For other types, decode CBOR and create a dcbor UR
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

    // Parse CBOR
    const cbor = decodeCbor(cborBytes)
    parsedCbor.value = cbor

    // Check if the CBOR data has an envelope tag (200)
    // This is more reliable than checking input format since hex can also contain envelopes
    isEnvelopeInput.value = cbor.type === MajorType.Tagged && cbor.tag === ENVELOPE.value

    // Generate annotated hex
    annotatedHex.value = hexOpt(cbor, { annotate: true })

    // Generate diagnostic notation
    diagnosticNotation.value = diagnosticOpt(cbor, { flat: false })

    // Generate envelope format if this is an envelope (has tag 200)
    if (isEnvelopeInput.value) {
      try {
        // Re-parse from bytes to ensure we have proper CBOR types (not display-optimized types)
        const freshCbor = decodeCbor(cborBytes)
        const envelope = envelopeFromCbor(freshCbor)
        envelopeFormat.value = envelope.treeFormat()
      } catch (err) {
        console.error('Failed to parse as envelope:', err)
        const errorMsg = err instanceof Error ? err.message : String(err)
        envelopeFormat.value = `Error parsing envelope:\n${errorMsg}\n\nNote: The envelope tag (200) is present and the hex/diagnostic views show the data correctly.`
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

// Compute byte count from raw input (regardless of validity)
const byteCount = computed(() => {
  const input = hexInput.value.trim()
  if (!input) return 0

  const effectiveFormat = inputFormat.value === 'auto' ? detectFormat(input) : inputFormat.value

  // For hex, count raw bytes without validation
  if (effectiveFormat === 'hex') {
    let cleanHex = input.replace(/\s/g, '')
    // Remove 0x prefix if present
    if (cleanHex.toLowerCase().startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    return Math.ceil(cleanHex.length / 2)
  }

  // For UR and bytewords, try to parse to get byte count
  try {
    const bytes = parseInput(input, inputFormat.value)
    return bytes.length
  } catch {
    // If parsing fails, estimate based on input length
    return Math.ceil(input.length / 2)
  }
})

// Auto-convert input when format changes
watch(inputFormat, (newFormat, oldFormat) => {
  // Skip if no previous format (initial load)
  if (!oldFormat) return

  // Skip if switching TO 'auto' (keep input as-is for auto-detect)
  if (newFormat === 'auto') return

  // Skip if formats are the same
  if (newFormat === oldFormat) return

  const input = hexInput.value.trim()
  if (!input) return

  try {
    // If switching FROM 'auto', detect the current format
    const sourceFormat = oldFormat === 'auto' ? detectFormat(input) : oldFormat

    // Skip if detected format is the same as target format
    if (sourceFormat === newFormat) return

    // Parse input with source format to get bytes
    const bytes = parseInput(input, sourceFormat)

    // Convert bytes to new format
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
    // If conversion fails, keep the original input
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

// Handle example selection from sidebar
function handleExampleSelect(example: { format: 'hex' | 'ur', value: string }) {
  inputFormat.value = example.format
  hexInput.value = example.value
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
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <AppHeader @toggle-sidebar="isSidebarOpen = !isSidebarOpen" />

    <!-- Main Content with Sidebar -->
    <div class="flex flex-1 overflow-hidden">
      <ExamplesSidebar
        :is-open="isSidebarOpen"
        @select="handleExampleSelect"
        @close="isSidebarOpen = false"
      />

      <main class="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 overflow-hidden relative">
        <!-- Error Display (Top Bar) -->
        <div v-if="error" class="px-4 py-2 lg:hidden">
          <UAlert
            color="error"
            variant="solid"
            icon="i-heroicons-exclamation-triangle"
            :title="error"
          />
        </div>

        <!-- Left Panel: Input -->
        <div
          :class="[
            'border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden bg-white dark:bg-gray-950 w-full',
            isInputCollapsed ? 'lg:absolute lg:z-10 lg:w-1/3' : 'lg:basis-1/3 lg:grow-0 lg:shrink-0'
          ]"
        >
          <!-- Header (always visible on both mobile and desktop) -->
          <div
            :title="isInputCollapsed ? 'Expand input panel' : 'Collapse input panel'"
            class="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-950/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            @click="isInputCollapsed = !isInputCollapsed"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 class="font-semibold text-sm text-blue-900 dark:text-blue-300">Input</h2>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">{{ byteCount }} bytes</span>
              <UIcon v-if="isInputCollapsed" name="i-heroicons-chevron-down" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <UIcon v-else name="i-heroicons-chevron-up" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <!-- Input Content (only visible when not collapsed) -->
          <template v-if="!isInputCollapsed">
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
          </template>
        </div>

        <!-- Right Panel: Output -->
        <div class="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
          <!-- Header with Toggle (always visible) -->
          <div
            :class="[
              'flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-green-50 dark:bg-green-950/30',
              isInputCollapsed ? 'lg:pl-[calc(33.333333%+1rem)]' : ''
            ]"
          >
            <div class="flex items-center gap-2 flex-shrink-0">
              <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 text-green-600 dark:text-green-400" />
              <h2 class="font-semibold text-sm text-green-900 dark:text-green-300">Output</h2>
            </div>
            <UTabs
              :items="[
                { label: 'Annotated Hex', value: 'hex' },
                { label: 'Diagnostic', value: 'diagnostic' },
                ...(isEnvelopeInput ? [{ label: 'Envelope', value: 'envelope' }] : [])
              ]"
              :model-value="outputView"
              size="xs"
              class="w-auto flex-shrink-0"
              :ui="{ root: 'gap-0', list: 'p-0.5' }"
              @update:model-value="outputView = $event as OutputView"
            />
          </div>

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
      </main>
    </div>

    <AppFooter />
  </div>
</template>
