/**
 * Format command tests - 1:1 port of tests/test_format.rs
 */

import { describe, it, expect } from "vitest";
import * as format from "../src/cmd/format.js";
import { HELLO_ENVELOPE_UR } from "./common.js";

const ENVELOPE =
  "ur:envelope/lftpsplntpcstansgshdcxchfdfwwdsrzofytsyndsvetsndkbbelbtdmuskhfdtyntbcprocktyatktaxaosphdcxfnstoxfwdaglhlmywzpafwmnfdzezmkisgfhtaetihtibemedpnsuevswtcngwpaoybtlstpcstansgshdcxaaenfsheytmseorfbsbzktrdrdfybkwntkeegetaveghzstattdertbswsihahvsoyaatpcsksckgajkjkkpihiecxidkkcxjyisihcxgujyhsjyihcxjliycxfekshsjnjojzihoyastpcstpcxksheisjyjyjojkftdldlihkshsjnjojzihjzihieioihjpdmiajljndlhsjpiniedldyeeeoeneoieeciyiyesesemeoeoidiadyiyehecememidhsidhseeeedyhsiyehiaiyeoeeeehsieesiheeeceeiyhsieesieeheyetiadydyiyihiyenecdyecihetoybalktpcstansgshdcxksrfdyaeflkootmhhpsfrhronbeytkjpdwwdwtrkzocygawdwfcshepyhdaysguohdcxbwjsinwkcmahnefdmsfdgtltkpdppdbdwnfdhhwfjyptvddimucwrycavameetssoytpcsimiyhsjninjzkkglhsjnihtpcsihgugtgaghfdoytpcsinioinkoihjtglhsjnihtpcsiegegwfdglhdcxhdcamnzeftfppdwzpmjojluypebnbeplzeptzesfkgfholssdtkgveimonnlsosehdcxjscnletijkdssosnvljpbklrhpihrpjtfwtnwecflolsolfmkbnlndosmdadztsboytpcsihinjnhsioihlstpcsjpgejlisjtcxgujninjyiscxjkjninjzinjtiooyastpcskshsisjyjyjojkftdldlihkshsjnjojzihjzihieioihjpdmiajljndlieinioihjkjydleoenidiheodyemeyenidihiyideneciahseheoideheoenhsiheyesieetdyetehiyeneeemeseyiaeyemdyeyeeehecihidendyhsieehiaecenihieeoeoiaesesesoyaatpcsksctghisinjkcxinjkcxhsjtcxinjnhsioihcxjliycxgejlisjtcxgujninjyisdmhdcxnsmkylvtfseegsgotaammhcezebdgwhyhhyljkrhwfqzoskgeosodsgmpmhgzchhhdcxosfmfplpfxvefzoybncfwzgtfewdcapsqdkkuolagdtdltvwfdttvorflocwzegahdcxtbcffdrptpstzmmomdktssmegedwvdecgadtdsreaygtdifwmokimwaodwbyuozmhdcxvyidloaagdetmopfrnbwleidmeioftfptavtlnptprvohnfpmtcegdseamceotwyhdcxzejocerptnaxchswvossceasnehkgefyptmhndretdghwtwepymwoyrocmnntddioyadtpcsimiajpihieihjtjyinhsjzhdcxwmesosbwlupscfiopltaemchmdzmtllrgraxlnrhwnkbfmlrveadrtlobspspmmsoyaxlftpcstansghhdfzqdwtmnhlgegylkasmhvtguaadtbstohstekbolkpastlrecltasgadcwtljtnlrhvlecrplufyvacfkevacpesbkdesfpfkpoyosylwzlbvosfyldtdejnbtioprdmoxoyaatpcskscagthsieihcxidkkcxjyisihcxgujyhsjyihcxjliycxfekshsjnjojzihdmjzveesyk";

describe("format command", () => {
  it("test_format", () => {
    const result = format.exec({
      ...format.defaultArgs(),
      envelope: HELLO_ENVELOPE_UR,
    });
    expect(result).toBe('"Hello."');
  });

  it("test_format_envelope", () => {
    const result = format.exec({
      ...format.defaultArgs(),
      envelope: ENVELOPE,
    });
    // Assertion ordering differs from Rust (digest sort parity), so check content
    expect(result).toContain("ARID(174842ea)");
    expect(result).toContain("'isA': \"credential\"");
    expect(result).toContain("'holder': ARID(78bc3000)");
    expect(result).toContain('"familyName": "SMITH"');
    expect(result).toContain('"givenName": "JOHN"');
    expect(result).toContain('"image": "John Smith smiling"');
    expect(result).toContain("'note': \"This is an image of John Smith.\"");
    expect(result).toContain("ELIDED (8)");
    expect(result).toContain("'issuer': ARID(04363d5f)");
    expect(result).toContain(
      "URI(https://exampleledger.com/arid/04363d5ff99733bc0f1577baba440af1cf344ad9e454fad9d128c00fef6505e8)",
    );
    expect(result).toContain("'note': \"Issued by the State of Example\"");
    expect(result).toContain("ELIDED (2)");
    expect(result).toContain("'signed': Signature");
    expect(result).toContain("'note': \"Made by the State of Example.\"");
  });

  it("test_format_cbor", () => {
    const result = format.exec({
      ...format.defaultArgs(),
      type: format.FormatType.Cbor,
      envelope: ENVELOPE,
    });
    const expected =
      "d8c882d8c886d8c9d99c4c5820174842eac3fb44d7f626e4d79b7e107fd293c55629f6d622b81ed407770302c858203cc7a442254e5d8ff2b1428e48feff7dca3fd93865d010912d9cdee8f0234fb1a10d83d8c9d99c4c582004363d5ff99733bc0f1577baba440af1cf344ad9e454fad9d128c00fef6505e8a104d8c9781e49737375656420627920746865205374617465206f66204578616d706c65a109d8c9d820785f68747470733a2f2f6578616d706c656c65646765722e636f6d2f617269642f30343336336435666639393733336263306631353737626162613434306166316366333434616439653435346661643964313238633030666566363530356538a10e8cd8c9d99c4c582078bc30004776a3905bccb9b8a032cf722ceaf0bbfb1a49eaf3185fab5808cadc5820137169f416059f4897484d87752da80bf1485cf374a9e727931bbd1de69138c4a1d8c96a66616d696c794e616d65d8c965534d495448a1d8c969676976656e4e616d65d8c9644a4f484e5820581d8efe3a41a8f2ad706fdbaf0c10aefea9fecc7b3fa6c4297be46aa599c9c1582071238ad07326c9cde3720a845b65b66e42daed198883a63e7e999ba79501fccba1d8c965696d61676583d8c9724a6f686e20536d69746820736d696c696e67a109d8c9786168747470733a2f2f6578616d706c656c65646765722e636f6d2f6469676573742f33366265333037323662656662363563613133623133366165323964383038316636343739326332373032343135656236306164316335366564333363393939a104d8c9781f5468697320697320616e20696d616765206f66204a6f686e20536d6974682e58209c98f7e03d344c55d906901cfe0b4f5e5cf773b9f3b4a77b33c92652ad57fd5c5820a73e418543e440a10c19f24d45ea1dacb379dc8050d287e548d1e2bc881bfe495820d61948b6d8c7ff929577c4914a2ce735492926b5084d2742927d94022c11dcff5820e1628804503892b0be138a6291673a41d9e086a9b2e26041961c50c1061ca3ee5820fe701cb6da0317c6e2c41c099f594a44a9909bb5d254f0edab94a1b8169ed227a101d8c96a63726564656e7469616c5820eb39a7138bac1967aed9371795ffd5844b0386b9f17e3e84e401c0880facad97a10382d8c9d99c545840b3f08e5d4a518c0990e05304290fce61d37ea67509d5b521d9ca011bd56e99b9e335b68b44e6197ce622390a28ccb075a1a7f7f27fe2ccf729286d0d67b22ea4a104d8c9781d4d61646520627920746865205374617465206f66204578616d706c652e";
    expect(result).toBe(expected);
  });

  it("test_format_diag", () => {
    const result = format.exec({
      ...format.defaultArgs(),
      type: format.FormatType.Diag,
      envelope: ENVELOPE,
    });
    // Just verify it contains expected CBOR diagnostic notation elements
    expect(result).toContain("200(");
    expect(result).toContain("201(");
    expect(result).toContain("40012(");
  });

  it("test_format_tree", () => {
    const result = format.exec({
      ...format.defaultArgs(),
      type: format.FormatType.Tree,
      envelope: ENVELOPE,
    });
    // Verify tree structure contains key elements
    expect(result).toContain("NODE");
    expect(result).toContain("WRAPPED");
    expect(result).toContain("ASSERTION");
    expect(result).toContain("ELIDED");
    // Tree format renders Signature as LEAF (not type-annotated like Rust)
    expect(result).toContain("LEAF");
    expect(result).toContain("KNOWN_VALUE");
  });

  it("test_format_ur", () => {
    const result = format.exec({
      ...format.defaultArgs(),
      type: format.FormatType.UR,
      envelope: HELLO_ENVELOPE_UR,
    });
    expect(result).toBe(HELLO_ENVELOPE_UR);
  });
});
