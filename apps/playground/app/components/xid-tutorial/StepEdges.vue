<script setup lang="ts">
import type { Envelope } from '@bcts/envelope'
import { buildSignedEdge } from '@/utils/xid-tutorial/edge'

const {
  activeSlot, activeDoc, activeIdentity, setActive, generateSshKey, attachEdgeToActive,
  advanceProvenance, completeAndAdvance, edgeList, sshPublicKeyText,
} = useXidTutorial()

const githubUsername = ref('BRadvoc8')
const edgeSubject = ref('account-credential-github')
const isA = ref('foaf:OnlineAccount')

const sshKeyText = ref('')
const builtEdge = shallowRef<Envelope | null>(null)
const builtEdgeTree = ref('')
const edgeAttached = ref(false)

function handleGenerateSsh() {
  const side = generateSshKey('amira')
  if (side) sshKeyText.value = sshPublicKeyText(side.pubKeys)
}

function handleBuildEdge() {
  const doc = activeDoc.value
  if (!doc) return
  const ssh = activeSlot.value.sshKey
  if (!ssh) return
  const xidUr = doc.xid().urString()
  const keyText = sshPublicKeyText(ssh.pubKeys)
  const sshPubUr = ssh.pubKeys.urString()
  const edge = buildSignedEdge({
    subject: edgeSubject.value,
    isA: isA.value,
    source: { xidUr },
    target: {
      xidUr,
      extras: {
        'foaf:accountName': githubUsername.value,
        'foaf:accountServiceHomepage': `https://github.com/${githubUsername.value}/${githubUsername.value}`,
        'sshSigningKeyText': keyText,
        'sshSigningKeysURL': `https://api.github.com/users/${githubUsername.value}/ssh_signing_keys`,
      },
      sshPublicKeysUr: sshPubUr,
    },
    date: new Date(),
    conformsTo: 'https://github.com',
    verifiableAt: `https://api.github.com/users/${githubUsername.value}`,
  }, ssh.prvKeys)
  builtEdge.value = edge
  builtEdgeTree.value = edge.treeFormat()
}

function handleAttach() {
  if (!builtEdge.value) return
  attachEdgeToActive(builtEdge.value)
  edgeAttached.value = true
}

function handleAdvance() { advanceProvenance() }

onMounted(() => {
  // §3.1 is Amira's GitHub-edge flow per the upstream tutorial — make sure
  // she's the active identity so the UI reflects the slot we mutate.
  if (activeIdentity.value !== 'amira') setActive('amira')
  if (activeSlot.value.sshKey) sshKeyText.value = sshPublicKeyText(activeSlot.value.sshKey.pubKeys)
})

const hasSshKey = computed(() => activeSlot.value.sshKey !== null)

const canContinue = computed(() => edgeAttached.value)
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🖋️</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Creating Edges</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        An <em>edge</em> is a signed XID-to-XID relationship. The canonical one is the GitHub
        account link: Amira builds an edge whose <code class="text-xs">target</code>
        sub-envelope claims ownership of her GitHub username, then signs it with the SSH key
        registered on that GitHub account. That signature is what proves control in §3.2.
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
        description="DevReviewer needs one more piece: proof that the person controlling BRadvoc8's XID is the same one controlling the BRadvoc8 GitHub account. Amira builds an edge signed with her SSH signing key — the one registered on the account — and attaches it to her XID."
      />

      <!-- SSH key -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">SSH signing key</h3>
        <div v-if="hasSshKey" class="space-y-2">
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
            <span>Standalone SSH signing key generated. Its public counterpart will go inside the edge target; the private half signs the edge.</span>
          </div>
          <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto">{{ sshKeyText }}</pre>
          <p class="text-xs text-gray-500">
            Upload this public key to GitHub → Settings → SSH and GPG keys → Signing keys. In the
            tutorial we'll continue using the canned BRadvoc8 GitHub account.
          </p>
        </div>
        <UButton v-else label="Generate SSH signing key" color="primary" icon="i-heroicons-key" @click="handleGenerateSsh" />
      </div>

      <!-- Build edge -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <h3 class="text-sm font-semibold">Build the GitHub edge</h3>
        <UFormField label="Edge subject (must be unique in the XID)">
          <UInput v-model="edgeSubject" class="w-full" />
        </UFormField>
        <UFormField label="isA (ontology type)">
          <UInput v-model="isA" class="w-full" />
        </UFormField>
        <UFormField label="GitHub username">
          <UInput v-model="githubUsername" class="w-full" />
        </UFormField>
        <UButton label="Build + sign edge" icon="i-heroicons-link" color="primary" @click="handleBuildEdge" />
      </div>

      <div v-if="builtEdge" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-2">
        <h3 class="text-sm font-semibold">Signed edge</h3>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 p-3 rounded-md overflow-auto max-h-96">{{ builtEdgeTree }}</pre>
        <p class="text-xs text-gray-500">
          Signed with <code class="text-xs">Signature(SshEd25519)</code> — binding the edge to the
          same key GitHub has on file.
        </p>
        <UButton
          label="Attach edge to XID"
          icon="i-heroicons-paper-clip"
          color="primary"
          :disabled="edgeAttached"
          @click="handleAttach"
        />
      </div>

      <div v-if="edgeAttached" class="rounded-lg border border-green-200 dark:border-green-900 p-4 space-y-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
          <span class="text-sm">Edge attached. Your XID now has {{ edgeList.length }} edge(s).</span>
        </div>
        <UButton label="Advance provenance" icon="i-heroicons-arrow-path" variant="outline" color="neutral" @click="handleAdvance" />
      </div>

      <div class="flex justify-end">
        <UButton
          label="Continue to §3.2"
          trailing-icon="i-heroicons-arrow-right"
          color="primary" size="lg"
          :disabled="!canContinue"
          @click="completeAndAdvance(7)"
        />
      </div>
    </template>
  </div>
</template>
