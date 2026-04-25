<script setup lang="ts">
import { TUTORIAL_SECTIONS, CHAPTERS, sectionsByChapter } from '@/utils/xid-tutorial/sections'

useHead({
  title: 'XID Tutorial',
  meta: [
    { name: 'description', content: 'Learn to create, verify, and use eXtensible IDentifiers (XIDs) with this interactive tutorial' },
  ],
})

const {
  activeIdentity, identities, setActive,
  currentSection, currentSectionMeta, sectionsCompleted, progress,
  treeOutput, hexOutput, notationOutput, diagnosticOutput, envelopeUrOutput,
  error, goToSection, resetTutorial, activeDoc,
} = useXidTutorial()

function onGoToSection(index: number) { goToSection(index) }

const identityList = computed(() => Object.values(identities.value))

const chapterSections = computed(() => {
  return CHAPTERS.map(ch => ({
    chapter: ch,
    sections: sectionsByChapter(ch.number),
  }))
})

function sectionStateClass(i: number): string {
  if (sectionsCompleted.value[i]) return 'text-green-600 dark:text-green-400'
  if (i === currentSection.value) return 'text-primary-600 dark:text-primary-400 font-semibold'
  return 'text-gray-600 dark:text-gray-400'
}

function globalIndex(sectionId: string): number {
  return TUTORIAL_SECTIONS.findIndex(s => s.id === sectionId)
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
              <p v-if="currentSectionMeta" class="text-xs text-gray-500">
                §{{ currentSectionMeta.id }} · {{ currentSectionMeta.title }}
              </p>
            </div>
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{{ progress.done }} / {{ progress.total }}</span>
            <UButton
              v-if="activeDoc"
              label="Open in Builder"
              icon="i-heroicons-wrench-screwdriver"
              variant="ghost"
              size="sm"
              to="/xid-builder"
            />
            <UButton
              label="Reset"
              icon="i-heroicons-arrow-path"
              variant="ghost"
              size="sm"
              color="neutral"
              @click="resetTutorial"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <ClientOnly>
      <template #fallback>
        <div class="flex items-center justify-center h-full">
          <div class="flex items-center gap-2 text-gray-500">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
            <span class="text-sm">Loading tutorial…</span>
          </div>
        </div>
      </template>
    <div class="flex flex-col lg:grid lg:grid-cols-12 gap-0 h-full overflow-hidden">
      <!-- Left sidebar: chapter + section list -->
      <aside class="lg:col-span-3 overflow-y-auto border-r border-gray-200 dark:border-gray-800 p-4 space-y-4 bg-gray-50 dark:bg-gray-900/30">
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active identity</div>
        <div class="space-y-1">
          <button
            v-for="slot in identityList"
            :key="slot.name"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors"
            :class="activeIdentity === slot.name ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800' : ''"
            @click="setActive(slot.name)"
          >
            <UIcon
              :name="slot.document ? 'i-heroicons-user-circle' : 'i-heroicons-user-circle'"
              class="w-4 h-4 shrink-0"
              :class="slot.document ? 'text-green-500' : 'text-gray-400'"
            />
            <span class="flex-1 text-left truncate" :class="!slot.document && 'text-gray-400'">
              {{ slot.displayName }}
            </span>
            <UBadge
              v-if="slot.document"
              size="xs"
              color="success"
              variant="subtle"
            >
              ready
            </UBadge>
          </button>
        </div>

        <div class="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          <div v-for="ch in chapterSections" :key="ch.chapter.number">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Ch. {{ ch.chapter.number }} · {{ ch.chapter.title }}
            </div>
            <div class="space-y-0.5">
              <button
                v-for="s in ch.sections"
                :key="s.id"
                :class="[
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/70',
                  sectionStateClass(globalIndex(s.id)),
                  globalIndex(s.id) === currentSection ? 'bg-primary-50 dark:bg-primary-900/20' : '',
                ]"
                @click="onGoToSection(globalIndex(s.id))"
              >
                <UIcon
                  :name="sectionsCompleted[globalIndex(s.id)] ? 'i-heroicons-check-circle'
                    : globalIndex(s.id) === currentSection ? 'i-heroicons-play'
                      : 'i-heroicons-minus-circle'"
                  class="w-4 h-4 shrink-0"
                />
                <span class="flex-1">§{{ s.id }} · {{ s.title }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <div class="lg:col-span-6 overflow-y-auto p-6 border-r border-gray-200 dark:border-gray-800">
        <XidTutorialStep1Welcome v-if="currentSectionMeta?.id === '1.1'" />
        <XidTutorialStep1Concepts v-else-if="currentSectionMeta?.id === '1.2'" />
        <XidTutorialStepCreateXid v-else-if="currentSectionMeta?.id === '1.3'" />
        <XidTutorialStepMakeVerifiable v-else-if="currentSectionMeta?.id === '1.4'" />
        <XidTutorialStepSelfAttestation v-else-if="currentSectionMeta?.id === '2.1'" />
        <XidTutorialStepElision v-else-if="currentSectionMeta?.id === '2.2'" />
        <XidTutorialStepEncryption v-else-if="currentSectionMeta?.id === '2.3'" />
        <XidTutorialStepEdges v-else-if="currentSectionMeta?.id === '3.1'" />
        <XidTutorialStepCrossVerification v-else-if="currentSectionMeta?.id === '3.2'" />
        <XidTutorialStepEndorsements v-else-if="currentSectionMeta?.id === '3.3'" />
        <XidTutorialStepCla v-else-if="currentSectionMeta?.id === '4.1'" />
        <XidTutorialStepPrivacy v-else-if="currentSectionMeta?.id === '4.2'" />
        <XidTutorialStepViews v-else-if="currentSectionMeta?.id === '4.3'" />
        <XidTutorialStepEditions v-else-if="currentSectionMeta?.id === '4.4'" />
      </div>

      <!-- Right panel: Live output -->
      <div class="lg:col-span-3 flex flex-col overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Active Envelope</h3>
          <p class="text-xs text-gray-500 mt-0.5">{{ identities[activeIdentity].displayName }}</p>
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
    </ClientOnly>
  </UDashboardPanel>
</template>
