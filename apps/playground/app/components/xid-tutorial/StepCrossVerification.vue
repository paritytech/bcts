<script setup lang="ts">
import type { Envelope } from '@bcts/envelope'
import { fetchGithubSigningKeys, sshKeysMatch, type GithubKey } from '@/utils/xid-tutorial/github'
import {
  extractEdgeTarget, extractString, verifyEdgeSignature, extractEdgeSshPublicKeys,
} from '@/utils/xid-tutorial/edge'
import { verifyAttestationAgainstXid } from '@/utils/xid-tutorial/attestation'

const { activeDoc, edgeList, completeAndAdvance, verifySignature } = useXidTutorial()

const selectedEdgeIndex = ref(0)
const extracted = ref<{
  username?: string
  claimedText?: string
  verifiableAt?: string
} | null>(null)

const githubLive = ref(false)
const githubUsername = ref('BRadvoc8')
const githubResult = ref<{ keys: GithubKey[]; source: 'live' | 'canned'; error?: string } | null>(null)

const keysMatch = ref<boolean | null>(null)
const edgeSignatureValid = ref<boolean | null>(null)
const selfConsistent = ref<boolean | null>(null)

const selectedEdge = computed<Envelope | null>(() => edgeList.value[selectedEdgeIndex.value]?.envelope ?? null)

function handleSelfConsistency() {
  selfConsistent.value = verifySignature()
}

function handleExtract() {
  const e = selectedEdge.value
  if (!e) return
  const tgt = extractEdgeTarget(e)
  extracted.value = {
    username: extractString(tgt, 'foaf:accountName'),
    claimedText: extractString(tgt, 'sshSigningKeyText'),
    verifiableAt: extractString(tgt, 'foaf:accountServiceHomepage'),
  }
  if (extracted.value.username) githubUsername.value = extracted.value.username
}

async function handleFetchGithub() {
  // Canned mode echoes the XID's claimed key back so it represents
  // "user uploaded their generated key to GitHub" — otherwise the canned
  // hardcoded key never matches the freshly-generated SSH key from §3.1.
  githubResult.value = await fetchGithubSigningKeys(githubUsername.value, {
    live: githubLive.value,
    cannedKeyOverride: extracted.value?.claimedText,
  })
  if (extracted.value?.claimedText && githubResult.value.keys[0]) {
    keysMatch.value = sshKeysMatch(extracted.value.claimedText, githubResult.value.keys[0].key)
  }
}

function handleVerifyEdgeSig() {
  const e = selectedEdge.value
  const doc = activeDoc.value
  if (!e || !doc) return
  // The SSH signing key in §3.1 is standalone (not registered on the XID),
  // so verify against the public key embedded in the edge target itself —
  // the same key just confirmed to match GitHub. This is what closes the
  // cross-verification loop: same key text → same private key signed the edge.
  const claimedPub = extractEdgeSshPublicKeys(e)
  if (claimedPub && verifyEdgeSignature(e, claimedPub)) {
    edgeSignatureValid.value = true
    return
  }
  // Fallback: any key registered on the XID (covers non-SSH edges).
  for (const key of doc.keys()) {
    try {
      if (verifyEdgeSignature(e, key.publicKeys())) {
        edgeSignatureValid.value = true
        return
      }
    } catch { continue }
  }
  const r = verifyAttestationAgainstXid(e, doc)
  edgeSignatureValid.value = r.verified
}

const canContinue = computed(() =>
  selfConsistent.value === true && keysMatch.value === true && edgeSignatureValid.value === true,
)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🔍</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Cross-Verification</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Self-consistency is necessary but not sufficient. To really trust a XID's claims, check
        them against <em>independent external sources</em>. Here: fetch GitHub's published
        signing keys and prove they match what's embedded in the edge — plus verify the edge's
        signature against the claimed key.
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
        title="DevReviewer's story"
        description="DevReviewer received BRadvoc8's latest XID. He runs through the verification chain: self-consistency → extract the GitHub edge → pull the claimed SSH key → query GitHub's API → compare keys → verify the edge's signature came from the same key."
      />

      <!-- Step 1: self-consistency -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">1. Self-consistency</h3>
        <UButton label="Verify inception signature" icon="i-heroicons-check-badge" color="neutral" variant="outline" @click="handleSelfConsistency" />
        <UAlert v-if="selfConsistent === true" color="success" icon="i-heroicons-check-circle" title="XID is self-consistent" />
        <UAlert v-else-if="selfConsistent === false" color="error" icon="i-heroicons-x-circle" title="Self-consistency failed" />
      </div>

      <!-- Step 2: extract edge claim -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">2. Extract the GitHub edge</h3>
        <UAlert v-if="edgeList.length === 0" color="warning" title="No edges on this XID" description="Go back to §3.1 and attach the GitHub edge." />
        <template v-else>
          <UFormField v-if="edgeList.length > 1" label="Which edge?">
            <USelect v-model="selectedEdgeIndex" :items="edgeList.map((_, i) => ({ label: `Edge ${i + 1}`, value: i }))" class="w-full" />
          </UFormField>
          <UButton label="Extract claimed SSH key + username" icon="i-heroicons-arrow-down-tray" color="primary" @click="handleExtract" />
          <div v-if="extracted" class="text-sm space-y-1 pt-2">
            <div><span class="text-gray-500">Claimed username:</span> <code class="text-xs">{{ extracted.username ?? '(missing)' }}</code></div>
            <div><span class="text-gray-500">Claimed SSH key:</span> <code class="text-xs break-all">{{ extracted.claimedText ?? '(missing)' }}</code></div>
            <div><span class="text-gray-500">Profile URL:</span> <code class="text-xs break-all">{{ extracted.verifiableAt ?? '(missing)' }}</code></div>
          </div>
        </template>
      </div>

      <!-- Step 3: query GitHub -->
      <div v-if="extracted" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">3. Query GitHub</h3>
        <div class="flex items-center gap-2">
          <UFormField label="Username" class="flex-1">
            <UInput v-model="githubUsername" class="w-full" />
          </UFormField>
          <UCheckbox v-model="githubLive" label="Use live api.github.com (rate limited; CORS may block)" />
        </div>
        <UButton label="Fetch signing keys" icon="i-heroicons-cloud-arrow-down" color="primary" @click="handleFetchGithub" />
        <div v-if="githubResult" class="text-sm space-y-1">
          <UBadge
            :color="githubResult.source === 'live' ? 'success' : 'info'"
            variant="subtle"
          >
            source: {{ githubResult.source }}
          </UBadge>
          <UAlert v-if="githubResult.error" color="warning" variant="subtle" :title="githubResult.error" />
          <template v-if="githubResult.keys[0]">
            <div><span class="text-gray-500">GitHub key:</span> <code class="text-xs break-all">{{ githubResult.keys[0].key }}</code></div>
            <div><span class="text-gray-500">Registered:</span> <code class="text-xs">{{ githubResult.keys[0].created_at }}</code></div>
          </template>
        </div>
        <UAlert
          v-if="keysMatch === true" color="success" icon="i-heroicons-check-circle"
          title="🔑 GitHub = 🔑 XID (text)"
          description="The XID's claimed SSH key matches the one registered on the GitHub account."
        />
        <UAlert
          v-else-if="keysMatch === false" color="error" icon="i-heroicons-x-circle"
          title="Key mismatch — possible forgery"
          description="The XID claims an SSH key that is NOT registered on this GitHub account."
        />
      </div>

      <!-- Step 4: verify edge signature -->
      <div v-if="keysMatch === true" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">4. Verify edge signature with the claimed key</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Since the XID's claimed key matches GitHub, verifying the edge's signature with that
          key proves BRadvoc8 controls the matching SSH private key — i.e. proof of control.
        </p>
        <UButton label="Verify edge signature" icon="i-heroicons-shield-check" color="primary" @click="handleVerifyEdgeSig" />
        <UAlert
          v-if="edgeSignatureValid === true" color="success" icon="i-heroicons-check-circle"
          title="Proof of control"
          description="The edge's signature was produced by the same key GitHub has registered. Cross-verification complete."
        />
        <UAlert
          v-else-if="edgeSignatureValid === false" color="error" icon="i-heroicons-x-circle"
          title="Edge signature did not verify"
        />
      </div>

      <!-- Trust matrix -->
      <div v-if="canContinue" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2 bg-green-50/30 dark:bg-green-950/10">
        <h3 class="text-sm font-semibold text-green-700 dark:text-green-300">Verification chain complete</h3>
        <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li>✅ XID is self-consistent</li>
          <li>✅ Edge claims a specific SSH key</li>
          <li>✅ GitHub registry matches that key</li>
          <li>✅ Edge was signed by the private half — proof of control</li>
          <li v-if="githubResult?.keys[0]?.created_at">🗓️ Key in use since {{ githubResult.keys[0].created_at }} (temporal anchor)</li>
        </ul>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §3.3"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(8)"
        />
      </div>
    </template>
  </div>
</template>
