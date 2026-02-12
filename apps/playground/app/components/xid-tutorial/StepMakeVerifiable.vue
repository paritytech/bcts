<script setup lang="ts">
const {
  xidDocument,
  envelopeUrOutput,
  error,
  resolutionMethodList,
  provenanceMark,
  addResolutionMethod,
  advanceProvenance,
  getPublicEnvelope,
  verifySignature,
  completeAndAdvance,
} = useXidTutorial()

const resolutionUri = ref('https://github.com/BRadvoc8/BRadvoc8')
const signatureValid = ref<boolean | null>(null)
const publicTree = ref('')
const copied = ref(false)

const hasResolutionMethod = computed(() => resolutionMethodList.value.length > 0)

function handleAddResolution() {
  if (!resolutionUri.value.trim()) return
  addResolutionMethod(resolutionUri.value.trim())
  resolutionUri.value = ''
  updatePublicTree()
}

function handleVerify() {
  signatureValid.value = verifySignature()
}

function updatePublicTree() {
  nextTick(() => {
    try {
      const pub = getPublicEnvelope()
      publicTree.value = pub ? pub.treeFormat() : ''
    } catch {
      publicTree.value = ''
    }
  })
}

async function copyUrString() {
  if (!envelopeUrOutput.value) return
  try {
    await navigator.clipboard.writeText(envelopeUrOutput.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {}
}

function handleContinue() {
  completeAndAdvance(1)
}

onMounted(() => updatePublicTree())
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      Now that you have an XID, others need a way to find and verify it. By adding a resolution
      method (a URL where your XID is published) and using provenance marks (a hash chain tracking
      updates), your identity becomes verifiable and fresh.
    </p>

    <div class="space-y-2">
      <XidTutorialConceptCard title="Resolution Methods" icon="i-heroicons-globe-alt" :default-open="true">
        A <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">dereferenceVia</code>
        assertion tells verifiers where to find the canonical version of your XID. This could be a
        GitHub repo, a website, or any stable URL you control.
      </XidTutorialConceptCard>

      <XidTutorialConceptCard title="Provenance Marks" icon="i-heroicons-shield-check">
        Provenance marks create a forward-commitment hash chain. Each update gets a sequence number
        and links to the previous version. This lets verifiers confirm they have the latest version
        and detect stale copies.
      </XidTutorialConceptCard>
    </div>

    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Add a Resolution Method</h3>
      </template>

      <div class="space-y-3">
        <UFormField label="Publication URL">
          <UInput
            v-model="resolutionUri"
            placeholder="https://github.com/YourName/YourName"
            icon="i-heroicons-link"
          />
        </UFormField>

        <UButton
          label="Add Resolution Method"
          icon="i-heroicons-globe-alt"
          color="primary"
          :disabled="!resolutionUri.trim()"
          @click="handleAddResolution"
        />

        <div v-if="resolutionMethodList.length" class="space-y-1.5 pt-2">
          <div
            v-for="(method, i) in resolutionMethodList"
            :key="i"
            class="flex items-center gap-2 text-sm"
          >
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500 shrink-0" />
            <span class="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
              {{ method }}
            </span>
          </div>
        </div>
      </div>
    </UCard>

    <UCard v-if="provenanceMark">
      <template #header>
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Provenance Chain</h3>
      </template>

      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <UBadge color="info" variant="subtle">
            Seq #{{ provenanceMark.seq() }}
          </UBadge>
          <UBadge v-if="provenanceMark.seq() === 0" color="success" variant="subtle">
            Genesis
          </UBadge>
        </div>

        <UButton
          label="Advance Provenance"
          icon="i-heroicons-arrow-path"
          color="neutral"
          variant="outline"
          @click="advanceProvenance(); updatePublicTree()"
        />
      </div>
    </UCard>

    <UAlert
      v-else
      icon="i-heroicons-information-circle"
      color="info"
      title="Provenance Not Enabled"
      description="Provenance chain was not enabled during XID creation. In a real workflow, you would enable it to track updates."
    />

    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Verify Signature</h3>
      </template>

      <div class="space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The inception signature proves this XID was created by the holder of the inception key.
        </p>

        <UButton
          label="Verify Signature"
          icon="i-heroicons-check-badge"
          color="neutral"
          variant="outline"
          @click="handleVerify"
        />

        <UAlert
          v-if="signatureValid === true"
          icon="i-heroicons-check-circle"
          color="success"
          title="Signature Valid"
          description="The inception signature was verified successfully."
        />

        <UAlert
          v-else-if="signatureValid === false"
          icon="i-heroicons-x-circle"
          color="error"
          title="Signature Invalid"
          description="The inception signature could not be verified."
        />
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Export Public XID</h3>
      </template>

      <div class="space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          This is the public version of your XID -- safe to share. Private keys are removed but
          signatures still verify.
        </p>

        <div v-if="publicTree" class="space-y-3">
          <pre
            class="font-mono text-xs bg-gray-950 text-gray-200 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-48"
          >{{ publicTree }}</pre>

          <UFormField label="UR String">
            <div class="flex gap-2">
              <UInput
                :model-value="envelopeUrOutput"
                readonly
                class="flex-1 font-mono text-xs"
              />
              <UButton
                :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                :label="copied ? 'Copied!' : 'Copy UR String'"
                :color="copied ? 'success' : 'neutral'"
                variant="outline"
                @click="copyUrString"
              />
            </div>
          </UFormField>
        </div>

        <div v-else class="text-sm text-gray-500 italic">
          Add a resolution method to see the public envelope.
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Trust Progression</h3>
      </template>

      <div class="space-y-3">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 shrink-0" />
            <span class="text-gray-700 dark:text-gray-300">Identity Exists</span>
          </div>

          <div class="flex items-center gap-2 text-sm">
            <UIcon
              :name="hasResolutionMethod ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
              :class="[
                'w-5 h-5 shrink-0',
                hasResolutionMethod ? 'text-green-500' : 'text-gray-400',
              ]"
            />
            <span
              :class="hasResolutionMethod
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-gray-400 dark:text-gray-500'"
            >
              Verifiable &amp; Fresh
            </span>
          </div>
        </div>

        <UButton
          label="Continue to Step 3"
          icon="i-heroicons-arrow-right"
          color="primary"
          :disabled="!hasResolutionMethod"
          @click="handleContinue"
        />
      </div>
    </UCard>

    <UAlert
      v-if="error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      :title="error"
    />
  </div>
</template>
