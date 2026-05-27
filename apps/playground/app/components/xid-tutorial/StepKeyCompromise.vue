<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import type { Envelope } from '@bcts/envelope'
import { trySskrJoin } from '@/utils/xid-tutorial/backup'
import { loadXidFromUr } from '@/utils/xid-tutorial/identity'

const {
  activeDoc, activeSlot, activeIdentity, setActive, keyInventory, getArtifact,
  removeActiveKeyByNickname, addOperationalKeyToActive, advanceProvenance,
  buildOperationalEnvelope, completeAndAdvance,
} = useXidTutorial()

// Step A — reconstruct authority from §5.3 shares
const recover1 = ref('')
const recover2 = ref('')
const reconstructResult = ref<{ ok: boolean, message: string } | null>(null)

// Step B — revoke + re-key
const revokeNickname = ref('')
const revokeDone = ref(false)
const rekeyDone = ref(false)
const provenanceAdvanced = ref(false)

// Step C — rebuild operational view
const operationalTree = ref('')
const operationalBuilt = ref(false)

const operationalNicknames = computed(() =>
  keyInventory.value.filter(k => !k.isInception).map(k => ({ label: k.nickname, value: k.nickname })),
)

function handleReconstruct() {
  const provided = [recover1.value, recover2.value].map(s => s.trim()).filter(Boolean)
  if (provided.length < 2) {
    reconstructResult.value = { ok: false, message: 'Paste at least 2 shares from §5.3.' }
    return
  }
  const res = trySskrJoin(provided)
  if (!res.ok) {
    reconstructResult.value = { ok: false, message: `Reconstruction failed: ${res.reason}` }
    return
  }
  try {
    const doc = loadXidFromUr(res.env.urString(), activeSlot.value.password || undefined)
    const seq = doc.provenance()?.seq()
    reconstructResult.value = {
      ok: true,
      message: seq !== undefined
        ? `Recovered the master XID — provenance sequence ${seq}, chain intact.`
        : 'Recovered the master XID.',
    }
  } catch (e) {
    reconstructResult.value = { ok: false, message: e instanceof Error ? e.message : 'Could not load recovered XID' }
  }
}

function handleRevoke() {
  const name = revokeNickname.value
  if (!name) return
  if (removeActiveKeyByNickname(name)) revokeDone.value = true
}

function handleRekey() {
  const base = revokeNickname.value || 'operational-key'
  const side = addOperationalKeyToActive(`${base}-may2026`, 'Ed25519', [
    Privilege.Auth, Privilege.Sign, Privilege.Elide, Privilege.Access,
  ])
  if (side) rekeyDone.value = true
}

function handleAdvance() {
  advanceProvenance()
  provenanceAdvanced.value = true
}

function handleRebuild() {
  const env: Envelope | null = buildOperationalEnvelope()
  if (env) {
    operationalTree.value = env.treeFormat()
    operationalBuilt.value = true
  }
}

onMounted(() => {
  if (activeIdentity.value !== 'amira') setActive('amira')
  // Pre-fill from the shares §5.3 stashed.
  const stashed = getArtifact('inception-backup-shares')
  if (stashed) {
    try {
      const arr = JSON.parse(stashed) as string[]
      recover1.value = arr[0] ?? ''
      recover2.value = arr[1] ?? ''
    } catch { /* */ }
  }
  // Default the revoke target to the first operational key.
  const first = operationalNicknames.value[0]
  if (first) revokeNickname.value = first.value
})

const canFinish = computed(() => operationalBuilt.value)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🚨</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Responding to Key Compromise</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        The worst case: an operational key is compromised. Because Amira kept her master key
        offline and SSKR-backed (§5.3), she can recover her full authority, revoke the bad keys,
        rotate in replacements, advance provenance, and rebuild a clean operational XID — all
        while keeping the same identifier.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" description="Go back to §1.3." />

    <template v-if="activeDoc">
      <UAlert
        color="error" variant="subtle" icon="i-heroicons-exclamation-triangle"
        title="Scenario: compromise"
        description="Amira discovers one of her operational keys was exposed. Any signatures it made are now suspect. Time to recover authority and re-key."
      />

      <!-- Step A: reconstruct -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">1. Reconstruct your authority (from §5.3 shares)</h3>
        <UAlert
          v-if="!recover1 && !recover2" color="warning" variant="subtle"
          title="No backup shares found"
          description="Run §5.3 first to generate and stash your 2-of-3 shares, or paste any two shares below."
        />
        <UFormField label="Share A"><UTextarea v-model="recover1" :rows="2" class="w-full font-mono text-xs" /></UFormField>
        <UFormField label="Share B"><UTextarea v-model="recover2" :rows="2" class="w-full font-mono text-xs" /></UFormField>
        <UButton label="Reconstruct master XID" icon="i-heroicons-puzzle-piece" color="primary" @click="handleReconstruct" />
        <UAlert
          v-if="reconstructResult" :color="reconstructResult.ok ? 'success' : 'error'"
          :icon="reconstructResult.ok ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
          :title="reconstructResult.ok ? 'Authority recovered' : 'Reconstruction failed'"
          :description="reconstructResult.message"
        />
      </div>

      <!-- Step B: revoke + re-key -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">2. Revoke the compromised key &amp; re-key</h3>
        <div class="flex flex-wrap gap-2 items-end">
          <UFormField label="Compromised key" class="flex-1 min-w-40">
            <USelect v-model="revokeNickname" :items="operationalNicknames" class="w-full" />
          </UFormField>
          <UButton label="Revoke key" icon="i-heroicons-trash" color="error" :disabled="!revokeNickname || revokeDone" @click="handleRevoke" />
        </div>
        <UAlert v-if="revokeDone" color="success" variant="subtle" icon="i-heroicons-check-circle" title="Compromised key removed" />
        <template v-if="revokeDone">
          <UButton label="Add replacement key (…-may2026)" icon="i-heroicons-key" color="primary" :disabled="rekeyDone" @click="handleRekey" />
          <UAlert v-if="rekeyDone" color="success" variant="subtle" icon="i-heroicons-check-circle" title="Replacement key added" />
        </template>
        <template v-if="rekeyDone">
          <UButton label="Advance provenance & re-publish" icon="i-heroicons-arrow-path" variant="outline" color="neutral" :disabled="provenanceAdvanced" @click="handleAdvance" />
          <UAlert v-if="provenanceAdvanced" color="success" variant="subtle" icon="i-heroicons-check-circle" title="Provenance advanced" />
        </template>
      </div>

      <!-- live inventory -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">Key inventory ({{ keyInventory.length }})</h3>
        <div
          v-for="k in keyInventory"
          :key="k.referenceHex"
          class="flex flex-wrap items-center gap-2 text-xs border-b border-gray-100 dark:border-gray-800/60 pb-2 last:border-0"
        >
          <UIcon :name="k.isInception ? 'i-heroicons-star' : 'i-heroicons-key'" class="w-4 h-4 shrink-0" :class="k.isInception ? 'text-amber-500' : 'text-gray-400'" />
          <span class="font-medium">{{ k.nickname }}</span>
          <span class="flex-1" />
          <UBadge v-for="perm in k.permissions" :key="perm" size="xs" color="primary" variant="soft">{{ perm }}</UBadge>
        </div>
      </div>

      <!-- Step C: rebuild operational view -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">3. Rebuild the operational XID</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          With the bad keys gone and replacements in place, regenerate the operational XID
          (inception key elided) for daily use.
        </p>
        <UButton label="Rebuild operational XID" icon="i-heroicons-cube" color="primary" @click="handleRebuild" />
        <pre v-if="operationalBuilt" class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-72">{{ operationalTree }}</pre>
      </div>

      <div v-if="canFinish" class="rounded-lg border border-green-200 dark:border-green-900 p-4 bg-green-50/30 dark:bg-green-950/10">
        <h3 class="text-sm font-semibold text-green-700 dark:text-green-300">Chapter 5 complete 🎉</h3>
        <p class="text-sm text-gray-700 dark:text-gray-300 mt-1">
          You've generated operational keys, updated and rotated them, backed up your inception and
          SSH keys with SSKR, and recovered from a compromise — all without changing your XID.
        </p>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Finish tutorial"
          trailing-icon="i-heroicons-check-circle"
          color="success" size="lg"
          :disabled="!canFinish"
          @click="completeAndAdvance(18)"
        />
      </div>
    </template>
  </div>
</template>
