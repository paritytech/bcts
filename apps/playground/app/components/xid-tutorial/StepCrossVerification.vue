<script setup lang="ts">
import { Envelope } from '@bcts/envelope'
import { XIDDocument, XIDVerifySignature } from '@bcts/xid'

const {
  xidDocument, xidHex, treeOutput, envelopeUrOutput, error,
  keyList, resolutionMethodList, attachmentList, serviceList, provenanceMark,
  verifySignature, getPublicEnvelope, getKeyAlgorithm, getKeyRefHex,
  completeStep, resetTutorial,
} = useXidTutorial()

const importMode = ref(false)
const importText = ref('')
const importError = ref<string | null>(null)
const checksRun = ref(false)
const checksComplete = ref(false)
const summaryOpen = ref(false)

type CheckStatus = 'pending' | 'pass' | 'fail' | 'warn'
const checks = ref<{ label: string, status: CheckStatus, detail: string }[]>([
  { label: 'Inception Signature', status: 'pending', detail: '' },
  { label: 'Resolution Methods', status: 'pending', detail: '' },
  { label: 'Provenance Chain', status: 'pending', detail: '' },
  { label: 'Attestations Present', status: 'pending', detail: '' },
  { label: 'Services Declared', status: 'pending', detail: '' },
])

const trustLevels = [
  { label: 'UNPROVEN', color: 'bg-red-500' },
  { label: 'SELF-CONSISTENT', color: 'bg-sky-500' },
  { label: 'CLAIMS PRESENT', color: 'bg-amber-500' },
  { label: 'CREDIBLE PSEUDONYM', color: 'bg-green-500' },
] as const

const trustLevel = computed(() => {
  if (!checksComplete.value) return -1
  const first = checks.value[0]
  if (!first || first.status !== 'pass') return 0
  const passCount = checks.value.filter(c => c.status === 'pass').length
  return passCount === checks.value.length ? 3 : passCount >= 3 ? 2 : 1
})
const trustBadge = computed(() => trustLevel.value < 0 ? null : trustLevels[trustLevel.value as 0 | 1 | 2 | 3] ?? null)
const badgeColor = computed(() => {
  const map = { 3: 'success', 2: 'warning', 1: 'info' } as Record<number, 'success' | 'warning' | 'info'>
  return map[trustLevel.value] ?? ('error' as const)
})

const statusIcon: Record<CheckStatus, string> = {
  pending: 'i-heroicons-ellipsis-horizontal-circle', pass: 'i-heroicons-check-circle',
  fail: 'i-heroicons-x-circle', warn: 'i-heroicons-exclamation-triangle',
}
const statusColor: Record<CheckStatus, string> = {
  pending: 'text-gray-400 animate-spin', pass: 'text-green-500',
  fail: 'text-red-500', warn: 'text-amber-500',
}

function useCurrentXid() { importMode.value = false; importError.value = null }

function parseImport() {
  importError.value = null
  try {
    const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(importText.value.trim())
    XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None)
    importMode.value = false
  }
  catch (e) { importError.value = e instanceof Error ? e.message : 'Invalid UR string' }
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function updateCheck(index: number, status: CheckStatus, detail: string) {
  const c = checks.value[index]
  if (c) checks.value[index] = { label: c.label, status, detail }
}

async function runChecks() {
  checksRun.value = true
  checksComplete.value = false
  checks.value = checks.value.map(c => ({ label: c.label, status: 'pending' as CheckStatus, detail: '' }))
  await delay(300)

  const sigOk = verifySignature()
  updateCheck(0, sigOk ? 'pass' : 'fail', sigOk ? 'Signature verified against inception key' : 'Signature verification failed')
  await delay(200)

  const rmCount = resolutionMethodList.value.length
  updateCheck(1, rmCount > 0 ? 'pass' : 'warn', rmCount > 0 ? `${rmCount} resolution method(s) found` : 'No resolution methods found')
  await delay(200)

  const hasProv = !!provenanceMark.value
  updateCheck(2, hasProv ? 'pass' : 'warn', hasProv ? 'Provenance chain present' : 'No provenance chain -- cannot verify freshness')
  await delay(200)

  const attCount = attachmentList.value.length
  updateCheck(3, attCount > 0 ? 'pass' : 'warn', attCount > 0 ? `${attCount} attestation(s) found` : 'No attestations present')
  await delay(200)

  const svcCount = serviceList.value.length
  updateCheck(4, svcCount > 0 ? 'pass' : 'warn', svcCount > 0 ? `${svcCount} service(s) declared` : 'No services declared')
  checksComplete.value = true
  completeStep(3)
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

const whatsNextCards = [
  { title: 'XID Builder', desc: 'Build and manage XID Documents with full control', icon: 'i-heroicons-wrench-screwdriver', to: '/xid-builder', ext: false },
  { title: 'Envelope Builder', desc: 'Explore Gordian Envelope structure', icon: 'i-heroicons-envelope', to: '/envelope-builder', ext: false },
  { title: 'API Reference', desc: 'XID SDK documentation', icon: 'i-heroicons-book-open', to: 'https://docs.bcts.dev/api/xid', ext: true },
  { title: 'XID-Quickstart', desc: 'CLI-based tutorials for deeper learning', icon: 'i-heroicons-command-line', to: 'https://github.com/nickthecook/XID-Quickstart', ext: true },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Introduction -->
    <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
      In this final step, you take on Ben's role -- a project maintainer who needs to verify
      Amira's XID before granting access. Cross-verification means checking claims against
      independent sources to build trust incrementally.
    </p>

    <!-- Concept Cards -->
    <div class="space-y-3">
      <XidTutorialConceptCard title="Cross-Verification" icon="i-heroicons-shield-check">
        Cross-verification checks XID claims against independent external sources. If someone
        claims a GitHub account, you verify the SSH key matches what GitHub reports. Multiple
        convergent checks build stronger trust.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Credible Pseudonym" icon="i-heroicons-user-circle">
        A credible pseudonym is the trust level achieved when cross-verification succeeds.
        The person's real name is unknown, but their cryptographic identity is verified through
        convergent evidence from multiple independent sources.
      </XidTutorialConceptCard>
    </div>

    <!-- Import or Use Current -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Load XID for Verification</h3>
      <div class="flex items-center gap-3">
        <UButton label="Use Current XID" color="primary" icon="i-heroicons-document-check" :disabled="!xidDocument" @click="useCurrentXid" />
        <UButton label="Import XID" color="neutral" variant="outline" icon="i-heroicons-arrow-down-tray" @click="importMode = !importMode" />
      </div>
      <template v-if="importMode">
        <UTextarea v-model="importText" placeholder="Paste a UR-encoded XID envelope..." :rows="3" class="w-full" />
        <UButton label="Parse" color="primary" size="sm" @click="parseImport" />
        <UAlert v-if="importError" color="error" :title="importError" variant="subtle" />
      </template>
      <div v-if="xidDocument && !importMode">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Current XID tree format:</p>
        <pre class="font-mono text-xs bg-gray-950 text-gray-200 dark:bg-gray-900 p-3 rounded-lg overflow-auto max-h-48">{{ treeOutput }}</pre>
      </div>
      <UAlert v-if="!xidDocument" color="warning" title="No XID loaded" description="Go back to Step 1 to create an XID, or import one above." variant="subtle" />
    </div>

    <template v-if="xidDocument">
      <!-- Verification Checklist -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Verification Checklist</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">Running automated checks against the XID document...</p>
        <UButton v-if="!checksRun" label="Run Verification" icon="i-heroicons-play" color="primary" @click="runChecks" />
        <div v-if="checksRun" class="space-y-2">
          <TransitionGroup enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 translate-x-2" enter-to-class="opacity-100 translate-x-0">
            <div v-for="check in checks" :key="check.label" class="flex items-start gap-3 py-2 px-3 rounded-md bg-gray-50 dark:bg-gray-800/50">
              <UIcon :name="statusIcon[check.status]" :class="['w-5 h-5 shrink-0 mt-0.5', statusColor[check.status]]" />
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ check.label }}</span>
                <p v-if="check.detail" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ check.detail }}</p>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>

      <!-- Trust Level Assessment -->
      <div v-if="checksComplete" class="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Trust Level Assessment</h3>
        <div v-if="trustBadge" class="flex items-center gap-3">
          <UBadge :color="badgeColor" size="lg" class="text-base font-bold px-4 py-1">{{ trustBadge.label }}</UBadge>
        </div>
        <div class="space-y-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">Trust progression:</p>
          <div class="flex rounded-lg overflow-hidden h-8">
            <div v-for="(level, i) in trustLevels" :key="level.label" :class="['flex-1 flex items-center justify-center text-xs font-medium transition-all duration-500', i <= trustLevel ? level.color + ' text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500']">
              <span class="hidden sm:inline truncate px-1">{{ level.label }}</span>
              <span class="sm:hidden">{{ i + 1 }}</span>
            </div>
          </div>
          <div class="flex text-xs text-gray-400">
            <span class="flex-1 text-left">Low trust</span>
            <span class="flex-1 text-right">High trust</span>
          </div>
        </div>
      </div>

      <!-- XID Summary (collapsible) -->
      <div v-if="checksComplete" class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <button class="flex items-center gap-2 w-full px-4 py-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" @click="summaryOpen = !summaryOpen">
          <UIcon name="i-heroicons-document-magnifying-glass" class="w-5 h-5 text-gray-400" />
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">XID Summary</span>
          <UIcon name="i-heroicons-chevron-down" :class="['w-4 h-4 text-gray-400 transition-transform duration-200', summaryOpen && 'rotate-180']" />
        </button>
        <Transition enter-active-class="transition-all duration-200 ease-out" leave-active-class="transition-all duration-150 ease-in" enter-from-class="opacity-0 max-h-0" enter-to-class="opacity-100 max-h-96" leave-from-class="opacity-100 max-h-96" leave-to-class="opacity-0 max-h-0">
          <div v-show="summaryOpen" class="overflow-hidden border-t border-gray-200 dark:border-gray-800">
            <div class="px-4 py-3 space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400 w-28 shrink-0">Identity</span>
                <code class="text-xs font-mono text-gray-800 dark:text-gray-200">{{ truncate(xidHex, 16) }}</code>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400 w-28 shrink-0">Keys</span>
                <span class="text-gray-800 dark:text-gray-200">{{ keyList.length }} key(s)<template v-if="keyList.length"> -- {{ keyList.map(k => getKeyAlgorithm(k)).join(', ') }}</template></span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400 w-28 shrink-0">Resolution</span>
                <span class="text-gray-800 dark:text-gray-200">{{ resolutionMethodList.length ? resolutionMethodList.join(', ') : 'None' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400 w-28 shrink-0">Attestations</span>
                <span class="text-gray-800 dark:text-gray-200">{{ attachmentList.length }} attestation(s)<template v-if="attachmentList.length"> -- {{ attachmentList.map(a => a.vendor).join(', ') }}</template></span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-gray-500 dark:text-gray-400 w-28 shrink-0">Services</span>
                <span class="text-gray-800 dark:text-gray-200">{{ serviceList.length }} service(s)</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- What's Next -->
      <div v-if="checksComplete" class="space-y-4">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">What's Next?</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <component
            v-for="card in whatsNextCards"
            :key="card.title"
            :is="card.ext ? 'a' : resolveComponent('NuxtLink')"
            :to="card.ext ? undefined : card.to"
            :href="card.ext ? card.to : undefined"
            :target="card.ext ? '_blank' : undefined"
            :rel="card.ext ? 'noopener noreferrer' : undefined"
            class="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <UIcon :name="card.icon" class="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
            <div class="min-w-0">
              <span class="text-sm font-medium text-gray-800 dark:text-gray-200 block">{{ card.title }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ card.desc }}</span>
              <UIcon v-if="card.ext" name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3 text-gray-400 inline-block ml-1" />
            </div>
          </component>
        </div>
        <div class="flex items-center gap-3">
          <UButton label="Start Over" variant="outline" color="neutral" icon="i-heroicons-arrow-path" @click="resetTutorial()" />
          <NuxtLink to="/xid-builder">
            <UButton label="Open in XID Builder" color="primary" icon="i-heroicons-wrench-screwdriver" />
          </NuxtLink>
        </div>
      </div>

      <!-- Complete button (shown before checks run) -->
      <div v-if="!checksRun" class="flex justify-end">
        <UButton label="Complete Tutorial" icon="i-heroicons-check-badge" color="primary" size="lg" @click="completeStep(3)" />
      </div>
    </template>
  </div>
</template>
