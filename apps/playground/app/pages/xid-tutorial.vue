<script setup lang="ts">
useHead({
  title: 'XID Tutorial',
  meta: [
    { name: 'description', content: 'Learn to create, verify, and use eXtensible IDentifiers (XIDs) with this interactive tutorial' }
  ]
})

const {
  currentStep,
  stepsCompleted,
  treeOutput,
  hexOutput,
  notationOutput,
  diagnosticOutput,
  envelopeUrOutput,
  xidDocument,
  error,
  goToStep,
  resetTutorial,
} = useXidTutorial()

const stepSubtitles = [
  'Create Your First XID',
  'Make It Verifiable',
  'Self-Attestation',
  'Cross-Verification',
]

function handleStepChange(step: number) {
  if (step === -1) {
    resetTutorial()
    return
  }
  goToStep(step)
}
</script>

<template>
  <UDashboardPanel id="xid-tutorial">
    <template #header>
      <UDashboardNavbar>
        <template #left>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-academic-cap" class="text-primary-500 w-5 h-5" />
            <div>
              <h1 class="font-semibold text-gray-900 dark:text-white">XID Tutorial</h1>
              <p class="text-xs text-gray-500">{{ stepSubtitles[currentStep] }}</p>
            </div>
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              v-if="xidDocument"
              label="Open in Builder"
              icon="i-heroicons-wrench-screwdriver"
              variant="ghost"
              size="sm"
              to="/xid-builder"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <div class="flex flex-col lg:grid lg:grid-cols-5 gap-0 h-full overflow-hidden">
      <!-- Left: Tutorial Content -->
      <div class="lg:col-span-3 overflow-y-auto p-6 border-r border-gray-200 dark:border-gray-800">
        <XidTutorialStepper
          :current-step="currentStep"
          :steps-completed="stepsCompleted"
          @go-to-step="handleStepChange"
        />

        <div class="mt-6">
          <XidTutorialStepCreateXid v-show="currentStep === 0" />
          <XidTutorialStepMakeVerifiable v-show="currentStep === 1" />
          <XidTutorialStepSelfAttestation v-show="currentStep === 2" />
          <XidTutorialStepCrossVerification v-show="currentStep === 3" />
        </div>
      </div>

      <!-- Right: Live Output -->
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
        </div>

        <div class="flex-1 overflow-auto p-4 space-y-4">
          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :title="error"
          />

          <XidTutorialCodePreview
            :tree="treeOutput"
            :hex="hexOutput"
            :ur="envelopeUrOutput"
            :notation="notationOutput"
            :diagnostic="diagnosticOutput"
          />
        </div>
      </div>
    </div>
  </UDashboardPanel>
</template>
