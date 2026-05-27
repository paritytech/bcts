<script setup lang="ts">
import { sskrSplitEnvelope, trySskrJoin } from '@/utils/xid-tutorial/backup'

const {
  activeDoc, activeIdentity, setActive, getPrivateEnvelope, setArtifact, completeAndAdvance,
} = useXidTutorial()

const splitting = ref(false)
const shares = ref<string[]>([])
const originalDigest = ref('')

const recover1 = ref('')
const recover2 = ref('')
const recover3 = ref('')
const recoveryResult = ref<{ ok: boolean, message: string } | null>(null)

async function handleSplit() {
  const env = getPrivateEnvelope()
  if (!env) return
  splitting.value = true
  recoveryResult.value = null
  // Yield a frame so the spinner paints before the (possibly Argon2id-backed)
  // private-envelope build + split runs synchronously.
  await nextTick()
  try {
    originalDigest.value = env.digest().hex()
    const result = sskrSplitEnvelope(env, 1, [[2, 3]])
    shares.value = result
    recover1.value = result[0] ?? ''
    recover2.value = result[1] ?? ''
    recover3.value = ''
    // Hand the shares to §5.5 so the compromise-recovery step can pre-fill them.
    setArtifact('inception-backup-shares', JSON.stringify(result))
  } finally {
    splitting.value = false
  }
}

function handleRecover() {
  const provided = [recover1.value, recover2.value, recover3.value].map(s => s.trim()).filter(Boolean)
  if (provided.length < 2) {
    recoveryResult.value = { ok: false, message: 'Provide at least 2 shares.' }
    return
  }
  const res = trySskrJoin(provided)
  if (!res.ok) {
    recoveryResult.value = { ok: false, message: `Recovery failed: ${res.reason}` }
    return
  }
  const match = res.env.digest().hex() === originalDigest.value
  recoveryResult.value = match
    ? { ok: true, message: 'Recovered XID digest matches the original — backup verified.' }
    : { ok: false, message: 'Recovered, but digest does NOT match the original.' }
}

function shortShare(s: string): string {
  return s.length > 56 ? `${s.slice(0, 56)}…` : s
}

onMounted(() => {
  if (activeIdentity.value !== 'amira') setActive('amira')
})

const canContinue = computed(() => recoveryResult.value?.ok === true)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🧩</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Backing Up Your Inception Key</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        The operational XID protects daily use, but the master is only as safe as its backup.
        <strong>SSKR</strong> (Sharded Secret Key Reconstruction — Shamir's Secret Sharing) splits
        the XID into shares, any <em>threshold</em> of which can reconstruct it. A single lost or
        stolen share reveals nothing.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" description="Go back to §1.3." />

    <template v-if="activeDoc">
      <UAlert
        color="info" variant="subtle" icon="i-heroicons-book-open"
        title="Amira's story"
        description="Amira splits her master XID 2-of-3: one share in a safe, one with a trusted friend, one in a bank box. She must prove recovery works BEFORE relying on it — never distribute shares you haven't tested."
      />

      <!-- Card A: split -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">1. Create backup shares (2-of-3)</h3>
        <UButton
          label="Split XID into 3 shares" icon="i-heroicons-scissors" color="primary"
          :loading="splitting" :disabled="splitting"
          @click="handleSplit"
        />
        <div v-if="shares.length" class="space-y-2">
          <p class="text-xs text-gray-500">3 shares created — any 2 can recover:</p>
          <div v-for="(s, i) in shares" :key="i" class="space-y-1">
            <p class="text-xs font-medium text-gray-600 dark:text-gray-400">Share {{ i + 1 }}</p>
            <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-2 rounded-md overflow-auto">{{ shortShare(s) }}</pre>
          </div>
        </div>
      </div>

      <!-- Card B: recover -->
      <div v-if="shares.length" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">2. Test recovery before distribution</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Shares 1 &amp; 2 are pre-filled. Clear one and paste share 3 instead to prove any 2 work.
        </p>
        <UFormField label="Share A"><UTextarea v-model="recover1" :rows="2" class="w-full font-mono text-xs" /></UFormField>
        <UFormField label="Share B"><UTextarea v-model="recover2" :rows="2" class="w-full font-mono text-xs" /></UFormField>
        <UFormField label="Share C (optional)"><UTextarea v-model="recover3" :rows="2" class="w-full font-mono text-xs" /></UFormField>
        <UButton label="Reconstruct & verify" icon="i-heroicons-puzzle-piece" color="primary" @click="handleRecover" />
        <UAlert
          v-if="recoveryResult" :color="recoveryResult.ok ? 'success' : 'error'"
          :icon="recoveryResult.ok ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
          :title="recoveryResult.ok ? 'Recovery test passed' : 'Recovery test failed'"
          :description="recoveryResult.message"
        />
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §5.4"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(16)"
        />
      </div>
    </template>
  </div>
</template>
