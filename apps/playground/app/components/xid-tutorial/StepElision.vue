<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import type { Envelope } from '@bcts/envelope'
import {
  buildSignedAttestation,
  verifyAttestationAgainstXid,
} from '@/utils/xid-tutorial/attestation'
import { commitElide, digestsMatch } from '@/utils/xid-tutorial/elision'

const { activeSlot, activeDoc, addSideKey, completeAndAdvance } = useXidTutorial()

const claim = ref('Audited cryptographic implementations for authentication systems (2023-2024)')
const skillCategory = ref('Security')

const fullSigned = shallowRef<Envelope | null>(null)
const fullTree = ref('')
const commitment = shallowRef<Envelope | null>(null)
const commitmentTree = ref('')
const digestMatch = ref<boolean | null>(null)
const fullSigValid = ref<boolean | null>(null)
const commitmentSigValid = ref<boolean | null>(null)

function ensureAttestationKey() {
  if (!activeSlot.value.attestationKey) {
    addSideKey('amira', 'attestation', 'Ed25519', [Privilege.Sign])
  }
}

function handleBuildAndSign() {
  const doc = activeDoc.value
  if (!doc) return
  ensureAttestationKey()
  const key = activeSlot.value.attestationKey
  if (!key) return
  const xidUr = doc.xid().urString()
  const signed = buildSignedAttestation(
    {
      claim: claim.value,
      sourceXidUr: xidUr,
      targetXidUr: xidUr,
      date: new Date(),
      extras: { skillCategory: skillCategory.value },
    },
    key.prvKeys,
  )
  fullSigned.value = signed
  fullTree.value = signed.treeFormat()
  commitment.value = null
  commitmentTree.value = ''
  digestMatch.value = null
}

function handleCommit() {
  if (!fullSigned.value) return
  const commit = commitElide(fullSigned.value)
  commitment.value = commit
  commitmentTree.value = commit.treeFormat()
  digestMatch.value = digestsMatch(fullSigned.value, commit)
}

function handleVerifyFull() {
  const doc = activeDoc.value
  if (!doc || !fullSigned.value) return
  fullSigValid.value = verifyAttestationAgainstXid(fullSigned.value, doc).verified
}

function handleVerifyCommitment() {
  const doc = activeDoc.value
  if (!doc || !commitment.value) return
  commitmentSigValid.value = verifyAttestationAgainstXid(commitment.value, doc).verified
}

const canContinue = computed(() => digestMatch.value === true)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">✂️</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Elision Commitments</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Some claims are too risky to publish publicly (correlation risk), but you might want to
        prove later that you held the claim at a specific time. The <em>commit-elide-reveal</em>
        pattern lets you sign a full attestation, publish <strong>only its digest</strong>, and
        reveal the full content to selected recipients later.
      </p>
    </section>

    <UAlert
      v-if="!activeDoc"
      color="warning" icon="i-heroicons-exclamation-triangle"
      title="Need a XID first" description="Go back to §1.3."
    />

    <template v-if="activeDoc">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-heroicons-book-open"
        title="Amira's story"
        description="Amira has rare cryptographic audit experience. The pool of people with this skill is small — publishing it publicly would narrow her anonymity set to a handful. She commits the claim publicly (just a digest) and reveals the full version privately to DevReviewer later."
      />

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Build the sensitive attestation</h3>
        <UFormField label="Claim">
          <UTextarea v-model="claim" :rows="2" class="w-full" />
        </UFormField>
        <UFormField label="Skill category (broad enough not to correlate)">
          <UInput v-model="skillCategory" class="w-full" />
        </UFormField>
        <UButton label="Sign full attestation" icon="i-heroicons-pencil-square" color="primary" @click="handleBuildAndSign" />
      </div>

      <div v-if="fullSigned" class="rounded-lg border-2 border-red-200 dark:border-red-900 p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-300">Full signed attestation (keep private)</h3>
          <UButton size="xs" variant="outline" label="Verify signature" @click="handleVerifyFull" />
        </div>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ fullTree }}</pre>
        <UAlert v-if="fullSigValid === true" color="success" icon="i-heroicons-check-circle" title="Signature valid on full version" />
      </div>

      <div v-if="fullSigned" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Create the commitment (elide the whole envelope)</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          <code class="text-xs">envelope elide removing &lt;digest&gt;</code> replaces all content
          with <code class="text-xs">ELIDED</code> but preserves the root digest.
        </p>
        <UButton label="Commit (fully elide)" icon="i-heroicons-scissors" color="primary" variant="outline" @click="handleCommit" />
      </div>

      <div v-if="commitment" class="rounded-lg border-2 border-green-200 dark:border-green-900 p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-green-700 dark:text-green-300">Commitment (publish this)</h3>
          <UButton size="xs" variant="outline" label="Try to verify signature" @click="handleVerifyCommitment" />
        </div>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-24">{{ commitmentTree }}</pre>
        <UAlert
          v-if="digestMatch === true" color="success" icon="i-heroicons-check-circle"
          title="Inclusion proof valid"
          description="Elided commitment's digest equals the full signed attestation's digest — proving they are the same document."
        />
        <UAlert
          v-if="commitmentSigValid === false"
          color="warning" icon="i-heroicons-exclamation-triangle"
          title="Commitment can't verify on its own"
          description="The elided envelope has no content for signatures to resolve against. This is by design — commitments prove timing, full reveal proves content."
        />
      </div>

      <div v-if="commitment" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-sky-50/30 dark:bg-sky-950/10">
        <h3 class="text-sm font-semibold text-sky-800 dark:text-sky-200">What DevReviewer learns (when Amira reveals)</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="rounded-md bg-green-50 dark:bg-green-950/20 p-3 space-y-1">
            <div class="text-xs font-semibold text-green-700 uppercase">Verified</div>
            <ul class="space-y-1">
              <li>✅ Claim matches public commitment</li>
              <li>✅ Claim was published on some earlier date</li>
              <li>✅ Claim not modified since signing</li>
              <li>✅ Signed by BRadvoc8's attestation key</li>
            </ul>
          </div>
          <div class="rounded-md bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
            <div class="text-xs font-semibold text-amber-700 uppercase">Still assumed</div>
            <ul class="space-y-1">
              <li>❓ Claim is actually true</li>
              <li>❓ Other hidden claims are consistent</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §2.3"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(5)"
        />
      </div>
    </template>
  </div>
</template>
