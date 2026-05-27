<script setup lang="ts">
import { Envelope } from '@bcts/envelope'
import { CONFORMS_TO, VERIFIABLE_AT } from '@bcts/known-values'
import { passwordEncrypt, sskrSplitEnvelope, trySskrJoin } from '@/utils/xid-tutorial/backup'

const {
  activeSlot, activeDoc, activeIdentity, setActive, generateSshKey, sshPublicKeyText,
  completeAndAdvance,
} = useXidTutorial()

const githubName = ref('BRadvoc8')
const password = ref('amira')

const wrappedTree = ref('')
const wrappedEnv = shallowRef<Envelope | null>(null)

const encryptedTree = ref('')
const encryptedEnv = shallowRef<Envelope | null>(null)
const encrypting = ref(false)

const shares = ref<string[]>([])
const recoveryResult = ref<{ ok: boolean, message: string } | null>(null)

const hasSshKey = computed(() => activeSlot.value.sshKey !== null)
const sshKeyText = computed(() => {
  const ssh = activeSlot.value.sshKey
  return ssh ? sshPublicKeyText(ssh.pubKeys) : ''
})

function handleGenerateSsh() {
  generateSshKey('amira')
}

function handleWrap() {
  const ssh = activeSlot.value.sshKey
  if (!ssh) return
  const name = githubName.value.trim()
  // Mirror upstream §5.4: subject = the SSH PrivateKeys (a tagged-CBOR leaf),
  // then metadata assertions. `subject type ur $SSH_PRVKEYS` == newLeaf(taggedCbor).
  const env = Envelope.newLeaf(ssh.prvKeys.taggedCbor())
    .addAssertion('keyType', 'signingKey')
    .addAssertion(CONFORMS_TO, 'https://github.com')
    .addAssertion(VERIFIABLE_AT, `https://api.github.com/users/${name}`)
    .addAssertion('accountName', name)
  wrappedEnv.value = env
  wrappedTree.value = env.format()
}

async function handleEncrypt() {
  if (!wrappedEnv.value) return
  encrypting.value = true
  recoveryResult.value = null
  await nextTick()
  try {
    const enc = passwordEncrypt(wrappedEnv.value, password.value)
    encryptedEnv.value = enc
    encryptedTree.value = enc.format()
  } finally {
    encrypting.value = false
  }
}

function handleSplit() {
  if (!encryptedEnv.value) return
  const result = sskrSplitEnvelope(encryptedEnv.value, 1, [[2, 3]])
  shares.value = result
  // Verify all three pairwise combinations recover the same digest.
  const original = encryptedEnv.value.digest().hex()
  const combos: [number, number][] = [[0, 1], [1, 2], [0, 2]]
  const allMatch = combos.every(([a, b]) => {
    const res = trySskrJoin([result[a] ?? '', result[b] ?? ''])
    return res.ok && res.env.digest().hex() === original
  })
  recoveryResult.value = allMatch
    ? { ok: true, message: 'All three 2-of-3 combinations recover the encrypted key.' }
    : { ok: false, message: 'One or more share combinations failed to recover.' }
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
        <span class="text-2xl">🔐</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Backing Up Your SSH Key</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Your XID isn't the only key worth protecting. Amira's SSH signing key (the one GitHub has
        on file, from §3.1) deserves the same treatment: wrap it in an annotated envelope,
        password-encrypt it, then SSKR-shard it for resilient backup.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" description="Go back to §1.3." />

    <template v-if="activeDoc">
      <!-- SSH key -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">SSH signing key</h3>
        <div v-if="hasSshKey" class="space-y-1">
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
            <span>SSH signing key ready.</span>
          </div>
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-2 rounded-md overflow-auto">{{ sshKeyText }}</pre>
        </div>
        <UButton v-else label="Generate SSH signing key" icon="i-heroicons-key" color="primary" @click="handleGenerateSsh" />
      </div>

      <template v-if="hasSshKey">
        <!-- Card A: wrap + annotate -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 class="text-sm font-semibold">1. Wrap the key + add metadata</h3>
          <UFormField label="GitHub account">
            <UInput v-model="githubName" class="w-full" />
          </UFormField>
          <UButton label="Build key envelope" icon="i-heroicons-document-text" color="primary" @click="handleWrap" />
          <pre v-if="wrappedTree" class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-72">{{ wrappedTree }}</pre>
        </div>

        <!-- Card B: encrypt -->
        <div v-if="wrappedEnv" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 class="text-sm font-semibold">2. Encrypt with a password</h3>
          <UFormField label="Password (Argon2id)">
            <UInput v-model="password" class="w-full" />
          </UFormField>
          <UButton label="Encrypt key envelope" icon="i-heroicons-lock-closed" color="primary" :loading="encrypting" :disabled="encrypting" @click="handleEncrypt" />
          <pre v-if="encryptedTree" class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-48">{{ encryptedTree }}</pre>
        </div>

        <!-- Card C: shard -->
        <div v-if="encryptedEnv" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h3 class="text-sm font-semibold">3. Shard the encrypted key (2-of-3)</h3>
          <UButton label="Split into 3 shares" icon="i-heroicons-scissors" color="primary" @click="handleSplit" />
          <div v-if="shares.length" class="space-y-2">
            <div v-for="(s, i) in shares" :key="i" class="space-y-1">
              <p class="text-xs font-medium text-gray-600 dark:text-gray-400">Share {{ i + 1 }}</p>
              <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-2 rounded-md overflow-auto">{{ shortShare(s) }}</pre>
            </div>
          </div>
          <UAlert
            v-if="recoveryResult" :color="recoveryResult.ok ? 'success' : 'error'"
            :icon="recoveryResult.ok ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
            :title="recoveryResult.ok ? 'All combinations verified' : 'Recovery failed'"
            :description="recoveryResult.message"
          />
        </div>
      </template>

      <div class="flex justify-end">
        <UButton
          label="Continue to §5.5"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(17)"
        />
      </div>
    </template>
  </div>
</template>
