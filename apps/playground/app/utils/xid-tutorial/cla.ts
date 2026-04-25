import { Envelope } from "@bcts/envelope";
import { IS_A, DATE, NICKNAME, DEREFERENCE_VIA } from "@bcts/known-values";
import type { PrivateKeys } from "@bcts/components";

export interface ClaInput {
  project: string;
  licenseName: string;
  licenseUrl: string;
  licenseHash: string;
  licenseHashAlgo: string;
  projectManagerXidUr: string;
  projectManagerNickname: string;
  contributorXidUr: string;
  contributorNickname: string;
  copyrightTerms: string;
  patentTerms: string;
  contributorRepresents: string;
}

function parseXid(ur: string): Envelope {
  return (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(ur);
}

/** Build the CLA envelope (unsigned). */
export function buildClaEnvelope(input: ClaInput): Envelope {
  const licenseEnv = Envelope.new(input.licenseName)
    .addAssertion(DEREFERENCE_VIA, input.licenseUrl)
    .addAssertion(DATE, "2004-01-01T00:00:00Z")
    .addAssertion("contractHash", input.licenseHash)
    .addAssertion("hashAlgorithm", input.licenseHashAlgo);

  const pmEnv = parseXid(input.projectManagerXidUr).addAssertion(
    NICKNAME,
    input.projectManagerNickname,
  );
  const contribEnv = parseXid(input.contributorXidUr).addAssertion(
    NICKNAME,
    input.contributorNickname,
  );

  return Envelope.new("Individual Contributor License Agreement")
    .addAssertion(IS_A, "ContributorLicenseAgreement")
    .addAssertion("project", input.project)
    .addAssertion("grantsCopyrightLicense", input.copyrightTerms)
    .addAssertion("grantsPatentLicense", input.patentTerms)
    .addAssertion("contributorRepresents", input.contributorRepresents)
    .addAssertion("licenseType", licenseEnv)
    .addAssertion("projectManager", pmEnv)
    .addAssertion("contributor", contribEnv);
}

/** Date + wrap + sign the CLA with the contributor's contract key. */
export function signCla(cla: Envelope, signer: PrivateKeys, date?: Date): Envelope {
  const dated = cla.addAssertion(DATE, (date ?? new Date()).toISOString());
  return dated.wrap().sign(signer);
}

/** Ben's side: wrap the contributor-signed CLA, add acceptedBy + date, wrap again, sign. */
export function acceptCla(
  signedCla: Envelope,
  accepterXidUr: string,
  accepterPrv: PrivateKeys,
  date?: Date,
): Envelope {
  const wrappedContrib = signedCla.wrap();
  const accepterXid = parseXid(accepterXidUr);
  const withAccept = wrappedContrib
    .addAssertionEnvelope(Envelope.newAssertion("acceptedBy", accepterXid))
    .addAssertion(DATE, (date ?? new Date()).toISOString());
  return withAccept.wrap().sign(accepterPrv);
}
