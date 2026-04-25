<script setup lang="ts">
import { downloadEnvelope, readTextFile } from '@/utils/xid-tutorial/file-io'
import type { TutorialScheme } from '@/utils/xid-tutorial/identity'

const {
  activeSlot, activeDoc, keyList, xidHex, xidUrString, xidBytewords, xidBytemojis,
  error, createIdentity, loadIdentityFromUr, getPrivateEnvelope, getPublicEnvelope,
  verifySignature, getKeyAlgorithm, completeAndAdvance,
} = useXidTutorial()

const nickname = ref('BRadvoc8')
const scheme = ref<TutorialScheme>('Ed25519')
const password = ref("Amira's strong password")
const withProvenance = ref(true)
const copied = ref<string | null>(null)

const schemeOptions = [
  { label: 'Ed25519 (recommended)', value: 'Ed25519' },
  { label: 'Schnorr (BIP-340)', value: 'Schnorr' },
  { label: 'ECDSA (secp256k1)', value: 'ECDSA' },
]

const fileInput = ref<HTMLInputElement | null>(null)

const encryptedTree = ref('')
const publicTree = ref('')
const signatureValid = ref<boolean | null>(null)
const provenanceValid = ref<boolean | null>(null)

function handleCreate() {
  signatureValid.value = null
  provenanceValid.value = null
  createIdentity('amira', nickname.value, scheme.value, password.value, withProvenance.value)
  nextTick(updateTrees)
}

function updateTrees() {
  try {
    const priv = getPrivateEnvelope()
    encryptedTree.value = priv ? priv.treeFormat() : ''
  } catch { encryptedTree.value = '' }
  try {
    const pub = getPublicEnvelope()
    publicTree.value = pub ? pub.treeFormat() : ''
  } catch { publicTree.value = '' }
}

function handleVerifySignature() {
  signatureValid.value = verifySignature()
}

function handleValidateProvenance() {
  const doc = activeDoc.value
  if (!doc) { provenanceValid.value = false; return }
  const mark = doc.provenance()
  provenanceValid.value = mark !== undefined
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = label
    setTimeout(() => { copied.value = null }, 1500)
  } catch { /* no clipboard */ }
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

function handleDownloadPrivate() {
  const env = getPrivateEnvelope()
  if (env) downloadEnvelope(`${nickname.value}-xid-private.envelope`, env)
}

function handleDownloadPublic() {
  const env = getPublicEnvelope()
  if (env) downloadEnvelope(`${nickname.value}-xid-public.envelope`, env)
}

async function handleFileLoad(ev: Event) {
  const target = ev.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  if (!file) return
  const text = await readTextFile(file)
  loadIdentityFromUr('amira', text.trim(), password.value)
  nextTick(updateTrees)
}

const inceptionKey = computed(() => keyList.value[0] ?? null)
const algorithmName = computed(() => inceptionKey.value ? getKeyAlgorithm(inceptionKey.value) : '')

watch(activeDoc, () => nextTick(updateTrees))
onMounted(() => nextTick(updateTrees))

// Advance
function handleContinue() { completeAndAdvance(2) }
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🪪</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Create Your First XID</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        A XID is a 32-byte identifier derived from the SHA-256 hash of your <em>inception public
        key</em>. Your private keys and provenance generator get encrypted with a password
        (Argon2id) and stored alongside the public material in a single signed document.
      </p>
    </section>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-heroicons-book-open"
      title="Amira's story"
      description="Amira needs BRadvoc8 — a stable pseudonymous identity she can use to contribute to social-impact projects. She chooses a strong password, picks Ed25519 (the same scheme SSH and Signal use), and enables provenance so that future editions of her XID can be ordered by recipients."
    />

    <!-- Create form -->
    <form class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4" autocomplete="off" @submit.prevent="handleCreate">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Create your XID</h3>
      <UFormField label="Nickname">
        <UInput v-model="nickname" placeholder="BRadvoc8" class="w-full" autocomplete="username" />
      </UFormField>
      <UFormField label="Signing algorithm">
        <USelect v-model="scheme" :items="schemeOptions" class="w-full" />
      </UFormField>
      <UFormField label="Password (encrypts private key + provenance generator)">
        <UInput v-model="password" type="password" class="w-full" placeholder="Your password" autocomplete="new-password" />
      </UFormField>
      <UCheckbox v-model="withProvenance" label="Generate genesis provenance mark (recommended)" />
      <div class="flex items-center gap-2">
        <UButton
          type="submit"
          label="Create XID"
          color="primary"
          icon="i-heroicons-sparkles"
        />
        <UButton
          type="button"
          label="Load from file"
          variant="outline"
          color="neutral"
          icon="i-heroicons-arrow-up-tray"
          @click="fileInput?.click()"
        />
        <input ref="fileInput" type="file" accept=".envelope,.txt" class="hidden" @change="handleFileLoad">
      </div>
      <UAlert v-if="error" color="error" :title="error" variant="subtle" />
    </form>

    <template v-if="activeDoc">
      <UAlert
        color="success"
        icon="i-heroicons-check-circle"
        :title="`XID created for '${activeSlot.displayName}'`"
        variant="subtle"
      />

      <!-- Identity formats -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Identity formats</h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 w-20 shrink-0">Hex</span>
            <code class="text-xs font-mono text-gray-800 dark:text-gray-200 truncate flex-1">{{ truncate(xidHex, 24) }}</code>
            <UButton
              :icon="copied === 'hex' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied === 'hex' ? 'success' : 'neutral'"
              variant="ghost" size="xs"
              @click="copyToClipboard(xidHex, 'hex')"
            />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 w-20 shrink-0">Bytemojis</span>
            <span class="text-sm flex-1 truncate">{{ xidBytemojis }}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 w-20 shrink-0">Bytewords</span>
            <code class="text-xs font-mono text-gray-800 dark:text-gray-200 truncate flex-1">{{ truncate(xidBytewords, 48) }}</code>
            <UButton
              :icon="copied === 'bytewords' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied === 'bytewords' ? 'success' : 'neutral'"
              variant="ghost" size="xs"
              @click="copyToClipboard(xidBytewords, 'bytewords')"
            />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-gray-500 w-20 shrink-0">UR</span>
            <code class="text-xs font-mono text-gray-800 dark:text-gray-200 truncate flex-1">{{ truncate(xidUrString, 48) }}</code>
            <UButton
              :icon="copied === 'ur' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied === 'ur' ? 'success' : 'neutral'"
              variant="ghost" size="xs"
              @click="copyToClipboard(xidUrString, 'ur')"
            />
          </div>
        </div>
        <div v-if="inceptionKey" class="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <UIcon name="i-heroicons-key" class="w-4 h-4 text-gray-400" />
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ algorithmName }}</span>
          <UBadge color="primary" variant="subtle" size="sm">Inception key</UBadge>
          <span v-if="password" class="text-xs text-gray-500">· private key encrypted (Argon2id)</span>
        </div>
      </div>

      <!-- Encrypted private vs public views -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Private (encrypted) vs. Public (elided)</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The private envelope keeps your keys and provenance generator — encrypted with Argon2id,
          but you still wouldn't share it. The public envelope replaces those sections with
          <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">ELIDED</code> while
          keeping the root digest identical so the signature still verifies.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="rounded-lg border-2 border-red-300 dark:border-red-800 p-3 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-red-500" />
                <span class="text-xs font-semibold text-red-600 dark:text-red-400">Private (save locally)</span>
              </div>
              <UButton
                size="xs" variant="ghost" color="neutral"
                icon="i-heroicons-arrow-down-tray" label="Download"
                @click="handleDownloadPrivate"
              />
            </div>
            <pre class="font-mono text-xs bg-gray-950 text-gray-200 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-64">{{ encryptedTree }}</pre>
          </div>
          <div class="rounded-lg border-2 border-green-300 dark:border-green-800 p-3 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-green-500" />
                <span class="text-xs font-semibold text-green-600 dark:text-green-400">Public (safe to share)</span>
              </div>
              <UButton
                size="xs" variant="ghost" color="neutral"
                icon="i-heroicons-arrow-down-tray" label="Download"
                @click="handleDownloadPublic"
              />
            </div>
            <pre class="font-mono text-xs bg-gray-950 text-gray-200 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-64">{{ publicTree }}</pre>
          </div>
        </div>
        <XidTutorialConceptCard title="Why does elision preserve signatures?" icon="i-heroicons-question-mark-circle">
          Every element in an envelope has a cryptographic hash. Elision replaces the content
          with its hash but keeps the tree structure intact. Since signatures sign the root
          hash — not the content — signatures remain valid even when data is removed.
        </XidTutorialConceptCard>
      </div>

      <!-- Inline verify + provenance -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Verify before you ship</h3>
        <div class="flex items-center gap-2 flex-wrap">
          <UButton
            label="Verify inception signature"
            icon="i-heroicons-check-badge"
            color="neutral" variant="outline"
            @click="handleVerifySignature"
          />
          <UAlert
            v-if="signatureValid === true"
            color="success" icon="i-heroicons-check-circle"
            title="Signature valid"
            class="flex-1"
          />
          <UAlert
            v-else-if="signatureValid === false"
            color="error" icon="i-heroicons-x-circle"
            title="Signature failed"
            class="flex-1"
          />
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <UButton
            label="Validate genesis provenance mark"
            icon="i-heroicons-link"
            color="neutral" variant="outline"
            @click="handleValidateProvenance"
          />
          <UAlert
            v-if="provenanceValid === true"
            color="success" icon="i-heroicons-check-circle"
            title="Genesis mark valid"
            class="flex-1"
          />
          <UAlert
            v-else-if="provenanceValid === false"
            color="warning" icon="i-heroicons-exclamation-triangle"
            title="No provenance mark"
            description="Create the XID with provenance enabled to get a genesis mark."
            class="flex-1"
          />
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §1.4"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          @click="handleContinue"
        />
      </div>
    </template>
  </div>
</template>
