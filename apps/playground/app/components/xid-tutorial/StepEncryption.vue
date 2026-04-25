<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import type { Envelope } from '@bcts/envelope'
import { buildSignedAttestation, verifyAttestationAgainstXid } from '@/utils/xid-tutorial/attestation'
import { encryptForRecipient, tryDecrypt } from '@/utils/xid-tutorial/encryption'

const {
  activeSlot, activeDoc, identities, addSideKey,
  createIdentity, completeAndAdvance,
} = useXidTutorial()

const claim = ref('Designed the authentication system for CivilTrust human rights documentation platform (2024)')
const privacyRisk = ref('Links to legal identity via contributor list')

const devReviewerPassword = ref('devreviewers-own-password')

const signedCleartext = shallowRef<Envelope | null>(null)
const signedCleartextTree = ref('')

const encrypted = shallowRef<Envelope | null>(null)
const encryptedTree = ref('')

const decrypted = shallowRef<Envelope | null>(null)
const decryptedTree = ref('')
const decryptStatus = ref<string | null>(null)

const wrongDecryptStatus = ref<string | null>(null)
const finalSigValid = ref<boolean | null>(null)

function ensureDevReviewer() {
  if (!identities.value.devreviewer.document) {
    createIdentity('devreviewer', 'DevReviewer', 'Ed25519', devReviewerPassword.value, false)
  }
}

function ensureAttestationKey() {
  if (!activeSlot.value.attestationKey) {
    addSideKey('amira', 'attestation', 'Ed25519', [Privilege.Sign])
  }
}

function handleBuild() {
  const doc = identities.value.amira.document
  if (!doc) return
  ensureAttestationKey()
  const key = identities.value.amira.attestationKey
  if (!key) return
  const xidUr = doc.xid().urString()
  const signed = buildSignedAttestation(
    {
      claim: claim.value,
      sourceXidUr: xidUr,
      targetXidUr: xidUr,
      date: new Date(),
      extras: { privacyRisk: privacyRisk.value },
    },
    key.prvKeys,
  )
  signedCleartext.value = signed
  signedCleartextTree.value = signed.treeFormat()
}

function handleEncrypt() {
  ensureDevReviewer()
  const recipient = identities.value.devreviewer.document?.inceptionKey()?.publicKeys()
  if (!signedCleartext.value || !recipient) return
  const enc = encryptForRecipient(signedCleartext.value, recipient)
  encrypted.value = enc
  encryptedTree.value = enc.treeFormat()
  decrypted.value = null
  decryptedTree.value = ''
  decryptStatus.value = null
}

function handleDecrypt() {
  const prvKeys = identities.value.devreviewer.document?.inceptionKey()?.privateKeys()
  if (!encrypted.value || !prvKeys) {
    decryptStatus.value = 'DevReviewer private keys unavailable'
    return
  }
  const res = tryDecrypt(encrypted.value, prvKeys)
  if (res.ok) {
    decrypted.value = res.env
    decryptedTree.value = res.env.treeFormat()
    decryptStatus.value = 'Decrypted successfully'
    // Also verify the signature
    const amiraDoc = identities.value.amira.document
    if (amiraDoc) finalSigValid.value = verifyAttestationAgainstXid(res.env, amiraDoc).verified
  } else {
    decryptStatus.value = `Failed: ${res.reason}`
  }
}

function handleWrongKey() {
  if (!encrypted.value) return
  // Create a throwaway identity not tied to the recipient
  createIdentity('charlene', 'Charlene', 'Ed25519', 'charlenes-password', false)
  const wrong = identities.value.charlene.document?.inceptionKey()?.privateKeys()
  if (!wrong) return
  const res = tryDecrypt(encrypted.value, wrong)
  wrongDecryptStatus.value = res.ok ? 'UNEXPECTED: decrypted with wrong key' : `Correctly rejected: ${res.reason}`
}

const canContinue = computed(() => decrypted.value !== null)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🔐</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Recipient Encryption</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        For the most sensitive claims — where even the existence of the commitment could draw
        attention — encrypt directly for a specific recipient's public key. No public trace, no
        hint. Only the intended recipient can read it.
      </p>
    </section>

    <UAlert
      v-if="!activeDoc"
      color="warning" icon="i-heroicons-exclamation-triangle"
      title="Need a XID first" description="Go back to §1.3."
    />

    <template v-if="activeDoc">
      <UAlert
        color="info" variant="subtle" icon="i-heroicons-book-open"
        title="Amira's story"
        description="Amira designed CivilTrust's authentication. The contributor list is public, and a commitment of 'human rights security work' on her profile would draw the wrong kind of attention. She encrypts the claim directly for DevReviewer, with no public trace."
      />

      <!-- DevReviewer identity -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">DevReviewer's recipient keypair</h3>
        <template v-if="identities.devreviewer.document">
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
            <span>DevReviewer's XID exists — ready to receive encrypted content.</span>
          </div>
        </template>
        <form v-else autocomplete="off" class="space-y-3" @submit.prevent="ensureDevReviewer">
          <input type="text" name="username" value="DevReviewer" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
          <UFormField label="DevReviewer password">
            <UInput v-model="devReviewerPassword" type="password" class="w-full" autocomplete="new-password" />
          </UFormField>
          <UButton type="submit" label="Create DevReviewer identity" color="primary" icon="i-heroicons-user-plus" />
        </form>
      </div>

      <!-- Build sensitive claim -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Build the sensitive claim</h3>
        <UFormField label="Claim">
          <UTextarea v-model="claim" :rows="2" class="w-full" />
        </UFormField>
        <UFormField label="privacyRisk (documents why this is sensitive)">
          <UInput v-model="privacyRisk" class="w-full" />
        </UFormField>
        <UButton label="Sign full attestation" icon="i-heroicons-pencil-square" color="primary" @click="handleBuild" />
      </div>

      <div v-if="signedCleartext" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">Signed (cleartext — do not share)</h3>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-48">{{ signedCleartextTree }}</pre>
        <UButton label="Encrypt for DevReviewer" icon="i-heroicons-lock-closed" color="primary" @click="handleEncrypt" />
      </div>

      <div v-if="encrypted" class="rounded-lg border-2 border-purple-200 dark:border-purple-900 p-4 space-y-2">
        <h3 class="text-sm font-semibold text-purple-700 dark:text-purple-300">Encrypted (safe to send in the clear)</h3>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-48">{{ encryptedTree }}</pre>
        <p class="text-xs text-gray-500">
          Note the <code class="text-xs">'hasRecipient': SealedMessage</code> assertion — the
          content key is sealed to DevReviewer's public key.
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton label="Decrypt with DevReviewer's private key" icon="i-heroicons-lock-open" color="success" @click="handleDecrypt" />
          <UButton label="Try with a wrong key (Charlene)" icon="i-heroicons-shield-exclamation" color="warning" variant="outline" @click="handleWrongKey" />
        </div>
        <UAlert v-if="decryptStatus" :color="decryptStatus.startsWith('Decrypted') ? 'success' : 'error'" :title="decryptStatus" />
        <UAlert v-if="wrongDecryptStatus" :color="wrongDecryptStatus.startsWith('Correctly') ? 'success' : 'error'" :title="wrongDecryptStatus" />
      </div>

      <div v-if="decrypted" class="rounded-lg border-2 border-green-200 dark:border-green-900 p-4 space-y-2">
        <h3 class="text-sm font-semibold text-green-700 dark:text-green-300">Decrypted by DevReviewer</h3>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-48">{{ decryptedTree }}</pre>
        <UAlert
          v-if="finalSigValid === true" color="success" icon="i-heroicons-check-circle"
          title="Signature verified"
          description="After decryption, the signature still validates against Amira's attestation key."
        />
      </div>

      <!-- Elision vs Encryption comparison -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">Elision vs Encryption</h3>
        <div class="grid grid-cols-3 text-xs gap-2">
          <div class="font-semibold text-gray-500">Aspect</div>
          <div class="font-semibold text-gray-500">Elision (§2.2)</div>
          <div class="font-semibold text-gray-500">Encryption (§2.3)</div>
          <div>Public trace</div><div>Yes — digest visible</div><div>No — completely hidden</div>
          <div>Proves timing</div><div>Yes</div><div>No</div>
          <div>Who can see</div><div>No one (until revealed)</div><div>Specific recipients</div>
          <div>Use case</div><div>"Might need to prove later"</div><div>"Only this person should see"</div>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §3.1"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(6)"
        />
      </div>
    </template>
  </div>
</template>
