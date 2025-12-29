<script setup lang="ts">
import { ref, computed } from 'vue'

useHead({
  title: 'Registry Browser | BCTS',
  meta: [{ name: 'description', content: 'Browse CBOR tags and Known Values registry' }],
})

type RegistryTab = 'tags' | 'known-values'

interface TagItem {
  value: number
  name: string
  category: string
  deprecated?: boolean
}

interface KnownValueItem {
  value: number
  name: string
  category: string
}

const activeTab = ref<RegistryTab>('tags')
const searchQuery = ref('')

// CBOR Tags data organized by category
const tagsData: TagItem[] = [
  // Standard IANA Tags
  { value: 32, name: 'url', category: 'Standard IANA' },
  { value: 37, name: 'uuid', category: 'Standard IANA' },

  // Core Envelope
  { value: 24, name: 'encoded-cbor', category: 'Core Envelope' },
  { value: 200, name: 'envelope', category: 'Core Envelope' },
  { value: 201, name: 'leaf', category: 'Core Envelope' },
  { value: 262, name: 'json', category: 'Core Envelope' },

  // Envelope Extensions
  { value: 40000, name: 'known-value', category: 'Envelope Extension' },
  { value: 40001, name: 'digest', category: 'Envelope Extension' },
  { value: 40002, name: 'encrypted', category: 'Envelope Extension' },
  { value: 40003, name: 'compressed', category: 'Envelope Extension' },

  // Distributed Function Calls
  { value: 40004, name: 'request', category: 'Function Calls' },
  { value: 40005, name: 'response', category: 'Function Calls' },
  { value: 40006, name: 'function', category: 'Function Calls' },
  { value: 40007, name: 'parameter', category: 'Function Calls' },
  { value: 40008, name: 'placeholder', category: 'Function Calls' },
  { value: 40009, name: 'replacement', category: 'Function Calls' },

  // Cryptographic Keys
  { value: 40010, name: 'agreement-private-key', category: 'Cryptography' },
  { value: 40011, name: 'agreement-public-key', category: 'Cryptography' },
  { value: 40012, name: 'arid', category: 'Cryptography' },
  { value: 40013, name: 'crypto-prvkeys', category: 'Cryptography' },
  { value: 40014, name: 'nonce', category: 'Cryptography' },
  { value: 40015, name: 'password', category: 'Cryptography' },
  { value: 40016, name: 'crypto-prvkey-base', category: 'Cryptography' },
  { value: 40017, name: 'crypto-pubkeys', category: 'Cryptography' },
  { value: 40018, name: 'salt', category: 'Cryptography' },
  { value: 40019, name: 'crypto-sealed', category: 'Cryptography' },
  { value: 40020, name: 'signature', category: 'Cryptography' },
  { value: 40021, name: 'signing-private-key', category: 'Cryptography' },
  { value: 40022, name: 'signing-public-key', category: 'Cryptography' },
  { value: 40023, name: 'crypto-key', category: 'Cryptography' },
  { value: 40024, name: 'xid', category: 'Cryptography' },
  { value: 40025, name: 'reference', category: 'Cryptography' },
  { value: 40026, name: 'event', category: 'Cryptography' },
  { value: 40027, name: 'encrypted-key', category: 'Cryptography' },

  // Post-Quantum Cryptography
  { value: 40100, name: 'mlkem-private-key', category: 'Post-Quantum' },
  { value: 40101, name: 'mlkem-public-key', category: 'Post-Quantum' },
  { value: 40102, name: 'mlkem-ciphertext', category: 'Post-Quantum' },
  { value: 40103, name: 'mldsa-private-key', category: 'Post-Quantum' },
  { value: 40104, name: 'mldsa-public-key', category: 'Post-Quantum' },
  { value: 40105, name: 'mldsa-signature', category: 'Post-Quantum' },

  // Seeds & Keys
  { value: 40300, name: 'seed', category: 'Seeds & Keys' },
  { value: 40303, name: 'hdkey', category: 'Seeds & Keys' },
  { value: 40304, name: 'keypath', category: 'Seeds & Keys' },
  { value: 40305, name: 'coin-info', category: 'Seeds & Keys' },
  { value: 40306, name: 'eckey', category: 'Seeds & Keys' },
  { value: 40307, name: 'address', category: 'Seeds & Keys' },
  { value: 40308, name: 'output-descriptor', category: 'Seeds & Keys' },
  { value: 40309, name: 'sskr', category: 'Seeds & Keys' },
  { value: 40310, name: 'psbt', category: 'Seeds & Keys' },
  { value: 40311, name: 'account-descriptor', category: 'Seeds & Keys' },

  // SSH
  { value: 40800, name: 'ssh-private', category: 'SSH' },
  { value: 40801, name: 'ssh-public', category: 'SSH' },
  { value: 40802, name: 'ssh-signature', category: 'SSH' },
  { value: 40803, name: 'ssh-certificate', category: 'SSH' },

  // Provenance
  { value: 1347571542, name: 'provenance', category: 'Provenance' },

  // Deprecated Tags
  { value: 300, name: 'crypto-seed', category: 'Deprecated', deprecated: true },
  { value: 303, name: 'crypto-hdkey', category: 'Deprecated', deprecated: true },
  { value: 304, name: 'crypto-keypath', category: 'Deprecated', deprecated: true },
  { value: 305, name: 'crypto-coin-info', category: 'Deprecated', deprecated: true },
  { value: 306, name: 'crypto-eckey', category: 'Deprecated', deprecated: true },
  { value: 307, name: 'crypto-output', category: 'Deprecated', deprecated: true },
  { value: 309, name: 'crypto-sskr', category: 'Deprecated', deprecated: true },
  { value: 310, name: 'crypto-psbt', category: 'Deprecated', deprecated: true },
  { value: 311, name: 'crypto-account', category: 'Deprecated', deprecated: true },

  // Output Descriptors
  { value: 400, name: 'output-script-hash', category: 'Output Descriptors' },
  { value: 401, name: 'output-witness-script-hash', category: 'Output Descriptors' },
  { value: 402, name: 'output-public-key', category: 'Output Descriptors' },
  { value: 403, name: 'output-public-key-hash', category: 'Output Descriptors' },
  { value: 404, name: 'output-witness-public-key-hash', category: 'Output Descriptors' },
  { value: 405, name: 'output-combo', category: 'Output Descriptors' },
  { value: 406, name: 'output-multisig', category: 'Output Descriptors' },
  { value: 407, name: 'output-sorted-multisig', category: 'Output Descriptors' },
  { value: 408, name: 'output-raw-script', category: 'Output Descriptors' },
  { value: 409, name: 'output-taproot', category: 'Output Descriptors' },
  { value: 410, name: 'output-cosigner', category: 'Output Descriptors' },
]

// Known Values data organized by category
const knownValuesData: KnownValueItem[] = [
  // General
  { value: 0, name: '', category: 'General' },
  { value: 1, name: 'isA', category: 'General' },
  { value: 2, name: 'id', category: 'General' },
  { value: 3, name: 'signed', category: 'General' },
  { value: 4, name: 'note', category: 'General' },
  { value: 5, name: 'hasRecipient', category: 'General' },
  { value: 6, name: 'sskrShare', category: 'General' },
  { value: 7, name: 'controller', category: 'General' },
  { value: 8, name: 'key', category: 'General' },
  { value: 9, name: 'dereferenceVia', category: 'General' },
  { value: 10, name: 'entity', category: 'General' },
  { value: 11, name: 'name', category: 'General' },
  { value: 12, name: 'language', category: 'General' },
  { value: 13, name: 'issuer', category: 'General' },
  { value: 14, name: 'holder', category: 'General' },
  { value: 15, name: 'salt', category: 'General' },
  { value: 16, name: 'date', category: 'General' },
  { value: 17, name: 'Unknown', category: 'General' },
  { value: 18, name: 'version', category: 'General' },
  { value: 19, name: 'hasSecret', category: 'General' },
  { value: 20, name: 'edits', category: 'General' },
  { value: 21, name: 'validFrom', category: 'General' },
  { value: 22, name: 'validUntil', category: 'General' },
  { value: 23, name: 'position', category: 'General' },
  { value: 24, name: 'nickname', category: 'General' },

  // Attachments
  { value: 50, name: 'attachment', category: 'Attachments' },
  { value: 51, name: 'vendor', category: 'Attachments' },
  { value: 52, name: 'conformsTo', category: 'Attachments' },

  // XID Documents
  { value: 60, name: 'allow', category: 'XID Documents' },
  { value: 61, name: 'deny', category: 'XID Documents' },
  { value: 62, name: 'endpoint', category: 'XID Documents' },
  { value: 63, name: 'delegate', category: 'XID Documents' },
  { value: 64, name: 'provenance', category: 'XID Documents' },
  { value: 65, name: 'privateKey', category: 'XID Documents' },
  { value: 66, name: 'service', category: 'XID Documents' },
  { value: 67, name: 'capability', category: 'XID Documents' },
  { value: 68, name: 'provenanceGenerator', category: 'XID Documents' },

  // XID Privileges
  { value: 70, name: 'All', category: 'XID Privileges' },
  { value: 71, name: 'Auth', category: 'XID Privileges' },
  { value: 72, name: 'Sign', category: 'XID Privileges' },
  { value: 73, name: 'Encrypt', category: 'XID Privileges' },
  { value: 74, name: 'Elide', category: 'XID Privileges' },
  { value: 75, name: 'Issue', category: 'XID Privileges' },
  { value: 76, name: 'Access', category: 'XID Privileges' },
  { value: 80, name: 'Delegate', category: 'XID Privileges' },
  { value: 81, name: 'Verify', category: 'XID Privileges' },
  { value: 82, name: 'Update', category: 'XID Privileges' },
  { value: 83, name: 'Transfer', category: 'XID Privileges' },
  { value: 84, name: 'Elect', category: 'XID Privileges' },
  { value: 85, name: 'Burn', category: 'XID Privileges' },
  { value: 86, name: 'Revoke', category: 'XID Privileges' },

  // Expression & Function Calls
  { value: 100, name: 'body', category: 'Expressions' },
  { value: 101, name: 'result', category: 'Expressions' },
  { value: 102, name: 'error', category: 'Expressions' },
  { value: 103, name: 'OK', category: 'Expressions' },
  { value: 104, name: 'Processing', category: 'Expressions' },
  { value: 105, name: 'sender', category: 'Expressions' },
  { value: 106, name: 'senderContinuation', category: 'Expressions' },
  { value: 107, name: 'recipientContinuation', category: 'Expressions' },
  { value: 108, name: 'content', category: 'Expressions' },

  // Cryptography
  { value: 200, name: 'Seed', category: 'Cryptography' },
  { value: 201, name: 'PrivateKey', category: 'Cryptography' },
  { value: 202, name: 'PublicKey', category: 'Cryptography' },
  { value: 203, name: 'MasterKey', category: 'Cryptography' },

  // Cryptocurrency Assets
  { value: 300, name: 'asset', category: 'Crypto Assets' },
  { value: 301, name: 'BTC', category: 'Crypto Assets' },
  { value: 302, name: 'ETH', category: 'Crypto Assets' },
  { value: 303, name: 'XTZ', category: 'Crypto Assets' },

  // Cryptocurrency Networks
  { value: 400, name: 'network', category: 'Networks' },
  { value: 401, name: 'MainNet', category: 'Networks' },
  { value: 402, name: 'TestNet', category: 'Networks' },

  // Bitcoin
  { value: 500, name: 'BIP32Key', category: 'Bitcoin' },
  { value: 501, name: 'chainCode', category: 'Bitcoin' },
  { value: 502, name: 'DerivationPath', category: 'Bitcoin' },
  { value: 503, name: 'parent', category: 'Bitcoin' },
  { value: 504, name: 'children', category: 'Bitcoin' },
  { value: 505, name: 'parentFingerprint', category: 'Bitcoin' },
  { value: 506, name: 'PSBT', category: 'Bitcoin' },
  { value: 507, name: 'OutputDescriptor', category: 'Bitcoin' },
  { value: 508, name: 'outputDescriptor', category: 'Bitcoin' },

  // Graphs
  { value: 600, name: 'graph', category: 'Graphs' },
  { value: 601, name: 'SourceTargetGraph', category: 'Graphs' },
  { value: 602, name: 'ParentChildGraph', category: 'Graphs' },
  { value: 603, name: 'Digraph', category: 'Graphs' },
  { value: 604, name: 'AcyclicGraph', category: 'Graphs' },
  { value: 605, name: 'Multigraph', category: 'Graphs' },
  { value: 606, name: 'Pseudograph', category: 'Graphs' },
  { value: 607, name: 'GraphFragment', category: 'Graphs' },
  { value: 608, name: 'DAG', category: 'Graphs' },
  { value: 609, name: 'Tree', category: 'Graphs' },
  { value: 610, name: 'Forest', category: 'Graphs' },
  { value: 611, name: 'CompoundGraph', category: 'Graphs' },
  { value: 612, name: 'Hypergraph', category: 'Graphs' },
  { value: 613, name: 'Dihypergraph', category: 'Graphs' },
  { value: 700, name: 'node', category: 'Graphs' },
  { value: 701, name: 'edge', category: 'Graphs' },
  { value: 702, name: 'source', category: 'Graphs' },
  { value: 703, name: 'target', category: 'Graphs' },
  { value: 704, name: 'parent', category: 'Graphs' },
  { value: 705, name: 'child', category: 'Graphs' },
]

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
                { label: 'Known Values', value: 'known-values' }
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

          <!-- Category Pills -->
          <div class="px-4 pb-3 flex flex-wrap gap-1.5">
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
          <table v-else class="w-full">
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

          <!-- Empty state -->
          <div
            v-if="(activeTab === 'tags' && filteredTags.length === 0) || (activeTab === 'known-values' && filteredKnownValues.length === 0)"
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
          <span v-else>
            Showing {{ knownValueStats.filtered }} of {{ knownValueStats.total }} known values
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
