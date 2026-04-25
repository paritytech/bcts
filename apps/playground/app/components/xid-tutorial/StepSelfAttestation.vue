<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import type { Envelope } from '@bcts/envelope'
import {
  buildSignedAttestation,
  verifyAttestationAgainstXid,
  buildSupersedingAttestation,
  buildRetractionAttestation,
} from '@/utils/xid-tutorial/attestation'

const {
  activeSlot, activeDoc, addSideKey, advanceProvenance, completeAndAdvance,
} = useXidTutorial()

const claim = ref('Contributed mass spec visualization code to galaxyproject/galaxy (PR #12847, merged 2024)')
const verifiableAt = ref('https://github.com/galaxyproject/galaxy/pull/12847')
const extraNotes = ref('')

interface StoredAttestation {
  id: string
  label: string
  signed: Envelope
  tree: string
  supersedesId?: string
  retracted?: boolean
}
const attestations = shallowRef<StoredAttestation[]>([])
const verifyResults = ref<Record<string, { verified: boolean; keyNickname?: string }>>({})

function ensureAttestationKey() {
  if (!activeSlot.value.attestationKey) {
    addSideKey('amira', 'attestation', 'Ed25519', [Privilege.Sign])
  }
}

function handleCreateClaim() {
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
      verifiableAt: verifiableAt.value || undefined,
      date: new Date(),
      extras: extraNotes.value ? { note: extraNotes.value } : undefined,
    },
    key.prvKeys,
  )
  const entry: StoredAttestation = {
    id: crypto.randomUUID(),
    label: claim.value.slice(0, 60),
    signed,
    tree: signed.treeFormat(),
  }
  attestations.value = [...attestations.value, entry]
}

function verifyOne(entry: StoredAttestation) {
  const doc = activeDoc.value
  if (!doc) return
  const r = verifyAttestationAgainstXid(entry.signed, doc)
  verifyResults.value = {
    ...verifyResults.value,
    [entry.id]: { verified: r.verified, keyNickname: r.keyNickname },
  }
}

function handleSupersede(entry: StoredAttestation) {
  const doc = activeDoc.value
  const key = activeSlot.value.attestationKey
  if (!doc || !key) return
  const xidUr = doc.xid().urString()
  const superseded = buildSupersedingAttestation(
    entry.signed,
    {
      claim: claim.value,
      sourceXidUr: xidUr,
      targetXidUr: xidUr,
      verifiableAt: verifiableAt.value || undefined,
      date: new Date(),
    },
    key.prvKeys,
  )
  attestations.value = [...attestations.value, {
    id: crypto.randomUUID(),
    label: `(supersedes) ${entry.label.slice(0, 40)}`,
    signed: superseded,
    tree: superseded.treeFormat(),
    supersedesId: entry.id,
  }]
}

function handleRetract(entry: StoredAttestation) {
  const key = activeSlot.value.attestationKey
  if (!key) return
  const retracted = buildRetractionAttestation(
    entry.signed,
    'Claim was overstated',
    key.prvKeys,
    `RETRACTED: ${entry.label}`,
  )
  attestations.value = [...attestations.value, {
    id: crypto.randomUUID(),
    label: `(retraction) ${entry.label.slice(0, 40)}`,
    signed: retracted,
    tree: retracted.treeFormat(),
    retracted: true,
  }]
}

function handleAdvance() { advanceProvenance() }

const hasAttestationKey = computed(() => activeSlot.value.attestationKey !== null)
const hasAttestations = computed(() => attestations.value.length > 0)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">📜</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Self-Attestations</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        A self-attestation is a signed claim <strong>about yourself</strong>. Following the
        <em>fair witness methodology</em>, the best attestations are specific, dated, and point
        to verifiable evidence. They're signed by a dedicated attestation key (not your inception
        key) so that claims can be rotated without affecting your core identity.
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
        description="Ben has verified BRadvoc8's XID but still doesn't know if they can code. Amira contributed to Galaxy Project — PR #12847 — a real merged contribution. She creates a separate attestation key (Sign-only), registers it, then builds a signed fair-witness attestation pointing to the PR."
      />

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Attestation key</h3>
        <div v-if="hasAttestationKey" class="flex items-center gap-2 text-sm">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
          <span>Registered in your XID with <code class="text-xs">Sign</code>-only permission.</span>
        </div>
        <UButton
          v-else label="Create + register attestation key"
          color="primary" icon="i-heroicons-key"
          @click="ensureAttestationKey"
        />
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Build a fair-witness claim</h3>
        <UFormField label="Claim (specific, verifiable — no vague opinions)">
          <UTextarea v-model="claim" :rows="2" class="w-full" />
        </UFormField>
        <UFormField label="verifiableAt (URL to evidence)">
          <UInput v-model="verifiableAt" placeholder="https://github.com/…/pull/…" class="w-full" />
        </UFormField>
        <UFormField label="Extra note (optional)">
          <UInput v-model="extraNotes" class="w-full" />
        </UFormField>
        <UButton
          label="Sign attestation"
          icon="i-heroicons-pencil-square"
          color="primary"
          @click="handleCreateClaim"
        />
      </div>

      <div v-if="hasAttestations" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Your attestations</h3>
        <div
          v-for="a in attestations"
          :key="a.id"
          class="rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3 space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-4 h-4 text-gray-400" />
              <span class="text-sm font-medium">{{ a.label }}</span>
              <UBadge v-if="a.supersedesId" color="info" size="xs" variant="subtle">supersedes</UBadge>
              <UBadge v-if="a.retracted" color="warning" size="xs" variant="subtle">retraction</UBadge>
            </div>
            <div class="flex items-center gap-1">
              <UButton size="xs" variant="ghost" icon="i-heroicons-magnifying-glass" label="Verify" @click="verifyOne(a)" />
              <UButton v-if="!a.retracted" size="xs" variant="ghost" icon="i-heroicons-arrow-path-rounded-square" label="Supersede" @click="handleSupersede(a)" />
              <UButton v-if="!a.retracted" size="xs" variant="ghost" color="warning" icon="i-heroicons-x-circle" label="Retract" @click="handleRetract(a)" />
            </div>
          </div>
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-48">{{ a.tree }}</pre>
          <UAlert
            v-if="verifyResults[a.id]?.verified === true"
            color="success" icon="i-heroicons-check-circle"
            :title="`Verified with key: ${verifyResults[a.id]?.keyNickname ?? '(unnamed)'}`"
          />
          <UAlert
            v-else-if="verifyResults[a.id]?.verified === false"
            color="error" icon="i-heroicons-x-circle"
            title="No key in the XID verified this signature"
          />
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Advance provenance</h3>
        <p class="text-xs text-gray-500">
          Publishing a new edition of the XID (now with the attestation key) advances the
          provenance mark.
        </p>
        <UButton label="Advance provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="handleAdvance" />
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §2.2"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!hasAttestations"
          @click="completeAndAdvance(4)"
        />
      </div>
    </template>
  </div>
</template>
