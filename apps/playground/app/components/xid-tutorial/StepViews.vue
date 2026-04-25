<script setup lang="ts">
import type { Envelope } from '@bcts/envelope'
import { exportPublicEnvelope } from '@/utils/xid-tutorial/identity'

const { activeDoc, keyList, edgeList, verifySignature, completeAndAdvance } = useXidTutorial()

interface ViewEntry {
  id: string
  name: string
  envelope: Envelope
  tree: string
  digestHex: string
  sigValid: boolean | null
}

const savedViews = shallowRef<ViewEntry[]>([])
const viewName = ref('Public view')
const selectedEdgeIndices = ref<number[]>([])
const selectedKeyIndices = ref<number[]>([])

function handleGenerateView() {
  const doc = activeDoc.value
  if (!doc) return
  let env: Envelope
  try { env = exportPublicEnvelope(doc) } catch { return }

  // Elide selected edges
  for (const i of selectedEdgeIndices.value) {
    const edge = edgeList.value[i]
    if (!edge) continue
    try { env = env.elideRemovingTarget(edge.envelope) }
    catch { /* already elided */ }
  }
  // Elide selected keys
  for (const i of selectedKeyIndices.value) {
    const k = keyList.value[i]
    if (!k) continue
    try { env = env.elideRemovingTarget(k as unknown as { digest(): import('@bcts/envelope').Digest }) }
    catch { /* */ }
  }

  // Re-verify
  let sigValid: boolean | null = null
  try { sigValid = verifySignature() && true } catch { sigValid = false }

  const entry: ViewEntry = {
    id: crypto.randomUUID(),
    name: viewName.value || `View ${savedViews.value.length + 1}`,
    envelope: env,
    tree: env.treeFormat(),
    digestHex: env.digest().hex(),
    sigValid,
  }
  savedViews.value = [...savedViews.value, entry]
}

const baseDigest = computed(() => {
  const doc = activeDoc.value
  if (!doc) return ''
  try { return exportPublicEnvelope(doc).digest().hex() }
  catch { return '' }
})
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">👁️</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Creating New Views</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        A single edition can have many <strong>views</strong> — different combinations of elided
        content for different recipients. The root digest stays the same across views, so the
        signature always verifies. Give each view a name and save it per recipient.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" title="Need a XID first" />

    <template v-if="activeDoc">
      <UAlert
        color="info" variant="subtle" icon="i-heroicons-book-open"
        title="Amira's story"
        description="Amira's XID has grown: multiple keys, three edges. For a quick hello to a new contact, she doesn't need to expose her whole history. She builds a per-recipient view that elides her contract key and the possibly-correlating parts of DevReviewer's endorsement context."
      />

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Pick what to elide</h3>
        <UFormField label="View name">
          <UInput v-model="viewName" placeholder="View for Ben" class="w-full" />
        </UFormField>

        <div>
          <div class="text-xs font-semibold text-gray-500 mb-2 uppercase">Keys ({{ keyList.length }})</div>
          <div class="space-y-1">
            <label
              v-for="(k, i) in keyList"
              :key="i"
              class="flex items-center gap-2 text-sm"
            >
              <UCheckbox
                :model-value="selectedKeyIndices.includes(i)"
                @update:model-value="() => {
                  const s = new Set(selectedKeyIndices)
                  s.has(i) ? s.delete(i) : s.add(i)
                  selectedKeyIndices = [...s]
                }"
              />
              <UIcon name="i-heroicons-key" class="w-4 h-4 text-gray-400" />
              <span>{{ k.nickname() || '(no nickname)' }}</span>
            </label>
          </div>
        </div>

        <div>
          <div class="text-xs font-semibold text-gray-500 mb-2 uppercase">Edges ({{ edgeList.length }})</div>
          <div v-if="edgeList.length === 0" class="text-xs text-gray-400 italic">No edges on this XID yet</div>
          <div v-else class="space-y-1">
            <label
              v-for="(e, i) in edgeList"
              :key="i"
              class="flex items-center gap-2 text-sm"
            >
              <UCheckbox
                :model-value="selectedEdgeIndices.includes(i)"
                @update:model-value="() => {
                  const s = new Set(selectedEdgeIndices)
                  s.has(i) ? s.delete(i) : s.add(i)
                  selectedEdgeIndices = [...s]
                }"
              />
              <UIcon name="i-heroicons-link" class="w-4 h-4 text-gray-400" />
              <span class="font-mono text-xs truncate">{{ e.digestHex.slice(0, 16) }}…</span>
            </label>
          </div>
        </div>

        <UButton label="Generate view" icon="i-heroicons-eye" color="primary" @click="handleGenerateView" />
      </div>

      <div v-if="baseDigest" class="text-xs text-gray-500">
        Base edition digest: <code class="break-all">{{ baseDigest.slice(0, 24) }}…</code>
      </div>

      <div v-if="savedViews.length" class="space-y-3">
        <h3 class="text-sm font-semibold">Saved views</h3>
        <div
          v-for="v in savedViews"
          :key="v.id"
          class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-eye" class="w-4 h-4 text-primary-500" />
              <span class="text-sm font-medium">{{ v.name }}</span>
              <UBadge
                v-if="v.digestHex === baseDigest"
                color="success" size="xs" variant="subtle"
              >
                same root digest
              </UBadge>
              <UBadge v-else color="warning" size="xs" variant="subtle">
                different digest
              </UBadge>
            </div>
            <UBadge v-if="v.sigValid" color="success" size="xs" variant="subtle">✅ sig valid</UBadge>
          </div>
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ v.tree }}</pre>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §4.4"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="savedViews.length === 0"
          @click="completeAndAdvance(12)"
        />
      </div>
    </template>
  </div>
</template>
