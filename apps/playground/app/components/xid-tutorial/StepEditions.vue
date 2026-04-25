<script setup lang="ts">
import type { Envelope } from '@bcts/envelope'
import { Envelope as EnvelopeClass } from '@bcts/envelope'
import { XIDDocument, XIDVerifySignature } from '@bcts/xid'
import { compareProvenanceMarks } from '@/utils/xid-tutorial/provenance'
import { exportPublicEnvelope } from '@/utils/xid-tutorial/identity'

const {
  activeDoc, edgeList, advanceProvenance,
  removeEdgeFromActive, completeAndAdvance,
} = useXidTutorial()

const selectedEdgeIndex = ref(0)
const removalPerformed = ref(false)
const afterTree = ref('')

// Edition comparison tool
const paste1 = ref('')
const paste2 = ref('')
const comparisonResult = ref<{
  sequences: number[]
  sameChain: boolean
  latestIndex: number
  issues: string[]
} | null>(null)

function handleRemove() {
  const edge = edgeList.value[selectedEdgeIndex.value]
  if (!edge) return
  removeEdgeFromActive(edge.envelope)
  removalPerformed.value = true
  // Render the updated XID
  try {
    const doc = activeDoc.value
    if (doc) afterTree.value = exportPublicEnvelope(doc).treeFormat()
  } catch { /* */ }
}

function handleAdvance() { advanceProvenance() }

function parseUrl(ur: string): Envelope | null {
  try { return (EnvelopeClass as unknown as { fromURString(s: string): Envelope }).fromURString(ur.trim()) }
  catch { return null }
}

function handleCompare() {
  const env1 = parseUrl(paste1.value)
  const env2 = parseUrl(paste2.value)
  if (!env1 || !env2) return
  try {
    const docs = [env1, env2].map(e => XIDDocument.fromEnvelope(e, undefined, XIDVerifySignature.None))
    const marks = docs.map(d => d.provenance()).filter((m): m is NonNullable<typeof m> => m !== undefined)
    if (marks.length !== 2) {
      comparisonResult.value = { sequences: [], sameChain: false, latestIndex: -1, issues: ['One or both XIDs have no provenance mark'] }
      return
    }
    const comp = compareProvenanceMarks(marks)
    comparisonResult.value = {
      sequences: comp.sequences,
      sameChain: comp.sameChain,
      latestIndex: comp.latestIndex,
      issues: comp.issues,
    }
  } catch (e) {
    comparisonResult.value = { sequences: [], sameChain: false, latestIndex: -1, issues: [e instanceof Error ? e.message : 'Failed'] }
  }
}

function useCurrent(slot: 'paste1' | 'paste2') {
  const doc = activeDoc.value
  if (!doc) return
  try {
    const ur = exportPublicEnvelope(doc).urString()
    if (slot === 'paste1') paste1.value = ur
    else paste2.value = ur
  } catch { /* */ }
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">♻️</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">New Editions</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Views are reversible; editions are not. Removing content entirely creates a new edition
        with implicit revocation — anything absent in the newer edition is revoked. Provenance
        marks tell verifiers which edition is newest and whether they're part of the same chain.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" title="Need a XID first" />

    <template v-if="activeDoc">
      <UAlert
        color="warning" variant="subtle" icon="i-heroicons-exclamation-triangle"
        title="XIDs are forever"
        description="Removing content doesn't unpublish previously shared editions. It just tells future recipients that the content is no longer supported. Think carefully before publishing anything sensitive."
      />

      <!-- Remove content -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Permanently remove an edge</h3>
        <UAlert v-if="edgeList.length === 0" color="info" title="No edges — go to §3.1 first" />
        <template v-else>
          <UFormField label="Edge to remove">
            <USelect
              v-model="selectedEdgeIndex"
              :items="edgeList.map((e, i) => ({ label: `Edge ${i + 1} · ${e.digestHex.slice(0, 12)}…`, value: i }))"
              class="w-full"
            />
          </UFormField>
          <UButton
            label="Remove edge (creates new edition)"
            color="warning" icon="i-heroicons-trash"
            :disabled="removalPerformed"
            @click="handleRemove"
          />
          <UButton v-if="removalPerformed" label="Advance provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="handleAdvance" />
        </template>
      </div>

      <div v-if="afterTree" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">Updated XID</h3>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ afterTree }}</pre>
      </div>

      <!-- Edition comparison -->
      <div class="rounded-lg border-2 border-sky-200 dark:border-sky-900 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-sky-700 dark:text-sky-300">Compare editions (SecurityMaintainer scenario)</h3>
        <p class="text-sm text-sky-800 dark:text-sky-200">
          Given two copies of a XID, use provenance marks to pick the newest and detect whether
          both belong to the same chain.
        </p>
        <UFormField label="Edition A (UR)">
          <UTextarea v-model="paste1" :rows="2" class="w-full font-mono text-xs" />
        </UFormField>
        <UButton size="xs" variant="outline" label="Use current XID" @click="useCurrent('paste1')" />
        <UFormField label="Edition B (UR)">
          <UTextarea v-model="paste2" :rows="2" class="w-full font-mono text-xs" />
        </UFormField>
        <UButton size="xs" variant="outline" label="Use current XID" @click="useCurrent('paste2')" />
        <UButton label="Compare" icon="i-heroicons-arrows-right-left" color="primary" @click="handleCompare" />

        <div v-if="comparisonResult" class="space-y-2 text-sm">
          <UAlert
            v-if="comparisonResult.sameChain"
            color="success" icon="i-heroicons-check-circle"
            title="Same chain"
            :description="`Seqs ${comparisonResult.sequences.join(' vs ')}. Newer edition: index ${comparisonResult.latestIndex} (seq ${comparisonResult.sequences[comparisonResult.latestIndex]}).`"
          />
          <UAlert
            v-else
            color="error" icon="i-heroicons-x-circle"
            title="Different chains — possible forgery"
          />
          <div v-if="comparisonResult.issues.length" class="text-xs text-amber-600">
            Issues: {{ comparisonResult.issues.join(', ') }}
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Finish tutorial"
          trailing-icon="i-heroicons-check-circle"
          color="success" size="lg"
          @click="completeAndAdvance(13)"
        />
      </div>
    </template>
  </div>
</template>
