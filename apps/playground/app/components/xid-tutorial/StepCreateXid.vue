<script setup lang="ts">
const {
  xidDocument,
  xidHex,
  xidUrString,
  xidBytewords,
  xidBytemojis,
  error,
  keyList,
  createXid,
  getPublicEnvelope,
  getPrivateEnvelope,
  getKeyAlgorithm,
  completeAndAdvance,
} = useXidTutorial()

const nickname = ref('BRadvoc8')
const scheme = ref('Ed25519')
const withProvenance = ref(false)
const passphrase = ref('')
const privateTree = ref('')
const publicTree = ref('')
const copied = ref<string | null>(null)

const schemeOptions = [
  { label: 'Ed25519 (Recommended)', value: 'Ed25519' },
  { label: 'Schnorr', value: 'Schnorr' },
  { label: 'ECDSA', value: 'ECDSA' },
]

function handleCreate() {
  createXid(nickname.value, scheme.value as 'Ed25519' | 'Schnorr' | 'ECDSA', withProvenance.value, passphrase.value || undefined)
  updateTrees()
}

function updateTrees() {
  nextTick(() => {
    try {
      const priv = getPrivateEnvelope()
      privateTree.value = priv ? priv.treeFormat() : ''
    } catch { privateTree.value = '' }
    try {
      const pub = getPublicEnvelope()
      publicTree.value = pub ? pub.treeFormat() : ''
    } catch { publicTree.value = '' }
  })
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = label
    setTimeout(() => { copied.value = null }, 1500)
  } catch { /* clipboard unavailable */ }
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

const inceptionKey = computed(() => keyList.value[0] ?? null)
const algorithmName = computed(() => inceptionKey.value ? getKeyAlgorithm(inceptionKey.value) : '')
</script>

<template>
  <div class="space-y-6">
    <!-- Section 1: Introduction -->
    <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      An XID (eXtensible IDentifier) is a 32-byte cryptographic identifier derived from a public key.
      Unlike traditional usernames, your XID stays stable even through key rotation and device changes
      — your identity is truly yours.
    </p>

    <!-- Section 2: Concept Cards -->
    <div class="space-y-3">
      <XidTutorialConceptCard title="What is an XID?" icon="i-heroicons-finger-print">
        XIDs are 32-byte identifiers derived from your inception public key. They serve as a stable,
        pseudonymous identity anchor that persists through key rotation, device changes, and recovery
        scenarios. Think of it as a permanent cryptographic username.
      </XidTutorialConceptCard>

      <XidTutorialConceptCard title="Gordian Envelope" icon="i-heroicons-envelope">
        XID Documents are encoded as Gordian Envelopes — a structured format that supports
        subject-predicate-object assertions, digital signatures, and selective disclosure through
        cryptographic elision. This means you can share only what's necessary while proving
        authenticity.
      </XidTutorialConceptCard>
    </div>

    <!-- Section 3: Create Form -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Create Your XID</h3>

      <UFormField label="Nickname">
        <UInput v-model="nickname" placeholder="BRadvoc8" class="w-full" />
      </UFormField>

      <UFormField label="Signing Algorithm">
        <USelect v-model="scheme" :items="schemeOptions" class="w-full" />
      </UFormField>

      <UCheckbox v-model="withProvenance" label="Enable provenance chain" />

      <UFormField v-if="withProvenance" label="Passphrase">
        <UInput
          v-model="passphrase"
          type="password"
          placeholder="Enter a passphrase for the provenance chain"
          class="w-full"
        />
      </UFormField>

      <UButton
        label="Create XID"
        color="primary"
        icon="i-heroicons-sparkles"
        @click="handleCreate"
      />

      <UAlert v-if="error" color="error" :title="error" variant="subtle" />
    </div>

    <!-- Section 4: Result -->
    <template v-if="xidDocument">
      <UAlert
        color="success"
        title="XID Created"
        :description="`Your XID for '${nickname}' has been created successfully.`"
        variant="subtle"
      />

      <!-- Identity display -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Identity Formats</h3>

        <div class="space-y-2">
          <!-- Hex -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">Hex</span>
            <code class="text-xs font-mono text-gray-800 dark:text-gray-200 truncate flex-1">{{ truncate(xidHex, 16) }}</code>
            <UButton
              :icon="copied === 'hex' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied === 'hex' ? 'success' : 'neutral'"
              variant="ghost"
              size="xs"
              @click="copyToClipboard(xidHex, 'hex')"
            />
          </div>

          <!-- Bytemojis -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">Bytemojis</span>
            <span class="text-sm flex-1 truncate">{{ xidBytemojis }}</span>
          </div>

          <!-- Bytewords -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">Bytewords</span>
            <code class="text-xs font-mono text-gray-800 dark:text-gray-200 truncate flex-1">{{ truncate(xidBytewords, 32) }}</code>
            <UButton
              :icon="copied === 'bytewords' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied === 'bytewords' ? 'success' : 'neutral'"
              variant="ghost"
              size="xs"
              @click="copyToClipboard(xidBytewords, 'bytewords')"
            />
          </div>

          <!-- UR -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">UR</span>
            <code class="text-xs font-mono text-gray-800 dark:text-gray-200 truncate flex-1">{{ truncate(xidUrString, 32) }}</code>
            <UButton
              :icon="copied === 'ur' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied === 'ur' ? 'success' : 'neutral'"
              variant="ghost"
              size="xs"
              @click="copyToClipboard(xidUrString, 'ur')"
            />
          </div>
        </div>

        <!-- Key info -->
        <div v-if="inceptionKey" class="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <UIcon name="i-heroicons-key" class="w-4 h-4 text-gray-400" />
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ algorithmName }}</span>
          <UBadge color="primary" variant="subtle" size="sm">Inception Key</UBadge>
        </div>
      </div>

      <!-- Section 5: Public vs Private -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Public vs Private View</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Your XID Document contains private keys that must stay secret. When sharing, you export a
          public view with private data removed (elided). The cryptographic structure ensures
          signatures still verify even with private data removed.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- Private View -->
          <div class="rounded-lg border-2 border-red-300 dark:border-red-800 p-3 space-y-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-red-500" />
              <span class="text-xs font-semibold text-red-600 dark:text-red-400">Private (keep secret)</span>
            </div>
            <pre class="font-mono text-xs bg-gray-950 text-gray-200 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-64">{{ privateTree }}</pre>
          </div>

          <!-- Public View -->
          <div class="rounded-lg border-2 border-green-300 dark:border-green-800 p-3 space-y-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-green-500" />
              <span class="text-xs font-semibold text-green-600 dark:text-green-400">Public (safe to share)</span>
            </div>
            <pre class="font-mono text-xs bg-gray-950 text-gray-200 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-64">{{ publicTree }}</pre>
          </div>
        </div>

        <XidTutorialConceptCard title="Data Minimization" icon="i-heroicons-eye-slash">
          Elision allows removing sensitive data from an envelope while preserving its cryptographic
          integrity. The root hash remains unchanged, so signatures still verify. You share only
          what's necessary.
        </XidTutorialConceptCard>
      </div>

      <!-- Section 6: Complete Step -->
      <div class="flex justify-end">
        <UButton
          label="Continue to Step 2"
          trailing-icon="i-heroicons-arrow-right"
          color="primary"
          size="lg"
          @click="completeAndAdvance(0)"
        />
      </div>
    </template>
  </div>
</template>
