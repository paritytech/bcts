<script setup lang="ts">
import { Envelope } from '@bcts/envelope'
import { XIDDocument, XIDVerifySignature } from '@bcts/xid'
import { tamperMiddle } from '@/utils/xid-tutorial/tamper'
import { DEREFERENCE_VIA } from '@bcts/known-values'

const {
  activeDoc, envelopeUrOutput, resolutionMethodList, provenanceMark,
  addResolutionMethod, removeResolutionMethodUri, advanceProvenance,
  getPublicEnvelope, verifySignature, completeAndAdvance,
} = useXidTutorial()

const newUri = ref('https://github.com/BRadvoc8/BRadvoc8/raw/main/xid.txt')
const signatureValid = ref<boolean | null>(null)
const hasPublished = ref(false)
const copied = ref(false)

const benPastedUr = ref('')
const benFetchUrl = ref('')
const benChecks = ref<{ label: string; status: 'pass' | 'fail' | 'warn' | null; detail: string }[]>([])

// Tampering
const tamperedUr = ref('')
const tamperedResult = ref<'valid' | 'invalid' | null>(null)

function handleAdd() {
  if (!newUri.value.trim()) return
  addResolutionMethod(newUri.value.trim())
  newUri.value = ''
}

function handleAdvance() {
  if (!hasPublished.value) return
  advanceProvenance()
}

function handleVerify() {
  signatureValid.value = verifySignature()
}

async function copyUr() {
  if (!envelopeUrOutput.value) return
  try {
    await navigator.clipboard.writeText(envelopeUrOutput.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* */ }
}

function runTamper() {
  const env = getPublicEnvelope()
  if (!env) return
  tamperedUr.value = tamperMiddle(env.urString())
  try {
    const parsed = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(tamperedUr.value)
    XIDDocument.fromEnvelope(parsed, undefined, XIDVerifySignature.Inception)
    tamperedResult.value = 'valid'
  } catch {
    tamperedResult.value = 'invalid'
  }
}

function resetTamper() { tamperedUr.value = ''; tamperedResult.value = null }

function runBenChecks() {
  benChecks.value = []
  const add = (label: string, status: 'pass' | 'fail' | 'warn', detail: string) => {
    benChecks.value.push({ label, status, detail })
  }
  let parsed: Envelope
  try {
    parsed = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(benPastedUr.value.trim())
  } catch (e) {
    add('Parse fetched XID', 'fail', e instanceof Error ? e.message : 'Invalid UR string')
    return
  }
  try {
    XIDDocument.fromEnvelope(parsed, undefined, XIDVerifySignature.Inception)
    add('Inception signature', 'pass', 'XID is self-consistent — signed by its own inception key')
  } catch (e) {
    add('Inception signature', 'fail', e instanceof Error ? e.message : 'Signature failed')
  }

  const derefUris: string[] = []
  try {
    const inner = parsed.subject().isWrapped() ? parsed.tryUnwrap() : parsed
    const assertions = inner.assertions()
    for (const a of assertions) {
      const c = a.case()
      if (c.type !== 'assertion') continue
      try {
        const predKv = c.assertion.predicate().asKnownValue?.()
        if (predKv && predKv.equals(DEREFERENCE_VIA)) {
          const text = c.assertion.object().asText?.()
          if (text) derefUris.push(text)
        }
      } catch { /* */ }
    }
  } catch { /* */ }

  if (derefUris.length === 0) {
    add('dereferenceVia match', 'warn', 'No dereferenceVia URIs declared in the fetched XID.')
  } else if (benFetchUrl.value && derefUris.includes(benFetchUrl.value.trim())) {
    add('dereferenceVia match', 'pass', `Fetched URL matches one of ${derefUris.length} dereferenceVia URIs.`)
  } else if (benFetchUrl.value) {
    add('dereferenceVia match', 'warn', `Fetched URL does not match. Declared URIs: ${derefUris.join(', ')}.`)
  } else {
    add('dereferenceVia match', 'warn', `No fetch URL supplied. XID declares: ${derefUris.join(', ')}.`)
  }

  try {
    const doc = XIDDocument.fromEnvelope(parsed, undefined, XIDVerifySignature.None)
    const mark = doc.provenance()
    if (mark) {
      const cid = Array.from(mark.chainId().slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
      add('Provenance mark present', 'pass', `Sequence ${mark.seq()} on chain ${cid}…`)
    }
    else add('Provenance mark present', 'warn', 'No provenance mark — cannot verify freshness.')
  } catch (e) {
    add('Provenance mark present', 'fail', e instanceof Error ? e.message : 'Could not read provenance')
  }
}

function useCurrentPublic() {
  const env = getPublicEnvelope()
  if (env) benPastedUr.value = env.urString()
  if (resolutionMethodList.value[0]) benFetchUrl.value = resolutionMethodList.value[0]
}

const canContinue = computed(() => resolutionMethodList.value.length > 0 && signatureValid.value === true)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🔗</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Make Your XID Verifiable</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        Right now anyone could pass around a stale copy of your XID and you'd have no way to flag
        it. Declaring a <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">dereferenceVia</code>
        URI embeds the canonical publication location inside the document itself. Verifiers can
        always fetch the freshest copy and check that it matches.
      </p>
    </section>

    <UAlert
      v-if="!activeDoc"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      title="No XID loaded"
      description="Go back to §1.3 and create your XID first."
      variant="subtle"
    />

    <template v-if="activeDoc">
      <!-- Resolution URIs -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Publication URLs</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Add one or more URLs where the canonical version can be fetched. You can declare several
          for redundancy (GitHub raw URL + personal domain, etc).
        </p>
        <div class="flex gap-2">
          <UInput v-model="newUri" placeholder="https://github.com/.../xid.txt" class="flex-1" />
          <UButton label="Add" icon="i-heroicons-plus" color="primary" @click="handleAdd" />
        </div>
        <div v-if="resolutionMethodList.length" class="space-y-1.5 pt-1">
          <div
            v-for="uri in resolutionMethodList"
            :key="uri"
            class="flex items-center justify-between gap-2 text-xs"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 text-green-500 shrink-0" />
              <code class="font-mono text-gray-700 dark:text-gray-300 truncate">{{ uri }}</code>
            </div>
            <UButton
              icon="i-heroicons-x-mark" size="xs" variant="ghost" color="neutral"
              @click="removeResolutionMethodUri(uri)"
            />
          </div>
        </div>
      </div>

      <!-- Provenance gating -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Provenance chain</h3>
        <template v-if="provenanceMark">
          <div class="flex items-center gap-2">
            <UBadge color="info" variant="subtle">Seq #{{ provenanceMark.seq() }}</UBadge>
            <UBadge v-if="provenanceMark.seq() === 0" color="success" variant="subtle">Genesis</UBadge>
          </div>
          <UCheckbox v-model="hasPublished" label="I have published this edition — advance the provenance mark for the next one" />
          <UButton
            label="Advance provenance"
            icon="i-heroicons-arrow-path"
            color="neutral" variant="outline"
            :disabled="!hasPublished"
            @click="handleAdvance"
          />
          <p class="text-xs text-gray-500">
            Only advance once you've actually published this edition — the chain orders <em>published</em> editions.
          </p>
        </template>
        <UAlert
          v-else
          color="info" icon="i-heroicons-information-circle"
          title="No provenance generator"
          description="Create the XID with a password and provenance enabled to get a chain."
          variant="subtle"
        />
      </div>

      <!-- Verify signature -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Verify signature</h3>
        <UButton
          label="Verify inception signature"
          icon="i-heroicons-check-badge"
          color="neutral" variant="outline"
          @click="handleVerify"
        />
        <UAlert
          v-if="signatureValid === true"
          color="success" icon="i-heroicons-check-circle" title="Signature valid"
          description="The inception signature was verified against the embedded public key."
        />
        <UAlert
          v-else-if="signatureValid === false"
          color="error" icon="i-heroicons-x-circle" title="Signature invalid"
        />
      </div>

      <!-- Public UR + copy -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Public UR (safe to share)</h3>
        <div class="flex gap-2">
          <UInput :model-value="envelopeUrOutput" readonly class="flex-1 font-mono text-xs" />
          <UButton
            :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
            :label="copied ? 'Copied' : 'Copy UR'"
            variant="outline"
            :color="copied ? 'success' : 'neutral'"
            @click="copyUr"
          />
        </div>
      </div>

      <!-- Tampering demo -->
      <div class="rounded-lg border border-amber-300 dark:border-amber-800 p-4 space-y-3 bg-amber-50/50 dark:bg-amber-950/10">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-bug-ant" class="w-5 h-5 text-amber-600" />
          <h3 class="text-sm font-semibold text-amber-800 dark:text-amber-200">Tampering demo</h3>
        </div>
        <p class="text-sm text-amber-800 dark:text-amber-200">
          Mutate a single character in the UR and watch the signature verification fail.
        </p>
        <div class="flex items-center gap-2">
          <UButton label="Tamper with public UR" icon="i-heroicons-bolt" color="warning" @click="runTamper" />
          <UButton v-if="tamperedUr" label="Reset" icon="i-heroicons-arrow-path" variant="ghost" color="neutral" @click="resetTamper" />
        </div>
        <UAlert
          v-if="tamperedResult === 'invalid'"
          color="error" icon="i-heroicons-x-circle"
          title="Tampering detected"
          description="Signature verification failed — exactly as expected."
        />
        <UAlert
          v-else-if="tamperedResult === 'valid'"
          color="warning" icon="i-heroicons-exclamation-triangle"
          title="Unexpected: tampered envelope still verified"
        />
      </div>

      <!-- Ben's perspective -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-sky-50/30 dark:bg-sky-950/10">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5 text-sky-600" />
          <h3 class="text-sm font-semibold text-sky-800 dark:text-sky-200">Ben's perspective — verify a received XID</h3>
        </div>
        <p class="text-sm text-sky-800 dark:text-sky-200">
          Ben got a XID via email. He fetches the canonical version from the declared URL and
          runs three checks: inception signature, dereferenceVia URL match, and provenance.
        </p>
        <UButton label="Use current public XID & first URL" variant="soft" color="info" @click="useCurrentPublic" />
        <UFormField label="Fetched XID (UR)">
          <UTextarea v-model="benPastedUr" placeholder="ur:envelope/…" :rows="3" class="w-full font-mono text-xs" />
        </UFormField>
        <UFormField label="URL you fetched from">
          <UInput v-model="benFetchUrl" placeholder="https://…" class="w-full" />
        </UFormField>
        <UButton label="Run Ben's checks" icon="i-heroicons-play" color="primary" @click="runBenChecks" />
        <div v-if="benChecks.length" class="space-y-2 pt-2">
          <div
            v-for="c in benChecks"
            :key="c.label"
            class="flex items-start gap-2 px-3 py-2 rounded-md bg-white dark:bg-gray-900/60"
          >
            <UIcon
              :name="c.status === 'pass' ? 'i-heroicons-check-circle'
                : c.status === 'fail' ? 'i-heroicons-x-circle'
                  : 'i-heroicons-exclamation-triangle'"
              :class="[
                'w-5 h-5 shrink-0 mt-0.5',
                c.status === 'pass' ? 'text-green-500'
                  : c.status === 'fail' ? 'text-red-500' : 'text-amber-500',
              ]"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ c.label }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ c.detail }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Trust assessment matrix -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">What's proven · What's assumed</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="rounded-md bg-green-50 dark:bg-green-950/20 p-3 space-y-1">
            <div class="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">Verified cryptographically</div>
            <ul class="space-y-1 text-gray-700 dark:text-gray-300">
              <li>✅ Signed by the embedded inception key</li>
              <li>✅ Not tampered with since signing</li>
              <li>✅ Valid genesis provenance mark</li>
            </ul>
          </div>
          <div class="rounded-md bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
            <div class="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Still assumed</div>
            <ul class="space-y-1 text-gray-700 dark:text-gray-300">
              <li>❓ Amira actually controls the GitHub account</li>
              <li>❓ Amira is who she says she is</li>
              <li>❓ BRadvoc8 has the claimed skills</li>
            </ul>
          </div>
        </div>
        <p class="text-xs text-gray-500">
          Future chapters will tackle each of these through self-attestations, cross-verification,
          and peer endorsements.
        </p>
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §2.1"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(3)"
        />
      </div>
    </template>
  </div>
</template>
