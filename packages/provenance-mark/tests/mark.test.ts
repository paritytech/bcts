import { cbor } from "@bcts/dcbor";
import { ProvenanceMark, ProvenanceMarkGenerator, ProvenanceMarkResolution } from "../src";

// =============================================================================
// Test Vectors from Rust provenance-mark-rust/tests/mark.rs
// =============================================================================

// Expected display strings for low resolution marks
const EXPECTED_DISPLAY_LOW = [
  "ProvenanceMark(5bdcec81)",
  "ProvenanceMark(477e3ce6)",
  "ProvenanceMark(3e5da986)",
  "ProvenanceMark(41c525a1)",
  "ProvenanceMark(8095afb4)",
  "ProvenanceMark(3bcacc8d)",
  "ProvenanceMark(41486af2)",
  "ProvenanceMark(5fa35da9)",
  "ProvenanceMark(e369288f)",
  "ProvenanceMark(7ce8f8bc)",
];

// Expected bytewords for low resolution marks
const EXPECTED_BYTEWORDS_LOW = [
  "axis bald whiz yoga rich join body jazz yurt wall monk fact urge cola exam arch kick fuel omit echo",
  "gyro lung runs skew flew yank yawn lung king sets luau idle draw aunt knob high jazz veto cola road",
  "guru jade diet iris gift zoom slot list omit ruby visa noon dark vibe road stub tied waxy race huts",
  "keep rock fuel taxi jugs fish fair fish help dull hope rust claw next urge zoom monk fern maze diet",
  "limp task jury jolt vows surf cost silk yoga king huts claw vibe mint yell quiz zinc wall join cost",
  "song deli flap blue work zone jump item heat stub mint kick gems vows love rock iris undo legs yell",
  "urge high ruby vibe fish jolt iced diet safe lion webs stub exam user work part wave fish back logo",
  "bias edge very ramp free surf wasp void hawk door also zoom gray down wall tent holy waxy leaf mint",
  "gray exam draw oboe unit yawn surf junk curl eyes keno belt crux navy need cats ruby noon yell noon",
  "play skew peck idle tent many song vibe open urge slot plus bulb free dice able keno buzz girl gear",
];

// Expected bytewords identifiers for low resolution marks
const EXPECTED_ID_WORDS_LOW = [
  "HELP UNDO WASP LAZY",
  "FUEL KNOB FERN VISA",
  "FILM HILL PART LION",
  "FLAP SILK DATA OBEY",
  "LAVA MILD POSE QUIZ",
  "FAIR SONG SURF LUNG",
  "FLAP FUND ITEM WHIZ",
  "HOPE OMIT HILL PART",
  "VIAL IRON DICE MANY",
  "KITE VOWS YOGA ROOF",
];

// Expected bytemoji identifiers for low resolution marks
const EXPECTED_BYTEMOJI_IDS_LOW = [
  "🌮 🐰 🦄 💔",
  "🍍 🪐 🦶 🐵",
  "🍊 🍱 🧮 🚩",
  "🍉 🔥 👽 🪑",
  "💛 🚀 📡 🎁",
  "🤚 🩳 👔 🛑",
  "🍉 🥝 🍄 🐢",
  "🍤 💌 🍱 🧮",
  "🐮 🍁 😻 🚗",
  "💫 🐥 🪼 🏆",
];

// Expected UR strings for low resolution marks
const EXPECTED_URS_LOW = [
  "ur:provenance/lfaegdasbdwzyarhjnbyjzytwlmkftuecaemahwmfgaxcl",
  "ur:provenance/lfaegdgolgrsswfwykynlgkgssluiedwatkbhhzevlrypd",
  "ur:provenance/lfaegdgujedtisgtzmstltotryvanndkverdsbfzwsbzjk",
  "ur:provenance/lfaegdkprkfltijsfhfrfhhpdlhertcwntuezmbkfsehfr",
  "ur:provenance/lfaegdlptkjyjtvssfctskyakghscwvemtylqzjlvssnbt",
  "ur:provenance/lfaegdsgdifpbewkzejpimhtsbmtkkgsvslerkzsutcnvw",
  "ur:provenance/lfaegduehhryvefhjtiddtselnwssbemurwkptlbfmpkny",
  "ur:provenance/lfaegdbseevyrpfesfwpvdhkdraozmgydnwlttsfwscplr",
  "ur:provenance/lfaegdgyemdwoeutynsfjkcleskobtcxnyndcsdlnehglk",
  "ur:provenance/lfaegdpyswpkiettmysgveonuestpsbbfedeaevebbwyhk",
];

// Expected URLs for low resolution marks
const EXPECTED_URLS_LOW = [
  "https://example.com/validate?provenance=tngdgmgwhflfaegdasbdwzyarhjnbyjzytwlmkftuecaemahdpbswmkb",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdgolgrsswfwykynlgkgssluiedwatkbhhetpkgoyl",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdgujedtisgtzmstltotryvanndkverdsblnolzcdw",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdkprkfltijsfhfrfhhpdlhertcwntuezmsfjytaie",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdlptkjyjtvssfctskyakghscwvemtylqzptoydagm",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdsgdifpbewkzejpimhtsbmtkkgsvslerkfnmwsbrd",
  "https://example.com/validate?provenance=tngdgmgwhflfaegduehhryvefhjtiddtselnwssbemurwkptrhktfwsk",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdbseevyrpfesfwpvdhkdraozmgydnwlttbkolsguy",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdgyemdwoeutynsfjkcleskobtcxnyndcswltbrste",
  "https://example.com/validate?provenance=tngdgmgwhflfaegdpyswpkiettmysgveonuestpsbbfedeaecphlamam",
];

// Expected display strings for low resolution marks with info
const EXPECTED_DISPLAY_LOW_WITH_INFO = [
  "ProvenanceMark(baee34c2)",
  "ProvenanceMark(7b80837c)",
  "ProvenanceMark(548fecfb)",
  "ProvenanceMark(f3365320)",
  "ProvenanceMark(bd61dc41)",
  "ProvenanceMark(e7d3f969)",
  "ProvenanceMark(4921b6e9)",
  "ProvenanceMark(f3d069fd)",
  "ProvenanceMark(bc4ca470)",
  "ProvenanceMark(5e798c9a)",
];

// =============================================================================
// Medium resolution with info test vectors from Rust mark.rs
// =============================================================================

const EXPECTED_DISPLAY_MEDIUM_WITH_INFO = [
  "ProvenanceMark(999b6a32)",
  "ProvenanceMark(cefdeacc)",
  "ProvenanceMark(a1cb0985)",
  "ProvenanceMark(f8f50783)",
  "ProvenanceMark(317961c4)",
  "ProvenanceMark(679dce5f)",
  "ProvenanceMark(ce0d6942)",
  "ProvenanceMark(fd0e42a9)",
  "ProvenanceMark(6b3452d4)",
  "ProvenanceMark(87f1c482)",
];

const EXPECTED_DEBUG_MEDIUM_WITH_INFO = [
  `ProvenanceMark(key: 090bf2f8b55be45b, hash: 999b6a32516e7ff8, chainID: 090bf2f8b55be45b, seq: 0, date: 2023-06-20T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 558dbfc6536b2968, hash: cefdeacc3f161286, chainID: 090bf2f8b55be45b, seq: 1, date: 2023-06-21T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 75bb47d085cf746e, hash: a1cb09851a4b0e63, chainID: 090bf2f8b55be45b, seq: 2, date: 2023-06-22T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: ca274110de5cbde4, hash: f8f507836a2944ae, chainID: 090bf2f8b55be45b, seq: 3, date: 2023-06-23T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 0f34e1b651372ca2, hash: 317961c4b69daec5, chainID: 090bf2f8b55be45b, seq: 4, date: 2023-06-24T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: abc6aa642861a61a, hash: 679dce5fc17f6ce0, chainID: 090bf2f8b55be45b, seq: 5, date: 2023-06-25T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 42c751c2012df374, hash: ce0d69422ce2c3dd, chainID: 090bf2f8b55be45b, seq: 6, date: 2023-06-26T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: e6528cad9d939b51, hash: fd0e42a9448fca02, chainID: 090bf2f8b55be45b, seq: 7, date: 2023-06-27T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 5e78dd288b3915f9, hash: 6b3452d45e5e467d, chainID: 090bf2f8b55be45b, seq: 8, date: 2023-06-28T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 7fc7b276b810e4fc, hash: 87f1c4826fbc5d23, chainID: 090bf2f8b55be45b, seq: 9, date: 2023-06-29T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
];

const EXPECTED_BYTEWORDS_MEDIUM_WITH_INFO = [
  "axis bald whiz yoga race help vibe help scar many list undo buzz puma urge hawk cusp liar jugs vial claw into door play slot back back vial join play days open void mint visa help grim peck waxy jowl tuna play onyx yank many fuel brag cash brew girl tiny arch webs very vial lamb safe owls iron onyx fair lamb data flux wall",
  "gyro lung runs skew guru jade diet iris wasp rust body yoga jowl apex drop dark cash navy kept kiln lava real noon frog wasp gems echo wave diet limp tomb vial iris race even aqua bias tiny back good dice puma keys knob jazz foxy hope body gems road real able cost cost dark waxy flux jade bald zoom liar flap chef cyan lava",
  "keep rock fuel taxi limp task jury jolt frog hang gems void saga epic legs curl into brew poem yoga cash warm waxy fizz drop cost flap roof slot glow aqua race kiln peck soap inch waxy fuel flux eyes legs item hawk brag apex mild surf guru junk tomb quad high roof eyes frog pool tomb grim inky undo jowl data road into race",
  "song deli flap blue urge high ruby vibe yawn keno draw yell twin safe ramp rich down runs dark many mint song pose help love note keys inch half solo tuna tied toys into gift deli toys heat gush math kiwi flew wolf lava door eyes zero cusp fact limp leaf brew jade zoom flap knob ugly keep twin omit need oboe item dark cats",
  "bias edge very ramp gray exam draw oboe redo glow tied quad onyx memo scar dull wasp soap many zoom tiny vibe keno fish vast scar many rich blue kiwi drop tent king crux belt dark when glow king flew help diet quiz webs horn junk pool judo down mint waxy cyan keys gear chef keys urge iced each code horn bias exit love yawn",
  "play skew peck idle dice huts oval city cash fizz cola idea task idea road time also tent flap kite rich blue leaf very rich lung yawn holy gift cook undo fish void figs visa quad numb eyes taxi aunt scar guru miss kick vast echo liar atom beta gems zero duty quad memo inch quiz meow jump oboe bald ramp oboe gala fund aunt",
  "flew slot gray saga acid drop wolf jury ruby easy noon luau song kept waxy list kept iced whiz lion fuel down guru back warm back kept city beta fish toys bald vows jugs bald cyan cost zest hard able grim tomb knob wave city loud scar huts twin away heat vows frog main acid void monk foxy puma roof vast tied acid vial brew",
  "visa grim luck poem next menu need gray void nail epic also idle knob king kiwi lion idea undo webs keno join play flap film figs logo help quiz apex peck free limp zoom quiz holy jury undo maze data leaf fuel tomb huts silk keys part liar brew eyes vial fern aunt curl open lava cusp legs part nail vast wolf logo dice away",
  "holy keys unit dice luau eyes buzz yurt zero hard pool city curl tiny dark kiln kiwi work skew when lung fair wolf days toil dark cyan swan whiz stub lion zone draw yoga hawk dull rich swan tuna loud luau jury flew also oval lung axis gush song warm fish knob lava even each main glow girl tuna redo miss soap kiln noon belt",
  "lamb slot purr keno redo blue vibe zest inky whiz drum ugly knob saga tied puff note gala very apex oboe days city trip dark hope memo race zest jowl tiny brag real silk mild trip jugs quiz monk poem hang quiz numb iron what fair noon poem luau taco unit ramp figs twin veto menu wall away solo figs skew kick cola zest apex",
];

const EXPECTED_ID_WORDS_MEDIUM_WITH_INFO = [
  "NAIL NEED ITEM EASY",
  "TACO ZINC WAND SURF",
  "OBEY STUB AXIS LIMP",
  "YOGA YANK AUNT LEGS",
  "EACH KICK HUTS SETS",
  "INTO NEXT TACO HOPE",
  "TACO BELT IRON FLEW",
  "ZINC BETA FLEW PART",
  "JADE EDGE GRIM TINY",
  "LIST WHEN SETS LEAF",
];

const EXPECTED_BYTEMOJI_IDS_MEDIUM_WITH_INFO = [
  "🏰 🎢 🍄 👈",
  "👓 🐟 🦉 👔",
  "🪑 👗 😭 🏁",
  "🪼 🪽 😍 💖",
  "👎 🌜 🥠 ✨",
  "🌱 🏠 👓 🍤",
  "👓 😶 🍁 🍇",
  "🐟 🤨 🍇 🧮",
  "🌹 💪 🥯 🧦",
  "💬 🐞 ✨ 💘",
];

const EXPECTED_URS_MEDIUM_WITH_INFO = [
  "ur:provenance/lfadhdfsasbdwzyarehpvehpsrmyltuobzpauehkcplrjsvlcwiodrpystbkbkvljnpydsonvdmtvahpgmpkwyjltapyoxykmyflbgchbwgltyahwsvyvllbseosinoxfrdttlhffg",
  "ur:provenance/lfadhdfsgolgrsswgujedtiswprtbyyajlaxdpdkchnyktknlarlnnfgwpgseowedtlptbvlisreenaabstybkgddepakskbjzfyhebygsrdrlaectctdkwyfxjebdzmlrchwlendl",
  "ur:provenance/lfadhdfskprkfltilptkjyjtfghggsvdsaeclscliobwpmyachwmwyfzdpctfprfstgwaareknpkspihwyflfxeslsimhkbgaxmdsfgujktbqdhhrfesfgpltbgmiyuojljkgejpcy",
  "ur:provenance/lfadhdfssgdifpbeuehhryveynkodwyltnserprhdnrsdkmymtsgpehpleneksihhfsotatdtsiogtditshtghmhkifwwfladreszocpftlplfbwjezmfpkbuykptnotndwknyehrl",
  "ur:provenance/lfadhdfsbseevyrpgyemdwoerogwtdqdoxmosrdlwpspmyzmtyvekofhvtsrmyrhbekidpttkgcxbtdkwngwkgfwhpdtqzwshnjkpljodnmtwycnksgrcfksueidehcehnhkspnehk",
  "ur:provenance/lfadhdfspyswpkiedehsolcychfzcaiatkiardteaottfpkerhbelfvyrhlgynhygtckuofhvdfsvaqdnbestiatsrgumskkvteolrambagszodyqdmoihqzmwjpoebdrpwkrhhlpd",
  "ur:provenance/lfadhdfsfwstgysaaddpwfjyryeynnlusgktwyltktidwzlnfldngubkwmbkktcybafhtsbdvsjsbdcnctzthdaegmtbkbwecyldsrhstnayhtvsfgmnadvdmkfyparfvtlrwnynrf",
  "ur:provenance/lfadhdfsvagmlkpmntmundgyvdnlecaoiekbkgkilniauowskojnpyfpfmfslohpqzaxpkfelpzmqzhyjyuomedalffltbhsskksptlrbwesvlfnatclonlacplsptnlvtonksfsos",
  "ur:provenance/lfadhdfshyksutdeluesbzytzohdplcycltydkknkiwkswwnlgfrwfdstldkcnsnwzsblnzedwyahkdlrhsntaldlujyfwaoollgasghsgwmfhkblaenehmngwgltaromsnnleluoe",
  "ur:provenance/lfadhdfslbstprkorobeveztiywzdmuykbsatdpfnegavyaxoedscytpdkhemoreztjltybgrlskmdtpjsqzmkpmhgqznbinwtfrnnpmlutoutrpfstnvomuwlaysofsswdlwewlps",
];

const EXPECTED_URLS_MEDIUM_WITH_INFO = [
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfsasbdwzyarehpvehpsrmyltuobzpauehkcplrjsvlcwiodrpystbkbkvljnpydsonvdmtvahpgmpkwyjltapyoxykmyflbgchbwgltyahwsvyvllbseosinoxfrchhhfnzo",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfsgolgrsswgujedtiswprtbyyajlaxdpdkchnyktknlarlnnfgwpgseowedtlptbvlisreenaabstybkgddepakskbjzfyhebygsrdrlaectctdkwyfxjebdzmlrdthnhhmo",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfskprkfltilptkjyjtfghggsvdsaeclscliobwpmyachwmwyfzdpctfprfstgwaareknpkspihwyflfxeslsimhkbgaxmdsfgujktbqdhhrfesfgpltbgmiyuojlgtsrcsos",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfssgdifpbeuehhryveynkodwyltnserprhdnrsdkmymtsgpehpleneksihhfsotatdtsiogtditshtghmhkifwwfladreszocpftlplfbwjezmfpkbuykptnotndsgbwhpbk",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfsbseevyrpgyemdwoerogwtdqdoxmosrdlwpspmyzmtyvekofhvtsrmyrhbekidpttkgcxbtdkwngwkgfwhpdtqzwshnjkpljodnmtwycnksgrcfksueidehcehniofpykve",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfspyswpkiedehsolcychfzcaiatkiardteaottfpkerhbelfvyrhlgynhygtckuofhvdfsvaqdnbestiatsrgumskkvteolrambagszodyqdmoihqzmwjpoebdrpsgdyembz",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfsfwstgysaaddpwfjyryeynnlusgktwyltktidwzlnfldngubkwmbkktcybafhtsbdvsjsbdcnctzthdaegmtbkbwecyldsrhstnayhtvsfgmnadvdmkfyparfvtrdksnsad",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfsvagmlkpmntmundgyvdnlecaoiekbkgkilniauowskojnpyfpfmfslohpqzaxpkfelpzmqzhyjyuomedalffltbhsskksptlrbwesvlfnatclonlacplsptnlvtndwnhgcy",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfshyksutdeluesbzytzohdplcycltydkknkiwkswwnlgfrwfdstldkcnsnwzsblnzedwyahkdlrhsntaldlujyfwaoollgasghsgwmfhkblaenehmngwgltaromsnbaxvyct",
  "https://example.com/validate?provenance=tngdgmgwhflfadhdfslbstprkorobeveztiywzdmuykbsatdpfnegavyaxoedscytpdkhemoreztjltybgrlskmdtpjsqzmkpmhgqznbinwtfrnnpmlutoutrpfstnvomuwlaysofsswbyielsby",
];

// =============================================================================
// Quartile resolution with info test vectors from Rust mark.rs
// =============================================================================

const EXPECTED_DISPLAY_QUARTILE_WITH_INFO = [
  "ProvenanceMark(5bbcccab)",
  "ProvenanceMark(9b1f7fe6)",
  "ProvenanceMark(89272fb4)",
  "ProvenanceMark(363c21c2)",
  "ProvenanceMark(8a9828a8)",
  "ProvenanceMark(50aeeb37)",
  "ProvenanceMark(84e26272)",
  "ProvenanceMark(25c8850f)",
  "ProvenanceMark(9ade9daa)",
  "ProvenanceMark(1c0b6f5e)",
];

const EXPECTED_DEBUG_QUARTILE_WITH_INFO = [
  `ProvenanceMark(key: 090bf2f8b55be45b4661b24b7e9c340c, hash: 5bbcccab578f10c794a2a66fd42abff1, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 0, date: 2023-06-20T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 558dbfc6536b296875bb47d085cf746e, hash: 9b1f7fe61f3f9a2fbfc5f896b5e1bb5c, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 1, date: 2023-06-21T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: ca274110de5cbde40f34e1b651372ca2, hash: 89272fb4945aa03ce0efe8bb7d454773, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 2, date: 2023-06-22T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: abc6aa642861a61a42c751c2012df374, hash: 363c21c2ca486cd34922912670a6c525, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 3, date: 2023-06-23T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: e6528cad9d939b515e78dd288b3915f9, hash: 8a9828a898c97d76e114d00af3bcdc1d, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 4, date: 2023-06-24T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 7fc7b276b810e4fc14a72ac53b5cd9b5, hash: 50aeeb375a05e2f870f302b221972dd2, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 5, date: 2023-06-25T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 445dbfc1264fd6de95b5ca8c060c24ba, hash: 84e2627277ea03eb2384ce167bba24a3, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 6, date: 2023-06-26T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 1dadf8aa6a2b2fa657fc7a0225d1880e, hash: 25c8850f0d4f74aefaea5460f5990317, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 7, date: 2023-06-27T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 5946b5fd32e588c593923750478d74d4, hash: 9ade9daaa70c28c38b6de6b5e93f7174, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 8, date: 2023-06-28T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 469cbdca128f2d85d803e81b3e0e3a7d, hash: 1c0b6f5e7521a6ebd2d2e96adae4df25, chainID: 090bf2f8b55be45b4661b24b7e9c340c, seq: 9, date: 2023-06-29T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
];

const EXPECTED_BYTEWORDS_QUARTILE_WITH_INFO = [
  "axis bald whiz yoga race help vibe help frog huts purr gear knob news edge barn inky jump mild warm warm pose obey ruby very hill yank song frog into maze work days hawk puff huts yurt limp limp mint keep echo free eyes ugly kiwi trip mild menu peck fern fizz item cost rich mild nail omit drum meow sets work zinc edge beta zero draw redo king math real dice onyx cats help iris join oboe nail slot barn news jury fact miss eyes love jury soap surf nail",
  "gyro lung runs skew guru jade diet iris keep rock fuel taxi limp task jury jolt fair puma luau fact lamb days eyes eyes omit ruin lava eyes soap huts fact part many swan slot hang void dark hill vows toys loud very cusp visa tomb love quiz huts guru logo skew exam scar brew jolt work memo task puma ramp zest redo high body trip many body door zest soap idle fish kiln webs kiwi jowl redo roof play warm able gems figs miss back visa silk lava quiz aunt",
  "song deli flap blue urge high ruby vibe bias edge very ramp gray exam draw oboe redo loud lion item yurt lion taxi oval chef crux song quiz need pose rust void rust aunt kiln puff inch mint puff able liar omit kept holy exam navy fund door wave owls ruby work view memo frog road tomb ruin data paid curl king scar axis flew math logo kiln frog jury flap judo omit peck edge pose unit code void puma maze road item ramp unit poem lamb task pose wave dull",
  "play skew peck idle dice huts oval city flew slot gray saga acid drop wolf jury fern tomb hope keys down plus keno able twin claw oval jugs bulb horn taxi twin easy lamb play join main need fizz kiwi wave keys jugs junk song kick cyan task rock road toil ramp diet cusp buzz eyes gear flew plus rock gift logo veto play calm sets yawn taco maze sets tomb owls dark film game item tent game lung ruby tuna blue calm trip help game kite warm luck fish work",
  "visa grim luck poem next menu need gray holy keys unit dice luau eyes buzz yurt zone jazz tomb days purr when main vast work eyes diet kept onyx visa fact iron data iced idea idea knob need gift guru yoga cats help iron leaf puff dark wasp jump zone oval unit main ramp taxi also memo wall even meow open menu hawk into frog inky wand task data surf yank half door grim kiln huts quiz huts item gala scar loud yoga dice webs zero keno gala lung slot lazy",
  "lamb slot purr keno redo blue vibe zest bulb owls door silk fair high tuna race idle main scar gear vast numb urge wasp lamb memo poem into void idle ruin arch onyx safe flew vows warm veto trip city whiz atom purr quad omit frog gush dice apex wall logo hang film webs tent race safe huts flew what love memo omit inky yawn paid puff saga kick fish dull many peck free play nail yawn scar keep idle part into zest wolf calm help fern wolf lung keep kiwi",
  "foxy hill runs safe days glow tomb urge mild race song luck atom barn dark road work foxy meow crux flux back jugs also flew purr liar jugs knob drum monk race surf city iris redo rock zoom solo unit knob news game very curl obey jazz bald king kick arch fern guru kick edge eyes fern pose aqua zone flew jolt jury game monk huts drop vows gyro undo figs king crux luck unit nail zoom blue cats gush vibe yurt omit flew zoom item vibe fern iced diet edge",
  "cola poem yoga peck item down dull oval hang zest kiln also data tent logo beta body yurt mint code jugs scar task oval wolf belt stub hard edge memo cost fish dice apex jugs race puma iris peck even hang frog menu calm memo nail whiz drop unit toil hope crux liar yell what cusp noon aqua work exam trip miss skew easy what free scar rock data body help roof away item king swan keep chef legs purr half kite brag gray lion hope love iris love road list",
  "hawk frog race zinc easy view logo silk menu memo exam good fuel lung jury tiny able kick iced iced free visa down undo time ruin tent jump body kiwi cook saga back back code claw tent film aunt hawk jazz tied dull edge real code data wolf aqua owls work safe vast apex song aqua help eyes news kite drop body bulb when junk diet jolt limp memo onyx girl echo omit crux draw axis whiz door huts edge numb jade real loud ruin saga fish obey wolf race good",
  "frog news ruby song brag many drop limp trip apex vows claw film beta fact kiwi fern ruin luck hard city paid nail grim flux zaps ramp kiwi exam tent free even waxy figs pool cook jade yank cusp solo deli redo surf tied time high door city brew loud real surf warm ugly cats away lamb beta judo diet work monk down vial visa menu also city view help solo real taxi visa flap apex edge help iron cost warm fuel chef free surf fact legs vows judo wall cats",
];

const EXPECTED_ID_WORDS_QUARTILE_WITH_INFO = [
  "HELP ROOF SURF PLAY",
  "NEED COST LAMB VISA",
  "LOUD DELI DULL QUIZ",
  "EVEN FERN CURL SAGA",
  "LOVE MONK DICE PAID",
  "GOOD POOL WARM EXAM",
  "LIAR VETO ICED JUMP",
  "DATA SOAP LIMP BIAS",
  "NAVY URGE NEXT PECK",
  "CODE BALD JOWL HOLY",
];

const EXPECTED_BYTEMOJI_IDS_QUARTILE_WITH_INFO = [
  "🌮 🏆 👔 💎",
  "🎢 🤯 🌐 🐵",
  "🚫 😹 🤝 🎁",
  "🦷 🦶 👹 🎾",
  "🔴 🚦 😻 📌",
  "🧄 ⏳ 🐴 👂",
  "💕 🦁 🍨 💧",
  "👽 👚 🏁 🫥",
  "🎡 🐻 🏠 🔒",
  "😬 🥱 🌸 🍜",
];

const EXPECTED_URS_QUARTILE_WITH_INFO = [
  "ur:provenance/lfaohdhgasbdwzyarehpvehpfghsprgrkbnseebniyjpmdwmwmpeoyryvyhlyksgfgiomewkdshkpfhsytlplpmtkpeofeesuykitpmdmupkfnfzimctrhmdnlotdmmwsswkzceebazodwrokgmhrldeoxcshpisjnoenlstbnnsjyftmseslejolemozs",
  "ur:provenance/lfaohdhggolgrsswgujedtiskprkfltilptkjyjtfrpaluftlbdsesesotrnlaessphsftptmysnsthgvddkhlvstsldvycpvatbleqzhsguloswemsrbwjtwkmotkparpztrohhbytpmybydrztspiefhknwskijlrorfpywmaegsfsmsbkvasesawdie",
  "ur:provenance/lfaohdhgsgdifpbeuehhryvebseevyrpgyemdwoeroldlnimytlntiolcfcxsgqzndpertvdrtatknpfihmtpfaelrotkthyemnyfddrweosrywkvwmofgrdtbrndapdclkgsrasfwmhloknfgjyfpjootpkeepeutcevdpamerdimrputpmlbsbweqdgs",
  "ur:provenance/lfaohdhgpyswpkiedehsolcyfwstgysaaddpwfjyfntbheksdnpskoaetncwoljsbbhntitneylbpyjnmnndfzkiweksjsjksgkkcntkrkrdtlrpdtcpbzesgrfwpsrkgtlovopycmssyntomesstbosdkfmgeimttgelgrytabecmtphpgekewstohsms",
  "ur:provenance/lfaohdhgvagmlkpmntmundgyhyksutdeluesbzytzejztbdsprwnmnvtwkesdtktoxvaftindaidiaiakbndgtguyacshpinlfpfdkwpjpzeolutmnrptiaomowlenmwonmuhkiofgiywdtkdasfykhfdrgmknhsqzhsimgasrldyadewszokogttknlvo",
  "ur:provenance/lfaohdhglbstprkorobeveztbbosdrskfrhhtareiemnsrgrvtnbuewplbmopmiovdiernahoxsefwvswmvotpcywzamprqdotfgghdeaxwllohgfmwsttresehsfwwtlemootiyynpdpfsakkfhdlmypkfepynlynsrkpieptioztwfcmhpfnyltkdnck",
  "ur:provenance/lfaohdhgfyhlrssedsgwtbuemdresglkambndkrdwkfymwcxfxbkjsaofwprlrjskbdmmkresfcyisrorkzmsoutkbnsgevycloyjzbdkgkkahfngukkeeesfnpeaazefwjtjygemkhsdpvsgouofskgcxlkutnlzmbecsghveytotfwzmimveetcxkthg",
  "ur:provenance/lfaohdhgcapmyapkimdndlolhgztknaodattlobabyytmtcejssrtkolwfbtsbhdeemoctfhdeaxjsrepaispkenhgfgmucmmonlwzdputtlhecxlrylwtcpnnaawkemtpmssweywtfesrrkdabyhprfayimkgsnkpcflsprhfkebggylnhelejzspveve",
  "ur:provenance/lfaohdhghkfgrezceyvwloskmumoemgdfllgjytyaekkididfevadnuoternttjpbykicksabkbkcecwttfmathkjztddleerlcedawfaaoswksevtaxsgaahpesnskedpbybbwnjkdtjtlpmooxgleootcxdwaswzdrhseenbjerlldrnsafhonpawmeo",
  "ur:provenance/lfaohdhgfgnsrysgbgmydplptpaxvscwfmbaftkifnrnlkhdcypdnlgmfxzsrpkiemttfeenwyfsplckjeykcpsodirosftdtehhdrcybwldrlsfwmuycsaylbbajodtwkmkdnvlvamuaocyvwhpsorltivafpaxeehpinctwmflcffesfftlswpeyrlkg",
];

const EXPECTED_URLS_QUARTILE_WITH_INFO = [
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgasbdwzyarehpvehpfghsprgrkbnseebniyjpmdwmwmpeoyryvyhlyksgfgiomewkdshkpfhsytlplpmtkpeofeesuykitpmdmupkfnfzimctrhmdnlotdmmwsswkzceebazodwrokgmhrldeoxcshpisjnoenlstbnnsjyftmsesletpjkuykp",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhggolgrsswgujedtiskprkfltilptkjyjtfrpaluftlbdsesesotrnlaessphsftptmysnsthgvddkhlvstsldvycpvatbleqzhsguloswemsrbwjtwkmotkparpztrohhbytpmybydrztspiefhknwskijlrorfpywmaegsfsmsbkvainfrotwm",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgsgdifpbeuehhryvebseevyrpgyemdwoeroldlnimytlntiolcfcxsgqzndpertvdrtatknpfihmtpfaelrotkthyemnyfddrweosrywkvwmofgrdtbrndapdclkgsrasfwmhloknfgjyfpjootpkeepeutcevdpamerdimrputpmlbiabbzssr",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgpyswpkiedehsolcyfwstgysaaddpwfjyfntbheksdnpskoaetncwoljsbbhntitneylbpyjnmnndfzkiweksjsjksgkkcntkrkrdtlrpdtcpbzesgrfwpsrkgtlovopycmssyntomesstbosdkfmgeimttgelgrytabecmtphpgekeflemdecs",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgvagmlkpmntmundgyhyksutdeluesbzytzejztbdsprwnmnvtwkesdtktoxvaftindaidiaiakbndgtguyacshpinlfpfdkwpjpzeolutmnrptiaomowlenmwonmuhkiofgiywdtkdasfykhfdrgmknhsqzhsimgasrldyadewszokovwentijn",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhglbstprkorobeveztbbosdrskfrhhtareiemnsrgrvtnbuewplbmopmiovdiernahoxsefwvswmvotpcywzamprqdotfgghdeaxwllohgfmwsttresehsfwwtlemootiyynpdpfsakkfhdlmypkfepynlynsrkpieptioztwfcmhpfnheenidme",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgfyhlrssedsgwtbuemdresglkambndkrdwkfymwcxfxbkjsaofwprlrjskbdmmkresfcyisrorkzmsoutkbnsgevycloyjzbdkgkkahfngukkeeesfnpeaazefwjtjygemkhsdpvsgouofskgcxlkutnlzmbecsghveytotfwzmimvemhtafmtp",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgcapmyapkimdndlolhgztknaodattlobabyytmtcejssrtkolwfbtsbhdeemoctfhdeaxjsrepaispkenhgfgmucmmonlwzdputtlhecxlrylwtcpnnaawkemtpmssweywtfesrrkdabyhprfayimkgsnkpcflsprhfkebggylnhelessehpmje",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhghkfgrezceyvwloskmumoemgdfllgjytyaekkididfevadnuoternttjpbykicksabkbkcecwttfmathkjztddleerlcedawfaaoswksevtaxsgaahpesnskedpbybbwnjkdtjtlpmooxgleootcxdwaswzdrhseenbjerlldrnsafhbtfdoerf",
  "https://example.com/validate?provenance=tngdgmgwhflfaohdhgfgnsrysgbgmydplptpaxvscwfmbaftkifnrnlkhdcypdnlgmfxzsrpkiemttfeenwyfsplckjeykcpsodirosftdtehhdrcybwldrlsfwmuycsaylbbajodtwkmkdnvlvamuaocyvwhpsorltivafpaxeehpinctwmflcffesfftlsfysbzewk",
];

// =============================================================================
// High resolution with info test vectors from Rust mark.rs
// =============================================================================

const EXPECTED_DISPLAY_HIGH_WITH_INFO = [
  "ProvenanceMark(0c6b0c1b)",
  "ProvenanceMark(f172222a)",
  "ProvenanceMark(6da569b9)",
  "ProvenanceMark(10e6c12f)",
  "ProvenanceMark(6e4641df)",
  "ProvenanceMark(d99c321d)",
  "ProvenanceMark(1af31098)",
  "ProvenanceMark(111904ac)",
  "ProvenanceMark(4cfc564c)",
  "ProvenanceMark(1e5bd360)",
];

const EXPECTED_DEBUG_HIGH_WITH_INFO = [
  `ProvenanceMark(key: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, hash: 0c6b0c1b5456dc960c9030f60474b317eade25621cd2fe5c6e70d5dd235c9480, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 0, date: 2023-06-20T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 558dbfc6536b296875bb47d085cf746eca274110de5cbde40f34e1b651372ca2, hash: f172222a21b23fb87eb3a6f50eda0b7e2c2e1a3d9f7ce9ad37d69049742f53bb, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 1, date: 2023-06-21T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: abc6aa642861a61a42c751c2012df374e6528cad9d939b515e78dd288b3915f9, hash: 6da569b9f34ab28134d1417c4167293ec75bd825e773940208be0e378ab3591a, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 2, date: 2023-06-22T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 7fc7b276b810e4fc14a72ac53b5cd9b5445dbfc1264fd6de95b5ca8c060c24ba, hash: 10e6c12f1d64129ad8decf1e568a4ee974a4e8182673253ca8f657b5619cddee, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 3, date: 2023-06-23T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 1dadf8aa6a2b2fa657fc7a0225d1880e5946b5fd32e588c593923750478d74d4, hash: 6e4641df3c26057c5edff653bdfca67bfdc9a9fe74e6e6a5746af48e4fd78ee2, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 4, date: 2023-06-24T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 469cbdca128f2d85d803e81b3e0e3a7d64f15911e1854210ef5d1b22614a2006, hash: d99c321d11167179a24d4a57351c032c134f03df761b83fc74662b9805450367, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 5, date: 2023-06-25T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 46b5294ba2787ed96dc10f79a3de28885d37a6dc0981dca240e7f1324e94a598, hash: 1af31098e6b27a35c492d5fc0b6106108183627a3d8a97d8eeb1271bbcadbfb4, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 6, date: 2023-06-26T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 2e557fea3bc15ed4de848fc9929ab9b059fa7d30a1436b1fd9a6bc3dd4c08a06, hash: 111904ac8f50db2bd1e482b415562aec37fd7f022618a73593973046ae5007b0, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 7, date: 2023-06-27T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 53a5f76321139ef9f174b27b088a66c4803128e09eb4c3d97ca51f0c369dca63, hash: 4cfc564c0d863a843ddb014681a813e98cc7126985f6958bdc14bf01acc38997, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 8, date: 2023-06-28T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
  `ProvenanceMark(key: 3e095176523550db5ea446af664feab86dba35dbfd168b78e589999b09a702eb, hash: 1e5bd360d448c43b08941028e5154aae2c29d6d3c3bc08869f298465ba77d77a, chainID: 090bf2f8b55be45b4661b24b7e9c340cf9464c5fe95c84f580954aaabe085e7c, seq: 9, date: 2023-06-29T12:00:00Z, info: "Lorem ipsum sit dolor amet.")`,
];

const EXPECTED_BYTEWORDS_HIGH_WITH_INFO = [
  "axis bald whiz yoga race help vibe help frog huts purr gear knob news edge barn yurt frog gems hope wall high liar yank lava mild game peck ruin away holy kite open fizz dark data lava brew gyro curl glow eyes body ramp epic tiny high item join navy solo gala away view acid real ruin open keys body dice stub fair inch yurt hill aunt toil calm task owls pool swan legs cusp plus edge iron tied lamb grim leaf keno stub code easy deli safe iron hard gems jolt flap days runs hawk hang bald menu draw curl noon jolt game legs void solo lazy zone unit judo limp yoga luck kick numb undo oboe code edge zone yank time note surf king blue waxy exit item gear holy zest good good pool wasp tomb huts",
  "gyro lung runs skew guru jade diet iris keep rock fuel taxi limp task jury jolt song deli flap blue urge high ruby vibe bias edge very ramp gray exam draw oboe huts free huts loud arch good saga news foxy whiz kiln jump foxy tiny belt guru vial zone wall gear lava puma liar veto luau puma pose holy oboe real part twin owls bald tent lazy peck lung leaf gush judo kiwi hill arch song list exit jazz yoga zaps saga love rich quad onyx deli keno vibe jade open nail rich slot vast lava good kite task taxi meow hang next cook taco guru user unit cook lava quiz mild keys sets high keys drum also item city duty zaps purr navy game poem quiz soap webs race hawk bias holy monk hard city logo ugly",
  "play skew peck idle dice huts oval city flew slot gray saga acid drop wolf jury visa grim luck poem next menu need gray holy keys unit dice luau eyes buzz yurt runs liar news puma play yoga limp echo cusp fuel echo blue dark surf tuna glow jury epic zest easy ramp also half quiz play kiwi epic gyro vast fuel work mint foxy free memo taxi what nail quiz paid duty stub peck tiny kick down cash song numb join hill glow tied user days cusp dull unit zone pose zone cusp zinc pose sets kick days quad puma waxy omit twin gems time need stub real join mild luau cola toil eyes down zone stub view slot oboe fizz acid kite into open lamb ruby hard wall toys obey loud drum main paid gush view next",
  "lamb slot purr keno redo blue vibe zest bulb owls door silk fair high tuna race foxy hill runs safe days glow tomb urge mild race song luck atom barn dark road blue webs noon work flap keep holy days eyes exam axis cats part race iris sets nail quiz stub tied main back zest void inky drum race gray when roof taxi many guru flew nail diet iris inch dice quad axis junk silk task cyan main fizz maze legs easy yank beta lazy into luau good kiwi when inky keno buzz data echo undo warm idea warm surf stub jazz quad kiwi help race chef yurt back item lava acid stub judo surf figs door navy lion gush race deli gems zest very main beta owls cola tent poem into real grim cats gala road fizz inky",
  "cola poem yoga peck item down dull oval hang zest kiln also data tent logo beta hawk frog race zinc easy view logo silk menu memo exam good fuel lung jury tiny zaps gyro yawn game when foxy hang luck skew omit crux data duty very taco dull pose zoom keys keys zero monk cook part knob ramp omit lazy game nail song part knob undo yank crux fern yurt very vial next gush nail kick legs atom love edge visa iris roof vial rust yurt taxi redo liar junk lazy exam curl toil noon jowl memo taco stub jury tied trip vibe when loud many holy puma join peck dull brew barn very dull list curl road deli film fair obey heat toil game fair safe ugly fund vial math aqua kick toil twin cola gear high work",
  "frog news ruby song brag many drop limp trip apex vows claw film beta fact kiwi idle when hawk body very limp flew blue webs hill claw cusp huts game crux atom gear vast lava bald taxi glow kept flew frog girl webs lamb webs what pool road stub trip away dull math visa jump race zinc next bias junk dice lion sets cyan rock easy pose dark slot zoom swan open unit memo yank maze yoga real flap rust saga code kiln girl luck slot lamb love next down also twin claw numb girl jowl fern huts wall door scar deli kiwi dark body wall zinc kiwi hill fact fair dice edge grim cola oboe taxi edge lion flew tuna knob days zoom claw knob flap solo down free when ramp road miss zaps memo jazz diet twin",
  "frog race diet gear oboe keys knob tuna join safe bias kick omit urge dice logo hill exam oval undo axis lazy undo oboe fizz void when easy girl meow open monk drop vibe game swan taco gear user slot memo item arch brag each junk kiln monk rock good news zero open flux dice song vial kite paid flew chef dark tent gift wolf cash list navy real kept nail owls tied door toil user legs door tuna work zero also kick tomb puff crux stub foxy idle obey legs open very zone heat tomb claw guru drum help loud yank taxi many race gift puff hang girl whiz lung skew flap huts fact vial main each city ramp poem fuel grim rock twin calm able cats easy keno sets open aqua peck cost belt cola quad jazz",
  "drum gyro lamb wand fair safe holy tiny urge liar many solo memo navy rich puff hawk zaps kiwi duty obey flux jade cost tuna oval roof figs tiny rust love atom nail edge bias cola zoom yurt menu iron door gyro judo next memo easy cost kiln data vows zoom belt what jazz into jury fund ramp tent foxy kiln cash purr obey blue list main knob yawn poem obey tied iced kick ruin cusp quad iris blue foxy hawk down city memo wall next exit even cola many song bulb item toys undo fact gyro taxi mild grim jugs main holy numb zest holy pool film keys arch inky play zero foxy cyan main lazy diet data good gems huts monk kept kiln void into void buzz rich tiny cola jade exam luck soap jowl cash iris",
  "guru open yell idea curl brew noon yurt when jury purr king away love inky sets lava each dice vast noon quiz scar tuna kite open cost barn even next song idea view mint gush wall hard kiwi help hard navy aqua swan toil draw play song drop miss road rock gush high vows part toys surf eyes ramp exam surf jury many zone scar ruin menu mint zinc oval vial meow keno many jazz vows acid bald deli gyro skew dull brew vast race wave quad tuna real also drum down down lazy hope blue help safe loud zone obey webs idea fact waxy peck fizz yank main legs atom kept data time vast pool fish lung silk jazz vows scar edge obey good math oboe code user draw gear tomb flux main next kick silk main yank",
  "film axis gray keno grim epic good ugly holy onyx frog pose inky glow wand redo join road epic ugly zinc calm luau keys view loud nail need axis owls also warm gems belt claw lion apex need very acid puma kick eyes menu jolt silk owls able ruby lazy epic dark cook glow oboe judo limp buzz brew deli yell able hard city saga cook ramp need open diet keep junk chef lazy tent surf also gray claw guru crux jowl meow visa oboe acid fuel skew flap wave dice judo idea zest city view oboe tent drum wave claw jazz dark quad peck body silk back puff jugs exit down wall user duty gems luck unit pose cost wasp dice swan epic lamb half miss idea chef luck ugly ramp unit soap tent rust taco iced maze",
];

const EXPECTED_ID_WORDS_HIGH_WITH_INFO = [
  "BARN JADE BARN CLAW",
  "WHEN JUMP CUSP DOOR",
  "JOIN OPEN IRON RICH",
  "BLUE VISA SAFE DULL",
  "JOLT FROG FLAP USER",
  "TUNA NEWS EASY COLA",
  "CITY WOLF BLUE MONK",
  "BODY CHEF AQUA PLUS",
  "GEMS ZEST HALF GEMS",
  "COOK HELP TIME HORN",
];

const EXPECTED_BYTEMOJI_IDS_HIGH_WITH_INFO = [
  "🤩 🌹 🤩 🥺",
  "🐞 💧 👺 🙀",
  "🌼 📫 🍁 🫖",
  "🥵 🐵 🏈 🤝",
  "🌻 🍑 🍉 🐼",
  "🐶 🎠 👈 🤑",
  "🥳 🐺 🥵 🚦",
  "🥶 🤡 🙄 📷",
  "🍅 🦭 🍗 🍅",
  "🙃 🌮 👟 🍚",
];

const EXPECTED_URS_HIGH_WITH_INFO = [
  "ur:provenance/lfaxhdltasbdwzyarehpvehpfghsprgrkbnseebnytfggshewlhhlryklamdgepkrnayhykeonfzdkdalabwgoclgwesbyrpectyhhimjnnysogaayvwadrlrnonksbydesbfrihythlattlcmtkosplsnlscppseeintdlbgmlfkosbceeydiseinhdgsjtfpdsrshkhgbdmudwclnnjtgelsvdsolyzeutjolpyalkkknbuooeceeezeyktenesfkgbewyetimgrhyztgdgdmsemvdah",
  "ur:provenance/lfaxhdltgolgrsswgujedtiskprkfltilptkjyjtsgdifpbeuehhryvebseevyrpgyemdwoehsfehsldahgdsansfywzknjpfytybtguvlzewlgrlapalrvolupapehyoerlpttnosbdttlypklglfghjokihlahsgltetjzyazssalerhqdoxdikovejeonnlrhstvtlagdketktimwhgntcktoguurutcklaqzmdkssshhksdmaoimcydyzsprnygepmqzspwsrehkbshymkhsserhrs",
  "ur:provenance/lfaxhdltpyswpkiedehsolcyfwstgysaaddpwfjyvagmlkpmntmundgyhyksutdeluesbzytrslrnspapyyalpeocpfleobedksftagwjyeczteyrpaohfqzpykiecgovtflwkmtfyfemotiwtnlqzpddysbpktykkdnchsgnbjnhlgwtdurdscpdlutzepezecpzcpesskkdsqdpawyottngstendsbrljnmdlucatlesdnzesbvwstoefzadkeioonlbryhdwltsoylddmmnmemytyyt",
  "ur:provenance/lfaxhdltlbstprkorobeveztbbosdrskfrhhtarefyhlrssedsgwtbuemdresglkambndkrdbewsnnwkfpkphydsesemascsptreisssnlqzsbtdmnbkztvdiydmregywnrftimygufwnldtisihdeqdasjksktkcnmnfzmelseyykbalyiolugdkiwniykobzdaeouowmiawmsfsbjzqdkihprecfytbkimlaadsbjosffsdrnylnghredigsztvymnbaoscattpmiorlgmcsjohsjsao",
  "ur:provenance/lfaxhdltcapmyapkimdndlolhgztknaodattlobahkfgrezceyvwloskmumoemgdfllgjytyzsgoyngewnfyhglkswotcxdadyvytodlpezmkskszomkckptkbrpotlygenlsgptkbuoykcxfnytvyvlntghnlkklsamleeevaisrfvlrtyttirolrjklyemcltlnnjlmotosbjytdtpvewnldmyhypajnpkdlbwbnvydlltclrddifmfroyhttlgefrseuyfdvlmhaakktltndkmhjnmh",
  "ur:provenance/lfaxhdltfgnsrysgbgmydplptpaxvscwfmbaftkiiewnhkbyvylpfwbewshlcwcphsgecxamgrvtlabdtigwktfwfgglwslbwswtplrdsbtpaydlmhvajprezcntbsjkdelnsscnrkeypedkstzmsnonutmoykmeyarlfprtsacekngllkstlblentdnaotncwnbgljlfnhswldrsrdikidkbywlzckihlftfrdeeegmcaoetieelnfwtakbdszmcwkbfpsodnfewnrprdmszspyrlcsrn",
  "ur:provenance/lfaxhdltfgredtgroekskbtajnsebskkotuedelohlemoluoaslyuooefzvdwneyglmwonmkdpvegesntogrurstmoimahbgehjkknmkrkgdnszoonfxdesgvlkepdfwcfdkttgtwfchltnyrlktnlostddrtlurlsdrtawkzoaokktbpfcxsbfyieoylsonvyzehttbcwgudmhpldyktimyregtpfhgglwzlgswfphsftvlmnehcyrppmflgmrktncmaecseykossonaapkcteeswlfay",
  "ur:provenance/lfaxhdltdmgolbwdfrsehytyuelrmysomonyrhpfhkzskidyoyfxjecttaolrffstyrtleamnleebscazmytmuindrgojontmoeyctkndavszmbtwtjziojyfdrpttfyknchproybeltmnkbynpmoytdidkkrncpqdisbefyhkdncymowlntetencamysgbbimtsuoftgotimdgmjsmnhynbzthyplfmksahiypyzofycnmnlydtdagdgshsmkktknvdiovdbzrhtycajeemlkwnqzdsbn",
  "ur:provenance/lfaxhdltguonyliaclbwnnytwnjyprkgayleiysslaehdevtnnqzsrtakeonctbnenntsgiavwmtghwlhdkihphdnyaasntldwpysgdpmsrdrkghhhvspttssfesrpemsfjymyzesrrnmumtzcolvlmwkomyjzvsadbddigoswdlbwvtreweqdtarlaodmdndnlyhebehpseldzeoywsiaftwypkfzykmnlsamktdatevtplfhlgskjzvssreeoygdmhoeceurdwgrtbfxmnntfzckrsme",
  "ur:provenance/lfaxhdltfmasgykogmecgduyhyoxfgpeiygwwdrojnrdecuyzccmluksvwldnlndasosaowmgsbtcwlnaxndvyadpakkesmujtskosaerylyecdkckgwoejolpbzbwdiylaehdcysackrpndondtkpjkcflyttsfaogycwgucxjlmwvaoeadflswfpwedejoiaztcyvwoettdmwecwjzdkqdpkbyskbkpfjsetdnwlurdygslkutpectwpdesneclbhfmsiacflkuyrputspttytbzguyk",
];

const EXPECTED_URLS_HIGH_WITH_INFO = [
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltasbdwzyarehpvehpfghsprgrkbnseebnytfggshewlhhlryklamdgepkrnayhykeonfzdkdalabwgoclgwesbyrpectyhhimjnnysogaayvwadrlrnonksbydesbfrihythlattlcmtkosplsnlscppseeintdlbgmlfkosbceeydiseinhdgsjtfpdsrshkhgbdmudwclnnjtgelsvdsolyzeutjolpyalkkknbuooeceeezeyktenesfkgbewyetimgrhyztgdgdlrpdstbg",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltgolgrsswgujedtiskprkfltilptkjyjtsgdifpbeuehhryvebseevyrpgyemdwoehsfehsldahgdsansfywzknjpfytybtguvlzewlgrlapalrvolupapehyoerlpttnosbdttlypklglfghjokihlahsgltetjzyazssalerhqdoxdikovejeonnlrhstvtlagdketktimwhgntcktoguurutcklaqzmdkssshhksdmaoimcydyzsprnygepmqzspwsrehkbshymkjphynlpd",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltpyswpkiedehsolcyfwstgysaaddpwfjyvagmlkpmntmundgyhyksutdeluesbzytrslrnspapyyalpeocpfleobedksftagwjyeczteyrpaohfqzpykiecgovtflwkmtfyfemotiwtnlqzpddysbpktykkdnchsgnbjnhlgwtdurdscpdlutzepezecpzcpesskkdsqdpawyottngstendsbrljnmdlucatlesdnzesbvwstoefzadkeioonlbryhdwltsoylddmmnlfbewkwy",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltlbstprkorobeveztbbosdrskfrhhtarefyhlrssedsgwtbuemdresglkambndkrdbewsnnwkfpkphydsesemascsptreisssnlqzsbtdmnbkztvdiydmregywnrftimygufwnldtisihdeqdasjksktkcnmnfzmelseyykbalyiolugdkiwniykobzdaeouowmiawmsfsbjzqdkihprecfytbkimlaadsbjosffsdrnylnghredigsztvymnbaoscattpmiorlgmcsiazegybz",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltcapmyapkimdndlolhgztknaodattlobahkfgrezceyvwloskmumoemgdfllgjytyzsgoyngewnfyhglkswotcxdadyvytodlpezmkskszomkckptkbrpotlygenlsgptkbuoykcxfnytvyvlntghnlkklsamleeevaisrfvlrtyttirolrjklyemcltlnnjlmotosbjytdtpvewnldmyhypajnpkdlbwbnvydlltclrddifmfroyhttlgefrseuyfdvlmhaakktltnembsgtlt",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltfgnsrysgbgmydplptpaxvscwfmbaftkiiewnhkbyvylpfwbewshlcwcphsgecxamgrvtlabdtigwktfwfgglwslbwswtplrdsbtpaydlmhvajprezcntbsjkdelnsscnrkeypedkstzmsnonutmoykmeyarlfprtsacekngllkstlblentdnaotncwnbgljlfnhswldrsrdikidkbywlzckihlftfrdeeegmcaoetieelnfwtakbdszmcwkbfpsodnfewnrprdmszsrodeetpt",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltfgredtgroekskbtajnsebskkotuedelohlemoluoaslyuooefzvdwneyglmwonmkdpvegesntogrurstmoimahbgehjkknmkrkgdnszoonfxdesgvlkepdfwcfdkttgtwfchltnyrlktnlostddrtlurlsdrtawkzoaokktbpfcxsbfyieoylsonvyzehttbcwgudmhpldyktimyregtpfhgglwzlgswfphsftvlmnehcyrppmflgmrktncmaecseykossonaapkctdihkoect",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltdmgolbwdfrsehytyuelrmysomonyrhpfhkzskidyoyfxjecttaolrffstyrtleamnleebscazmytmuindrgojontmoeyctkndavszmbtwtjziojyfdrpttfyknchproybeltmnkbynpmoytdidkkrncpqdisbefyhkdncymowlntetencamysgbbimtsuoftgotimdgmjsmnhynbzthyplfmksahiypyzofycnmnlydtdagdgshsmkktknvdiovdbzrhtycajeemlkvodnamcw",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltguonyliaclbwnnytwnjyprkgayleiysslaehdevtnnqzsrtakeonctbnenntsgiavwmtghwlhdkihphdnyaasntldwpysgdpmsrdrkghhhvspttssfesrpemsfjymyzesrrnmumtzcolvlmwkomyjzvsadbddigoswdlbwvtreweqdtarlaodmdndnlyhebehpseldzeoywsiaftwypkfzykmnlsamktdatevtplfhlgskjzvssreeoygdmhoeceurdwgrtbfxmnntgulyneln",
  "https://example.com/validate?provenance=tngdgmgwhflfaxhdltfmasgykogmecgduyhyoxfgpeiygwwdrojnrdecuyzccmluksvwldnlndasosaowmgsbtcwlnaxndvyadpakkesmujtskosaerylyecdkckgwoejolpbzbwdiylaehdcysackrpndondtkpjkcflyttsfaogycwgucxjlmwvaoeadflswfpwedejoiaztcyvwoettdmwecwjzdkqdpkbyskbkpfjsetdnwlurdygslkutpectwpdesneclbhfmsiacflkuyrputspttwdlejkvo",
];

describe("ProvenanceMark", () => {
  describe("Low resolution", () => {
    it("should generate expected marks with passphrase 'Wolf'", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const dates = Array.from(
        { length: 10 },
        (_, i) => new Date(Date.UTC(2023, 5, 20 + i, 0, 0, 0, 0)),
      );

      let currentGenerator = generator;
      const marks: ProvenanceMark[] = [];

      for (const date of dates) {
        // Serialize and deserialize generator to test persistence
        const json = JSON.stringify(currentGenerator.toJSON());
        currentGenerator = ProvenanceMarkGenerator.fromJSON(JSON.parse(json));

        const mark = currentGenerator.next(date);
        marks.push(mark);
      }

      // Test expected identifiers
      const expectedIds = [
        "5bdcec81",
        "477e3ce6",
        "3e5da986",
        "41c525a1",
        "8095afb4",
        "3bcacc8d",
        "41486af2",
        "5fa35da9",
        "e369288f",
        "7ce8f8bc",
      ];

      expect(marks.map((m) => m.identifier())).toEqual(expectedIds);

      // Verify sequence is valid
      expect(ProvenanceMark.isSequenceValid(marks)).toBe(true);

      // Verify marks don't work in reverse
      expect(marks[1].precedes(marks[0])).toBe(false);
    });

    it("should serialize and deserialize via bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const bytewords = mark.toBytewords();
      const restored = ProvenanceMark.fromBytewords(ProvenanceMarkResolution.Low, bytewords);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should serialize and deserialize via CBOR", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const cborData = mark.toCborData();
      const restored = ProvenanceMark.fromCborData(cborData);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should serialize and deserialize via URL encoding", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const urlEncoding = mark.toUrlEncoding();
      const restored = ProvenanceMark.fromUrlEncoding(urlEncoding);

      expect(mark.equals(restored)).toBe(true);
    });

    it("should build and parse URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const url = mark.toUrl("https://example.com/validate");
      const restored = ProvenanceMark.fromUrl(url);

      expect(mark.equals(restored)).toBe(true);
    });
  });

  describe("Medium resolution", () => {
    it("should generate expected marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Medium resolution has 8-byte links
      expect(mark.key().length).toBe(8);
      expect(mark.hash().length).toBe(8);
      expect(mark.chainId().length).toBe(8);
    });
  });

  describe("Quartile resolution", () => {
    it("should generate expected marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // Quartile resolution has 16-byte links
      expect(mark.key().length).toBe(16);
      expect(mark.hash().length).toBe(16);
      expect(mark.chainId().length).toBe(16);
    });
  });

  describe("High resolution", () => {
    it("should generate expected marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark = generator.next(date);

      // High resolution has 32-byte links
      expect(mark.key().length).toBe(32);
      expect(mark.hash().length).toBe(32);
      expect(mark.chainId().length).toBe(32);
    });
  });

  describe("Genesis mark", () => {
    it("should correctly identify genesis marks", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const genesisMark = generator.next(date);

      expect(genesisMark.isGenesis()).toBe(true);
      expect(genesisMark.seq()).toBe(0);

      // Key should equal chain ID for genesis mark
      expect(genesisMark.key()).toEqual(genesisMark.chainId());

      // Second mark should not be genesis
      const secondMark = generator.next(new Date(Date.UTC(2023, 5, 21)));
      expect(secondMark.isGenesis()).toBe(false);
      expect(secondMark.seq()).toBe(1);
    });
  });

  describe("JSON serialization", () => {
    it("should serialize and deserialize via JSON", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const date = new Date(Date.UTC(2023, 5, 20, 0, 0, 0, 0));
      const mark = generator.next(date);

      const json = mark.toJSON();
      const restored = ProvenanceMark.fromJSON(json);

      expect(mark.identifier()).toEqual(restored.identifier());
      expect(mark.seq()).toEqual(restored.seq());
    });
  });

  // ===========================================================================
  // Rust Parity Tests (test vectors from mark.rs)
  // ===========================================================================

  describe("test_low (Rust parity)", () => {
    it("should match Rust expected display strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify display strings
      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_LOW);
    });

    it("should match Rust expected bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify bytewords encoding
      expect(marks.map((m) => m.toBytewords())).toEqual(EXPECTED_BYTEWORDS_LOW);

      // Verify roundtrip
      for (let i = 0; i < marks.length; i++) {
        const restored = ProvenanceMark.fromBytewords(
          ProvenanceMarkResolution.Low,
          EXPECTED_BYTEWORDS_LOW[i],
        );
        expect(marks[i].equals(restored)).toBe(true);
      }
    });

    it("should match Rust expected bytewords identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify bytewords identifiers
      expect(marks.map((m) => m.bytewordsIdentifier(false))).toEqual(EXPECTED_ID_WORDS_LOW);
    });

    it("should match Rust expected bytemoji identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify bytemoji identifiers
      expect(marks.map((m) => m.bytemojiIdentifier(false))).toEqual(EXPECTED_BYTEMOJI_IDS_LOW);
    });

    it("should match Rust expected UR strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      // Verify UR strings
      expect(marks.map((m) => m.urString())).toEqual(EXPECTED_URS_LOW);

      // Verify roundtrip
      for (let i = 0; i < marks.length; i++) {
        const restored = ProvenanceMark.fromURString(EXPECTED_URS_LOW[i]);
        expect(marks[i].equals(restored)).toBe(true);
      }
    });

    it("should match Rust expected URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date));
      }

      const baseUrl = "https://example.com/validate";

      // Verify URLs (toUrl returns URL object, convert to string for comparison)
      expect(marks.map((m) => m.toUrl(baseUrl).toString())).toEqual(EXPECTED_URLS_LOW);

      // Verify roundtrip
      for (let i = 0; i < marks.length; i++) {
        const restored = ProvenanceMark.fromUrl(new URL(EXPECTED_URLS_LOW[i]));
        expect(marks[i].equals(restored)).toBe(true);
      }
    });
  });

  describe("test_low_with_info (Rust parity)", () => {
    it("should match Rust expected display strings with info", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      // Verify display strings
      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_LOW_WITH_INFO);

      // Verify sequence is valid
      expect(ProvenanceMark.isSequenceValid(marks)).toBe(true);
    });
  });

  describe("Seed serialization (Rust parity)", () => {
    it("should serialize and deserialize seed via JSON", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Low,
        "Wolf",
      );

      // Serialize generator state
      const json = JSON.stringify(generator.toJSON());

      // Deserialize
      const restored = ProvenanceMarkGenerator.fromJSON(JSON.parse(json));

      // Generate a mark from each and compare
      const date = new Date(Date.UTC(2023, 5, 20, 12, 0, 0, 0));
      const mark1 = generator.next(date);
      const mark2 = restored.next(date);

      expect(mark1.identifier()).toEqual(mark2.identifier());
    });
  });

  describe("test_medium_with_info (Rust parity)", () => {
    it("should match Rust expected display strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_MEDIUM_WITH_INFO);
    });

    it("should match Rust expected debug strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toDebugString())).toEqual(EXPECTED_DEBUG_MEDIUM_WITH_INFO);
    });

    it("should match Rust expected bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toBytewords())).toEqual(EXPECTED_BYTEWORDS_MEDIUM_WITH_INFO);
    });

    it("should match Rust expected bytewords identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.bytewordsIdentifier(false))).toEqual(EXPECTED_ID_WORDS_MEDIUM_WITH_INFO);
    });

    it("should match Rust expected bytemoji identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.bytemojiIdentifier(false))).toEqual(EXPECTED_BYTEMOJI_IDS_MEDIUM_WITH_INFO);
    });

    it("should match Rust expected UR strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.urString())).toEqual(EXPECTED_URS_MEDIUM_WITH_INFO);
    });

    it("should match Rust expected URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Medium,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      const baseUrl = "https://example.com/validate";
      expect(marks.map((m) => m.toUrl(baseUrl).toString())).toEqual(EXPECTED_URLS_MEDIUM_WITH_INFO);
    });
  });

  describe("test_quartile_with_info (Rust parity)", () => {
    it("should match Rust expected display strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_QUARTILE_WITH_INFO);
    });

    it("should match Rust expected debug strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toDebugString())).toEqual(EXPECTED_DEBUG_QUARTILE_WITH_INFO);
    });

    it("should match Rust expected bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toBytewords())).toEqual(EXPECTED_BYTEWORDS_QUARTILE_WITH_INFO);
    });

    it("should match Rust expected bytewords identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.bytewordsIdentifier(false))).toEqual(EXPECTED_ID_WORDS_QUARTILE_WITH_INFO);
    });

    it("should match Rust expected bytemoji identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.bytemojiIdentifier(false))).toEqual(EXPECTED_BYTEMOJI_IDS_QUARTILE_WITH_INFO);
    });

    it("should match Rust expected UR strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.urString())).toEqual(EXPECTED_URS_QUARTILE_WITH_INFO);
    });

    it("should match Rust expected URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.Quartile,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      const baseUrl = "https://example.com/validate";
      expect(marks.map((m) => m.toUrl(baseUrl).toString())).toEqual(EXPECTED_URLS_QUARTILE_WITH_INFO);
    });
  });

  describe("test_high_with_info (Rust parity)", () => {
    it("should match Rust expected display strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toString())).toEqual(EXPECTED_DISPLAY_HIGH_WITH_INFO);
    });

    it("should match Rust expected debug strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toDebugString())).toEqual(EXPECTED_DEBUG_HIGH_WITH_INFO);
    });

    it("should match Rust expected bytewords", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.toBytewords())).toEqual(EXPECTED_BYTEWORDS_HIGH_WITH_INFO);
    });

    it("should match Rust expected bytewords identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.bytewordsIdentifier(false))).toEqual(EXPECTED_ID_WORDS_HIGH_WITH_INFO);
    });

    it("should match Rust expected bytemoji identifiers", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.bytemojiIdentifier(false))).toEqual(EXPECTED_BYTEMOJI_IDS_HIGH_WITH_INFO);
    });

    it("should match Rust expected UR strings", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      expect(marks.map((m) => m.urString())).toEqual(EXPECTED_URS_HIGH_WITH_INFO);
    });

    it("should match Rust expected URLs", () => {
      const generator = ProvenanceMarkGenerator.newWithPassphrase(
        ProvenanceMarkResolution.High,
        "Wolf",
      );

      const marks: ProvenanceMark[] = [];
      for (let i = 0; i < 10; i++) {
        const date = new Date(Date.UTC(2023, 5, 20 + i, 12, 0, 0, 0));
        marks.push(generator.next(date, cbor("Lorem ipsum sit dolor amet.")));
      }

      const baseUrl = "https://example.com/validate";
      expect(marks.map((m) => m.toUrl(baseUrl).toString())).toEqual(EXPECTED_URLS_HIGH_WITH_INFO);
    });
  });
});
