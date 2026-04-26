/**
 * Introductions tests.
 *
 * Port of tests/introductions.rs from frost-hubert-rust.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { ownerSet } from "../src/cmd/registry/owner/set.js";
import { participantAdd } from "../src/cmd/registry/participant/add.js";
import { fixture, registerTags } from "./common/index.js";

interface User {
  name: string;
  signedDoc: string;
  privateDoc: string;
}

interface Users {
  alice: User;
  bob: User;
  carol: User;
  dan: User;
}

function loadUsers(): Users {
  const fixtures = [
    ["alice", "Alice"],
    ["bob", "Bob"],
    ["carol", "Carol"],
    ["dan", "Dan"],
  ] as const;

  const users: Record<string, User> = {};

  for (const [key, name] of fixtures) {
    const signed = fixture(`${key}_signed_xid.txt`);
    const privateXid = fixture(`${key}_private_xid.txt`);
    users[name] = {
      name,
      signedDoc: signed,
      privateDoc: privateXid,
    };
  }

  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return {
    alice: users["Alice"]!,
    bob: users["Bob"]!,
    carol: users["Carol"]!,
    dan: users["Dan"]!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

function getAllUsers(users: Users): User[] {
  return [users.alice, users.bob, users.carol, users.dan];
}

function getOthers(users: Users, userName: string): User[] {
  return getAllUsers(users).filter((user) => user.name !== userName);
}

function expectedRegistryText(ownerName: string): Record<string, unknown> {
  switch (ownerName) {
    case "Alice":
      return {
        groups: {},
        owner: {
          xid_document:
            "ur:xid/tpsplftpsotanshdhdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsoyaylrtpsotansgylftanshfhdcxswkeatmoclaehlpezsprtkntgrparfihgosofmfnlrgltndysabkwlckykimemottansgrhdcxtnhluevohylpdadednfmrsdkcfvovdsfaaadpecllftytbhgmylapkbarsfhdthsoycsfncsfgoycscstpsoihfpjziniaihlfoycsfptpsotansgtlftansgohdcxgrftdienhfprgtbsjlgmtefzfmhpvtlyqzglcxrstaeegdstlncwwtfhwkdwkbehtansgehdcxctzmfyqzrkcpjpbslrmeiymovtktbkdllynbztspryolfhjpbzrdmeghwdehkekpoybstpsotansgmhdcxbagdkturtovtaxryolhgonbblygahdsbwejyhspfbgtbspssmwroghhknyhlzcyafzpkftwy",
        },
        participants: {
          "ur:xid/hdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkrttabnpl": {
            pet_name: "Carol",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkoyaylstpsotansgylftanshfhdcxkkplksiykkynfeisiedkserfbdollodikgprmsihaeuoveehytcsjzmkahwycxestansgrhdcxfgbbinheylcmhlsomhrsvddmisvehhgywttnwlwniojecerettfeuyjylnlybsbtoycsfncsfgoycscstpsoihfxhsjpjljzoyaxtpsotansghhdfzfwgycsiocwnsimpafwytieyktsaegunneyvawkidaojzsrmndmptrygucnlelocpeydtnddmndgugakgdsoxwmpfadgumyesvwssgmpeiymddnsbcmbakkguaddernimwmoxdyta",
          },
          "ur:xid/hdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarovtfgurnd": {
            pet_name: "Dan",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarooyaylstpsotansgylftanshfhdcxsaspkbhlmukgpfwemofgiadppkpsihrphecafxgahnbgfljnptluhdwzfdvacswftansgrhdcxldgtiadwmnvslaaxgufysnlfneghfgurfsiaaysbhkcadmaavwlkfytdwdzmkteeoycsfncsfgoycscstpsoiafyhsjtoyaxtpsotansghhdfzoxahrnfmmnckdedaiarkgonbnytdneesjtftwsgrrlaootployfzhtattdhnjkfwguctjtjnurutlomuatsokkjybzflfenlmnfpcecainkksoztcxdtjnmyotgyesqdkgadjtdi",
          },
          "ur:xid/hdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecdsfxhljz": {
            pet_name: "Bob",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecoyaylstpsotansgylftanshfhdcxtoiniabgotbtltwpfgnbcxlybznngywkfsflbabyamadwmuefgtyjecxmteefxjntansgrhdcxbatpyafttpyabewkcmutihvesklrhytehydavdimwpahbalnnsrsnyfzpkcehpfhoycsfncsfgoycscstpsoiafwjlidoyaxtpsotansghhdfzhlimcmkgkkhdpmvsmtiowezcnemnyapaaxvostosrpluaslaylasmuzmsatsotwdchwlwmpsheclgeltynteyleohdwlhdticwdsahrtsrykseptflosbwtkrhlybwoydntkpmem",
          },
        },
      };
    case "Bob":
      return {
        groups: {},
        owner: {
          xid_document:
            "ur:xid/tpsplftpsotanshdhdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecoyaylrtpsotansgylftanshfhdcxtoiniabgotbtltwpfgnbcxlybznngywkfsflbabyamadwmuefgtyjecxmteefxjntansgrhdcxbatpyafttpyabewkcmutihvesklrhytehydavdimwpahbalnnsrsnyfzpkcehpfhoycsfncsfglfoycsfptpsotansgtlftansgohdcxmdfskpescejtfyjozttezsbsbwbtmochadnscpadcwnnfejlqzjomwpskieyrendtansgehdcxdwbalolkwlhfhfvewnbbtshdbbiswdreldadwleynbfrwdgsbgjlgthfhktdrykooybstpsotansgmhdcxbsadwtqzdkvefnpesfasgsuoiocavonbieimfhtpkkpslbkbkkoscyidlfnscygdoycscstpsoiafwjlidclptjzwz",
        },
        participants: {
          "ur:xid/hdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkrttabnpl": {
            pet_name: "Carol",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkoyaylstpsotansgylftanshfhdcxkkplksiykkynfeisiedkserfbdollodikgprmsihaeuoveehytcsjzmkahwycxestansgrhdcxfgbbinheylcmhlsomhrsvddmisvehhgywttnwlwniojecerettfeuyjylnlybsbtoycsfncsfgoycscstpsoihfxhsjpjljzoyaxtpsotansghhdfzfwgycsiocwnsimpafwytieyktsaegunneyvawkidaojzsrmndmptrygucnlelocpeydtnddmndgugakgdsoxwmpfadgumyesvwssgmpeiymddnsbcmbakkguaddernimwmoxdyta",
          },
          "ur:xid/hdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarovtfgurnd": {
            pet_name: "Dan",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarooyaylstpsotansgylftanshfhdcxsaspkbhlmukgpfwemofgiadppkpsihrphecafxgahnbgfljnptluhdwzfdvacswftansgrhdcxldgtiadwmnvslaaxgufysnlfneghfgurfsiaaysbhkcadmaavwlkfytdwdzmkteeoycsfncsfgoycscstpsoiafyhsjtoyaxtpsotansghhdfzoxahrnfmmnckdedaiarkgonbnytdneesjtftwsgrrlaootployfzhtattdhnjkfwguctjtjnurutlomuatsokkjybzflfenlmnfpcecainkksoztcxdtjnmyotgyesqdkgadjtdi",
          },
          "ur:xid/hdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsfnpkjony": {
            pet_name: "Alice",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsoyaylstpsotansgylftanshfhdcxswkeatmoclaehlpezsprtkntgrparfihgosofmfnlrgltndysabkwlckykimemottansgrhdcxtnhluevohylpdadednfmrsdkcfvovdsfaaadpecllftytbhgmylapkbarsfhdthsoycsfncsfgoycscstpsoihfpjziniaihoyaxtpsotansghhdfzkizesfchbgmylycxcesplsatmelfctwdplbeidjkmklehetntyidasgevachftiyotielsidkomoynskpkknpfuojobyrkbncektdsiateluetctyklrgrpshdhfadfzwkesroaa",
          },
        },
      };
    case "Carol":
      return {
        groups: {},
        owner: {
          xid_document:
            "ur:xid/tpsplftpsotanshdhdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkoyaylrtpsotansgylftanshfhdcxkkplksiykkynfeisiedkserfbdollodikgprmsihaeuoveehytcsjzmkahwycxestansgrhdcxfgbbinheylcmhlsomhrsvddmisvehhgywttnwlwniojecerettfeuyjylnlybsbtlfoycsfptpsotansgtlftansgohdcxhpnnvtrooespntdrcnylluvwimbbamfzswaatifrvspyqdjyjooltacaasdthedrtansgehdcxrprtadaacyhtsgfglfwefhjzcmlapdasndgwfgnlvtaeuecwaezsclrpwfgmiyfloybstpsotansgmhdcxpdrevoptstsgjsbzoybwmelgwnhdcscaesnblapacfuolsdysfykflihjolbzovwoycsfncsfgoycscstpsoihfxhsjpjljzgljeqzfl",
        },
        participants: {
          "ur:xid/hdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarovtfgurnd": {
            pet_name: "Dan",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarooyaylstpsotansgylftanshfhdcxsaspkbhlmukgpfwemofgiadppkpsihrphecafxgahnbgfljnptluhdwzfdvacswftansgrhdcxldgtiadwmnvslaaxgufysnlfneghfgurfsiaaysbhkcadmaavwlkfytdwdzmkteeoycsfncsfgoycscstpsoiafyhsjtoyaxtpsotansghhdfzoxahrnfmmnckdedaiarkgonbnytdneesjtftwsgrrlaootployfzhtattdhnjkfwguctjtjnurutlomuatsokkjybzflfenlmnfpcecainkksoztcxdtjnmyotgyesqdkgadjtdi",
          },
          "ur:xid/hdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecdsfxhljz": {
            pet_name: "Bob",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecoyaylstpsotansgylftanshfhdcxtoiniabgotbtltwpfgnbcxlybznngywkfsflbabyamadwmuefgtyjecxmteefxjntansgrhdcxbatpyafttpyabewkcmutihvesklrhytehydavdimwpahbalnnsrsnyfzpkcehpfhoycsfncsfgoycscstpsoiafwjlidoyaxtpsotansghhdfzhlimcmkgkkhdpmvsmtiowezcnemnyapaaxvostosrpluaslaylasmuzmsatsotwdchwlwmpsheclgeltynteyleohdwlhdticwdsahrtsrykseptflosbwtkrhlybwoydntkpmem",
          },
          "ur:xid/hdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsfnpkjony": {
            pet_name: "Alice",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsoyaylstpsotansgylftanshfhdcxswkeatmoclaehlpezsprtkntgrparfihgosofmfnlrgltndysabkwlckykimemottansgrhdcxtnhluevohylpdadednfmrsdkcfvovdsfaaadpecllftytbhgmylapkbarsfhdthsoycsfncsfgoycscstpsoihfpjziniaihoyaxtpsotansghhdfzkizesfchbgmylycxcesplsatmelfctwdplbeidjkmklehetntyidasgevachftiyotielsidkomoynskpkknpfuojobyrkbncektdsiateluetctyklrgrpshdhfadfzwkesroaa",
          },
        },
      };
    case "Dan":
      return {
        groups: {},
        owner: {
          xid_document:
            "ur:xid/tpsplftpsotanshdhdcxptfslorobgsgbyltdeoxbniysoktlffllkdtkovadicljpbahhenemhtbsmslarooyaylrtpsotansgylftanshfhdcxsaspkbhlmukgpfwemofgiadppkpsihrphecafxgahnbgfljnptluhdwzfdvacswftansgrhdcxldgtiadwmnvslaaxgufysnlfneghfgurfsiaaysbhkcadmaavwlkfytdwdzmkteeoycsfncsfglfoycsfptpsotansgtlftansgohdcxltmtiegwiddrbnvebzbkfzmholaadyvdkobdrlfswtlefyfrrhjzjpjoneetskjytansgehdcxurdshedtbtueldbszetsayhntnsnsgetcapscalpztgmcpinfppytizsprmevtfloybstpsotansgmhdcxsgylchiyotiamhkeftdafdvochskhpknembttoecbglbmyutytwtoxrpswhsdpuyoycscstpsoiafyhsjtgewthkps",
        },
        participants: {
          "ur:xid/hdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkrttabnpl": {
            pet_name: "Carol",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxnemtgmchkkuewflyoycydstepepecfoxwyeoiszourtayketgutkhnoednceeydkoyaylstpsotansgylftanshfhdcxkkplksiykkynfeisiedkserfbdollodikgprmsihaeuoveehytcsjzmkahwycxestansgrhdcxfgbbinheylcmhlsomhrsvddmisvehhgywttnwlwniojecerettfeuyjylnlybsbtoycsfncsfgoycscstpsoihfxhsjpjljzoyaxtpsotansghhdfzfwgycsiocwnsimpafwytieyktsaegunneyvawkidaojzsrmndmptrygucnlelocpeydtnddmndgugakgdsoxwmpfadgumyesvwssgmpeiymddnsbcmbakkguaddernimwmoxdyta",
          },
          "ur:xid/hdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecdsfxhljz": {
            pet_name: "Bob",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxuysflgfsmwjseozmhplehywpwdcnfwmtvskkkbtieerpsfmtwegoiysaeeylfsecoyaylstpsotansgylftanshfhdcxtoiniabgotbtltwpfgnbcxlybznngywkfsflbabyamadwmuefgtyjecxmteefxjntansgrhdcxbatpyafttpyabewkcmutihvesklrhytehydavdimwpahbalnnsrsnyfzpkcehpfhoycsfncsfgoycscstpsoiafwjlidoyaxtpsotansghhdfzhlimcmkgkkhdpmvsmtiowezcnemnyapaaxvostosrpluaslaylasmuzmsatsotwdchwlwmpsheclgeltynteyleohdwlhdticwdsahrtsrykseptflosbwtkrhlybwoydntkpmem",
          },
          "ur:xid/hdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsfnpkjony": {
            pet_name: "Alice",
            xid_document:
              "ur:xid/tpsplftpsplftpsotanshdhdcxwmkbiywnmkwdlprdjliowtdkprkpbszodnlychyklapdjzrohnwpwecefglolsbsoyaylstpsotansgylftanshfhdcxswkeatmoclaehlpezsprtkntgrparfihgosofmfnlrgltndysabkwlckykimemottansgrhdcxtnhluevohylpdadednfmrsdkcfvovdsfaaadpecllftytbhgmylapkbarsfhdthsoycsfncsfgoycscstpsoihfpjziniaihoyaxtpsotansghhdfzkizesfchbgmylycxcesplsatmelfctwdplbeidjkmklehetntyidasgevachftiyotielsidkomoynskpkknpfuojobyrkbncektdsiateluetctyklrgrpshdhfadfzwkesroaa",
          },
        },
      };
    default:
      throw new Error(`Unknown owner: ${ownerName}`);
  }
}

describe("introductions", () => {
  let tempDirs: Map<string, string>;

  beforeEach(async () => {
    await registerTags();
    tempDirs = new Map();
  });

  afterEach(() => {
    for (const dir of tempDirs.values()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Skip until UR parsing is fully working in @bcts/uniform-resources
  it("introductions_create_four_registries", () => {
    const users = loadUsers();

    const registries: Map<string, [Record<string, unknown>, Record<string, unknown>]> = new Map();

    for (const user of getAllUsers(users)) {
      const temp = fs.mkdtempSync(path.join(os.tmpdir(), "frost-test-"));
      tempDirs.set(user.name, temp);

      const others = getOthers(users, user.name);

      // Set owner
      ownerSet({ xidDocument: user.privateDoc }, temp);

      // Add other participants
      for (const other of others) {
        participantAdd({ xidDocument: other.signedDoc, petName: other.name }, temp);
      }

      const registryPath = path.join(temp, "registry.json");
      const content = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
      registries.set(user.name, [content, expectedRegistryText(user.name)]);
    }

    // Verify all registries.
    //
    // Mirrors Rust `tests/introductions.rs:53-54`:
    //   let actual_pretty: Value = serde_json::from_str(&actual).unwrap();
    //   let actual_text = serde_json::to_string_pretty(&actual_pretty).unwrap();
    // This re-parse-then-pretty round-trip normalizes key order through
    // `serde_json::Map`'s default `BTreeMap` backing, i.e. it
    // alphabetizes keys recursively. JS `JSON.parse`/`JSON.stringify`
    // preserve insertion order, so we replicate the alphabetization
    // explicitly via `sortJsonKeys` below before comparing.
    for (const [_name, [actual, expected]] of registries) {
      const actualPretty = JSON.stringify(sortJsonKeys(actual), null, 2);
      const expectedPretty = JSON.stringify(sortJsonKeys(expected), null, 2);
      expect(actualPretty).toBe(expectedPretty);
    }
  });
});

/**
 * Recursively re-emit a JSON value with object keys in alphabetical
 * order. Mirrors Rust `serde_json::Value` round-trip, which normalizes
 * key order through `Map<String, Value>`'s default `BTreeMap` backing.
 */
function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value === null || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortJsonKeys(obj[key]);
  }
  return sorted;
}
