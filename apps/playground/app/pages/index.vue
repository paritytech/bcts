<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { decodeCbor, hexToBytes, hexOpt, diagnosticOpt, bytesToHex, type Cbor } from '@blockchain-commons/dcbor'
import { UR } from '@blockchain-commons/uniform-resources'

useHead({
  title: 'CBOR Diagnostic Tool - Blockchain Commons',
  meta: [{ name: 'description', content: 'Parse and visualize CBOR data with annotated hex and diagnostic notation' }],
})

// State
const hexInput = ref('a2626964187b646e616d65684a6f686e20446f65')
const parseMode = ref<'hex' | 'diagnostic'>('hex')
const error = ref<string | null>(null)
const parsedCbor = ref<Cbor | null>(null)
const annotatedHex = ref<string>('')
const diagnosticNotation = ref<string>('')

// Parse CBOR from hex input
function parseCbor() {
  error.value = null
  parsedCbor.value = null
  annotatedHex.value = ''
  diagnosticNotation.value = ''

  if (!hexInput.value.trim()) {
    error.value = 'Please enter hex data'
    return
  }

  try {
    // Remove whitespace and validate hex
    const cleanHex = hexInput.value.replace(/\s/g, '')
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      throw new Error('Invalid hex characters')
    }
    if (cleanHex.length % 2 !== 0) {
      throw new Error('Hex string must have even length')
    }

    // Parse CBOR
    const bytes = hexToBytes(cleanHex)
    const cbor = decodeCbor(bytes)
    parsedCbor.value = cbor

    // Generate annotated hex
    annotatedHex.value = hexOpt(cbor, { annotate: true })

    // Generate diagnostic notation
    diagnosticNotation.value = diagnosticOpt(cbor, { flat: false })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to parse CBOR'
  }
}

// Compute byte count from hex input
const byteCount = computed(() => {
  const cleanHex = hexInput.value.replace(/\s/g, '')
  return cleanHex.length / 2
})

// Auto-parse when hex input changes (debounced)
let parseTimeout: NodeJS.Timeout | null = null
watch(hexInput, () => {
  if (parseTimeout) clearTimeout(parseTimeout)
  parseTimeout = setTimeout(() => {
    parseCbor()
  }, 300)
})

// Load UR example
function loadURExample() {
  try {
    const ur = UR.fromURString('ur:user/oeidiniecskgiejthsjnihisgejlisjtcxfyjlihjldnbwrl')
    const cborData = ur.cbor()
    const cborBytes = cborData.encode()
    hexInput.value = bytesToHex(cborBytes)
    parseCbor()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load UR example'
  }
}

// Parse on mount
onMounted(() => {
  parseCbor()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <!-- Header -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-50">
      <div class="mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex items-center justify-between gap-4">
          <h1 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            dCBOR Diagnostic Tool
          </h1>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              to="https://github.com/leonardocustodio/bc-dcbor-ts"
              target="_blank"
              variant="ghost"
              size="sm"
              icon="i-heroicons-github"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <UContainer class="py-6">
        <!-- Error Display (Full Width) -->
        <div v-if="error" class="mb-4">
          <UAlert
            color="red"
            icon="i-heroicons-exclamation-triangle"
            :title="error"
          />
        </div>

        <!-- Main Flex Layout -->
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Left Column: Input (25% on desktop) -->
          <div class="w-full lg:w-1/4 flex-shrink-0">
            <div class="sticky top-20 lg:top-16 h-fit">
              <div class="bg-gradient-to-br from-blue-50 to-blue-50/30 dark:from-blue-950/40 dark:to-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                <UCard variant="soft" :ui="{ header: 'bg-blue-100 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800' }">
                  <template #header>
                    <div class="flex items-center justify-between w-full">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h2 class="font-semibold text-sm text-blue-900 dark:text-blue-300">Input</h2>
                      </div>
                      <span class="text-xs text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">{{ byteCount }} bytes</span>
                    </div>
                  </template>

                  <div class="space-y-3">
                    <div>
                      <UTextarea
                        v-model="hexInput"
                        :rows="8"
                        placeholder="Enter hex data (e.g., bf6346756ef563416d7421ff)"
                        class="font-mono text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
                      />
                    </div>
                    <UButton
                      @click="parseCbor"
                      color="primary"
                      size="sm"
                      block
                      class="font-semibold"
                    >
                      Parse
                    </UButton>

                    <!-- Quick Examples -->
                    <div class="pt-3 mt-3 border-t border-blue-200 dark:border-blue-800">
                      <p class="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-1">
                        <UIcon name="i-heroicons-lightning-bolt" class="w-3 h-3" />
                        Quick Examples
                      </p>
                      <div class="space-y-2">
                        <UButton
                          @click="hexInput = 'a2626964187b646e616d65684a6f686e20446f65'; parseCbor()"
                          variant="outline"
                          size="xs"
                          block
                          class="justify-start hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          <div class="text-left w-full">
                            <div class="text-xs font-semibold">Simple Example</div>
                          </div>
                        </UButton>
                        <UButton
                          @click="hexInput = 'a2646e616d656d4d7920436f6c6c656374696f6e65757365727382d86fa262696401646e616d6571c4b07266616e2042696c616c6fc49f6c75d86fa262696402646e616d6572506965746572205579747465727370726f74'; parseCbor()"
                          variant="outline"
                          size="xs"
                          block
                          class="justify-start hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          <div class="text-left w-full">
                            <div class="text-xs font-semibold">Collection Example</div>
                          </div>
                        </UButton>
                        <UButton
                          @click="loadURExample()"
                          variant="outline"
                          size="xs"
                          block
                          class="justify-start hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                          <div class="text-left w-full">
                            <div class="text-xs font-semibold">UR Example</div>
                          </div>
                        </UButton>
                      </div>
                    </div>
                  </div>
                </UCard>
              </div>
            </div>
          </div>

          <!-- Right Column: Outputs (75% on desktop) -->
          <div class="w-full lg:w-3/4 flex-1">
            <!-- Output Grid: 2 columns for Annotated Hex and Diagnostic Notation -->
            <div v-if="parsedCbor" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Annotated Hex Output -->
              <div class="bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-950/40 dark:to-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 shadow-sm overflow-hidden">
                <UCard variant="soft" :ui="{ header: 'bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800' }">
                  <template #header>
                    <div class="flex items-center justify-between w-full">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-heroicons-code-bracket" class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <h2 class="font-semibold text-sm text-amber-900 dark:text-amber-300">Annotated Hex</h2>
                      </div>
                      <UBadge size="sm" variant="subtle" class="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">{{ byteCount }} bytes</UBadge>
                    </div>
                  </template>

                  <div class="bg-white dark:bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-96 border border-amber-100 dark:border-amber-900/50">
                    <pre class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200">{{ annotatedHex }}</pre>
                  </div>
                </UCard>
              </div>

              <!-- Diagnostic Notation Output -->
              <div class="bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/40 dark:to-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm overflow-hidden">
                <UCard variant="soft" :ui="{ header: 'bg-emerald-100 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800' }">
                  <template #header>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h2 class="font-semibold text-sm text-emerald-900 dark:text-emerald-300">Diagnostic Notation</h2>
                    </div>
                  </template>

                  <div class="bg-white dark:bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-96 border border-emerald-100 dark:border-emerald-900/50">
                    <pre class="font-mono text-xs whitespace-pre text-gray-800 dark:text-gray-200">{{ diagnosticNotation }}</pre>
                  </div>
                </UCard>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else>
              <div class="bg-gradient-to-br from-gray-50 to-gray-50/30 dark:from-gray-950/40 dark:to-gray-950/20 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                <UCard variant="soft">
                  <div class="flex flex-col items-center justify-center py-16 text-center">
                    <div class="bg-gray-100 dark:bg-gray-800 rounded-full p-4 mb-4">
                      <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400 dark:text-gray-600" />
                    </div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">No CBOR data parsed</h3>
                    <p class="text-xs text-gray-600 dark:text-gray-400">Enter hex data in the input panel and click Parse to see results here</p>
                  </div>
                </UCard>
              </div>
            </div>
          </div>
        </div>
      </UContainer>
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto">
      <UContainer class="py-4">
        <div class="text-center text-xs text-gray-600 dark:text-gray-400">
          <p>
            Built with
            <ULink to="https://github.com/leonardocustodio/bc-dcbor-ts" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline">
              @blockchain-commons/dcbor
            </ULink>
            • Powered by Blockchain Commons
          </p>
        </div>
      </UContainer>
    </footer>
  </div>
</template>
