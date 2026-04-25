<script setup lang="ts">
const { completeAndAdvance } = useXidTutorial()
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">👋</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Welcome</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        This course takes you through creating, verifying, and maintaining a self-sovereign
        identity based on <strong>eXtensible IDentifiers (XIDs)</strong>. You'll follow Amira, a
        software developer who needs a pseudonymous identity to contribute to social-impact
        projects without risking her professional position or her family's safety.
      </p>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        You'll create XIDs, make them verifiable, publish claims, protect sensitive data through
        elision and encryption, build edges to external accounts, earn peer endorsements, sign
        binding agreements, and finally manage the lifecycle of all that data.
      </p>
    </section>

    <div class="space-y-3">
      <XidTutorialConceptCard title="What is an XID?" icon="i-heroicons-finger-print" :default-open="true">
        A XID is a 32-byte cryptographic identifier derived from the SHA-256 hash of an inception
        public key. It's stable across key rotation, device additions, and recovery — your identity
        never changes even as your keys evolve.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Self-Sovereign Identity" icon="i-heroicons-identification">
        You control your identity. No issuer, no central authority, no server you depend on. XIDs
        are autonomous cryptographic objects that live wherever you put them: USB drive, email,
        QR code, IPFS.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Pseudonymous Identity" icon="i-heroicons-eye-slash">
        A pseudonym is an ongoing identity that's not tied to your legal name. Unlike anonymity,
        pseudonymity lets you build a reputation over time. Authors have used pen names for
        centuries — XIDs bring that to digital collaboration.
      </XidTutorialConceptCard>
    </div>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-heroicons-book-open"
      title="Amira's story"
      description="Amira works as a senior developer at a Boston bank on an H-1B visa. She wants to contribute to human-rights security projects but can't publicly. She needs a way to build trust under a stable pseudonym — BRadvoc8 (Basic Rights Advocate) — while keeping her real identity off the record. XIDs give her the tools."
    />

    <div class="flex justify-end">
      <UButton
        label="Next: Core Concepts"
        trailing-icon="i-heroicons-arrow-right"
        color="primary"
        size="lg"
        @click="completeAndAdvance(0)"
      />
    </div>
  </div>
</template>
