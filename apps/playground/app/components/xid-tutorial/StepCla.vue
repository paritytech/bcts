<script setup lang="ts">
import { Privilege } from '@bcts/xid'
import type { Envelope } from '@bcts/envelope'
import { sha256 } from '@bcts/crypto'
import { buildClaEnvelope, signCla, acceptCla } from '@/utils/xid-tutorial/cla'

const {
  identities, activeDoc, addSideKey, advanceProvenance,
  createIdentity, completeAndAdvance,
} = useXidTutorial()

const benPassword = ref("ben's-own-password")
const projectName = ref('SisterSpaces SecureAuth Library')
const licenseName = ref('Apache-2.0')
const licenseUrl = ref('https://www.apache.org/licenses/LICENSE-2.0.txt')
const licenseText = ref('Apache License Version 2.0, January 2004 … (abbreviated for demo)')
const copyrightTerms = ref('perpetual, worldwide, non-exclusive, royalty-free')
const patentTerms = ref('for contributions containing patentable technology')
const contributorRepresents = ref('original work with authority to grant license')

const claEnvelope = shallowRef<Envelope | null>(null)
const claTree = ref('')
const signedCla = shallowRef<Envelope | null>(null)
const signedClaTree = ref('')
const acceptedCla = shallowRef<Envelope | null>(null)
const acceptedClaTree = ref('')

const contribSigValid = ref<boolean | null>(null)
const accepterSigValid = ref<boolean | null>(null)

function ensureBen() {
  if (!identities.value.ben.document) {
    createIdentity('ben', 'Ben', 'Ed25519', benPassword.value, false)
  }
}

function ensureContractKey() {
  if (!identities.value.amira.contractKey) {
    addSideKey('amira', 'contract', 'Ed25519', [Privilege.Sign])
  }
}

function computeHashHex(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const out = sha256(bytes)
  return Array.from(out).map(b => b.toString(16).padStart(2, '0')).join('')
}

function handleBuild() {
  ensureBen()
  ensureContractKey()
  const amira = identities.value.amira.document
  const ben = identities.value.ben.document
  if (!amira || !ben) return
  const env = buildClaEnvelope({
    project: projectName.value,
    licenseName: licenseName.value,
    licenseUrl: licenseUrl.value,
    licenseHash: computeHashHex(licenseText.value),
    licenseHashAlgo: 'sha256',
    projectManagerXidUr: ben.xid().urString(),
    projectManagerNickname: 'Ben (SisterSpaces)',
    contributorXidUr: amira.xid().urString(),
    contributorNickname: 'BRadvoc8',
    copyrightTerms: copyrightTerms.value,
    patentTerms: patentTerms.value,
    contributorRepresents: contributorRepresents.value,
  })
  claEnvelope.value = env
  claTree.value = env.format()
  signedCla.value = null
  acceptedCla.value = null
}

function handleSign() {
  const key = identities.value.amira.contractKey
  if (!claEnvelope.value || !key) return
  const signed = signCla(claEnvelope.value, key.prvKeys, new Date())
  signedCla.value = signed
  signedClaTree.value = signed.treeFormat()
}

function handleAccept() {
  const ben = identities.value.ben.document
  const benKey = ben?.inceptionKey()?.privateKeys()
  if (!signedCla.value || !ben || !benKey) return
  const accepted = acceptCla(signedCla.value, ben.xid().urString(), benKey, new Date())
  acceptedCla.value = accepted
  acceptedClaTree.value = accepted.treeFormat()
}

function handleVerifyContribSig() {
  const amira = identities.value.amira.document
  const contractPub = identities.value.amira.contractKey?.pubKeys
  if (!signedCla.value || !amira || !contractPub) return
  try { contribSigValid.value = signedCla.value.hasSignatureFrom(contractPub) }
  catch { contribSigValid.value = false }
}

function handleVerifyAcceptSig() {
  const ben = identities.value.ben.document
  const benPub = ben?.inceptionKey()?.publicKeys()
  if (!acceptedCla.value || !benPub) return
  try { accepterSigValid.value = acceptedCla.value.hasSignatureFrom(benPub) }
  catch { accepterSigValid.value = false }
}

const canContinue = computed(() => acceptedCla.value !== null)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">📄</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Binding Agreements</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        A Contributor License Agreement is bilateral: both parties have obligations. Amira signs
        with her <strong>contract key</strong> (sign-only, separate from identity key). Ben wraps
        the signed CLA, adds an <code class="text-xs">acceptedBy</code> assertion + date, wraps
        again, and signs — producing a double-wrapped, double-signed contract.
      </p>
    </section>

    <UAlert v-if="!activeDoc" color="warning" icon="i-heroicons-exclamation-triangle" title="Need a XID first" />

    <template v-if="activeDoc">
      <UAlert
        color="info" variant="subtle" icon="i-heroicons-book-open"
        title="Amira's story"
        description="Ben wants to merge a small PR from BRadvoc8 into SisterSpaces. He needs a signed CLA papering the contribution. Amira creates a contract-signing key, registers it in her XID, signs the CLA — and Ben countersigns."
      />

      <!-- Setup -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Participants</h3>
        <div class="text-xs">
          Amira contract key:
          <span v-if="identities.amira.contractKey" class="text-green-600">✅ ready</span>
          <span v-else class="text-gray-400">not yet created</span>
        </div>
        <div class="text-xs">
          Ben's XID:
          <span v-if="identities.ben.document" class="text-green-600">✅ ready</span>
          <form v-else autocomplete="off" class="inline-flex items-center gap-2" @submit.prevent="ensureBen">
            <input type="text" name="username" value="Ben" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
            <UInput v-model="benPassword" type="password" size="xs" class="inline-block w-40" autocomplete="new-password" />
            <UButton type="submit" size="xs" color="primary" label="Create Ben's XID" />
          </form>
        </div>
      </div>

      <!-- Build CLA -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Build CLA</h3>
        <UFormField label="Project"><UInput v-model="projectName" class="w-full" /></UFormField>
        <UFormField label="License name"><UInput v-model="licenseName" class="w-full" /></UFormField>
        <UFormField label="License URL"><UInput v-model="licenseUrl" class="w-full" /></UFormField>
        <UFormField label="License text (hashed for contractHash)">
          <UTextarea v-model="licenseText" :rows="2" class="w-full" />
        </UFormField>
        <UFormField label="Copyright terms"><UInput v-model="copyrightTerms" class="w-full" /></UFormField>
        <UFormField label="Patent terms"><UInput v-model="patentTerms" class="w-full" /></UFormField>
        <UFormField label="Contributor represents"><UInput v-model="contributorRepresents" class="w-full" /></UFormField>
        <UButton label="Build CLA envelope" icon="i-heroicons-document-text" color="primary" @click="handleBuild" />
      </div>

      <div v-if="claEnvelope" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">CLA document (unsigned)</h3>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ claTree }}</pre>
        <UButton label="Amira signs with contract key" icon="i-heroicons-pencil-square" color="primary" @click="handleSign" />
      </div>

      <div v-if="signedCla" class="rounded-lg border-2 border-blue-200 dark:border-blue-900 p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-300">CLA signed by contributor</h3>
          <UButton size="xs" variant="outline" label="Verify contributor signature" @click="handleVerifyContribSig" />
        </div>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-48">{{ signedClaTree }}</pre>
        <UAlert v-if="contribSigValid === true" color="success" icon="i-heroicons-check-circle" title="Contributor signature valid" />
        <UAlert v-else-if="contribSigValid === false" color="error" icon="i-heroicons-x-circle" title="Contributor signature failed" />
        <UButton label="Ben accepts + countersigns" icon="i-heroicons-check-badge" color="primary" @click="handleAccept" />
      </div>

      <div v-if="acceptedCla" class="rounded-lg border-2 border-green-200 dark:border-green-900 p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-green-700 dark:text-green-300">Accepted CLA (double-wrapped)</h3>
          <UButton size="xs" variant="outline" label="Verify acceptance signature" @click="handleVerifyAcceptSig" />
        </div>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-64">{{ acceptedClaTree }}</pre>
        <UAlert v-if="accepterSigValid === true" color="success" icon="i-heroicons-check-circle" title="Accepter signature valid" />
        <UButton label="Advance Amira's provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="advanceProvenance" />
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §4.2"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(10)"
        />
      </div>
    </template>
  </div>
</template>
