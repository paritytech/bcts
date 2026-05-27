<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import type { Envelope } from '@bcts/envelope'

const {
  activeDoc, activeIdentity, setActive, keyInventory,
  addOperationalKeyToActive, buildOperationalEnvelope, advanceProvenance,
  completeAndAdvance,
} = useXidTutorial()

// Operational privileges Amira can grant a day-to-day key. Management
// privileges (delegate/verify/update/transfer/elect/burn/revoke) deliberately
// stay with the inception key — least-necessary design.
const OPERATIONAL_PRIVILEGES: { value: Privilege, label: string }[] = [
  { value: Privilege.Auth, label: 'auth' },
  { value: Privilege.Sign, label: 'sign' },
  { value: Privilege.Encrypt, label: 'encrypt' },
  { value: Privilege.Elide, label: 'elide' },
  { value: Privilege.Issue, label: 'issue' },
  { value: Privilege.Access, label: 'access' },
]

const LAPTOP_PRESET: Privilege[] = [
  Privilege.Auth, Privilege.Sign, Privilege.Encrypt, Privilege.Elide, Privilege.Issue, Privilege.Access,
]
const PORTABLE_PRESET: Privilege[] = [Privilege.Auth, Privilege.Sign, Privilege.Elide, Privilege.Access]

const nickname = ref('laptop-key')
const selected = ref<Privilege[]>([...LAPTOP_PRESET])
const lastAddedUr = ref('')
const addedCount = ref(0)

const operationalTree = ref('')
const operationalBuilt = ref(false)

function applyPreset(preset: 'laptop' | 'portable') {
  if (preset === 'laptop') {
    nickname.value = 'laptop-key'
    selected.value = [...LAPTOP_PRESET]
  } else {
    nickname.value = 'portable-key'
    selected.value = [...PORTABLE_PRESET]
  }
}

function toggle(p: Privilege) {
  selected.value = selected.value.includes(p)
    ? selected.value.filter(x => x !== p)
    : [...selected.value, p]
}

function handleAddKey() {
  const name = nickname.value.trim()
  if (!name || selected.value.length === 0) return
  const side = addOperationalKeyToActive(name, 'Ed25519', selected.value)
  if (side) {
    lastAddedUr.value = side.pubKeys.urString()
    addedCount.value++
  }
}

function handleBuildOperational() {
  const env: Envelope | null = buildOperationalEnvelope()
  if (env) {
    operationalTree.value = env.treeFormat()
    operationalBuilt.value = true
  }
}

function handleAdvance() { advanceProvenance() }

onMounted(() => {
  // Chapter 5 is Amira's key-management through-line.
  if (activeIdentity.value !== 'amira') setActive('amira')
})

const canContinue = computed(() => addedCount.value > 0)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🔑</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Generating Operational Keys</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Until now a single <em>inception key</em> has controlled BRadvoc8's entire XID — if it's
        lost or stolen, the identity is gone. Following the
        <a href="https://www.blockchaincommons.com/musings/Least-Necessary/" target="_blank" class="text-primary-500 underline">least-necessary</a>
        pattern, Amira adds day-to-day <em>operational keys</em> with only the permissions each
        device needs, then derives an operational XID that omits the master key entirely.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" description="Go back to §1.3." />

    <template v-if="activeDoc">
      <UAlert
        color="info" variant="subtle" icon="i-heroicons-book-open"
        title="Amira's story"
        description="Now that Amira is working on SisterSpaces, losing BRadvoc8 would mean losing four chapters of reputation. She keeps her powerful inception key offline and works with scoped operational keys: a laptop key for everyday use and a portable key for her drive."
      />

      <!-- Card A: add operational key -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Add an operational key</h3>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" color="neutral" label="Laptop preset" @click="applyPreset('laptop')" />
          <UButton size="xs" variant="outline" color="neutral" label="Portable preset" @click="applyPreset('portable')" />
        </div>
        <UFormField label="Nickname">
          <UInput v-model="nickname" class="w-full" placeholder="laptop-key" />
        </UFormField>
        <UFormField label="Permissions (--allow)">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in OPERATIONAL_PRIVILEGES"
              :key="p.label"
              type="button"
              class="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
              :class="selected.includes(p.value)
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/60'"
              @click="toggle(p.value)"
            >
              {{ p.label }}
            </button>
          </div>
        </UFormField>
        <UButton
          label="Add operational key" icon="i-heroicons-key" color="primary"
          :disabled="!nickname.trim() || selected.length === 0"
          @click="handleAddKey"
        />
        <div v-if="lastAddedUr" class="space-y-1">
          <p class="text-xs text-gray-500">Public keys (ur:crypto-pubkeys):</p>
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-24">{{ lastAddedUr }}</pre>
        </div>
      </div>

      <!-- Card B: key inventory -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Key inventory ({{ keyInventory.length }})</h3>
        <div class="space-y-2">
          <div
            v-for="k in keyInventory"
            :key="k.referenceHex"
            class="flex flex-wrap items-center gap-2 text-xs border-b border-gray-100 dark:border-gray-800/60 pb-2 last:border-0"
          >
            <UIcon :name="k.isInception ? 'i-heroicons-star' : 'i-heroicons-key'" class="w-4 h-4 shrink-0" :class="k.isInception ? 'text-amber-500' : 'text-gray-400'" />
            <span class="font-medium">{{ k.nickname }}</span>
            <UBadge v-if="k.isInception" size="xs" color="warning" variant="subtle">inception</UBadge>
            <UBadge size="xs" color="neutral" variant="subtle">{{ k.scheme }}</UBadge>
            <span class="flex-1" />
            <UBadge v-for="perm in k.permissions" :key="perm" size="xs" color="primary" variant="soft">{{ perm }}</UBadge>
          </div>
        </div>
      </div>

      <!-- Card C: operational XID -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Create the operational XID</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The operational XID is an elided-private copy with the inception (master) key removed,
          so a compromised laptop can't rotate keys or revoke the identity. Your full master stays
          intact here — you'll back it up in §5.3 and use it to recover in §5.5.
        </p>
        <UButton label="Build operational XID" icon="i-heroicons-cube" color="primary" @click="handleBuildOperational" />
        <div v-if="operationalBuilt" class="space-y-2">
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-72">{{ operationalTree }}</pre>
          <UButton label="Advance provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="handleAdvance" />
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §5.2"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(14)"
        />
      </div>
    </template>
  </div>
</template>
