<script setup lang="ts">
const {
  xidDocument,
  error,
  keyList,
  attachmentList,
  serviceList,
  provenanceMark,
  addAttachment,
  addService,
  advanceProvenance,
  getKeyAlgorithm,
  getKeyRefHex,
  completeAndAdvance,
} = useXidTutorial()

const vendor = ref('self')
const customVendor = ref('')
const payloadType = ref('github-account')
const payloadValue = ref('')
const conformsTo = ref('')

const serviceUri = ref('')
const serviceName = ref('')
const serviceCapability = ref('')
const serviceKeyRef = ref('')

const vendorOptions = [
  { label: 'self (Self-authored)', value: 'self' },
  { label: 'github', value: 'github' },
  { label: 'custom', value: 'custom' },
]

const payloadTypeOptions = [
  { label: 'GitHub Account', value: 'github-account' },
  { label: 'SSH Public Key', value: 'ssh-key' },
  { label: 'Website URL', value: 'website' },
  { label: 'Custom Text', value: 'custom' },
]

const payloadPlaceholder = computed(() => {
  const map: Record<string, string> = {
    'github-account': 'github.com/username',
    'ssh-key': 'ssh-ed25519 AAAA...',
    'website': 'https://example.com',
    'custom': 'Enter your attestation data...',
  }
  return map[payloadType.value] ?? ''
})

const usesTextarea = computed(() => payloadType.value === 'ssh-key' || payloadType.value === 'custom')

const keyRefOptions = computed(() =>
  keyList.value.map(key => ({
    label: `${getKeyAlgorithm(key)} (${getKeyRefHex(key).substring(0, 8)}...)`,
    value: getKeyRefHex(key),
  })),
)

const hasAttachments = computed(() => attachmentList.value.length > 0)

function handleAddAttestation() {
  const v = vendor.value === 'custom' ? customVendor.value.trim() : vendor.value
  if (!v || !payloadValue.value.trim()) return
  addAttachment(payloadValue.value.trim(), v, conformsTo.value.trim() || undefined)
  payloadValue.value = ''
  conformsTo.value = ''
}

function handleAddService() {
  if (!serviceUri.value.trim()) return
  addService(
    serviceUri.value.trim(),
    serviceName.value.trim(),
    serviceCapability.value.trim(),
    serviceKeyRef.value || undefined,
  )
  serviceUri.value = ''
  serviceName.value = ''
  serviceCapability.value = ''
  serviceKeyRef.value = ''
}

function truncatePayload(text: string, maxLen = 60): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}
</script>

<template>
  <div class="space-y-6">
    <!-- Section 1: Introduction -->
    <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      Now you can add verifiable claims to your XID. Attachments are vendor-qualified
      containers that hold custom data — like proving you control a GitHub account or an
      SSH signing key. Services declare endpoints where your identity can be used.
    </p>

    <!-- Section 2: Concept Cards -->
    <div class="space-y-3">
      <XidTutorialConceptCard title="Attachments" icon="i-heroicons-paper-clip">
        Attachments are vendor-qualified payload containers. The vendor field identifies
        who authored the data (e.g., 'self' for self-authored claims). They can optionally
        include a conformsTo URI indicating the data format.
      </XidTutorialConceptCard>

      <XidTutorialConceptCard title="Proof-of-Control" icon="i-heroicons-key">
        By embedding a public key (like an SSH signing key) inside an attachment and signing
        the XID with your inception key, you create cryptographic proof that the same entity
        controls both the XID and the attested account.
      </XidTutorialConceptCard>
    </div>

    <!-- Section 3: Add Attestation Form -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Add an Attestation</h3>

      <div class="space-y-3">
        <UFormField label="Vendor">
          <USelect v-model="vendor" :items="vendorOptions" class="w-full" />
        </UFormField>

        <UFormField v-if="vendor === 'custom'" label="Custom Vendor Name">
          <UInput v-model="customVendor" placeholder="e.g. my-org" class="w-full" />
        </UFormField>

        <UFormField label="Payload Type">
          <USelect v-model="payloadType" :items="payloadTypeOptions" class="w-full" />
        </UFormField>

        <UFormField label="Payload">
          <UTextarea
            v-if="usesTextarea"
            v-model="payloadValue"
            :placeholder="payloadPlaceholder"
            class="w-full"
            :rows="3"
          />
          <UInput
            v-else
            v-model="payloadValue"
            :placeholder="payloadPlaceholder"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Conforms To (optional)">
          <UInput
            v-model="conformsTo"
            placeholder="https://schema.example.com/github-v1"
            class="w-full"
          />
        </UFormField>

        <UButton
          label="Add Attestation"
          icon="i-heroicons-paper-clip"
          color="primary"
          @click="handleAddAttestation"
        />
      </div>

      <UAlert v-if="error" color="error" :title="error" variant="subtle" />
    </div>

    <!-- Section 4: Current Attestations -->
    <div v-if="hasAttachments" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Your Attestations</h3>

      <div class="space-y-2">
        <div
          v-for="att in attachmentList"
          :key="att.digestHex"
          class="flex items-start gap-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3"
        >
          <UIcon name="i-heroicons-paper-clip" class="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <UBadge color="neutral" variant="subtle" size="sm">{{ att.vendor }}</UBadge>
            </div>
            <pre class="font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">{{ truncatePayload(att.payloadPreview) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 5: Add Service Endpoint -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Add a Service Endpoint</h3>

      <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        Services declare where your identity is used, linking a URI to specific keys and capabilities.
      </p>

      <div class="space-y-3">
        <UFormField label="Service URI">
          <UInput v-model="serviceUri" placeholder="https://github.com/BRadvoc8" class="w-full" />
        </UFormField>

        <UFormField label="Service Name">
          <UInput v-model="serviceName" placeholder="GitHub" class="w-full" />
        </UFormField>

        <UFormField label="Capability">
          <UInput v-model="serviceCapability" placeholder="code-signing" class="w-full" />
        </UFormField>

        <UFormField label="Key Reference">
          <USelect v-model="serviceKeyRef" :items="keyRefOptions" class="w-full" />
        </UFormField>

        <UButton
          label="Add Service"
          icon="i-heroicons-server-stack"
          color="primary"
          variant="outline"
          @click="handleAddService"
        />
      </div>
    </div>

    <!-- Section 6: Record Update (Provenance) -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <template v-if="provenanceMark">
        <UButton
          label="Record Update (Advance Provenance)"
          icon="i-heroicons-arrow-path"
          color="primary"
          variant="soft"
          @click="advanceProvenance"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Sequence: 0 (genesis) &rarr; 1 (attestation added)
        </p>
      </template>
      <UAlert
        v-else
        color="info"
        title="Provenance not enabled"
        description="Provenance tracking was not enabled during XID creation. You can still add attestations without it."
        variant="subtle"
      />
    </div>

    <!-- Section 7: Trust Progression & Complete -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Trust Progression</h3>

      <ul class="space-y-2 text-sm">
        <li class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 shrink-0" />
          <span class="text-gray-700 dark:text-gray-300">Identity Exists</span>
        </li>
        <li class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 shrink-0" />
          <span class="text-gray-700 dark:text-gray-300">Verifiable &amp; Fresh</span>
        </li>
        <li class="flex items-center gap-2">
          <UIcon
            :name="hasAttachments ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
            :class="['w-5 h-5 shrink-0', hasAttachments ? 'text-green-500' : 'text-gray-300 dark:text-gray-600']"
          />
          <span :class="['text-gray-700 dark:text-gray-300', !hasAttachments && 'opacity-50']">
            Claims Present
          </span>
        </li>
      </ul>

      <div class="flex justify-end">
        <UButton
          label="Continue to Step 4"
          trailing-icon="i-heroicons-arrow-right"
          color="primary"
          size="lg"
          :disabled="!hasAttachments"
          @click="completeAndAdvance(2)"
        />
      </div>
    </div>
  </div>
</template>
