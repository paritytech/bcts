<script setup lang="ts">
const emit = defineEmits<{
  toggleSidebar: []
}>()
</script>

<template>
  <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-50">
    <div class="mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-heroicons-bars-3"
            class="lg:hidden"
            aria-label="Toggle examples menu"
            @click="emit('toggleSidebar')"
          />
          <UColorModeImage
            light="bc-logo-black.png"
            dark="bc-logo-white.png"
            alt="Blockchain Commons Logo"
            class="h-8 w-auto shrink-0"
          />
          <h1 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            dCBOR Playground
          </h1>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UColorModeButton
            variant="ghost"
            color="neutral"
            size="sm"
          />
          <UButton
            to="https://github.com/leonardocustodio/blockchain-commons"
            target="_blank"
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-simple-icons-github"
          />
        </div>
      </div>
    </div>
  </header>
</template>
