<script setup lang="ts">
import type { Envelope } from '@bcts/envelope'
import { Envelope as EnvelopeClass } from '@bcts/envelope'
import { buildCommitmentList, digestUr, verifyAgainstList, type CommitmentListEntry } from '@/utils/xid-tutorial/commitment'
import { buildSignedEdge } from '@/utils/xid-tutorial/edge'
import { readTextFile } from '@/utils/xid-tutorial/file-io'

const {
  activeSlot, activeDoc, attachEdgeToActive, advanceProvenance,
  completeAndAdvance, edgeList, getArtifact,
} = useXidTutorial()

const claFromPrevStep = computed(() => getArtifact('acceptedCla'))

// Part A: embed a commitment into an edge
const projectName = ref('SisterSpaces')
const projectVerifiableAt = ref('https://github.com/SisterSpaces/SecureAuth/CLAs/README.md')
const contractUrPaste = ref('')
const contractEnvelope = shallowRef<Envelope | null>(null)
const contractDigestUrValue = ref('')
const projectEdge = shallowRef<Envelope | null>(null)
const projectEdgeTree = ref('')
const edgeAttached = ref(false)

function parseUrlSafe(ur: string): Envelope | null {
  try {
    return (EnvelopeClass as unknown as { fromURString(s: string): Envelope }).fromURString(ur.trim())
  } catch { return null }
}

function handleLoadContract() {
  const env = parseUrlSafe(contractUrPaste.value)
  if (!env) return
  contractEnvelope.value = env
  contractDigestUrValue.value = digestUr(env)
}

function handlePasteFromCla() {
  const ur = claFromPrevStep.value
  if (!ur) return
  contractUrPaste.value = ur
  handleLoadContract()
}

function handleBuildContractEdge() {
  const doc = activeDoc.value
  const attKey = activeSlot.value.attestationKey
  if (!doc || !attKey || !contractEnvelope.value) return
  const xidUr = doc.xid().urString()
  const edge = buildSignedEdge(
    {
      subject: `project-${projectName.value.toLowerCase().replace(/\s+/g, '-')}`,
      isA: 'foaf:Project',
      source: { xidUr },
      target: {
        xidUr,
        extras: {
          'foaf:Project': projectName.value,
          'claDigest': contractDigestUrValue.value,
        },
      },
      verifiableAt: projectVerifiableAt.value,
      date: new Date(),
    },
    attKey.prvKeys,
  )
  projectEdge.value = edge
  projectEdgeTree.value = edge.treeFormat()
}

function handleAttachEdge() {
  if (!projectEdge.value) return
  attachEdgeToActive(projectEdge.value)
  edgeAttached.value = true
}

// Part B: commitment list
interface UploadedCla { filename: string; envelope: Envelope }
const uploadedClas = shallowRef<UploadedCla[]>([])
const readmeMarkdown = ref('')
const verifyPasteUr = ref('')
const verifyResult = ref<boolean | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

async function handleUploadClas(ev: Event) {
  const target = ev.target as HTMLInputElement
  if (!target.files) return
  const items: UploadedCla[] = []
  for (const f of Array.from(target.files)) {
    const text = await readTextFile(f)
    const env = parseUrlSafe(text)
    if (env) items.push({ filename: f.name, envelope: env })
  }
  uploadedClas.value = [...uploadedClas.value, ...items]
}

function handleBuildList() {
  const entries: CommitmentListEntry[] = uploadedClas.value.map(u => ({
    filename: u.filename,
    digestUr: digestUr(u.envelope),
  }))
  readmeMarkdown.value = buildCommitmentList(entries)
}

function handleVerifyAgainstList() {
  const env = parseUrlSafe(verifyPasteUr.value)
  if (!env) { verifyResult.value = false; return }
  verifyResult.value = verifyAgainstList(env, readmeMarkdown.value)
}

const canContinue = computed(() => edgeAttached.value || readmeMarkdown.value.length > 0)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🕶️</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Publishing for Privacy</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Two patterns for publishing commitments privately: embed the <em>digest</em> of a private
        contract into an edge on your XID, or publish many digests in a single list so each
        blends into the crowd (<strong>herd privacy</strong>).
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" />

    <template v-if="activeDoc">
      <!-- Part A -->
      <div class="rounded-lg border-2 border-indigo-200 dark:border-indigo-900 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Part A — Embed a commitment in an edge</h3>

        <UFormField label="Paste a signed contract UR (e.g. the accepted CLA from §4.1)">
          <UTextarea v-model="contractUrPaste" :rows="3" placeholder="ur:envelope/…" class="w-full font-mono text-xs" />
        </UFormField>
        <div class="flex items-center gap-2 flex-wrap">
          <UButton label="Compute digest" icon="i-heroicons-calculator" color="primary" @click="handleLoadContract" />
          <UButton
            v-if="claFromPrevStep"
            label="Paste from §4.1"
            icon="i-heroicons-clipboard-document-check"
            variant="outline" color="neutral"
            @click="handlePasteFromCla"
          />
        </div>

        <div v-if="contractDigestUrValue" class="text-xs space-y-1">
          <div><span class="text-gray-500">Digest:</span></div>
          <code class="break-all">{{ contractDigestUrValue }}</code>
        </div>

        <div v-if="contractEnvelope" class="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <UFormField label="Project name">
            <UInput v-model="projectName" class="w-full" />
          </UFormField>
          <UFormField label="verifiableAt">
            <UInput v-model="projectVerifiableAt" class="w-full" />
          </UFormField>
          <UButton
            label="Build signed project edge (with claDigest)"
            icon="i-heroicons-link"
            color="primary"
            :disabled="!activeSlot.attestationKey"
            @click="handleBuildContractEdge"
          />
          <p v-if="!activeSlot.attestationKey" class="text-xs text-amber-600">
            Go to §2.1 first to create an attestation key.
          </p>
        </div>

        <pre v-if="projectEdgeTree" class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ projectEdgeTree }}</pre>
        <UButton v-if="projectEdge && !edgeAttached" label="Attach edge to XID" icon="i-heroicons-paper-clip" color="success" @click="handleAttachEdge" />
        <UAlert v-if="edgeAttached" color="success" icon="i-heroicons-check-circle" title="Edge attached" :description="`XID now has ${edgeList.length} edge(s).`" />
        <UButton v-if="edgeAttached" label="Advance provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="advanceProvenance" />
      </div>

      <!-- Part B: herd privacy -->
      <div class="rounded-lg border-2 border-teal-200 dark:border-teal-900 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-teal-700 dark:text-teal-300">Part B — Commitment list (herd privacy)</h3>
        <p class="text-sm text-teal-800 dark:text-teal-200">
          Ben has 50 contributors — he publishes their CLA digests in a README. Each individual
          commitment hides in the crowd.
        </p>

        <div class="flex items-center gap-2">
          <UButton icon="i-heroicons-arrow-up-tray" label="Upload CLA files" variant="outline" @click="fileInput?.click()" />
          <input ref="fileInput" type="file" multiple accept=".envelope,.txt" class="hidden" @change="handleUploadClas">
          <span class="text-xs text-gray-500">{{ uploadedClas.length }} loaded</span>
        </div>

        <div v-if="uploadedClas.length" class="space-y-1">
          <div v-for="(u, i) in uploadedClas" :key="i" class="text-xs flex items-center gap-2">
            <UIcon name="i-heroicons-document" class="w-4 h-4 text-gray-400" />
            <span class="truncate flex-1">{{ u.filename }}</span>
            <code class="text-[10px] text-gray-500">{{ digestUr(u.envelope).slice(0, 30) }}…</code>
          </div>
        </div>

        <UButton v-if="uploadedClas.length" label="Generate README.md" icon="i-heroicons-document-plus" color="primary" @click="handleBuildList" />

        <UTextarea v-if="readmeMarkdown" :model-value="readmeMarkdown" readonly :rows="10" class="w-full font-mono text-xs" />

        <div v-if="readmeMarkdown" class="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-2">
          <h4 class="text-sm font-semibold">Verify a specific CLA against the list</h4>
          <UTextarea v-model="verifyPasteUr" placeholder="Paste a CLA UR to check" :rows="2" class="w-full font-mono text-xs" />
          <UButton label="Check against README" icon="i-heroicons-magnifying-glass" color="neutral" variant="outline" @click="handleVerifyAgainstList" />
          <UAlert v-if="verifyResult === true" color="success" title="✅ Digest found in commitment list" />
          <UAlert v-if="verifyResult === false" color="error" title="❌ Digest not in list" />
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">Herd privacy scales</h3>
        <div class="grid grid-cols-2 gap-x-6 text-xs">
          <div class="font-semibold text-gray-500">Contributors</div>
          <div class="font-semibold text-gray-500">Observer's challenge</div>
          <div>1</div><div>Trivial to identify</div>
          <div>10</div><div>Difficult</div>
          <div>50</div><div>Needle in haystack</div>
          <div>500</div><div>Effectively anonymous</div>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §4.3"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(11)"
        />
      </div>
    </template>
  </div>
</template>
