/**
 * Common test utilities - 1:1 port of tests/common/mod.rs
 *
 * Constants and helper functions for envelope-cli tests.
 */

// Test Constants
export const HELLO_STR = "Hello.";
export const HELLO_ENVELOPE_UR = "ur:envelope/tpsoiyfdihjzjzjldmksbaoede";
export const ARID_HEX = "dec7e82893c32f7a4fcec633c02c0ec32a4361ca3ee3bc8758ae07742e940550";
export const ARID =
  "ur:arid/hdcxuestvsdemusrdlkngwtosweortdwbasrdrfxhssgfmvlrflthdplatjydmmwahgdwlflguqz";
export const DATE_EXAMPLE = "2022-08-30T07:16:11Z";
export const DIGEST_EXAMPLE =
  "ur:digest/hdcxdplutstarkhelprdiefhadbetlbnreamoyzefxnnkonycpgdehmuwdhnfgrkltylrovyeeck";
export const SEED_UR_EXAMPLE = "ur:seed/oyadgdaawzwplrbdhdpabgrnvokorolnrtemksayyadmut";
export const UUID_EXAMPLE = "eb377e65-5774-410a-b9cb-510bfc73e6d9";
export const ALICE_KNOWS_BOB_EXAMPLE =
  "ur:envelope/lftpsoihfpjziniaihoytpsoihjejtjlktjktpsoiafwjlidutgmnnns";
export const CREDENTIAL_EXAMPLE =
  "ur:envelope/lstpspmntpsotansgshdcxfgkoiahtjthnissawsfhzcmyyldsutfzcttefpaxjtmobsbwimcaleykvsdtgajnoytpsojsiaihjpjyiniyiniahsjyihglkpjnidihjptpsojeeheyeodpeeecendpemetesoytpsojtihksjoinjphsjyinjljtfyhsjyihtpsosecyjncscxaeoytpsoisjzhsjkjyglhsjnihtpsoiogthsksktihjzjzoytpsoininjkjkkpihfyhsjyihtpsosecyhybdvyaeoyadtpsokscffxihjpjyiniyiniahsjyihcxjliycxfxjljnjojzihjyinjljtoytpsoihjoisjljyjltpsoksckghisinjkcxinjkcxgehsjnihjkcxgthsksktihjzjzdijkcxjoisjljyjldmoytpsokscejojpjliyihjkjkinjljthsjzfyihkoihjzjljojnihjtjyfdjlkpjpjktpsobsoytpsoiniyinjpjkjyglhsjnihtpsoihgehsjnihjkoytpsoiyjyjljoiniajktpsolfingukpidimihiajycxehingukpidimihiajycxeyoytpsokscsiajljtjyinjtkpinjtiofeiekpiahsjyinjljtgojtinjyjktpsoadoyattpsoksdkfekshsjnjojzihcxfejzihiajyjpiniahsjzcxfejtioinjtihihjpinjtiocxfwjlhsjpieoytpsoiojkkpidimihiajytpsokscegmfgcxhsjtiecxgtiniajpjlkthskoihcxfejtioinjtihihjpinjtiooybttpsoksdkfekshsjnjojzihcxfejzihiajyjpiniahsjzcxfejtioinjtihihjpinjtiocxfwjlhsjpieoyaxtpsotansghhdfzdlmunbknwymowslbwfkidawyastikibksfhdosgslulecpwktysphprdheingyckvlrtjlrdhswnkbdereotdryapyhddpmnahcsmymnlsmtpdadsptyptmdbyosdllooyaatpsoksdmguiniojtihiecxidkkcxfekshsjnjojzihcxfejzihiajyjpiniahsjzcxfejtioinjtihihjpinjtiocxfwjlhsjpietdeoahrf";
export const KEY_EXAMPLE =
  "ur:crypto-key/hdcxmszmjlfsgssrbzehsslphdlgtbwesofnlpehlftldwotpaiyfwbtzsykwttomsbatnzswlqd";

// Alice keys and identifiers
export const ALICE_ARID =
  "ur:arid/hdcxtygshybkzcecfhflpfdlhdonotoentnydmzsidmkindlldjztdmoeyishknybtbswtgwwpdi";
export const ALICE_SEED = "ur:seed/oyadgdlfwfdwlphlfsghcphfcsaybekkkbaejkhphdfndy";
export const ALICE_PRVKEY_BASE = "ur:crypto-prvkey-base/gdlfwfdwlphlfsghcphfcsaybekkkbaejksfnynsct";
export const ALICE_PRVKEYS =
  "ur:crypto-prvkeys/lftansgohdcxdntswmjerdqdoxhnguzsdrhfcmjsfewkhkvezohkeycpasdysrvdgypeoemtgywztansgehdcxisespmvlhflnweksvyfnmhvofysnhyztpyhlftluweaoemenurstreckoybbfroektnncyls";
export const ALICE_PUBKEYS =
  "ur:crypto-pubkeys/lftanshfhdcxrdhgfsfsfsosrloebgwmfrfhsnlskegsjydecawybniadyzovehncacnlbmdbesstansgrhdcxytgefrmnbzftltcmcnaspaimhftbjehlatjklkhktidrpmjobslewkfretcaetbnwksorlbd";

// Bob keys and identifiers
export const BOB_ARID =
  "ur:arid/hdcxdkreprfslewefgdwhtfnaosfgajpehhyrlcyjzheurrtamfsvolnaxwkioplgansesiabtdr";
export const BOB_SEED = "ur:seed/oyadgdcsknhkjkswgtecnslsjtrdfgimfyuykglfsfwtso";
export const BOB_PRVKEY_BASE = "ur:crypto-prvkey-base/gdcsknhkjkswgtecnslsjtrdfgimfyuykgbzbagdva";
export const BOB_PUBKEYS =
  "ur:crypto-pubkeys/lftanshfhdcxndctnnflynethhhnwdkbhtehhdosmhgoclvefhjpehtaethkltsrmssnwfctfggdtansgrhdcxtipdbagmoertsklaflfhfewsptrlmhjpdeemkbdyktmtfwnninfrbnmwonetwphejzwnmhhf";

// Carol keys and identifiers
export const CAROL_ARID =
  "ur:arid/hdcxamstktdsdlplurgaoxfxdijyjysertlpehwstkwkskmnnsqdpfgwlbsertvatbbtcaryrdta";
export const CAROL_SEED = "ur:seed/oyadgdlpjypepycsvodtihcecwvsyljlzevwcnmepllulo";
export const CAROL_PRVKEY_BASE = "ur:crypto-prvkey-base/gdlpjypepycsvodtihcecwvsyljlzevwcnamjzdnos";
export const CAROL_PRVKEYS =
  "ur:crypto-prvkeys/lftansgohdcxmorsytadihzswmckyltauyolecmevychhlwmtylbhsmdptfdrtuewnjtdkmnmkretansgehdcxhententsjphsfwclylihbwroaoisptaskegrimyldebecsdrrtbdlrrslazeursspmldtkmdds";
export const CAROL_PUBKEYS =
  "ur:crypto-pubkeys/lftanshfhdcxeckpgwvyasletilffeeekbtyjlzeimmtkslkpadrtnnytontpyfyeocnecstktkttansgrhdcxoyndtbndhspebgtewmgrgrgriygmvwckkkaysfzozclbgendfmhfjliorteenlbwsbkbotbs";

// Dave keys and identifiers
export const DAVE_PRVKEY_BASE =
  "ur:crypto-prvkey-base/hdcxjtgrwefxlpihpmvtzoprdpfrbaghgmfmdyjsiafzaewlenmktesweocpluwepekgdyutaejy";
export const DAVE_PUBKEYS =
  "ur:crypto-pubkeys/lftanshfhdcxbwbdwmehecntwdwdfgeyotrhplcejyglaacpotqzbtjslfoybdpyhpdpbasrytpatansgrhdcxptsnuebzqzwdhtlanbhyweprpytkpfntvyfpmomykkasfeltwyceuoieaysngrjtjndrescf";

/**
 * Helper to trim and compare output.
 */
export function expectOutput(actual: string, expected: string): void {
  const trimmedActual = actual.trim();
  const trimmedExpected = expected.trim();
  if (trimmedActual !== trimmedExpected) {
    console.log("Actual:\n" + trimmedActual);
    console.log("Expected:\n" + trimmedExpected);
  }
  expect(trimmedActual).toBe(trimmedExpected);
}

/**
 * Helper to compare raw output (with trailing newline preserved).
 */
export function expectRawOutput(actual: string, expected: string): void {
  if (actual !== expected) {
    console.log("Actual:\n" + actual);
    console.log("Expected:\n" + expected);
  }
  expect(actual).toBe(expected);
}
