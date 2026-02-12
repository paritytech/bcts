<script setup lang="ts">
const props = defineProps<{
  tree: string
  hex: string
  ur: string
  notation: string
  diagnostic?: string
}>()

const envelopeOutputMode = ref<'notation' | 'hex' | 'diag'>('notation')
const copiedLabel = ref<string | null>(null)

const hasAnyOutput = computed(() => !!(props.tree || props.hex || props.notation))

async function copyToClipboard(text: string, label: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedLabel.value = label
    setTimeout(() => { copiedLabel.value = null }, 1500)
  } catch {}
}

const envelopeContent = computed(() => {
  if (envelopeOutputMode.value === 'notation') return props.notation
  if (envelopeOutputMode.value === 'hex') return props.hex
  return props.diagnostic ?? ''
})

const envelopeLabel = computed(() => {
  if (envelopeOutputMode.value === 'notation') return 'Envelope Notation'
  if (envelopeOutputMode.value === 'hex') return 'CBOR (Hex)'
  return 'CBOR Diagnostic'
})
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-auto space-y-4">
      <!-- Error / Empty State -->
      <div v-if="!hasAnyOutput" class="h-full flex items-center justify-center">
        <div class="text-center text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p class="text-sm">Create an XID to see output</p>
        </div>
      </div>

      <template v-else>
        <!-- Tree Format Output -->
        <div v-if="tree">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tree Format</h4>
            <UButton
              :icon="copiedLabel === 'tree' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copiedLabel === 'tree' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              @click="copyToClipboard(tree, 'tree')"
            />
          </div>
          <pre class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre max-h-64">{{ tree }}</pre>
        </div>

        <!-- Envelope Output (Notation / CBOR Hex / CBOR Diagnostic) -->
        <div v-if="notation || hex || diagnostic">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {{ envelopeLabel }}
              <UBadge v-if="envelopeOutputMode === 'hex' && hex" color="neutral" variant="soft" size="xs" class="ml-1">{{ hex.length / 2 }} bytes</UBadge>
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
                :icon="copiedLabel === 'envelope' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                :color="copiedLabel === 'envelope' ? 'success' : 'neutral'"
                size="xs"
                variant="ghost"
                @click="copyToClipboard(envelopeContent, 'envelope')"
              />
            </div>
          </div>
          <pre v-if="envelopeOutputMode === 'notation' && notation" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre max-h-48">{{ notation }}</pre>
          <div v-else-if="envelopeOutputMode === 'hex' && hex" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-h-48 overflow-y-auto">
            {{ hex }}
          </div>
          <pre v-else-if="envelopeOutputMode === 'diag' && diagnostic" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre max-h-48">{{ diagnostic }}</pre>
        </div>

        <!-- UR String -->
        <div v-if="ur">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">UR String</h4>
            <UButton
              :icon="copiedLabel === 'ur' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copiedLabel === 'ur' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              @click="copyToClipboard(ur, 'ur')"
            />
          </div>
          <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-h-32 overflow-y-auto">
            {{ ur }}
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
