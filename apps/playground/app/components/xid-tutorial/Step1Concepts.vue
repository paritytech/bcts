<script setup lang="ts">
const { completeAndAdvance } = useXidTutorial()
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🧠</span>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Core Concepts</h2>
      </div>
      <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        XIDs rest on ten foundational ideas that will reappear throughout the course. Skim them
        now; each one gets demonstrated hands-on in the chapters ahead.
      </p>
    </section>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <XidTutorialConceptCard title="Gordian Envelope" icon="i-heroicons-envelope">
        A smart-document format with a subject-predicate-object shape. Every element has a
        cryptographic digest that forms a Merkle-like tree, which is what enables elision and
        signature preservation.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Data Minimization" icon="i-heroicons-squares-2x2">
        "Share what you must, protect what you can." Every bit of data you publish is permanent
        and can be correlated with other sources — so disclose only what's necessary for each
        interaction.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Elision Cryptography" icon="i-heroicons-scissors">
        Remove content from an envelope while keeping its digest in the tree. Signatures remain
        valid because they sign the root hash, not the content. Enables selective disclosure.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Fair Witness" icon="i-heroicons-eye">
        Report only what you directly observed, document your methodology, acknowledge
        limitations and biases. Derived from Heinlein — applied to attestations, it builds trust
        through specificity instead of authority.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Key Management" icon="i-heroicons-key">
        Heterogeneous keys by purpose (identity, signing, encryption, contract, recovery).
        Progressive permissions. Rotation preserves the stable XID. Recovery doesn't lose the
        identity.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Progressive Trust" icon="i-heroicons-chart-bar">
        Trust builds gradually through ten life-cycle phases: context → introduction → wholeness
        → proofs → references → requirements → approval → agreement → fulfillment →
        escalation/dispute.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Pseudonymous Trust Building" icon="i-heroicons-user-circle">
        A pseudonym can reach the same trust level as a legal name through quality work,
        verifiable attestations, and contextual peer endorsements — all tied to the stable XID.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Attestation & Endorsement" icon="i-heroicons-document-check">
        Self-attestations (signed by you) vs. peer endorsements (signed by others). Endorsements
        carry more weight because endorsers stake their own reputation.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Provenance Marks" icon="i-heroicons-link">
        A forward-commitment hash chain that tracks the evolution of your XID across editions.
        Tells verifiers which copy is newest and whether all editions belong to the same chain.
      </XidTutorialConceptCard>
      <XidTutorialConceptCard title="Cross-Verification" icon="i-heroicons-shield-check">
        Check claims against independent external sources (GitHub, commit signatures, temporal
        anchors). Multiple convergent checks build a verification chain.
      </XidTutorialConceptCard>
    </div>

    <div class="flex justify-end">
      <UButton
        label="Next: Create Your First XID"
        trailing-icon="i-heroicons-arrow-right"
        color="primary"
        size="lg"
        @click="completeAndAdvance(1)"
      />
    </div>
  </div>
</template>
