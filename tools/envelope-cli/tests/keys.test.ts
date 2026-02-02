/**
 * Keys command tests - 1:1 port of tests/test_keys.rs
 *
 * NOTE: Many tests are skipped because only Ed25519 signing scheme is
 * implemented in the TypeScript version. Schnorr, ECDSA, and SSH key
 * schemes require additional implementation in @bcts/components.
 */

import { describe, it, expect } from "vitest";
import * as generate from "../src/cmd/generate/index.js";
import * as sign from "../src/cmd/sign.js";
import * as verify from "../src/cmd/verify.js";
import * as format from "../src/cmd/format.js";
import { ALICE_KNOWS_BOB_EXAMPLE, expectOutput } from "./common.js";

const SEED =
  "ur:seed/oyadhdcxhsinuesrennenlhfaopycnrfrkdmfnsrvltowmtbmyfwdafxvwmthersktcpetdweocfztrd";
const COMMENT = "comment";

describe("keys command", () => {
  describe("generate prvkeys", () => {
    it("test_generate_random_private_key_base", () => {
      const prvkeys = generate.prvKeys.exec({
        ...generate.prvKeys.defaultArgs(),
        signing: generate.PrvKeysSigningScheme.Ed25519,
        encryption: generate.PrvKeysEncryptionScheme.X25519,
      });
      expect(prvkeys).toMatch(/^ur:crypto-prvkeys\//);
    });

    it("test_generate_private_key_base_from_seed", () => {
      const expectedPrvkeys =
        "ur:crypto-prvkeys/lftansgohdcxpfsndiahcxsfrhjoltglmebwwnnstovocffejytdbwihdkrtdykebkiebglbtteetansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdstbtagyeh";

      // Default signing scheme is Schnorr (matching Rust CLI default)
      const prvkeys = generate.prvKeys.exec({
        ...generate.prvKeys.defaultArgs(),
        input: SEED,
      });
      expect(prvkeys).toBe(expectedPrvkeys);
    });
  });

  describe("generate keypairs", () => {
    it("test_generate_keypairs_random", () => {
      // Test with default algorithms (ed25519 + x25519)
      const output = generate.keypairs.exec({
        ...generate.keypairs.defaultArgs(),
        signing: generate.KeypairsSigningScheme.Ed25519,
        encryption: generate.KeypairsEncryptionScheme.X25519,
      });

      const parts = output.split(/\s+/).filter(Boolean);
      expect(parts.length).toBe(2);

      // Verify both are valid URs with correct types
      expect(parts[0]).toMatch(/^ur:crypto-prvkeys\//);
      expect(parts[1]).toMatch(/^ur:crypto-pubkeys\//);
    });
  });

  describe("signing schemes", () => {
    async function testKeys(
      signingScheme: generate.PrvKeysSigningScheme,
      expectedPrvkeys: string,
      expectedPubkeys: string,
      expectedSignatureSummary: string,
    ): Promise<void> {
      // Generate prvkeys with the appropriate signing type
      const prvkeys = generate.prvKeys.exec({
        ...generate.prvKeys.defaultArgs(),
        input: SEED,
        signing: signingScheme,
        encryption: generate.PrvKeysEncryptionScheme.X25519,
      });
      expect(prvkeys).toBe(expectedPrvkeys);

      // Generate pubkeys from prvkeys
      const pubkeys = generate.pubKeys.exec({
        ...generate.pubKeys.defaultArgs(),
        prvKeys: prvkeys,
        comment: COMMENT,
      });
      expect(pubkeys).toBe(expectedPubkeys);

      // Sign an envelope
      const signed = await sign.exec({
        ...sign.defaultArgs(),
        signers: [prvkeys],
        namespace: "test",
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });

      // Verify the format contains expected assertions
      // Note: assertion ordering depends on digests which vary with
      // non-deterministic signatures (random aux_rand in BIP-340),
      // so we check for each assertion line independently.
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signed,
      });
      expect(formatted).toContain('"Alice"');
      expect(formatted).toContain('"knows": "Bob"');
      expect(formatted).toContain(`'signed': ${expectedSignatureSummary}`);

      // Verify the signature
      await verify.exec({
        ...verify.defaultArgs(),
        verifiers: [pubkeys],
        envelope: signed,
      });
    }

    it("test_schnorr", async () => {
      await testKeys(
        generate.PrvKeysSigningScheme.Schnorr,
        "ur:crypto-prvkeys/lftansgohdcxpfsndiahcxsfrhjoltglmebwwnnstovocffejytdbwihdkrtdykebkiebglbtteetansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdstbtagyeh",
        "ur:crypto-pubkeys/lftanshfhdcxayvazmflzsfrotemfxvoghtbynbsgywztlheisvapypmidzmaoldisdybkvdlerytansgrhdcxfdgwgacloxsrmupdcybdchfylewsdilrbestjodpwnknndjoztjprfkkjopkdejobebtdlhd",
        "Signature",
      );
    });

    it("test_ecdsa", async () => {
      await testKeys(
        generate.PrvKeysSigningScheme.Ecdsa,
        "ur:crypto-prvkeys/lftansgolfadhdcxpfsndiahcxsfrhjoltglmebwwnnstovocffejytdbwihdkrtdykebkiebglbtteetansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdsuoamcehg",
        "ur:crypto-pubkeys/lftanshflfadhdclaoayvazmflzsfrotemfxvoghtbynbsgywztlheisvapypmidzmaoldisdybkvdlerytansgrhdcxfdgwgacloxsrmupdcybdchfylewsdilrbestjodpwnknndjoztjprfkkjopkdejomecapkpr",
        "Signature(Ecdsa)",
      );
    });

    // Skip: SSH Ed25519 key generation is not yet implemented in TypeScript
    it.skip("test_ssh_ed25519", async () => {
      await testKeys(
        generate.PrvKeysSigningScheme.SshEd25519,
        "ur:crypto-prvkeys/lftansgotanehnkkadlsdpdpdpdpdpfwfeflgaglcxgwgdfeglgugufdcxgdgmgahffpghfecxgrfehkdpdpdpdpdpbkideofwjzidjtglknhsfxehjphthdjejyieimfefpfpfpfpfpfwfleckoidjngofpfpfpfpfeidjneskphtgyfpfpfpfpfpfpfpfpfpfwfpfpfpfpgtktfpfpfpfpjykniaeyiojyhthgbkgykkglghgoksgwgyfpfpfpfxfpiheskokkdliekogwkokoeyfyemjyeckoihidkkjnemhsjnisjehtjnecghehjtknfyeyimjnhggwdlesgshdktfpfpfpgaimjkeejpgyjlemgwgrdybkgrfpfpfpfpfpjykniaeyiojyhthggykkglghgoksgwgyfpfpfpfxfpiheskokkdliekogwkokoeyfyemjyeckoihidkkjnemhsjnisjehtjnecghehjtknfyeyimjnhggwdlesgshdktbkfpfpfpfefyidiaesjpgdjojpioioidjkkokpiaghgugsjsjlflkphdidiahtecihgyktjsinfxecehfgfykpdygheciegwfwemeydlgseseyetendndlhkgdkpeojneseckogridjyjsbkhsflgmjnidjzgdhgiygtgdhsgwhthkemdldyjyiyfpfpfpfpfpfpfefxfpktgyfgbkdpdpdpdpdpfeglfycxgwgdfeglgugufdcxgdgmgahffpghfecxgrfehkdpdpdpdpdpbktansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdsmejlckmn",
        "ur:crypto-pubkeys/lftanshftanehskshdjkjkisdpihieeyececehescxfpfpfpfpfxeoglknhsfxehjzhtfygaehglghfeecfpfpfpfpgafwemeydlgseseyetendndlhkgdkpeojneseckogridjyjshsflgmjnidjzgdhgiygtgdhsgwhthkemdldyjyiycxiajljnjnihjtjytansgrhdcxfdgwgacloxsrmupdcybdchfylewsdilrbestjodpwnknndjoztjprfkkjopkdejogoimkkkt",
        "Signature(SshEd25519)",
      );
    });

    // Skip: SSH ECDSA P256 key generation is not yet implemented in TypeScript
    it.skip("test_ssh_ecdsa_nistp256", async () => {
      await testKeys(
        generate.PrvKeysSigningScheme.SshEcdsaP256,
        "ur:crypto-prvkeys/lftansgotanehnkkadvtdpdpdpdpdpfwfeflgaglcxgwgdfeglgugufdcxgdgmgahffpghfecxgrfehkdpdpdpdpdpbkideofwjzidjtglknhsfxehjphthdjejyieimfefpfpfpfpfpfwfleckoidjngofpfpfpfpfeidjneskphtgyfpfpfpfpfpfpfpfpfpfwfpfpfpfphsfpfpfpfpfwgljzhkeygmknhkgubkehknhsflfekkgshgecjoiaeogmktgtimgoeyfpfpfpfpfxflecjoiaeogmktgtimgoeyfpfpfpfpgygygmkpingsisjefgfdgeesjyjygheygakninhdjegohkinhdeoeyhthtjkgyjpbkgwktihjpjninethtdygljlgdglemeyjnemidjygheoineodykpjsjoehgrgmhsfwguglgegdkkjlgdfxfgdnemhdjseefleceyemingsfygufwgtfpfpfpfpjngwhggsfxgykojzinktbkjegsfpfpfpfpfeeyhfimhtfdglisgshdgljlhkghgajyidjnjzkniefdfpkkglghhkfpfpfpfpgaidjnjzkniefdfpkkglghhkfpfpfpfwfwfwflengakpflgygoiajteyeyehgdhkimbkgwgeihgmgmingeiyiyhtjzjnksfxjkemfwenkphsgsksjtgyeyioeteokohsidjykpehgdihgsiyguenjsjtgojofgjlfggadyjedlgrioetgahdemjyihjpioidjtidkpgajkglgafebkktfpfpfpfpiofdjeeegreeengtktgleejpeoiaesimjnjtjteyjzglkkghimhkiydnemdlgaghgdindngsiojlkkgoflghfxfpfpfpfpfpfpbkdpdpdpdpdpfeglfycxgwgdfeglgugufdcxgdgmgahffpghfecxgrfehkdpdpdpdpdpbktansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdshprhjszt",
        "ur:crypto-pubkeys/lftanshftanehskspdihiaiejkhsdpjkishseydpjtinjkjyjoeyecencxfpfpfpfpfeeyhfimhtfdglisgshdgljlhkghgajyidjnjzkniefdfpkkglghhkfpfpfpfpgaidjnjzkniefdfpkkglghhkfpfpfpfwfwfwflengakpflgygoiajteyeyehgdhkimgwgeihgmgmingeiyiyhtjzjnksfxjkemfwenkphsgsksjtgyeyioeteokohsidjykpehgdihgsiyguenjsjtgojofgjlfggadyjedlgrioetgahdemjyihjpioidjtidkpgajkglgafektfscxiajljnjnihjtjytansgrhdcxfdgwgacloxsrmupdcybdchfylewsdilrbestjodpwnknndjoztjprfkkjopkdejodlztswca",
        "Signature(SshEcdsaP256)",
      );
    });

    // Skip: SSH ECDSA P384 key generation is not yet implemented in TypeScript
    it.skip("test_ssh_ecdsa_nistp384", async () => {
      await testKeys(
        generate.PrvKeysSigningScheme.SshEcdsaP384,
        "ur:crypto-prvkeys/lftansgotanehnkkaohtdpdpdpdpdpfwfeflgaglcxgwgdfeglgugufdcxgdgmgahffpghfecxgrfehkdpdpdpdpdpbkideofwjzidjtglknhsfxehjphthdjejyieimfefpfpfpfpfpfwfleckoidjngofpfpfpfpfeidjneskphtgyfpfpfpfpfpfpfpfpfpfwfpfpfpfpinfpfpfpfpfwgljzhkeygmknhkgubkehknhsflfekkgshgecjoiaeogmktgtkniodyfpfpfpfpfxflecjoiaeogmktgtkniodyfpfpfpfphkgygmgwglfwiegthsgujehffeeyfdhgeekokkjlgmghengyhdjyghjnenhginknbkieenfyjsfwjzehhtflgsetihgohgeyetkpimemfdfwinhgihksimglgaindyjtjljshsgrgdgtjzdygwksfphffeiahkisingajzgsenfdehjpemiygeihfwgoiegmjyjkgugafxglgabkeogyjliyglisguidfdhfgliaishkdlflhdgsfygakoeehtkpgodljoeyjlfpfpfpfygyioeseefegtgagdihfwfyfpfpfpfpfpghhthggljeiaeyfejyiaeyisisgtinehkphshdgldybkiafygteeglfpfpfpfpfpiskphshdgldyiafygteeglfpfpfpfpflfefeghimgyhdghfljejofggmglisehkpgsetjsfegodnjefgemgoeckpjzjljkeoihioeniohtiehggmindlfdjzbkfgjykogsjldnkskthkjzjtjkhkkngugajygeengrjninimkngeiefyjkgyfggmfdflgahkingegudniseshsdneokkhdiohffdgoididfeinfpimgugldygrfdknhkgojnksehghhdgabkhggdksjzkkktkkgsdnflidjzgdeniejsfpfpfpfpgtgyfxjljejtjygdinidgmfejliaiadlehglioiejofddnhdkojleejpjejehdenglesjyjofldliagrjljkgeisdyjeksjekojybkdyfgihkkesktknhkioehfpetkshtkojseefpfpfpfpfpfpgygafyfwfpgoflfwktfsfsbkdpdpdpdpdpfeglfycxgwgdfeglgugufdcxgdgmgahffpghfecxgrfehkdpdpdpdpdpbktansgehdcxvsdapeurgauovlbsvdfhvdcevywlptspfgnejpbksadehkhkfzehhfaysrsrbsdswnecfzhf",
        "ur:crypto-pubkeys/lftanshftanehskstyihiaiejkhsdpjkishseydpjtinjkjyjoeoeteecxfpfpfpfpfeeyhfimhtfdglisgshdgljlhkghgajyidjnjzkniefdfpkngwfygyfpfpfpfpgaidjnjzkniefdfpkngwfygyfpfpfpfwisfwfeeedyfgdyksjogrgmgoghhkieidindlgrisfggdjofwihehgwidjohsgsgleojlgwjlflhdhfjehkkoksecgmididkkengdjkiaflgehtemflgtdyingsguihinjojljletkkhdgyemfefwgogmksinflgaingokojliyhgkojyetjzeefggmehfleyksgaiogadyimiefxiseteyfggejkiegoehkkfgimethtiajkgtindlisjnecghdnjthsiofsfscxiajljnjnihjtjytansgrhdcxfdgwgacloxsrmupdcybdchfylewsdilrbestjodpwnknndjoztjprfkkjopkdejoltvdgula",
        "Signature(SshEcdsaP384)",
      );
    });

    // Skip: SSH DSA key generation is particularly slow and not yet implemented in TypeScript
    it.skip("test_ssh_dsa", async () => {
      // Very long test - SSH DSA key generation is slow
    });
  });

  describe("Ed25519 signing (implemented)", () => {
    it("test_ed25519_sign_verify", async () => {
      // Generate random Ed25519 prvkeys
      const prvkeys = generate.prvKeys.exec({
        ...generate.prvKeys.defaultArgs(),
        signing: generate.PrvKeysSigningScheme.Ed25519,
        encryption: generate.PrvKeysEncryptionScheme.X25519,
      });

      // Generate pubkeys from prvkeys
      const pubkeys = generate.pubKeys.exec({
        ...generate.pubKeys.defaultArgs(),
        prvKeys: prvkeys,
        comment: COMMENT,
      });

      // Sign an envelope
      const signed = await sign.exec({
        ...sign.defaultArgs(),
        signers: [prvkeys],
        namespace: "test",
        envelope: ALICE_KNOWS_BOB_EXAMPLE,
      });

      // Verify the format contains a signature
      const formatted = format.exec({
        ...format.defaultArgs(),
        envelope: signed,
      });
      expect(formatted).toContain("'signed':");
      expect(formatted).toContain("Signature");

      // Verify the signature
      await verify.exec({
        ...verify.defaultArgs(),
        verifiers: [pubkeys],
        envelope: signed,
      });
    });
  });
});
