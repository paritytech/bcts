<script setup lang="ts">
const props = defineProps<{
  currentStep: number
  stepsCompleted: boolean[]
}>()

const emit = defineEmits<{
  'go-to-step': [step: number]
}>()

const steps = [
  'Create XID',
  'Make Verifiable',
  'Self-Attestation',
  'Cross-Verify',
]

function stepState(index: number): 'completed' | 'active' | 'pending' {
  if (props.stepsCompleted[index]) return 'completed'
  if (index === props.currentStep) return 'active'
  return 'pending'
}

function onStepClick(index: number) {
  if (props.stepsCompleted[index]) {
    emit('go-to-step', index)
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-center">
      <template v-for="(label, i) in steps" :key="i">
        <!-- Connecting line -->
        <div
          v-if="i > 0"
          :class="[
            'h-0.5 w-8 sm:w-16 transition-colors',
            stepsCompleted[i - 1] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700',
          ]"
        />

        <!-- Step circle + label -->
        <div class="flex flex-col items-center gap-1.5">
          <button
            :class="[
              'relative flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all',
              stepState(i) === 'completed' && 'bg-green-500 text-white cursor-pointer hover:bg-green-600',
              stepState(i) === 'active' && 'bg-primary-500 text-white ring-4 ring-primary-500/30 animate-pulse',
              stepState(i) === 'pending' && 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed',
            ]"
            :disabled="stepState(i) === 'pending'"
            @click="onStepClick(i)"
          >
            <UIcon v-if="stepState(i) === 'completed'" name="i-heroicons-check" class="w-5 h-5" />
            <UIcon v-else-if="stepState(i) === 'pending'" name="i-heroicons-lock-closed" class="w-4 h-4" />
            <span v-else class="w-2 h-2 rounded-full bg-white" />
          </button>
          <span
            :class="[
              'text-xs text-center max-w-16 sm:max-w-20 leading-tight',
              stepState(i) === 'active' ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-500 dark:text-gray-400',
            ]"
          >
            {{ label }}
          </span>
        </div>
      </template>
    </div>

  </div>
</template>
