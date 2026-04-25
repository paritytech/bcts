<script setup lang="ts">
import type { Envelope } from '@bcts/envelope'
import { buildSignedAttestation, verifyAttestationAgainstXid } from '@/utils/xid-tutorial/attestation'
import { buildSignedEdge } from '@/utils/xid-tutorial/edge'

const {
  identities, activeDoc, attachEdgeToActive, advanceProvenance,
  createIdentity, completeAndAdvance, edgeList,
} = useXidTutorial()

const charlenePassword = ref('charlenes-own-password')
const devReviewerPassword = ref('devreviewers-own-password')

// Detached endorsement (Charlene)
const charleneClaim = ref('BRadvoc8 is a thoughtful and committed contributor to privacy work that protects vulnerable communities')
const charleneContext = ref('Personal friend, observed values and commitment over 2+ years')
const charleneScope = ref('Character and values alignment, not technical skills')
const charleneBasis = ref('Friend who introduced BRadvoc8 to RISK network concept')
const detachedEndorsement = shallowRef<Envelope | null>(null)
const detachedTree = ref('')
const detachedVerified = ref<boolean | null>(null)

// Embedded edge (DevReviewer)
const reviewerPeer = ref('Writes secure, well-tested code with clear attention to privacy-preserving patterns')
const reviewerContext = ref('Verified previous security experience, worked together on short project for SisterSpaces')
const reviewerScope = ref('Security architecture, cryptographic implementation, privacy patterns')
const reviewerBasis = ref('Security collaboration partner who verified credentials through commit-reveal and encrypted sharing')
const embeddedEdge = shallowRef<Envelope | null>(null)
const embeddedTree = ref('')
const embeddedAttached = ref(false)

// Forgery demo
const forgeryStatus = ref<string | null>(null)

function ensureCharlene() {
  if (!identities.value.charlene.document) {
    createIdentity('charlene', 'Charlene', 'Ed25519', charlenePassword.value, false)
  }
}
function ensureDevReviewer() {
  if (!identities.value.devreviewer.document) {
    createIdentity('devreviewer', 'DevReviewer', 'Ed25519', devReviewerPassword.value, false)
  }
}

function handleBuildDetached() {
  ensureCharlene()
  const charleneDoc = identities.value.charlene.document
  const amiraDoc = identities.value.amira.document
  const charleneKey = charleneDoc?.inceptionKey()?.privateKeys()
  if (!charleneDoc || !amiraDoc || !charleneKey) return
  const signed = buildSignedAttestation(
    {
      claim: charleneClaim.value,
      sourceXidUr: charleneDoc.xid().urString(),
      targetXidUr: amiraDoc.xid().urString(),
      date: new Date(),
      extras: {
        endorsementContext: charleneContext.value,
        endorsementScope: charleneScope.value,
        relationshipBasis: charleneBasis.value,
      },
    },
    charleneKey,
  )
  detachedEndorsement.value = signed
  detachedTree.value = signed.treeFormat()
}

function handleVerifyDetached() {
  const charleneDoc = identities.value.charlene.document
  if (!detachedEndorsement.value || !charleneDoc) return
  detachedVerified.value = verifyAttestationAgainstXid(detachedEndorsement.value, charleneDoc).verified
}

function handleBuildEmbedded() {
  ensureDevReviewer()
  const reviewerDoc = identities.value.devreviewer.document
  const amiraDoc = identities.value.amira.document
  const reviewerKey = reviewerDoc?.inceptionKey()?.privateKeys()
  if (!reviewerDoc || !amiraDoc || !reviewerKey) return
  const arid = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const edge = buildSignedEdge(
    {
      subject: `peer-endorsement-from-devreviewer-${arid}`,
      isA: 'attestation',
      source: {
        xidUr: reviewerDoc.xid().urString(),
        extras: {
          'schema:worksFor': 'SisterSpaces',
          'schema:employeeRole': 'Head Security Programmer',
        },
      },
      target: {
        xidUr: amiraDoc.xid().urString(),
        extras: {
          peerEndorsement: reviewerPeer.value,
          endorsementContext: reviewerContext.value,
          endorsementScope: reviewerScope.value,
          relationshipBasis: reviewerBasis.value,
        },
      },
      date: new Date(),
    },
    reviewerKey,
  )
  embeddedEdge.value = edge
  embeddedTree.value = edge.treeFormat()
}

function handleAttachEmbedded() {
  if (!embeddedEdge.value) return
  attachEdgeToActive(embeddedEdge.value)
  embeddedAttached.value = true
}

function handleForgery() {
  // Try to forge Charlene's endorsement by signing with Amira's key (wrong)
  const amiraKey = identities.value.amira.attestationKey?.prvKeys ?? identities.value.amira.document?.inceptionKey()?.privateKeys()
  const charleneDoc = identities.value.charlene.document
  const amiraDoc = identities.value.amira.document
  if (!amiraKey || !charleneDoc || !amiraDoc) return
  const fake = buildSignedAttestation(
    {
      claim: 'BRadvoc8 is amazing at everything',
      sourceXidUr: charleneDoc.xid().urString(), // lies about source
      targetXidUr: amiraDoc.xid().urString(),
      date: new Date(),
    },
    amiraKey, // signed with the wrong key
  )
  const verified = verifyAttestationAgainstXid(fake, charleneDoc).verified
  forgeryStatus.value = verified
    ? 'UNEXPECTED: forgery verified'
    : '✅ Forgery detected — signature does not verify against any key in Charlene\'s XID.'
}

const canContinue = computed(() => detachedVerified.value === true && embeddedAttached.value)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🤝</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Peer Endorsements</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Self-attestations are signed <em>by you</em> — limited weight. Peer endorsements are
        signed <em>by others</em>, who stake their own reputation on you. Multiple endorsements
        from different contexts triangulate trust. Two forms: <strong>detached</strong> (a
        separate signed envelope) and <strong>embedded</strong> (an edge inside the subject's
        XID).
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
        description="Charlene (personal friend) writes a character endorsement as a detached envelope. DevReviewer (project collaborator) writes a technical endorsement as an embedded edge, which Amira can attach to her XID if she chooses."
      />

      <!-- Detached: Charlene -->
      <div class="rounded-lg border-2 border-emerald-200 dark:border-emerald-900 p-4 space-y-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-heart" class="w-5 h-5 text-emerald-500" />
          <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Part 1 — Detached endorsement (Charlene)</h3>
        </div>
        <form v-if="!identities.charlene.document" autocomplete="off" class="space-y-3" @submit.prevent="ensureCharlene">
          <input type="text" name="username" value="Charlene" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
          <UFormField label="Charlene's password">
            <UInput v-model="charlenePassword" type="password" class="w-full" autocomplete="new-password" />
          </UFormField>
          <UButton type="submit" label="Create Charlene's XID" color="primary" icon="i-heroicons-user-plus" />
        </form>
        <template v-else>
          <div class="text-xs text-gray-500">Charlene's XID: <code>{{ identities.charlene.document.xid().urString().slice(0, 40) }}…</code></div>
          <UFormField label="Claim">
            <UTextarea v-model="charleneClaim" :rows="2" class="w-full" />
          </UFormField>
          <UFormField label="endorsementContext">
            <UInput v-model="charleneContext" class="w-full" />
          </UFormField>
          <UFormField label="endorsementScope">
            <UInput v-model="charleneScope" class="w-full" />
          </UFormField>
          <UFormField label="relationshipBasis">
            <UInput v-model="charleneBasis" class="w-full" />
          </UFormField>
          <div class="flex gap-2">
            <UButton label="Sign as Charlene" icon="i-heroicons-pencil-square" color="primary" @click="handleBuildDetached" />
            <UButton v-if="detachedEndorsement" label="Verify against Charlene's keys" icon="i-heroicons-check-badge" variant="outline" @click="handleVerifyDetached" />
          </div>
        </template>
        <pre v-if="detachedTree" class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ detachedTree }}</pre>
        <UAlert v-if="detachedVerified === true" color="success" icon="i-heroicons-check-circle" title="Verified — signed by Charlene's inception key" />
        <UAlert v-else-if="detachedVerified === false" color="error" icon="i-heroicons-x-circle" title="Signature failed" />
      </div>

      <!-- Embedded: DevReviewer -->
      <div class="rounded-lg border-2 border-violet-200 dark:border-violet-900 p-4 space-y-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-violet-500" />
          <h3 class="text-sm font-semibold text-violet-700 dark:text-violet-300">Part 2 — Embedded edge (DevReviewer)</h3>
        </div>
        <form v-if="!identities.devreviewer.document" autocomplete="off" class="space-y-3" @submit.prevent="ensureDevReviewer">
          <input type="text" name="username" value="DevReviewer" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
          <UFormField label="DevReviewer's password">
            <UInput v-model="devReviewerPassword" type="password" class="w-full" autocomplete="new-password" />
          </UFormField>
          <UButton type="submit" label="Create DevReviewer's XID" color="primary" icon="i-heroicons-user-plus" />
        </form>
        <template v-else>
          <div class="text-xs text-gray-500">DevReviewer's XID: <code>{{ identities.devreviewer.document.xid().urString().slice(0, 40) }}…</code></div>
          <UFormField label="peerEndorsement">
            <UTextarea v-model="reviewerPeer" :rows="2" class="w-full" />
          </UFormField>
          <UFormField label="endorsementContext">
            <UInput v-model="reviewerContext" class="w-full" />
          </UFormField>
          <UFormField label="endorsementScope">
            <UInput v-model="reviewerScope" class="w-full" />
          </UFormField>
          <UFormField label="relationshipBasis">
            <UInput v-model="reviewerBasis" class="w-full" />
          </UFormField>
          <div class="flex gap-2">
            <UButton label="Build + sign edge" icon="i-heroicons-link" color="primary" @click="handleBuildEmbedded" />
            <UButton
              v-if="embeddedEdge"
              label="Attach to Amira's XID"
              icon="i-heroicons-paper-clip"
              color="success"
              :disabled="embeddedAttached"
              @click="handleAttachEmbedded"
            />
          </div>
        </template>
        <pre v-if="embeddedTree" class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ embeddedTree }}</pre>
        <UAlert
          v-if="embeddedAttached" color="success" icon="i-heroicons-check-circle"
          title="Edge attached to Amira's XID"
          :description="`Amira now has ${edgeList.length} edge(s).`"
        />
        <UButton v-if="embeddedAttached" label="Advance provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="advanceProvenance" />
      </div>

      <!-- Forgery demo -->
      <div class="rounded-lg border border-amber-300 dark:border-amber-800 p-4 space-y-2 bg-amber-50/50 dark:bg-amber-950/10">
        <h3 class="text-sm font-semibold text-amber-800 dark:text-amber-200">Forgery demo</h3>
        <p class="text-sm text-amber-800 dark:text-amber-200">
          An attacker can't produce a valid endorsement without the endorser's private key —
          watch what happens when we try.
        </p>
        <UButton label="Try to forge Charlene's endorsement" icon="i-heroicons-shield-exclamation" color="warning" variant="outline" @click="handleForgery" />
        <UAlert v-if="forgeryStatus" :color="forgeryStatus.startsWith('✅') ? 'success' : 'error'" :title="forgeryStatus" />
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §4.1"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(9)"
        />
      </div>
    </template>
  </div>
</template>
