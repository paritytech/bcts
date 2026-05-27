<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import { PublicKeys } from '@bcts/components'

const {
  activeDoc, activeIdentity, setActive, keyInventory,
  updateActiveKeyPermissions, rotateActiveKey, advanceProvenance, completeAndAdvance,
} = useXidTutorial()

const findName = ref('laptop-key')
const findResult = ref<{ found: boolean, permissions: Privilege[] } | null>(null)

const selectedNickname = ref('laptop-key')
const permToDrop = ref<Privilege | undefined>(Privilege.Access)
const dropDone = ref(false)

const rotateNickname = ref('laptop-key-v2')
const rotatedUr = ref('')
const rotateDone = ref(false)

const operationalNicknames = computed(() =>
  keyInventory.value.filter(k => !k.isInception).map(k => ({ label: k.nickname, value: k.nickname })),
)
const selectedEntry = computed(() => keyInventory.value.find(k => k.nickname === selectedNickname.value) ?? null)
const droppablePermissions = computed(() =>
  (selectedEntry.value?.permissions ?? []).map(p => ({ label: String(p), value: p })),
)

function handleFind() {
  const entry = keyInventory.value.find(k => k.nickname === findName.value.trim())
  findResult.value = entry
    ? { found: true, permissions: entry.permissions }
    : { found: false, permissions: [] }
}

function handleDrop() {
  const entry = selectedEntry.value
  if (!entry || permToDrop.value === undefined) return
  const pub = PublicKeys.fromURString(entry.pubKeysUr)
  const newAllow = entry.permissions.filter(p => p !== permToDrop.value)
  if (updateActiveKeyPermissions(pub, newAllow)) dropDone.value = true
}

function handleRotate() {
  const entry = selectedEntry.value
  if (!entry) return
  const pub = PublicKeys.fromURString(entry.pubKeysUr)
  const newNick = rotateNickname.value.trim() || `${entry.nickname}-v2`
  const side = rotateActiveKey(pub, newNick, 'Ed25519', entry.permissions)
  if (side) {
    rotatedUr.value = side.pubKeys.urString()
    rotateDone.value = true
    selectedNickname.value = newNick
  }
}

function handleAdvance() { advanceProvenance() }

onMounted(() => {
  if (activeIdentity.value !== 'amira') setActive('amira')
})

const canContinue = computed(() => dropDone.value || rotateDone.value)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">♻️</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Updating Keys</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Keys aren't forever — they get over-provisioned, or need rotating after loss. XIDs let you
        change a key's <em>permissions</em> and <em>rotate</em> a key (add the new, remove the old)
        while the identifier itself stays constant.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" description="Go back to §1.3." />
    <UAlert v-else-if="operationalNicknames.length === 0" color="warning" icon="i-heroicons-exclamation-triangle" title="No operational keys" description="Add a laptop/portable key in §5.1 first." />

    <template v-if="activeDoc && operationalNicknames.length > 0">
      <UAlert
        color="info" variant="subtle" icon="i-heroicons-book-open"
        title="Amira's story"
        description="Amira realises she over-powered her laptop key with 'access' — she's never put any resources under her XID's control. Least-necessary says: drop it. Later she'll rotate the laptop key entirely."
      />

      <!-- Card A: find by name -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">1. Find a key by name</h3>
        <div class="flex gap-2 items-end">
          <UFormField label="Nickname" class="flex-1">
            <UInput v-model="findName" class="w-full" />
          </UFormField>
          <UButton label="Find" icon="i-heroicons-magnifying-glass" color="neutral" variant="outline" @click="handleFind" />
        </div>
        <div v-if="findResult" class="text-sm">
          <template v-if="findResult.found">
            <span class="text-gray-500">Permissions:</span>
            <UBadge v-for="p in findResult.permissions" :key="String(p)" size="xs" color="primary" variant="soft" class="ml-1">{{ p }}</UBadge>
          </template>
          <UAlert v-else color="warning" variant="subtle" title="No key with that nickname" />
        </div>
      </div>

      <!-- Card B: drop a permission -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">2. Change key permissions</h3>
        <div class="flex flex-wrap gap-2 items-end">
          <UFormField label="Key" class="flex-1 min-w-40">
            <USelect v-model="selectedNickname" :items="operationalNicknames" class="w-full" />
          </UFormField>
          <UFormField label="Permission to drop" class="flex-1 min-w-40">
            <USelect v-model="permToDrop" :items="droppablePermissions" class="w-full" />
          </UFormField>
          <UButton label="Drop permission" icon="i-heroicons-minus-circle" color="warning" @click="handleDrop" />
        </div>
        <div v-if="dropDone" class="text-sm">
          <UAlert color="success" variant="subtle" icon="i-heroicons-check-circle" title="Permission updated" />
          <div class="mt-1">
            <span class="text-gray-500">{{ selectedEntry?.nickname }} now allows:</span>
            <UBadge v-for="p in selectedEntry?.permissions ?? []" :key="String(p)" size="xs" color="primary" variant="soft" class="ml-1">{{ p }}</UBadge>
          </div>
        </div>
      </div>

      <!-- Card C: rotate -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">3. Rotate a key</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Rotation = add the replacement, then remove the old key. The new key inherits the
          (now-trimmed) permission set.
        </p>
        <div class="flex flex-wrap gap-2 items-end">
          <UFormField label="Replace key" class="flex-1 min-w-40">
            <USelect v-model="selectedNickname" :items="operationalNicknames" class="w-full" />
          </UFormField>
          <UFormField label="New nickname" class="flex-1 min-w-40">
            <UInput v-model="rotateNickname" class="w-full" />
          </UFormField>
          <UButton label="Rotate key" icon="i-heroicons-arrow-path-rounded-square" color="primary" @click="handleRotate" />
        </div>
        <div v-if="rotateDone" class="space-y-1">
          <UAlert color="success" variant="subtle" icon="i-heroicons-check-circle" title="Key rotated — old key removed" />
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-24">{{ rotatedUr }}</pre>
          <UButton label="Advance provenance & re-publish" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="handleAdvance" />
        </div>
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

      <div class="flex justify-end">
        <UButton
          label="Continue to §5.3"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(15)"
        />
      </div>
    </template>
  </div>
</template>
