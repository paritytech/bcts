<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject, nextTick, type Ref } from 'vue'
import { decodeCbor, cborData, cbor, hexToBytes, hexOpt, diagnosticOpt, MajorType, type CborMap, type Cbor } from '@bcts/dcbor'
import { UR, decodeBytewords, encodeBytewords, BytewordsStyle, MultipartDecoder } from '@bcts/uniform-resources'
import { envelopeFromCbor } from '@bcts/envelope'
import { ENVELOPE } from '@bcts/tags'
import encodeQR from '@paulmillr/qr'
import decodeQR from '@paulmillr/qr/decode.js'
import { svgToPng } from '@paulmillr/qr/dom.js'

// Helper to extract raw string value from CBOR text
function extractTextValue(value: unknown): string {
  const str = typeof value === 'string' ? value : String(value)
  // If the string looks like a JSON-encoded string, parse it
  if (str.startsWith('"') && str.endsWith('"')) {
    try {
      const parsed = JSON.parse(str)
      if (typeof parsed === 'string') {
        return parsed
      }
    } catch {
      // Fall back to stripping quotes manually
      return str.slice(1, -1)
    }
  }
  return str
}

// Convert CBOR to JSON-serializable format
function cborToJson(cborVal: Cbor): unknown {
  switch (cborVal.type) {
    case MajorType.Unsigned:
    case MajorType.Negative:
      // Convert bigint to string if too large for JSON
      if (typeof cborVal.value === 'bigint') {
        return cborVal.value <= Number.MAX_SAFE_INTEGER && cborVal.value >= Number.MIN_SAFE_INTEGER
          ? Number(cborVal.value)
          : cborVal.value.toString()
      }
      return cborVal.value

    case MajorType.ByteString:
      // Convert bytes to hex string
      return Array.from(cborVal.value as Uint8Array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

    case MajorType.Text:
      // Use asText() to get the raw string value
      return cborVal.asText() ?? extractTextValue(cborVal.value)

    case MajorType.Array:
      return (cborVal.value as Cbor[]).map(item => cborToJson(item))

    case MajorType.Map: {
      const result: Record<string, unknown> = {}
      const mapValue = cborVal.value as CborMap
      for (const [key, value] of mapValue.entries()) {
        // Convert key to string for JSON object
        let keyStr: string
        if (key.type === MajorType.Text) {
          keyStr = key.asText() ?? extractTextValue(key.value)
        } else if (key.type === MajorType.Unsigned || key.type === MajorType.Negative) {
          keyStr = String(key.value)
        } else {
          keyStr = JSON.stringify(cborToJson(key))
        }
        result[keyStr] = cborToJson(value)
      }
      return result
    }

    case MajorType.Tagged:
      // For tagged values, include tag info
      return {
        tag: Number(cborVal.tag),
        value: cborToJson(cborVal.value as Cbor)
      }

    case MajorType.Simple:
      // Handle simple values (true, false, null, undefined, floats)
      return cborVal.value

    default:
      return String((cborVal as Cbor).value)
  }
}

useHead({
  title: 'Data Playground',
  meta: [{ name: 'description', content: 'Parse and visualize dCBOR data with annotated hex and diagnostic notation' }],
})

// Types
type InputFormat = 'auto' | 'ur' | 'bytewords' | 'hex'
type ViewMode = 'auto' | 'json' | 'dcbor' | 'ur' | 'bytewords' | 'diagnostic' | 'envelope' | 'hex'
type DisplayMode = 'editor' | 'split' | 'qr'

interface TabState {
  id: string
  name: string
  hexInput: string
  error: string | null
  parsedCbor: Cbor | null
  annotatedHex: string
  diagnosticNotation: string
  jsonOutput: string
  envelopeFormat: string
  urOutput: string
  bytewordsOutput: string
  isEnvelopeInput: boolean
  viewMode: ViewMode
  displayMode: DisplayMode
  qrCodeDataUrl: string
  isCameraTab: boolean
  // Fountain code scanning state
  fountainProgress: number
  fountainPartsReceived: number
  fountainTotalParts: number
  isFountainScanning: boolean
}

interface PaneState {
  id: string
  tabs: TabState[]
  activeTabId: string | null
}

// Storage key
const STORAGE_KEY = 'bcts-playground-state'

// Serializable state for localStorage (without computed/parsed fields)
interface SerializableTabState {
  id: string
  name: string
  hexInput: string
  viewMode: ViewMode
  displayMode: DisplayMode
}

interface SerializablePaneState {
  id: string
  tabs: SerializableTabState[]
  activeTabId: string | null
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
        viewMode: tab.viewMode,
        displayMode: tab.displayMode
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
        jsonOutput: '',
        envelopeFormat: '',
        urOutput: '',
        bytewordsOutput: '',
        isEnvelopeInput: false,
        viewMode: tab.viewMode || 'auto',
        displayMode: tab.displayMode || 'editor',
        qrCodeDataUrl: '',
        isCameraTab: false,
        fountainProgress: 0,
        fountainPartsReceived: 0,
        fountainTotalParts: 0,
        isFountainScanning: false
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
function createTab(name?: string, initialInput?: string, isCameraTab = false): TabState {
  const id = `tab-${tabCounter++}`
  return {
    id,
    name: name || `Tab ${tabCounter - 1}`,
    hexInput: initialInput ?? '',
    error: null,
    parsedCbor: null,
    annotatedHex: '',
    diagnosticNotation: '',
    jsonOutput: '',
    envelopeFormat: '',
    urOutput: '',
    bytewordsOutput: '',
    isEnvelopeInput: false,
    viewMode: 'auto',
    displayMode: 'editor',
    qrCodeDataUrl: '',
    isCameraTab,
    // Fountain code scanning state
    fountainProgress: 0,
    fountainPartsReceived: 0,
    fountainTotalParts: 0,
    isFountainScanning: false
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
  nextTick(() => {
    if (newPane.activeTabId) {
      parseTabCbor(newPane.id, newPane.activeTabId)
    }
  })
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

// Add a camera tab for QR code scanning (supports both static and animated/fountain QR codes)
function addCameraTab(paneId: string) {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  const newTab = createTab('QR Scanner', '', true)
  pane.tabs.push(newTab)
  pane.activeTabId = newTab.id
  activePaneId.value = paneId

  // Start camera for this tab
  nextTick(() => startCamera(newTab.id))
}

// Camera state management
const cameraStreams = new Map<string, MediaStream>()
const scanningIntervals = new Map<string, ReturnType<typeof setInterval>>()
// Fountain decoder state management for animated QR codes
const fountainDecoders = new Map<string, MultipartDecoder>()
const lastScannedParts = new Map<string, string>() // Track last scanned to avoid duplicates

// Start camera for a tab
async function startCamera(tabId: string) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    cameraStreams.set(tabId, stream)

    nextTick(() => {
      const videoEl = document.querySelector(`video[data-tab-id="${tabId}"]`) as HTMLVideoElement
      if (videoEl) {
        videoEl.srcObject = stream
        videoEl.play()
        startQRScanning(tabId)
      }
    })
  } catch (err) {
    console.error('Failed to start camera:', err)
  }
}

// Stop camera for a tab
function stopCamera(tabId: string) {
  const stream = cameraStreams.get(tabId)
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    cameraStreams.delete(tabId)
  }

  const interval = scanningIntervals.get(tabId)
  if (interval) {
    clearInterval(interval)
    scanningIntervals.delete(tabId)
  }

  // Clean up fountain decoder state
  fountainDecoders.delete(tabId)
  lastScannedParts.delete(tabId)
}

// Normalize scanned QR data - URs are encoded uppercase in QR codes for efficiency,
// but should be displayed lowercase per the UR specification
function normalizeScannedQR(data: string): string {
  const trimmed = data.trim()
  // UR strings should be lowercase (they're uppercase in QR for alphanumeric mode efficiency)
  if (trimmed.toUpperCase().startsWith('UR:')) {
    return trimmed.toLowerCase()
  }
  // Return other formats as-is
  return trimmed
}

// Check if a UR string is a multipart UR
function isMultipartUR(urString: string): { isMultipart: boolean; seqNum?: number; seqLen?: number } {
  const lowercased = urString.toLowerCase()
  if (!lowercased.startsWith('ur:')) {
    return { isMultipart: false }
  }

  const afterScheme = lowercased.substring(3)
  const components = afterScheme.split('/')

  if (components.length >= 3) {
    const seqPart = components[1]
    if (seqPart) {
      const seqMatch = /^(\d+)-(\d+)$/.exec(seqPart)

      if (seqMatch !== null && seqMatch[1] && seqMatch[2]) {
        return {
          isMultipart: true,
          seqNum: parseInt(seqMatch[1], 10),
          seqLen: parseInt(seqMatch[2], 10)
        }
      }
    }
  }

  return { isMultipart: false }
}

// Start QR code scanning for a camera tab
function startQRScanning(tabId: string) {
  const videoEl = document.querySelector(`video[data-tab-id="${tabId}"]`) as HTMLVideoElement
  const canvasEl = document.querySelector(`canvas[data-tab-id="${tabId}"]`) as HTMLCanvasElement
  if (!videoEl || !canvasEl) return

  const ctx = canvasEl.getContext('2d')
  if (!ctx) return

  const interval = setInterval(() => {
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvasEl.width = videoEl.videoWidth
      canvasEl.height = videoEl.videoHeight
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height)

      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height)

      try {
        // Pass RGBA image data directly to decodeQR
        const result = decodeQR({
          width: imageData.width,
          height: imageData.height,
          data: imageData.data
        })

        if (result) {
          const pane = panes.value.find(p => p.tabs.some(t => t.id === tabId))
          if (!pane) return

          const tab = pane.tabs.find(t => t.id === tabId)
          if (!tab) return

          // Normalize the scanned data (URs are uppercase in QR codes but should be lowercase)
          const normalizedResult = normalizeScannedQR(result)

          // Check if this is a multipart UR (fountain code / animated QR)
          const multipartInfo = isMultipartUR(normalizedResult)

          if (multipartInfo.isMultipart && multipartInfo.seqLen && multipartInfo.seqLen > 1) {
            // Skip if we just scanned this exact same part
            const lastPart = lastScannedParts.get(tabId)
            if (lastPart === normalizedResult) {
              return
            }
            lastScannedParts.set(tabId, normalizedResult)

            // Initialize or get the fountain decoder for this tab
            let decoder = fountainDecoders.get(tabId)
            if (!decoder) {
              console.log('[Fountain] Creating NEW decoder (previous was reset or first time)')
              decoder = new MultipartDecoder()
              fountainDecoders.set(tabId, decoder)
              tab.isFountainScanning = true
              tab.fountainTotalParts = multipartInfo.seqLen
            }

            // Receive the part
            try {
              console.log(`[Fountain] Receiving part ${multipartInfo.seqNum}/${multipartInfo.seqLen}`)
              decoder.receive(normalizedResult)
              console.log(`[Fountain] After receive - isComplete: ${decoder.isComplete()}`)

              // Update progress
              tab.fountainPartsReceived = (tab.fountainPartsReceived || 0) + 1
              tab.fountainProgress = Math.min(
                (tab.fountainPartsReceived / tab.fountainTotalParts) * 100,
                99 // Cap at 99% until truly complete
              )

              // Check if complete
              if (decoder.isComplete()) {
                console.log('[Fountain] Decoder complete, getting message...')
                const ur = decoder.message()
                console.log('[Fountain] Message:', ur)
                if (ur) {
                  tab.hexInput = ur.string()
                  tab.isCameraTab = false
                  tab.isFountainScanning = false
                  tab.fountainProgress = 100
                  stopCamera(tabId)
                  fountainDecoders.delete(tabId)
                  lastScannedParts.delete(tabId)
                  nextTick(() => parseTabCbor(pane.id, tabId))
                }
              }
            } catch (err) {
              // Check if this is an "Inconsistent part metadata" error
              // This happens when scanning a different animated QR sequence
              const isMetadataMismatch = err instanceof Error &&
                err.message.includes('Inconsistent part metadata')

              if (isMetadataMismatch) {
                console.log('[Fountain] Metadata mismatch - resetting decoder for new sequence')
                // Reset and start fresh with the new sequence
                const newDecoder = new MultipartDecoder()
                fountainDecoders.set(tabId, newDecoder)
                lastScannedParts.clear()
                tab.fountainPartsReceived = 0
                tab.fountainTotalParts = multipartInfo.seqLen

                // Try to receive this part with the new decoder
                try {
                  newDecoder.receive(normalizedResult)
                  tab.fountainPartsReceived = 1
                  tab.fountainProgress = Math.min(
                    (1 / tab.fountainTotalParts) * 100,
                    99
                  )
                } catch (innerErr) {
                  console.error('[Fountain] Failed to receive after reset:', innerErr)
                  // If it still fails, reset completely
                  fountainDecoders.delete(tabId)
                  lastScannedParts.delete(tabId)
                  tab.isFountainScanning = false
                  tab.fountainProgress = 0
                  tab.fountainPartsReceived = 0
                }
              } else {
                console.error('[Fountain] Decode error (resetting decoder):', err)
                // Reset decoder on other errors
                fountainDecoders.delete(tabId)
                lastScannedParts.delete(tabId)
                tab.isFountainScanning = false
                tab.fountainProgress = 0
                tab.fountainPartsReceived = 0
              }
            }
          } else {
            // Single QR code detected - populate the tab with the data
            tab.hexInput = normalizedResult
            tab.isCameraTab = false
            stopCamera(tabId)
            // Parse the scanned data
            nextTick(() => parseTabCbor(pane.id, tabId))
          }
        }
      } catch {
        // Ignore scanning errors, continue scanning
      }
    }
  }, 100)

  scanningIntervals.set(tabId, interval)
}

// Cleanup cameras on unmount
onUnmounted(() => {
  cameraStreams.forEach((stream) => {
    stream.getTracks().forEach(track => track.stop())
  })
  cameraStreams.clear()
  scanningIntervals.forEach(interval => clearInterval(interval))
  scanningIntervals.clear()
  fountainDecoders.clear()
  lastScannedParts.clear()
})

// Trigger file input for QR upload
function triggerQRUpload(paneId: string) {
  const input = document.querySelector(`input[data-upload-pane="${paneId}"]`) as HTMLInputElement
  if (input) {
    input.click()
  }
}

// Handle QR code upload from image file
function handleQRUpload(paneId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  // Create a new tab for the upload
  const newTab = createTab('QR Upload', '')
  pane.tabs.push(newTab)
  pane.activeTabId = newTab.id
  activePaneId.value = paneId

  // Check if file is SVG
  if (file.type === 'image/svg+xml') {
    // Handle SVG files
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const svgText = e.target?.result as string

        // Parse SVG to get dimensions
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')
        const svgElement = svgDoc.documentElement

        // Get SVG dimensions or use default size
        const width = parseInt(svgElement.getAttribute('width') || '512')
        const height = parseInt(svgElement.getAttribute('height') || '512')

        // Convert SVG to PNG data URL using svgToPng (returns a Promise)
        const pngDataUrl = await svgToPng(svgText, width, height)

        // Load the PNG data URL into an image
        const img = new Image()
        img.onload = () => {
          // Create canvas to extract ImageData
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, width, height)

          try {
            // Decode QR code from ImageData
            const result = decodeQR({
              width: imageData.width,
              height: imageData.height,
              data: imageData.data
            })

            if (result) {
              const tab = pane.tabs.find(t => t.id === newTab.id)
              if (tab) {
                tab.hexInput = normalizeScannedQR(result)
                tab.name = 'Scanned QR'
                nextTick(() => parseTabCbor(pane.id, newTab.id))
              }
            } else {
              const tab = pane.tabs.find(t => t.id === newTab.id)
              if (tab) {
                tab.error = 'No QR code found in the uploaded SVG'
                tab.viewMode = 'hex'
              }
            }
          } catch {
            const tab = pane.tabs.find(t => t.id === newTab.id)
            if (tab) {
              tab.error = 'Failed to decode QR code from SVG'
              tab.viewMode = 'hex'
            }
          }
        }

        img.onerror = () => {
          const tab = pane.tabs.find(t => t.id === newTab.id)
          if (tab) {
            tab.error = 'Failed to load SVG image'
            tab.viewMode = 'hex'
          }
        }

        img.src = pngDataUrl
      } catch {
        const tab = pane.tabs.find(t => t.id === newTab.id)
        if (tab) {
          tab.error = 'Failed to process SVG file'
          tab.viewMode = 'hex'
        }
      }
    }
    reader.readAsText(file)
  } else {
    // Handle regular image files (PNG, JPG, etc.)
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas to draw image
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        try {
          // Decode QR code from image
          const result = decodeQR({
            width: imageData.width,
            height: imageData.height,
            data: imageData.data
          })

          if (result) {
            // Populate tab with decoded data
            const tab = pane.tabs.find(t => t.id === newTab.id)
            if (tab) {
              tab.hexInput = normalizeScannedQR(result)
              tab.name = 'Scanned QR'
              nextTick(() => parseTabCbor(pane.id, newTab.id))
            }
          } else {
            // No QR code found
            const tab = pane.tabs.find(t => t.id === newTab.id)
            if (tab) {
              tab.error = 'No QR code found in the uploaded image'
              tab.viewMode = 'hex' // Show error message
            }
          }
        } catch {
          // Error decoding
          const tab = pane.tabs.find(t => t.id === newTab.id)
          if (tab) {
            tab.error = 'Failed to decode QR code from image'
            tab.viewMode = 'hex' // Show error message
          }
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Reset input so the same file can be uploaded again
  input.value = ''
}

// Close a tab
function closeTab(paneId: string, tabId: string) {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  const index = pane.tabs.findIndex(t => t.id === tabId)
  if (index === -1) return

  // Stop camera if it's a camera tab
  const tab = pane.tabs[index]
  if (tab && tab.isCameraTab) {
    stopCamera(tabId)
  }

  // If it's the last tab in the pane, close the pane instead (if not the last pane)
  if (pane.tabs.length === 1) {
    if (panes.value.length > 1) {
      closePane(paneId)
    } else {
      // Allow closing the last tab in the last pane
      pane.tabs.splice(index, 1)
      pane.activeTabId = null
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

// Set display mode for the active tab in a pane
function setDisplayMode(paneId: string, mode: DisplayMode) {
  const tab = getActiveTab(paneId)
  if (tab) {
    tab.displayMode = mode
  }
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

// Generate QR code from UR output
function generateQRCode(tab: TabState) {
  if (!tab.urOutput || tab.urOutput.startsWith('//')) {
    tab.qrCodeDataUrl = ''
    return
  }

  try {
    // Generate QR code using @paulmillr/qr
    const qrData = encodeQR(tab.urOutput.toUpperCase(), 'raw', {
      ecc: 'low',
      border: 2
    })

    // Convert QR matrix to SVG
    const size = qrData.length
    const scale = 4
    const svgSize = size * scale

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="400" height="400">
      <rect width="${svgSize}" height="${svgSize}" fill="#ffffff"/>
      ${qrData.map((row, y) =>
        row.map((cell, x) =>
          cell ? `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="#000000"/>` : ''
        ).join('')
      ).join('')}
    </svg>`

    // Convert SVG to data URL
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`
    tab.qrCodeDataUrl = dataUrl
  } catch (err) {
    console.error('Failed to generate QR code:', err)
    tab.qrCodeDataUrl = ''
  }
}

// Parse CBOR for a specific tab in a pane
function parseTabCbor(paneId: string, tabId: string) {
  const pane = panes.value.find(p => p.id === paneId)
  if (!pane) return

  const tab = pane.tabs.find(t => t.id === tabId) as TabState | undefined
  if (!tab) return

  const input = tab.hexInput.trim()
  if (!input) {
    tab.error = 'Please enter data to parse'
    tab.parsedCbor = null
    tab.annotatedHex = ''
    tab.diagnosticNotation = ''
    tab.jsonOutput = ''
    tab.envelopeFormat = ''
    tab.urOutput = ''
    tab.bytewordsOutput = ''
    tab.isEnvelopeInput = false
    tab.qrCodeDataUrl = ''
    return
  }

  try {
    // Clear error on successful parse attempt
    tab.error = null
    // Always use auto-detect
    const cborBytes = parseInput(input, 'auto')
    const cbor = decodeCbor(cborBytes)
    tab.parsedCbor = cbor

    tab.isEnvelopeInput = cbor.type === MajorType.Tagged && cbor.tag === ENVELOPE.value

    tab.annotatedHex = hexOpt(cbor, { annotate: true })
    tab.diagnosticNotation = diagnosticOpt(cbor, { flat: false })

    // Generate JSON output
    try {
      const jsonData = cborToJson(cbor)
      tab.jsonOutput = JSON.stringify(jsonData, null, 2)
    } catch {
      tab.jsonOutput = '// Could not convert to JSON format'
    }

    // Generate UR output
    try {
      tab.urOutput = bytesToUR(cborBytes)
      // Generate QR code from UR
      generateQRCode(tab)
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
function getByteCount(tab: { hexInput: string }): number {
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

// Process a selected example
function processSelectedExample() {
  if (selectedExample?.value && activePane.value) {
    const example = selectedExample.value
    // Create a new tab with the example content
    const newTab = createTab(example.name, example.value)
    activePane.value.tabs.push(newTab)
    activePane.value.activeTabId = newTab.id

    // Parse the new tab's content
    nextTick(() => parseTabCbor(activePane.value!.id, newTab.id))

    // Reset the selected example to allow re-selecting the same example
    selectedExample.value = null
  }
}

// Watch for example selection from sidebar
watch(selectedExample!, () => {
  processSelectedExample()
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
      // Check for pending example after state is loaded
      processSelectedExample()
    })
  } else {
    // No saved state, create initial pane
    const initialPane = createPane()
    panes.value.push(initialPane)
    activePaneId.value = initialPane.id
    nextTick(() => {
      if (initialPane.activeTabId) {
        parseTabCbor(initialPane.id, initialPane.activeTabId)
      }
      // Check for pending example after pane is created
      processSelectedExample()
    })
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
      <UDashboardNavbar title="Data Playground">
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
            to="https://github.com/paritytech/bcts"
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
            paneIndex > 0 ? 'border-l border-gray-300 dark:border-gray-800' : '',
            panes.length > 1 ? 'flex-1 min-w-0' : 'w-full'
          ]"
          @click="activePaneId = pane.id"
        >
          <!-- Tab Bar -->
          <div
            :class="[
              'flex items-center border-b border-gray-200 dark:border-gray-800/50',
              activePaneId === pane.id ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-gray-100 dark:bg-gray-900/30'
            ]"
          >
            <div class="flex-1 min-w-0 overflow-x-auto tab-scrollbar">
              <div class="flex items-center flex-nowrap w-max">
                <div
                  v-for="tab in pane.tabs"
                  :key="tab.id"
                  :class="[
                    'group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-200 dark:border-gray-800/30 min-w-[100px] max-w-[160px]',
                    pane.activeTabId === tab.id
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                      : 'bg-gray-100 dark:bg-transparent text-gray-500 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
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
            </div>
            <div class="flex items-center gap-0.5">
              <UButton
                icon="i-heroicons-plus"
                size="xs"
                color="neutral"
                variant="ghost"
                @click.stop="addTab(pane.id)"
              />
              <UTooltip text="Scan QR (supports animated)">
                <UButton
                  icon="i-heroicons-camera"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click.stop="addCameraTab(pane.id)"
                />
              </UTooltip>
              <UButton
                icon="i-heroicons-arrow-up-tray"
                size="xs"
                color="neutral"
                variant="ghost"
                @click.stop="triggerQRUpload(pane.id)"
              />
              <input
                :data-upload-pane="pane.id"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleQRUpload(pane.id, $event)"
              >
              <div class="h-4 w-px bg-gray-300 dark:bg-gray-700/50 mx-1" />
              <UButton
                icon="i-heroicons-bars-3-bottom-left"
                size="xs"
                color="neutral"
                :variant="getActiveTab(pane.id)?.displayMode === 'editor' ? 'soft' : 'ghost'"
                :class="getActiveTab(pane.id)?.displayMode === 'editor' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
                @click.stop="setDisplayMode(pane.id, 'editor')"
              />
              <UButton
                icon="i-heroicons-rectangle-group"
                size="xs"
                color="neutral"
                :variant="getActiveTab(pane.id)?.displayMode === 'split' ? 'soft' : 'ghost'"
                :class="getActiveTab(pane.id)?.displayMode === 'split' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
                @click.stop="setDisplayMode(pane.id, 'split')"
              />
              <UButton
                icon="i-heroicons-qr-code"
                size="xs"
                color="neutral"
                :variant="getActiveTab(pane.id)?.displayMode === 'qr' ? 'soft' : 'ghost'"
                :class="getActiveTab(pane.id)?.displayMode === 'qr' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
                @click.stop="setDisplayMode(pane.id, 'qr')"
              />
              <UButton
                v-if="panes.length > 1"
                icon="i-heroicons-x-mark"
                size="xs"
                color="neutral"
                variant="ghost"
                class="ml-1"
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
              <div v-if="tab.error && tab.viewMode !== 'auto'" class="px-3 py-1.5">
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
                <!-- Camera Scanner View -->
                <div v-if="tab.isCameraTab" class="flex-1 flex flex-col items-center justify-center bg-gray-900 overflow-hidden relative">
                  <div class="relative w-full h-full flex items-center justify-center">
                    <video
                      :data-tab-id="tab.id"
                      autoplay
                      playsinline
                      class="w-full h-full object-cover"
                    />
                    <canvas
                      :data-tab-id="tab.id"
                      class="hidden"
                    />
                    <!-- Scanning overlay for fountain codes -->
                    <div v-if="tab.isFountainScanning" class="absolute inset-0 pointer-events-none">
                      <div class="absolute top-4 left-4 right-4">
                        <div class="bg-black/70 rounded-lg p-3">
                          <div class="flex items-center justify-between text-white text-sm mb-2">
                            <span class="flex items-center gap-2">
                              <UIcon name="i-heroicons-film" class="w-4 h-4 animate-pulse text-blue-400" />
                              Animated QR
                            </span>
                            <span class="font-mono">{{ tab.fountainPartsReceived }} parts</span>
                          </div>
                          <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              class="bg-blue-500 h-2 rounded-full transition-all duration-200"
                              :style="{ width: `${tab.fountainProgress}%` }"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="absolute bottom-4 left-0 right-0 text-center">
                    <p class="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full inline-block">
                      {{ tab.isFountainScanning ? 'Keep scanning animated QR...' : 'Point camera at QR code' }}
                    </p>
                  </div>
                </div>

                <!-- QR Code View -->
                <div v-else-if="tab.displayMode === 'qr'" class="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 overflow-auto p-4">
                  <div v-if="tab.qrCodeDataUrl" class="flex flex-col items-center gap-4">
                    <img :src="tab.qrCodeDataUrl" alt="QR Code" class="max-w-full h-auto rounded-lg shadow-lg">
                    <p class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[300px]">{{ tab.urOutput.substring(0, 50) }}...</p>
                  </div>
                  <div v-else class="text-center">
                    <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-3 mb-2 inline-block">
                      <UIcon name="i-heroicons-qr-code" class="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 class="text-xs font-semibold text-gray-900 dark:text-gray-200 mb-1">No QR Code</h3>
                    <p class="text-xs text-gray-600 dark:text-gray-500">Enter valid data to generate a QR code</p>
                  </div>
                </div>

                <!-- Split View - Editor + QR Code -->
                <div v-else-if="tab.displayMode === 'split'" class="flex-1 flex overflow-hidden">
                  <!-- Editor Side -->
                  <div class="flex-1 min-h-0 min-w-0 overflow-hidden border-r border-gray-200 dark:border-gray-800">
                    <!-- Auto View - Edit raw input -->
                    <textarea
                      v-if="tab.viewMode === 'auto'"
                      v-model="tab.hexInput"
                      placeholder="Enter data (hex, UR, or bytewords)"
                      class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 focus:outline-none overflow-auto placeholder:text-gray-400 dark:placeholder:text-gray-600"
                      style="word-break: break-all;"
                    />

                    <!-- JSON View - Edit JSON -->
                    <textarea
                      v-else-if="tab.viewMode === 'json'"
                      :value="tab.jsonOutput"
                      placeholder="JSON output"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />

                    <!-- dCBOR View - Edit annotated hex -->
                    <textarea
                      v-else-if="tab.viewMode === 'dcbor'"
                      :value="tab.annotatedHex"
                      placeholder="dCBOR annotated hex"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />

                    <!-- UR View - Edit UR string -->
                    <textarea
                      v-else-if="tab.viewMode === 'ur'"
                      v-model="tab.urOutput"
                      placeholder="UR string"
                      class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                      style="word-break: break-all;"
                      @input="tab.hexInput = tab.urOutput"
                    />

                    <!-- Bytewords View - Edit bytewords -->
                    <textarea
                      v-else-if="tab.viewMode === 'bytewords'"
                      v-model="tab.bytewordsOutput"
                      placeholder="Bytewords"
                      class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                      @input="tab.hexInput = tab.bytewordsOutput"
                    />

                    <!-- Envelope View - Edit envelope format -->
                    <textarea
                      v-else-if="tab.viewMode === 'envelope'"
                      :value="tab.envelopeFormat || '// Input is not an Envelope (tag 200)'"
                      placeholder="Envelope format"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />

                    <!-- Diagnostic View - Edit diagnostic notation -->
                    <textarea
                      v-else-if="tab.viewMode === 'diagnostic'"
                      :value="tab.diagnosticNotation"
                      placeholder="Diagnostic notation"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />
                  </div>

                  <!-- QR Code Side -->
                  <div class="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 overflow-auto p-4">
                    <div v-if="tab.qrCodeDataUrl" class="flex flex-col items-center gap-4">
                      <img :src="tab.qrCodeDataUrl" alt="QR Code" class="max-w-full h-auto rounded-lg shadow-lg">
                      <p class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[300px]">{{ tab.urOutput.substring(0, 50) }}...</p>
                    </div>
                    <div v-else class="text-center">
                      <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-3 mb-2 inline-block">
                        <UIcon name="i-heroicons-qr-code" class="w-6 h-6 text-gray-400 dark:text-gray-500" />
                      </div>
                      <h3 class="text-xs font-semibold text-gray-900 dark:text-gray-200 mb-1">No QR Code</h3>
                      <p class="text-xs text-gray-600 dark:text-gray-500">Enter valid data to generate a QR code</p>
                    </div>
                  </div>
                </div>

                <!-- Editor View -->
                <template v-else>
                  <div class="flex-1 min-h-0 min-w-0 overflow-hidden">
                    <!-- Auto View - Edit raw input -->
                    <textarea
                      v-if="tab.viewMode === 'auto'"
                      v-model="tab.hexInput"
                      placeholder="Enter data (hex, UR, or bytewords)"
                      class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 focus:outline-none overflow-auto placeholder:text-gray-400 dark:placeholder:text-gray-600"
                      style="word-break: break-all;"
                    />

                    <!-- JSON View - Edit JSON -->
                    <textarea
                      v-else-if="tab.viewMode === 'json'"
                      :value="tab.jsonOutput"
                      placeholder="JSON output"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />

                    <!-- dCBOR View - Edit annotated hex -->
                    <textarea
                      v-else-if="tab.viewMode === 'dcbor'"
                      :value="tab.annotatedHex"
                      placeholder="dCBOR annotated hex"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />

                    <!-- UR View - Edit UR string -->
                    <textarea
                      v-else-if="tab.viewMode === 'ur'"
                      v-model="tab.urOutput"
                      placeholder="UR string"
                      class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                      style="word-break: break-all;"
                      @input="tab.hexInput = tab.urOutput"
                    />

                    <!-- Bytewords View - Edit bytewords -->
                    <textarea
                      v-else-if="tab.viewMode === 'bytewords'"
                      v-model="tab.bytewordsOutput"
                      placeholder="Bytewords"
                      class="w-full h-full resize-none font-mono text-xs bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                      @input="tab.hexInput = tab.bytewordsOutput"
                    />

                    <!-- Envelope View - Edit envelope format -->
                    <textarea
                      v-else-if="tab.viewMode === 'envelope'"
                      :value="tab.envelopeFormat || '// Input is not an Envelope (tag 200)'"
                      placeholder="Envelope format"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />

                    <!-- Diagnostic View - Edit diagnostic notation -->
                    <textarea
                      v-else-if="tab.viewMode === 'diagnostic'"
                      :value="tab.diagnosticNotation"
                      placeholder="Diagnostic notation"
                      readonly
                      class="w-full h-full resize-none font-mono text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 focus:outline-none overflow-auto"
                    />
                  </div>
                </template>
              </div>

              <!-- Status Bar -->
              <div class="flex items-center justify-between px-2 py-0.5 border-t border-gray-200 dark:border-gray-800/50 bg-gray-100 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-500">
                <UTabs
                  v-model="tab.viewMode"
                  :items="[
                    { label: 'Auto', value: 'auto' },
                    { label: 'JSON', value: 'json' },
                    { label: 'dCBOR', value: 'dcbor' },
                    { label: 'UR', value: 'ur' },
                    { label: 'Bytewords', value: 'bytewords' },
                    { label: 'Envelope', value: 'envelope' },
                    { label: 'Diagnostic', value: 'diagnostic' }
                  ]"
                  size="xs"
                  class="w-auto"
                  :ui="{ root: 'gap-0', list: 'p-0' }"
                />
                <div class="flex items-center gap-3">
                  <span v-if="tab.isEnvelopeInput" class="text-blue-600 dark:text-blue-400">Envelope</span>
                  <span v-if="tab.parsedCbor">CBOR</span>
                  <span>{{ getByteCount(tab) }} bytes</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Empty State - No Tabs -->
          <div v-else class="flex-1 flex items-center justify-center bg-white dark:bg-gray-900">
            <div class="text-center max-w-md px-4">
              <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-4 inline-block">
                <UIcon name="i-heroicons-document-plus" class="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-200 mb-2">No tabs open</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Create a new tab to start working with dCBOR data</p>
              <UButton
                icon="i-heroicons-plus"
                color="primary"
                @click="addTab(pane.id)"
              >
                New Tab
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
