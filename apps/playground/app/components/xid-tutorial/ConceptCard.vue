<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  icon: string
  defaultOpen?: boolean
}>(), {
  defaultOpen: false,
})

const open = ref(props.defaultOpen)
</script>

<template>
  <div class="rounded-lg border-l-4 border-primary-500 bg-sky-50 dark:bg-sky-950/20 overflow-hidden">
    <button
      class="flex items-center gap-2 w-full px-3 py-2.5 text-left cursor-pointer"
      @click="open = !open"
    >
      <UIcon :name="icon" class="w-5 h-5 text-primary-500 shrink-0" />
      <span class="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{{ title }}</span>
      <UIcon
        name="i-heroicons-chevron-down"
        :class="[
          'w-4 h-4 text-gray-400 transition-transform duration-200',
          open && 'rotate-180',
        ]"
      />
    </button>
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-96"
      leave-from-class="opacity-100 max-h-96"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-show="open" class="overflow-hidden">
        <div class="px-3 pb-3 pt-0 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>
