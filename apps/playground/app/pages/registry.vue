<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRegistryData, type TagItem, type KnownValueItem } from '~/composables/useRegistryData'
import { useIanaTags } from '~/composables/useIanaTags'

useHead({
  title: 'Registry Browser | BCTS IDE - Blockchain Commons TypeScript',
  meta: [{ name: 'description', content: 'Browse CBOR tags and Known Values registry' }],
})

type RegistryTab = 'tags' | 'known-values' | 'iana'

const activeTab = ref<RegistryTab>('tags')
const searchQuery = ref('')

// Get data from the packages via composable
const { tagsData, knownValuesData } = useRegistryData()

// Get IANA tags (fetched dynamically)
const ianaResult = useIanaTags()

// Get unique categories
const tagCategories = computed(() => [...new Set(tagsData.map(t => t.category))])
const knownValueCategories = computed(() => [...new Set(knownValuesData.map(k => k.category))])

// Selected category filter
const selectedTagCategory = ref<string | null>(null)
const selectedKnownValueCategory = ref<string | null>(null)

// Filtered data
const filteredTags = computed(() => {
  let result = tagsData

  if (selectedTagCategory.value) {
    result = result.filter(t => t.category === selectedTagCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.value.toString().includes(query) ||
      t.category.toLowerCase().includes(query)
    )
  }

  return result
})

const filteredKnownValues = computed(() => {
  let result = knownValuesData

  if (selectedKnownValueCategory.value) {
    result = result.filter(k => k.category === selectedKnownValueCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(k =>
      k.name.toLowerCase().includes(query) ||
      k.value.toString().includes(query) ||
      k.category.toLowerCase().includes(query)
    )
  }

  return result
})

// Filtered IANA tags
const filteredIanaTags = computed(() => {
  let result = ianaResult.value.tags

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.value.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.semantics.toLowerCase().includes(query)
    )
  }

  return result
})

// Category color mapping
const categoryColors: Record<string, string> = {
  'Standard IANA': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Core Envelope': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Envelope Extension': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Function Calls': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Cryptography': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Post-Quantum': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Seeds & Keys': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'SSH': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  'Provenance': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Deprecated': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Output Descriptors': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'General': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  'Attachments': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'XID Documents': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  'XID Privileges': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Expressions': 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  'Crypto Assets': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Networks': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'Bitcoin': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Graphs': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

function getCategoryColor(category: string): string {
  return categoryColors[category] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
}

// Helper functions to get category counts
function getTagCategoryCount(category: string): number {
  return tagsData.filter((t: TagItem) => t.category === category).length
}

function getKnownValueCategoryCount(category: string): number {
  return knownValuesData.filter((k: KnownValueItem) => k.category === category).length
}

// Stats
const tagStats = computed(() => ({
  total: tagsData.length,
  filtered: filteredTags.value.length,
}))

const knownValueStats = computed(() => ({
  total: knownValuesData.length,
  filtered: filteredKnownValues.value.length,
}))

const ianaStats = computed(() => ({
  total: ianaResult.value.tags.length,
  filtered: filteredIanaTags.value.length,
  loading: ianaResult.value.loading,
  error: ianaResult.value.error,
  lastUpdated: ianaResult.value.lastUpdated,
}))
</script>

<template>
  <UDashboardPanel id="registry">
    <template #header>
      <UDashboardNavbar title="Registry Browser">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UColorModeButton size="sm" />
          <UButton
            to="https://github.com/leonardocustodio/bcts"
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
      <div class="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-900">
        <!-- Header with tabs, search, and category filters -->
        <div class="shrink-0 border-b border-gray-200 dark:border-gray-800/50">
          <!-- Tabs and Search Row -->
          <div class="flex items-center justify-between px-4 py-2">
            <UTabs
              v-model="activeTab"
              :items="[
                { label: 'CBOR Tags', value: 'tags' },
                { label: 'Known Values', value: 'known-values' },
                { label: 'IANA Registry', value: 'iana' }
              ]"
              size="sm"
            />
            <UInput
              v-model="searchQuery"
              placeholder="Search by name, value, or category..."
              icon="i-heroicons-magnifying-glass"
              size="sm"
              class="w-72"
              :ui="{ base: 'bg-gray-50 dark:bg-gray-800' }"
            />
          </div>

          <!-- Category Pills (not shown for IANA) -->
          <div v-if="activeTab !== 'iana'" class="px-4 pb-3 flex flex-wrap gap-1.5">
            <template v-if="activeTab === 'tags'">
              <button
                :class="[
                  'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                  selectedTagCategory === null
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                ]"
                @click="selectedTagCategory = null"
              >
                All ({{ tagsData.length }})
              </button>
              <button
                v-for="category in tagCategories"
                :key="category"
                :class="[
                  'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                  selectedTagCategory === category
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                ]"
                @click="selectedTagCategory = category"
              >
                {{ category }} ({{ getTagCategoryCount(category) }})
              </button>
            </template>
            <template v-else>
              <button
                :class="[
                  'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                  selectedKnownValueCategory === null
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                ]"
                @click="selectedKnownValueCategory = null"
              >
                All ({{ knownValuesData.length }})
              </button>
              <button
                v-for="category in knownValueCategories"
                :key="category"
                :class="[
                  'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
                  selectedKnownValueCategory === category
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                ]"
                @click="selectedKnownValueCategory = category"
              >
                {{ category }} ({{ getKnownValueCategoryCount(category) }})
              </button>
            </template>
          </div>
        </div>

        <!-- Table Content -->
        <div class="flex-1 overflow-auto">
          <!-- Tags Table -->
          <table v-if="activeTab === 'tags'" class="w-full">
            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur z-10">
              <tr>
                <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Tag</th>
                <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-48">Category</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">
              <tr
                v-for="tag in filteredTags"
                :key="tag.value"
                :class="[
                  'hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors',
                  tag.deprecated ? 'opacity-60' : ''
                ]"
              >
                <td class="px-4 py-3">
                  <code class="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
                    #6.{{ tag.value }}
                  </code>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ tag.name }}</span>
                    <span v-if="tag.deprecated" class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">DEPRECATED</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', getCategoryColor(tag.category)]">
                    {{ tag.category }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Known Values Table -->
          <table v-else-if="activeTab === 'known-values'" class="w-full">
            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur z-10">
              <tr>
                <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Value</th>
                <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-48">Category</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">
              <tr
                v-for="kv in filteredKnownValues"
                :key="kv.value"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td class="px-4 py-3">
                  <code class="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {{ kv.value }}
                  </code>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ kv.name || '(unit)' }}</span>
                </td>
                <td class="px-4 py-3">
                  <span :class="['px-2 py-0.5 text-xs font-medium rounded-full', getCategoryColor(kv.category)]">
                    {{ kv.category }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- IANA Tags Table -->
          <div v-else-if="activeTab === 'iana'">
            <!-- Loading state -->
            <div v-if="ianaStats.loading" class="flex items-center justify-center h-64">
              <div class="text-center">
                <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 dark:text-gray-500 animate-spin mb-3" />
                <p class="text-sm text-gray-500 dark:text-gray-400">Loading IANA registry...</p>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="ianaStats.error" class="flex items-center justify-center h-64">
              <div class="text-center">
                <div class="bg-red-100 dark:bg-red-900/30 rounded-full p-4 mb-3 inline-block">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500 dark:text-red-400" />
                </div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1">Failed to load IANA registry</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ ianaStats.error }}</p>
              </div>
            </div>

            <!-- IANA Table -->
            <table v-else class="w-full">
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur z-10">
                <tr>
                  <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-32">Tag</th>
                  <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-40">Data Item</th>
                  <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">Semantics</th>
                  <th class="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 w-48">Reference</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">
                <tr
                  v-for="tag in filteredIanaTags"
                  :key="tag.value"
                  class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td class="px-4 py-3">
                    <code class="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {{ tag.value }}
                    </code>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-gray-600 dark:text-gray-300">{{ tag.description || '-' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm text-gray-900 dark:text-gray-100">{{ tag.semantics || '-' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-0.5">
                      <span
                        v-for="(reference, idx) in tag.references.slice(0, 2)"
                        :key="idx"
                        class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]"
                        :title="reference"
                      >
                        {{ reference }}
                      </span>
                      <span v-if="tag.references.length > 2" class="text-xs text-gray-400">
                        +{{ tag.references.length - 2 }} more
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty state -->
          <div
            v-if="(activeTab === 'tags' && filteredTags.length === 0) || (activeTab === 'known-values' && filteredKnownValues.length === 0) || (activeTab === 'iana' && !ianaStats.loading && !ianaStats.error && filteredIanaTags.length === 0)"
            class="flex items-center justify-center h-64"
          >
            <div class="text-center">
              <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-3 inline-block">
                <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1">No results found</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filter</p>
            </div>
          </div>
        </div>

        <!-- Status Bar -->
        <div class="shrink-0 flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400">
          <span v-if="activeTab === 'tags'">
            Showing {{ tagStats.filtered }} of {{ tagStats.total }} tags
          </span>
          <span v-else-if="activeTab === 'known-values'">
            Showing {{ knownValueStats.filtered }} of {{ knownValueStats.total }} known values
          </span>
          <span v-else-if="activeTab === 'iana'">
            <template v-if="ianaStats.loading">Loading IANA registry...</template>
            <template v-else-if="ianaStats.error">Error loading registry</template>
            <template v-else>
              Showing {{ ianaStats.filtered }} of {{ ianaStats.total }} IANA tags
              <span v-if="ianaStats.lastUpdated" class="ml-2 text-gray-400">
                (Updated: {{ ianaStats.lastUpdated }})
              </span>
            </template>
          </span>
          <a
            href="https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml"
            target="_blank"
            class="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>IANA CBOR Tags Registry</span>
            <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3" />
          </a>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
