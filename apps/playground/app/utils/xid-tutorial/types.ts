import type { XIDDocument } from "@bcts/xid";
import type { PrivateKeys, PublicKeys } from "@bcts/components";

export type IdentityName = "amira" | "charlene" | "devreviewer" | "ben";

export interface SideKey {
  nickname: string;
  prvKeys: PrivateKeys;
  pubKeys: PublicKeys;
}

export interface IdentitySlot {
  name: IdentityName;
  displayName: string;
  role: string;
  color: string;
  document: XIDDocument | null;
  password: string;
  attestationKey: SideKey | null;
  sshKey: SideKey | null;
  contractKey: SideKey | null;
}

export type CheckStatus = "pending" | "pass" | "fail" | "warn";

export interface CheckResult {
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface SectionMeta {
  id: string;
  chapter: number;
  section: number;
  title: string;
  subtitle: string;
  component: string;
  needsIdentity: boolean;
  needsSecondIdentity?: IdentityName;
}
