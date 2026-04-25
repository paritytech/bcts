import type { SectionMeta } from "./types";

export const TUTORIAL_SECTIONS: SectionMeta[] = [
  {
    id: "1.1",
    chapter: 1,
    section: 1,
    title: "Welcome",
    subtitle: "Amira's story & why XIDs",
    component: "Step1Welcome",
    needsIdentity: false,
  },
  {
    id: "1.2",
    chapter: 1,
    section: 2,
    title: "Core Concepts",
    subtitle: "Ten foundations for XIDs",
    component: "Step1Concepts",
    needsIdentity: false,
  },
  {
    id: "1.3",
    chapter: 1,
    section: 3,
    title: "Create First XID",
    subtitle: "Encrypted keys + genesis mark",
    component: "StepCreateXid",
    needsIdentity: false,
  },
  {
    id: "1.4",
    chapter: 1,
    section: 4,
    title: "Make Verifiable",
    subtitle: "dereferenceVia + publication",
    component: "StepMakeVerifiable",
    needsIdentity: true,
  },
  {
    id: "2.1",
    chapter: 2,
    section: 1,
    title: "Self-Attestations",
    subtitle: "Fair-witness claims",
    component: "StepSelfAttestation",
    needsIdentity: true,
  },
  {
    id: "2.2",
    chapter: 2,
    section: 2,
    title: "Elision Commitments",
    subtitle: "Commit now, reveal later",
    component: "StepElision",
    needsIdentity: true,
  },
  {
    id: "2.3",
    chapter: 2,
    section: 3,
    title: "Recipient Encryption",
    subtitle: "Share secrets privately",
    component: "StepEncryption",
    needsIdentity: true,
    needsSecondIdentity: "devreviewer",
  },
  {
    id: "3.1",
    chapter: 3,
    section: 1,
    title: "Creating Edges",
    subtitle: "SSH key + GitHub edge",
    component: "StepEdges",
    needsIdentity: true,
  },
  {
    id: "3.2",
    chapter: 3,
    section: 2,
    title: "Cross-Verification",
    subtitle: "Verify against GitHub",
    component: "StepCrossVerification",
    needsIdentity: true,
  },
  {
    id: "3.3",
    chapter: 3,
    section: 3,
    title: "Peer Endorsements",
    subtitle: "Web of trust",
    component: "StepEndorsements",
    needsIdentity: true,
    needsSecondIdentity: "charlene",
  },
  {
    id: "4.1",
    chapter: 4,
    section: 1,
    title: "Binding Agreements",
    subtitle: "CLA bilateral signing",
    component: "StepCla",
    needsIdentity: true,
    needsSecondIdentity: "ben",
  },
  {
    id: "4.2",
    chapter: 4,
    section: 2,
    title: "Publishing for Privacy",
    subtitle: "Commitments + herd privacy",
    component: "StepPrivacy",
    needsIdentity: true,
  },
  {
    id: "4.3",
    chapter: 4,
    section: 3,
    title: "New Views",
    subtitle: "Per-recipient elision",
    component: "StepViews",
    needsIdentity: true,
  },
  {
    id: "4.4",
    chapter: 4,
    section: 4,
    title: "New Editions",
    subtitle: "Remove, revoke, replace",
    component: "StepEditions",
    needsIdentity: true,
  },
];

export const CHAPTERS = [
  { number: 1, title: "Introduction to XIDs" },
  { number: 2, title: "Making Claims" },
  { number: 3, title: "Attesting with Edges" },
  { number: 4, title: "Managing Your XIDs" },
];

export function sectionIndex(id: string): number {
  return TUTORIAL_SECTIONS.findIndex((s) => s.id === id);
}

export function getSection(index: number): SectionMeta | null {
  return TUTORIAL_SECTIONS[index] ?? null;
}

export function sectionsByChapter(chapter: number): SectionMeta[] {
  return TUTORIAL_SECTIONS.filter((s) => s.chapter === chapter);
}
