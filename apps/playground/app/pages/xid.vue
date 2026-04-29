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
  error, goToSection, resetTutorial,
} = useXidTutorial()

const mobileNavOpen = ref(false)

function onGoToSection(index: number) {
  goToSection(index)
  mobileNavOpen.value = false
}

function onSetActive(name: typeof activeIdentity.value) {
  setActive(name)
  mobileNavOpen.value = false
}

const identityList = computed(() => Object.values(identities.value))

const hasOutput = computed(() =>
  !!(treeOutput.value || hexOutput.value || notationOutput.value || error.value),
)

const PANE_STORAGE_KEY = 'xid-tutorial-pane-size'
const SIDEBAR_STORAGE_KEY = 'xid-tutorial-sidebar-size'
const SIDEBAR_DEFAULT = 256
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480

const mainPaneSize = ref(50)
const sidebarSize = ref(SIDEBAR_DEFAULT)
const splitContainerRef = ref<HTMLElement | null>(null)
const layoutRef = ref<HTMLElement | null>(null)

const mainPaneStyle = computed(() => ({
  flex: `0 0 ${mainPaneSize.value}%`,
}))

const sidebarStyle = computed(() => ({
  width: `${sidebarSize.value}px`,
}))

onMounted(() => {
  const storedPane = Number(localStorage.getItem(PANE_STORAGE_KEY))
  if (Number.isFinite(storedPane) && storedPane >= 20 && storedPane <= 80) mainPaneSize.value = storedPane
  const storedSidebar = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY))
  if (Number.isFinite(storedSidebar) && storedSidebar >= SIDEBAR_MIN && storedSidebar <= SIDEBAR_MAX) {
    sidebarSize.value = storedSidebar
  }
})

watch(mainPaneSize, (v) => {
  try { localStorage.setItem(PANE_STORAGE_KEY, String(v)) } catch { /* */ }
})
watch(sidebarSize, (v) => {
  try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(v)) } catch { /* */ }
})

function isPortraitMobile(): boolean {
  return window.matchMedia('(max-width: 1023px) and (orientation: portrait)').matches
}

// ---- Main vs output divider ----
function updateMainPaneFromPointer(e: PointerEvent) {
  const el = splitContainerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const portrait = isPortraitMobile()
  const offset = portrait ? e.clientY - rect.top : e.clientX - rect.left
  const total = portrait ? rect.height : rect.width
  if (total <= 0) return
  // In portrait the split container uses flex-col-reverse: output on top, main on bottom.
  // Pointer-from-top maps to output's height, so we invert to get main's percentage.
  let pct = (offset / total) * 100
  if (portrait) pct = 100 - pct
  mainPaneSize.value = Math.max(20, Math.min(80, pct))
}

function endMainResize() {
  document.removeEventListener('pointermove', updateMainPaneFromPointer)
  document.removeEventListener('pointerup', endMainResize)
  document.removeEventListener('pointercancel', endMainResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

function startMainResize(e: PointerEvent) {
  e.preventDefault()
  document.addEventListener('pointermove', updateMainPaneFromPointer)
  document.addEventListener('pointerup', endMainResize)
  document.addEventListener('pointercancel', endMainResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = isPortraitMobile() ? 'row-resize' : 'col-resize'
}

function resetMainPaneSize() { mainPaneSize.value = 50 }

// ---- Sidebar divider (desktop only) ----
function updateSidebarFromPointer(e: PointerEvent) {
  const el = layoutRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const next = e.clientX - rect.left
  sidebarSize.value = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, next))
}

function endSidebarResize() {
  document.removeEventListener('pointermove', updateSidebarFromPointer)
  document.removeEventListener('pointerup', endSidebarResize)
  document.removeEventListener('pointercancel', endSidebarResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

function startSidebarResize(e: PointerEvent) {
  e.preventDefault()
  document.addEventListener('pointermove', updateSidebarFromPointer)
  document.addEventListener('pointerup', endSidebarResize)
  document.addEventListener('pointercancel', endSidebarResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

function resetSidebarSize() { sidebarSize.value = SIDEBAR_DEFAULT }

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
      <UDashboardNavbar title="XID Tutorial">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <span class="text-xs text-gray-500">{{ progress.done }} / {{ progress.total }}</span>
          <UButton
            label="Reset"
            icon="i-heroicons-arrow-path"
            variant="ghost"
            size="sm"
            color="neutral"
            @click="resetTutorial"
          />
          <UColorModeButton size="sm" />
          <UButton
            to="https://github.com/paritytech/bcts"
            target="_blank"
            icon="i-simple-icons-github"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="GitHub Repository"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
    <ClientOnly>
      <template #fallback>
        <div class="flex items-center justify-center h-full">
          <div class="flex items-center gap-2 text-gray-500">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
            <span class="text-sm">Loading tutorial…</span>
          </div>
        </div>
      </template>
    <div class="h-full flex flex-col overflow-hidden">
      <!-- Mobile-only collapsible nav toolbar -->
      <div class="lg:hidden border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 shrink-0">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors"
          :aria-expanded="mobileNavOpen"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <UIcon :name="mobileNavOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-4 h-4 shrink-0 text-gray-500" />
          <span class="font-semibold text-gray-800 dark:text-gray-200 truncate">
            §{{ currentSectionMeta?.id }} · {{ currentSectionMeta?.title }}
          </span>
          <span class="text-gray-400 dark:text-gray-600">·</span>
          <span class="text-gray-600 dark:text-gray-400 truncate">{{ identities[activeIdentity].displayName }}</span>
        </button>
        <div v-if="mobileNavOpen" class="px-4 pb-4 pt-1 space-y-4 max-h-[60vh] overflow-y-auto border-t border-gray-200/70 dark:border-gray-800/70">
          <div>
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active identity</div>
            <div class="space-y-1">
              <button
                v-for="slot in identityList"
                :key="slot.name"
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors"
                :class="activeIdentity === slot.name ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800' : ''"
                @click="onSetActive(slot.name)"
              >
                <UIcon
                  name="i-heroicons-user-circle"
                  class="w-4 h-4 shrink-0"
                  :class="slot.document ? 'text-green-500' : 'text-gray-400'"
                />
                <span class="flex-1 text-left truncate" :class="!slot.document && 'text-gray-400'">
                  {{ slot.displayName }}
                </span>
                <UBadge v-if="slot.document" size="xs" color="success" variant="subtle">ready</UBadge>
              </button>
            </div>
          </div>
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
      </div>

      <!--
        Layout switcher.
        Mobile portrait: stacked (flex-col); main + divider + output share full height.
        Mobile landscape: side-by-side (flex-row); main + divider + output share full width.
        Desktop (lg+): sidebar + (main + divider + output) row.
        Main pane size is user-resizable via the divider; output gets the remainder.
      -->
      <div ref="layoutRef" class="flex-1 min-h-0 flex max-lg:portrait:flex-col lg:flex-row gap-0 overflow-hidden">
        <!-- Desktop sidebar -->
        <aside
          :style="sidebarStyle"
          class="hidden lg:block lg:shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-800 p-4 space-y-4 bg-gray-50 dark:bg-gray-900/30"
        >
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
                name="i-heroicons-user-circle"
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
                  @click="goToSection(globalIndex(s.id))"
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

        <!-- Drag handle for sidebar width (desktop only) -->
        <div
          class="hidden lg:flex group shrink-0 items-center justify-center select-none touch-none transition-colors
                 cursor-col-resize w-1.5 h-full bg-gray-200 dark:bg-gray-800 hover:bg-primary-300 dark:hover:bg-primary-700"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          @pointerdown="startSidebarResize"
          @dblclick="resetSidebarSize"
        >
          <span class="block w-0.5 h-8 bg-gray-400 dark:bg-gray-600 group-hover:bg-primary-500 rounded-full transition-colors" />
        </div>

        <!-- Resizable split container (main + divider + output).
             Portrait uses flex-col-reverse so the live output sits at the top and
             the tutorial content stays beneath it (closer to the user's thumbs). -->
        <div
          ref="splitContainerRef"
          class="flex-1 min-h-0 flex max-lg:portrait:flex-col-reverse lg:flex-row overflow-hidden"
        >
          <!-- Main content. On desktop, sidebar resizing must not reflow the form
               fields, so we pin a min-width and let the pane scroll horizontally. -->
          <div
            :style="hasOutput ? mainPaneStyle : undefined"
            class="min-h-0 overflow-y-auto lg:overflow-x-auto"
            :class="hasOutput ? '' : 'flex-1'"
          >
            <div class="p-6 lg:min-w-[576px]">
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
          </div>

          <!-- Drag handle to resize main vs output. Vertical bar in row layouts; horizontal in portrait stack. -->
          <div
            v-show="hasOutput"
            class="group shrink-0 flex items-center justify-center select-none touch-none transition-colors
                   cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-primary-300 dark:hover:bg-primary-700
                   max-lg:portrait:cursor-row-resize max-lg:portrait:w-full max-lg:portrait:h-1.5
                   lg:w-1.5 lg:h-full
                   max-lg:landscape:w-1.5 max-lg:landscape:h-full"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panes"
            @pointerdown="startMainResize"
            @dblclick="resetMainPaneSize"
          >
            <span
              class="block bg-gray-400 dark:bg-gray-600 group-hover:bg-primary-500 rounded-full transition-colors
                     max-lg:portrait:h-0.5 max-lg:portrait:w-8
                     lg:w-0.5 lg:h-8
                     max-lg:landscape:w-0.5 max-lg:landscape:h-8"
            />
          </div>

          <!-- Right panel: Live output (hidden on mobile when there's nothing to show) -->
          <div
            :class="[
              'min-h-0 overflow-hidden flex flex-col',
              hasOutput ? 'flex-1' : 'max-lg:hidden lg:flex lg:flex-1',
            ]"
          >
          <div class="hidden lg:block px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50 shrink-0">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Active Envelope</h3>
            <p class="text-xs text-gray-500 mt-0.5">{{ identities[activeIdentity].displayName }}</p>
          </div>
          <div class="flex-1 min-h-0 flex flex-col overflow-hidden p-4 space-y-4">
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
      </div>
    </div>
    </ClientOnly>
    </template>
  </UDashboardPanel>
</template>
