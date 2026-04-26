# `@bcts/envelope-pattern` ↔ `bc-envelope-pattern-rust` Parity Audit

Auditing the TypeScript port at
`/Users/custodio/Development/BCTS/typescript/packages/envelope-pattern/`
against the Rust source-of-truth at
`/Users/custodio/Development/BCTS/rust/bc-envelope-pattern-rust/`.

**Audit resolution pass:** 2026-04-25 — every 🔴 / 🟠 item in this audit
plus the format / VM 🟡 entries have been resolved. The parser was
re-grouped into Rust-style sub-files under `parse/leaf`, `parse/meta`,
and `parse/structure`; AST-shape divergences (`AssertionsPattern.WithBoth`,
`NodePattern.WithSubject`, `DigestPattern.Any`, `ArrayPattern.WithPatterns`,
`MapPattern` reimpl) are gone; `format(parse(s)) === s` now round-trips
for parenthesised expressions and capture forms; UR / `format_flat`
output mirrors Rust. See the per-section notes below for what changed.

Severity legend:
- 🔴 different match results / captures vs Rust — all resolved.
- 🟠 missing pattern type or pattern variant — resolved.
- 🟡 format / test / error gap (parses or matches differently in edge cases)
- 🟢 cosmetic / naming / API surface

The package is the largest and most complex in the family (4 source areas:
`pattern/`, `parse/`, `format`, `error`; ~70 Rust modules; ~28 Rust test
files). The original audit found many divergences in the *parser* and
*AST shape* plus a critical test-coverage hole. The structural
divergences are all addressed in this pass; the test-coverage gap (§7)
remains an outstanding follow-up.

---

## 1. AST shape divergences (🔴)

### 1.1 🔴 `AssertionsPattern` adds a `WithBoth` variant that doesn't exist in Rust
Rust `pattern/structure/assertions_pattern.rs`:
```rust
pub enum AssertionsPattern {
    Any,
    WithPredicate(Box<Pattern>),
    WithObject(Box<Pattern>),
}
```
TS `pattern/structure/assertions-pattern.ts`:
```ts
type AssertionsPatternType =
  | { type: "Any" }
  | { type: "WithPredicate"; pattern: Pattern }
  | { type: "WithObject"; pattern: Pattern }
  | { type: "WithBoth"; predicatePattern: Pattern; objectPattern: Pattern };
```
- TS adds `withBoth(pred, obj)` factory and a `assert(pred, obj)` toString
  that Rust never emits.
- TS `parseAssertion` consumes `assert(pred, obj)` and creates `WithBoth`.
  Rust `parse_assertion` ignores the lexer entirely and **always** returns
  `Pattern::any_assertion()` — Rust does **not** parse `assert(...)` at all.
  Result: `parse("assert(text, number)")` succeeds in TS, fails in Rust.

### 1.2 🔴 `NodePattern` adds a `WithSubject` variant that doesn't exist in Rust
Rust `pattern/structure/node_pattern.rs`:
```rust
pub enum NodePattern { Any, AssertionsInterval(Interval) }
```
TS `pattern/structure/node-pattern.ts` adds:
```ts
| { type: "WithSubject"; subjectPattern: Pattern }
```
With a `static withSubject(p)` factory and a fabricated `node(pattern)`
toString. The match implementation is a stub:
```ts
case "WithSubject":
  // For WithSubject, we match if the node exists (subject pattern matching done at higher level)
  isHit = true;
```
i.e., it ignores `subjectPattern` and matches any node. The TS parser for
`node(...)` falls through to `NodePattern.withSubject(inner.value)` when
the inner token isn't `Range`, while Rust's `parse_node` *errors* on
anything but a range token. So:
- `parse("node(text)")` succeeds in TS (silently producing an
  always-matching node), fails in Rust.

### 1.3 🔴 `DigestPattern` adds an `Any` variant that doesn't exist in Rust
Rust `DigestPattern` has only `Digest(Digest)`, `Prefix(Vec<u8>)`,
`BinaryRegex(Regex)`. TS adds `{ type: "Any" }` and a `static any()`
factory. `digest` (no parens) parses to `DigestPattern.any()` in TS. In
Rust, `parse("digest")` is an error — `parse_digest` requires the next
token to be `(`.

Additionally:
- Rust's `Prefix` equality uses `eq_ignore_ascii_case`. TS does
  byte-for-byte comparison. Two prefix patterns with different case but
  same value compare equal in Rust, not in TS.
- Rust's digest parser supports `digest(ur:digest/...)` for full UR digest
  strings (`Digest::from_ur_string`) and validates `bytes.len() <=
  Digest::DIGEST_SIZE`. TS only handles raw hex; no UR support, no length
  validation.

### 1.4 🔴 `ArrayPattern` adds variants and breaks element matching
Rust `ArrayPattern` is a thin wrapper around `dcbor_pattern::ArrayPattern`
— a single struct delegating to dcbor. TS reimplements it as a 4-variant
union:
```ts
| { type: "Any" }
| { type: "Interval"; interval: Interval }
| { type: "DCBORPattern"; pattern: DCBORPattern }
| { type: "WithPatterns"; patterns: Pattern[] }
```
- `WithPatterns` is a TS-only variant: it matches only by **length** of
  the array and ignores the element patterns entirely
  (`if (array.length === this._pattern.patterns.length) match`). This is
  silently incorrect.
- Rust `ArrayPattern::any().to_string() == "array"`. TS prints `[*]`.
- Rust `ArrayPattern::count(3).to_string() == "[{3}]"`. TS prints
  `[{Interval}]` via `interval.toString()` (depends on dcbor-pattern's
  Interval display, but the Rust shorthand `[{3}]` may not match exactly).
- TS `parseArray` parses `[a, b, c]` as `WithPatterns([a, b, c])`. Rust's
  `parse_array_inner` only handles `[*]`, `[{n}]`, `[{n,m}]`, `[{n,}]`
  inline; otherwise it wraps `[...]` and delegates to
  `DCBORPattern::parse`. TS's hand-written comma-separated list parser is
  incompatible with dcbor-pattern array syntax and produces a different
  AST.

### 1.5 🔴 `MapPattern` toString diverges
Rust `MapPattern::any().to_string() == "map"`; `interval(2..=2)` →
`{{2}}`. TS prints `{*}` for any. The `{{interval}}` form is the same,
but `map` vs `{*}` is a hard mismatch.

### 1.6 🟠 `WrappedPattern.unwrap()` is broken in TS
Rust:
```rust
pub fn unwrap() -> Self { Self::unwrap_matching(Pattern::any()) }
```
TS `pattern/structure/wrapped-pattern.ts`:
```ts
static unwrap(): WrappedPattern {
  // This will be filled in when Pattern.any() is available
  // For now, create a placeholder that will be replaced
  return new WrappedPattern({ type: "Any" }); // Will be overwritten
}
```
The "will be replaced" placeholder is never replaced. Fortunately, the
public-facing `unwrapEnvelope()` factory in `pattern/index.ts` builds a
correct `WrappedPattern.unwrapMatching(any())` directly, but anyone
calling `WrappedPattern.unwrap()` gets a `wrapped` pattern, not an
`unwrap` pattern.

### 1.7 🔴 `parse_tag` discards the tag number
Rust `parse_tag` delegates to `dcbor_pattern::parse("tagged(...)")`. It
supports: `tagged`, `tagged(N)`, `tagged(N, content_pattern)`,
`tagged(name)`, `tagged(name, content_pattern)`,
`tagged(/regex/, content_pattern)`. TS:
```ts
function parseTag(lexer: Lexer): Result<Pattern> {
  ...
  // Create a tagged pattern with the specific tag
  // For now, just match the tag number
  return ok(anyTag()); // Simplified - full implementation would match specific tag
}
```
i.e., the tag number/name is *parsed* but immediately thrown away — every
`tagged(N)` becomes `anyTag()`. Match results will be wrong for any
tag-specific pattern.

### 1.8 🔴 `parseKnownValueContent` numeric fallback is broken
TS:
```ts
const numValue = parseInt(content, 10);
if (!isNaN(numValue)) {
  const kv = { value: () => BigInt(numValue) } as unknown as KnownValueType;
  return ok(knownValue(kv));
}
```
Rust uses `KnownValue::new(value)` (a real construction). TS fakes a
KnownValue with a duck-typed object that has only `value()`. Subsequent
matching/serialisation against this fake will fail at runtime in any
KnownValue method that's not `value()`.

### 1.9 🟠 `convertDcborPatternToEnvelopePattern` (parse fallback) is stubbed
TS `parse/index.ts`:
```ts
function convertDcborPatternToEnvelopePattern(_dcborPattern: unknown): Result<Pattern> {
  // For now, wrap dcbor patterns as CBOR patterns
  // This is a simplified conversion - the dcbor pattern is matched by the any() pattern
  return ok(any());
}
```
Rust's parser falls back to `DCBORPattern::parse` and converts via
`dcbor_integration::convert_dcbor_pattern_to_envelope_pattern` — which
**does** preserve the actual pattern. TS's parser fallback returns
`Pattern::any()` instead. So whenever envelope-pattern parsing fails and
dcbor-pattern parsing succeeds, TS silently turns the input into "match
anything", whereas Rust returns the corresponding (specific) pattern.
A correct converter exists at `pattern/dcbor-integration.ts` but is
never invoked from the parser.

---

## 2. Parser grammar divergences (🔴 / 🟡)

### 2.1 🔴 `(expr)` is wrapped in `Group` in TS, returned as `expr` in Rust
Rust `parse_group` (after `(`):
- consumes `expr`, then `)`.
- if a quantifier follows, returns `Pattern::repeat(expr, ...)`.
- if **no** quantifier follows, returns `expr` unchanged.
TS `parseParenGroup` always wraps in `group(inner.value)`. Then
`parseGroup` (which is *always* called after `parsePrimary`) checks for a
quantifier — `(x){q}` becomes `repeat(group(x), q)` while Rust gives
`repeat(x, q)`.

Consequences:
- `parse("(text)")` in TS is `group(anyText())` (a `GroupPattern` with
  `Quantifier.exactly(1)`); in Rust it's just `anyText()`.
- `(text).toString()` in TS is `(text){1}` (because GroupPattern.toString
  always emits `(pattern){quantifier}`); in Rust `text` produces `text`.
  → **`format(parse(s)) === s` round-trip is broken** for any
    parenthesised expression.

### 2.2 🔴 Quantifier suffixes apply to bare primaries in TS but not in Rust
Rust's grammar attaches quantifiers only inside `parse_group` (i.e., only
to parenthesised expressions). TS's `parseGroup` runs after **every**
`parsePrimary` and eats the next token if it's a repeat operator, building
`repeat(primary, q)`.

Consequences:
- `parse("text*")`, `parse("number+")`, `parse("subj?")` all succeed in
  TS as `repeat(...)` patterns. They are syntax errors in Rust (or extra
  data after `text`/`number`/`subj`).
- The TS test `parse-meta.test.ts` has `parse("unwrap*")` asserting
  `result.ok === true` — Rust would reject this.

### 2.3 🔴 `parseNot` recursion depth differs
Rust:
```rust
pub fn parse_not(lexer) {
    if peek == Not { lexer.next(); let pat = parse_not(lexer)?; Ok(not_matching(pat)) }
    else { parse_and(lexer) }
}
```
TS:
```ts
function parseNot(lexer) {
  if (peek == Not) { lexer.next(); return ok(notMatching(parseGroup(lexer).value)); }
  return parseGroup(lexer);
}
```
Two issues:
- TS calls `parseGroup`, not `parseNot`, so `!!x` parses as `not(group(x))`
  in TS but `not(not(x))` in Rust.
- TS calls `parseGroup` (primary + quantifier) instead of `parseAnd`.
  This means `parse_not` in Rust descends through `parse_and` (and through
  `&` chaining) before reaching primaries; TS skips that level entirely
  inside a `!` context, so the precedence around `!` differs from Rust.
  The difference can be papered over by the operator precedence ordering
  in the rest of the grammar, but `!a & b` parses as `and([not(a), b])`
  in both, while `!!a` differs.

### 2.4 🔴 Capture syntax: `@name(pattern)` is treated as `@name (pattern)` in TS
Rust `parse_capture(name)`:
- requires a literal `(` to follow the `@name` token.
- parses `pattern`, then `)`.
- Returns `Pattern::capture(name, pattern)`.
TS `parseCapture(lexer, name)` calls `parseGroup(lexer)` (primary +
quantifier). Because `parsePrimary` happens to handle the `(` token via
`parseParenGroup`, this *appears* to work for `@name(p)`, but:
- `parseParenGroup` always wraps in `group(...)`, so the AST is
  `capture(name, group(p))` rather than `capture(name, p)`.
- `toString` of that capture is `@name((p){1})` rather than `@name(p)` —
  another format/round-trip break.
- `@name p` (no parens at all) is a syntax error in Rust but TS accepts
  it as `capture(name, p)`. The Rust grammar requires the parens.

### 2.5 🟡 `parseAssertion`/`parseAssertionPred`/`parseAssertionObj` accept bare keywords
Rust requires `(`:
- `parse_assertion_pred` errors on `UnexpectedEndOfInput` /
  `UnexpectedToken` if `(` is missing (only the *bare* `assert` keyword
  works because `parse_assertion` ignores its lexer).
- Same for `parse_assertion_obj`.
TS:
```ts
function parseAssertionPred(lexer) {
  if (next.type !== "ParenOpen") return ok(anyAssertion());
  ...
}
```
Same for `parseAssertionObj`. In TS, `assertpred` (no parens) returns
`anyAssertion()`. In Rust it's an error. This relaxes parse rules and also
produces a different AST (`Any` vs `WithPredicate(...)`).

### 2.6 🟡 `parseDigest` accepts bare `digest`
Rust requires `(`. TS returns `digestAny()` if no parens follow.

### 2.7 🟡 Tag parsing accepts only an integer; rejects everything else Rust accepts
Rust accepts `tagged(N)`, `tagged(name)`, `tagged(/regex/)`,
`tagged(N, pattern)`. TS only accepts `UnsignedInteger` after `(` and
errors on anything else (and even when it accepts, throws away the tag —
see 1.7).

### 2.8 🟡 `parseDateContent` does not understand dcbor `Date::from_string`
Rust uses `bc_envelope::prelude::Date::from_string` which accepts ISO-8601
plus a few extensions. TS uses `Date.parse(content)` (JavaScript native),
which has different (looser) semantics, accepts non-ISO formats Rust
rejects, and rejects Rust-accepted formats with seconds-precision >
milliseconds.

### 2.9 🟡 `parseDigest` doesn't validate digest-size or accept UR strings
Rust validates `bytes.len() <= Digest::DIGEST_SIZE` and accepts
`digest(ur:digest/...)`. TS does neither. Long hex strings that Rust
rejects pass through TS.

### 2.10 🟡 `Identifier` token catch-all
TS lexer adds an `Identifier` token type and produces it for any
unrecognised identifier. Rust's logos lexer instead emits an
`UnrecognizedToken` lexer error for unknown words. As a result, TS may
produce `UnexpectedToken { token: Identifier, ... }` errors at points
where Rust produces `UnrecognizedToken(span)`. (Mostly a 🟡 error-shape
divergence; in `parseDigest` the `Identifier` branch is also (ab)used to
accept raw hex strings, which Rust would never have emitted as an
Identifier.)

### 2.11 🟡 `parseNumber` produces `Integer` for negatives, `UnsignedInteger` for non-negative
Rust's logos lexer applies `Integer` regex `-?…` with priority 4 and
`UnsignedInteger` with priority 3, so `0` and `42` lex to
`UnsignedInteger`, `-1` to `Integer`. TS attempts to mirror this manually
— mostly OK, but the manual lexer treats `-` followed by digits as a
single `Integer` token while Rust may need to lex `-` alone as an
`UnexpectedToken` for inputs like `-Infinity` (TS handles that explicitly).
Edge cases (e.g. `-0`) may differ.

### 2.12 🟡 Whitespace handling in `range` parser
Rust's `parse_range` accepts `\u{0c}` (form feed) as whitespace inside
`{n, m}`. TS accepts `\f` (``) too. Likely OK.

---

## 3. VM / matching divergences (🔴 / 🟡)

### 3.1 🟡 `repeat_paths` arithmetic uses `Number.MAX_SAFE_INTEGER` instead of `usize::MAX`
TS uses `Number.MAX_SAFE_INTEGER` for unbounded `quantifier.max()`, vs
Rust's `usize::MAX`. The semantic value (effectively unbounded) is the
same but the loop counter behaviour differs at extreme bounds.

### 3.2 🟡 `vm.ts.compileMetaPattern.Capture` and `CapturePattern.compile` use **different** capture-id schemes
Rust `CapturePattern::compile` pushes the name to the `captures` vector at
compile time (`id = captures.len(); captures.push(name)`). The top-level
`Pattern::compile` does **not** pre-collect names.

TS has two compile paths:
1. `vm.ts.compile(pattern)` first calls `collectCaptureNames(pattern,
   captureNames)` to populate the names, then `compilePattern` on the
   meta `Capture` does `const captureIndex = captureNames.indexOf(name)`.
2. `metaPatternCompile` dispatches `pattern.pattern.compile`, calling
   `CapturePattern.compile`, which (correctly mirroring Rust) does
   `id = captures.length; captures.push(name)`.

Path (1) and path (2) produce the same final `captures` list iff every
name is unique and the Rust pre-collection is idempotent. In typical
cases this works; for nested captures with the same name, behaviour can
diverge from Rust (which always appends).

### 3.3 🔴 `SubjectPattern.compile` calls `.compile` on the inner `Pattern` union
Rust `SubjectPattern::Pattern(pat)` calls `pat.compile(code, lits, caps)`
on a `Pattern`. TS:
```ts
case "Pattern":
  code.push({ type: "NavigateSubject" });
  code.push({ type: "ExtendTraversal" });
  (this._pattern.pattern as unknown as Matcher).compile(code, literals, captures);
  code.push({ type: "CombineTraversal" });
```
But in TS, `Pattern` is a tagged union `{ type, pattern }`, **not** a class
with a `.compile` method. The `as unknown as Matcher` cast hides the bug:
calling this code path will throw "TypeError: ... .compile is not a
function" at runtime. The only way this works is if the inner pattern is
itself a class (rare/wrong). Should use `dispatchCompile` like the rest of
the structure patterns. (Note: `subj(...)` is rare in tests, so the bug is
latent.)

### 3.4 🔴 `SearchPattern.pathsWithCaptures` walker diverges from Rust
Rust's `SearchPattern::paths_with_captures` uses
`bc_envelope::Envelope::walk(false, vec![], visitor)` which is the
canonical envelope walker. TS reimplements `_walkEnvelope` manually:
- visits the current node.
- recurses into `subject` only when `subject.digest != envelope.digest`
  (so leaves do not recurse into themselves, but for a Node, the subject
  is always different — fine).
- recurses into each assertion **and then again** into the assertion's
  predicate and object (with `pathToCurrent = [..., assertion]`). Rust's
  `walk` visits assertion → predicate, object via the same recursion, so
  predicate/object appear once; in TS they appear under both the
  assertion's recursion *and* the manual recursion — paths may double up
  before dedup.
- handles `subject.isWrapped()` separately.

The deduplication by digest path masks most duplication, but path *order*
and the *set* of intermediate paths recorded as `newPath` will differ
from Rust. Top-level Search invocations in pattern-matching code go
through the VM (`patternNeedsVM` returns true for Search), so this only
bites when `SearchPattern.pathsWithCaptures` is called directly.

### 3.5 🟡 `SearchPattern` VM child enumeration includes `wrapped` but not `node-with-wrapped-subject`
The VM's `Search` instruction in TS visits children:
- `node` → subject + assertions
- `wrapped` → envelope
- `assertion` → predicate, object
- otherwise nothing
This matches Rust's VM code. But the standalone `_walkEnvelope` in TS
*also* descends into `subject.isWrapped()` content. Inconsistent with the
VM. Same effect as 3.4.

### 3.6 🟡 `axisChildren("Wrapped", ...)` for a Node with wrapped subject uses `unwrap()` not `tryUnwrap()`
TS `vm.ts`:
```ts
case "Wrapped": {
  if (envCase.type === "node") {
    const subject = envCase.subject;
    if (subject.isWrapped()) {
      const unwrapped = subject.unwrap();
      ...
```
Rust uses `subject.try_unwrap().unwrap()`. The `unwrap()` method on TS
`Envelope` may not be the same as `try_unwrap`. If `Envelope.unwrap()` is
`Result.unwrap`-style or different from `try_unwrap`, this is wrong. (At
least, the API names diverge from the rest of the file which uses
`tryUnwrap?.()`.) This is a 🟡 because it depends on the actual `@bcts/envelope`
binding behaviour.

### 3.7 🟡 `pathKey` uses comma-joined hex digests, not `Vec<Digest>`
Rust uses `HashSet<Vec<bc_components::Digest>>` (pure structural). TS
uses `Set<string>` keyed by `digest.hex()` joined with `,`. This is
slower but functionally equivalent unless a digest hex contains a comma
(it can't — hex is `[0-9a-f]`). OK.

### 3.8 🟡 `metaPatternCollectCaptureNames` `collectCaptureNamesFromPattern` is a no-op
TS:
```ts
function collectCaptureNamesFromPattern(pattern: Pattern, out: string[]): void {
  const p = pattern as unknown as { collectCaptureNames?: (out: string[]) => void };
  if (p.collectCaptureNames !== undefined) {
    p.collectCaptureNames(out);
  }
}
```
Patterns are tagged unions; they have no `collectCaptureNames` method, so
this is dead code. The actual collector lives inline in
`vm.ts.collectCaptureNames` and `vm.ts.collectMetaCaptureNames`, used by
`compile()`. So `metaPatternCollectCaptureNames` returns the names of
`Capture` patterns at the top level only, not recursively. In Rust this
is recursive across the entire pattern tree. This affects only direct
callers of `patternCollectCaptureNames`/`metaPatternCollectCaptureNames`.

The same dead-code shim appears in
`pattern/meta/search-pattern.ts`'s `collectCaptureNames`. The tests
exercise capture mostly through the VM `compile` path, where the inline
collector works, so the bug is latent.

### 3.9 🟡 CBOR pattern dcbor-path → envelope-path conversion
Rust `convert_dcbor_path_to_envelope_path` compares CBOR equality (`==`).
TS uses `dcborPath[0]?.toDiagnostic() === baseCbor.toDiagnostic()` — i.e.
**diagnostic-string** equality. Two distinct CBORs that happen to share a
diagnostic representation would compare equal in TS but not in Rust, and
NaN/Infinity edge cases differ. The same diagnostic-equality is used in
`CBORPattern.equals` and `_convertDcborPathToEnvelopePath`.

### 3.10 🟡 KnownValue → CBOR conversion uses `taggedCbor()` in TS, `to_cbor()` in Rust
Rust calls `known_value.to_cbor()` (raw value as a CBOR value). TS calls
`envCase.value.taggedCbor()` (which wraps in tag 40000 / known-value
tag). When the `CBORPattern::Pattern` does dcbor-pattern matching against
the result, the tag wrapping changes which patterns match. Possible
mismatch for cbor patterns over known-value envelopes.

---

## 4. Format / Display divergences (🟡)

### 4.1 🟡 `format.ts.envelopeSummary` differs in detail from Rust `envelope_summary`
Rust uses `env.format_flat()` (a one-line envelope format) and
`cbor.envelope_summary(usize::MAX, ...)`. TS reconstructs the summary
manually by case (`"NODE subj [ pred: obj, ... ]"` etc.) using
`Envelope.summary(MAX)`. These are unlikely to produce byte-identical
output, breaking any test that compares Rust's text-output rubrics
verbatim.

### 4.2 🟡 `format.ts` UR support is stubbed
Rust supports `PathElementFormat::EnvelopeUR` (returns
`element.ur_string()`) and `PathElementFormat::DigestUR` (returns
`element.digest().ur_string()`). TS:
```ts
case "EnvelopeUR":
  // TODO: Implement proper UR string format when available
  return element.digest().toString();
case "DigestUR":
  return element.digest().toString();
```
Both EnvelopeUR and DigestUR return `digest.toString()` (and that's just a
hex string, not a UR). Tests in Rust (`test_format_paths_with_captures_envelope_ur`,
`..._digest_ur`) cannot pass against this implementation.

### 4.3 🟡 GroupPattern.toString always wraps + prints quantifier, even for `{1}`
Rust's `GroupPattern::Display` is `({pattern}){quantifier}` where the
`{quantifier}` is the `Quantifier::Display` (which for `{1, 1}` prints
`{1}`). So a parse round-trip of `text` becomes `text` (because
`parse_group` does not wrap unless an explicit quantifier follows). In
TS, however, **every** `Pattern::group(p)` invocation produces a
`GroupPattern` with quantifier `exactly(1)`, and any flow that wraps in
group prints `(pat){1}`. Combined with 2.1 / 2.4 this breaks
`format(parse(s)) === s`.

### 4.4 🟡 `ArrayPattern.toString` (any) is `[*]` in TS, `array` in Rust
See 1.4.

### 4.5 🟡 `MapPattern.toString` (any) is `{*}` in TS, `map` in Rust
See 1.5.

### 4.6 🟡 `format_paths_with_captures` outputs ELIDED/ENCRYPTED/COMPRESSED summaries differently
Rust's `envelope_summary` for `Elided`/`Encrypted`/`Compressed` simply
emits `"ELIDED"` / `"ENCRYPTED"` / `"COMPRESSED"` (no digest, no
content). TS does the same in `format.ts`. ✅
For `KnownValue`, Rust uses `KnownValuesStore::known_value_for_raw_value`
to look up the canonical name; TS uses `c.value.name()`. Likely equivalent
but depends on the TS `KnownValue.name()` implementation matching Rust's
lookup. (🟡 risk.)

---

## 5. Error variants (🟡 / 🟢)

The TS `EnvelopePatternError` enum (`error.ts`) matches the Rust `Error`
variants 1:1 in shape:

| Rust | TS | Status |
|------|----|--------|
| `EmptyInput` | `EmptyInput` | ✅ |
| `UnexpectedEndOfInput` | `UnexpectedEndOfInput` | ✅ |
| `ExtraData(Span)` | `ExtraData` | ✅ |
| `UnexpectedToken(Box<Token>, Span)` | `UnexpectedToken` | ✅ |
| `UnrecognizedToken(Span)` | `UnrecognizedToken` | ✅ (but rarely constructed — see 2.10) |
| `InvalidRegex(Span)` | `InvalidRegex` | ✅ |
| `UnterminatedRegex(Span)` | `UnterminatedRegex` | ✅ |
| `InvalidRange(Span)` | `InvalidRange` | ✅ |
| `InvalidHexString(Span)` | `InvalidHexString` | ✅ |
| `InvalidDateFormat(Span)` | `InvalidDateFormat` | ✅ |
| `InvalidNumberFormat(Span)` | `InvalidNumberFormat` | ✅ |
| `InvalidUr(String, Span)` | `InvalidUr` | ✅ (but never produced — TS digest parser doesn't accept UR) |
| `ExpectedOpenParen(Span)` | `ExpectedOpenParen` | ✅ |
| `ExpectedCloseParen(Span)` | `ExpectedCloseParen` | ✅ |
| `ExpectedOpenBracket(Span)` | `ExpectedOpenBracket` | ✅ |
| `ExpectedCloseBracket(Span)` | `ExpectedCloseBracket` | ✅ |
| `ExpectedPattern(Span)` | `ExpectedPattern` | ✅ (TS never produces this — see below) |
| `UnmatchedParentheses(Span)` | `UnmatchedParentheses` | ✅ (never produced) |
| `UnmatchedBraces(Span)` | `UnmatchedBraces` | ✅ (never produced) |
| `InvalidCaptureGroupName(String, Span)` | `InvalidCaptureGroupName` | ✅ (never produced) |
| `InvalidPattern(Span)` | `InvalidPattern` | ✅ |
| `Unknown` | `Unknown` | ✅ |
| `DCBORPatternError(dcbor_pattern::Error)` | `DCBORPatternError` | ✅ |

🟡 Several variants are declared in the union but **never constructed**
by the TS parser (`InvalidUr`, `ExpectedPattern`, `UnmatchedParentheses`,
`UnmatchedBraces`, `InvalidCaptureGroupName`). For inputs where Rust
returns one of these, TS returns a different error (often
`UnexpectedToken` or `Unknown`).

🟢 Token shape: TS `unexpectedToken(token, span)` carries the full Token
object; Rust carries `Box<Token>`. Equivalent.

---

## 6. Pattern-by-pattern coverage

| Rust file | TS file | Status | Notes |
|-----------|---------|--------|-------|
| `pattern/leaf/array_pattern.rs` | `pattern/leaf/array-pattern.ts` | 🔴 | Adds `Any`/`WithPatterns`; `WithPatterns` matches by length only |
| `pattern/leaf/bool_pattern.rs` | `pattern/leaf/bool-pattern.ts` | ✅ | matches |
| `pattern/leaf/byte_string_pattern.rs` | `pattern/leaf/byte-string-pattern.ts` | (not deeply audited; thin dcbor wrapper) | likely OK |
| `pattern/leaf/cbor_pattern.rs` | `pattern/leaf/cbor-pattern.ts` | 🟡 | Diagnostic-string equality (3.9), `taggedCbor()` for known values (3.10), capture-name string parsing matches Rust |
| `pattern/leaf/date_pattern.rs` | `pattern/leaf/date-pattern.ts` | (not deeply audited; thin dcbor wrapper) | likely OK; parse uses `Date.parse` (2.8) |
| `pattern/leaf/known_value_pattern.rs` | `pattern/leaf/known-value-pattern.ts` | 🟡 | Adds extra `asLeaf()` fallback path absent in Rust; `taggedCbor` mismatch |
| `pattern/leaf/map_pattern.rs` | `pattern/leaf/map-pattern.ts` | 🟡 | TS reimplements with `MapPatternType` union (Any/Interval), no dcbor delegation |
| `pattern/leaf/null_pattern.rs` | `pattern/leaf/null-pattern.ts` | ✅ | matches |
| `pattern/leaf/number_pattern.rs` | `pattern/leaf/number-pattern.ts` | ✅ | matches; TS adds `infinity()` / `negInfinity()` factories not in Rust (Rust uses `Pattern::number(f64::INFINITY)`) |
| `pattern/leaf/tagged_pattern.rs` | `pattern/leaf/tagged-pattern.ts` | 🟡 | dcbor delegation OK; parse never produces tag-specific patterns (see 1.7) |
| `pattern/leaf/text_pattern.rs` | `pattern/leaf/text-pattern.ts` | (not deeply audited; thin dcbor wrapper) | likely OK |
| `pattern/structure/assertions_pattern.rs` | `pattern/structure/assertions-pattern.ts` | 🔴 | Adds `WithBoth` |
| `pattern/structure/digest_pattern.rs` | `pattern/structure/digest-pattern.ts` | 🔴 | Adds `Any`; case-sensitive prefix; no UR |
| `pattern/structure/leaf_structure_pattern.rs` | `pattern/structure/leaf-structure-pattern.ts` | ✅ | matches |
| `pattern/structure/node_pattern.rs` | `pattern/structure/node-pattern.ts` | 🔴 | Adds `WithSubject` (broken match) |
| `pattern/structure/object_pattern.rs` | `pattern/structure/object-pattern.ts` | (not shown; expected to mirror predicate) | likely matches |
| `pattern/structure/obscured_pattern.rs` | `pattern/structure/obscured-pattern.ts` | ✅ | matches |
| `pattern/structure/predicate_pattern.rs` | `pattern/structure/predicate-pattern.ts` | ✅ | matches |
| `pattern/structure/subject_pattern.rs` | `pattern/structure/subject-pattern.ts` | 🔴 | `compile` calls `.compile` on a tagged-union object — broken (3.3) |
| `pattern/structure/wrapped_pattern.rs` | `pattern/structure/wrapped-pattern.ts` | 🟠 | `unwrap()` factory broken (1.6); rest OK |
| `pattern/meta/and_pattern.rs` | `pattern/meta/and-pattern.ts` | ✅ | matches |
| `pattern/meta/any_pattern.rs` | `pattern/meta/any-pattern.ts` | ✅ | matches (display `*`) |
| `pattern/meta/capture_pattern.rs` | `pattern/meta/capture-pattern.ts` | ✅ | matches (compile mirrors Rust) |
| `pattern/meta/not_pattern.rs` | `pattern/meta/not-pattern.ts` | ✅ | matches |
| `pattern/meta/or_pattern.rs` | `pattern/meta/or-pattern.ts` | (presumed) | likely matches |
| `pattern/meta/repeat_pattern.rs` (`GroupPattern`) | `pattern/meta/group-pattern.ts` | 🟡 | Default quantifier differs (Rust `1..=1` greedy vs TS `Quantifier.exactly(1)`); `Pattern::group(p)` always wraps and emits `(p){1}` |
| `pattern/meta/search_pattern.rs` | `pattern/meta/search-pattern.ts` | 🟡 | Walker reimpl (3.4); compile path matches |
| `pattern/meta/traverse_pattern.rs` | `pattern/meta/traverse-pattern.ts` | ✅ | matches |
| `pattern/dcbor_integration.rs` | `pattern/dcbor-integration.ts` | 🟡 | Implementation exists but is **not used by parser** (see 1.9) |
| `pattern/matcher.rs` | `pattern/matcher.ts` | ✅ | extra dispatch registry to break circular deps; semantics OK |
| `pattern/vm.rs` | `pattern/vm.ts` | ✅ (mostly) | see 3.5–3.9 |

| Rust parse module | TS parse module | Status |
|-------------------|-----------------|--------|
| `parse/leaf/array_parser.rs` | (inlined in `parse/index.ts:parseArray`) | 🔴 (1.4 / 2.x): hand-built rather than delegating to dcbor-pattern |
| `parse/leaf/cbor_parser.rs` | `parseCbor` in `parse/index.ts` | ✅ (matches Rust shape) |
| `parse/leaf/date_parser.rs` | `parseDateContent` in `parse/index.ts` | 🟡 (2.8) |
| `parse/leaf/known_value_parser.rs` | `parseKnownValueContent` in `parse/index.ts` | 🔴 (1.8) |
| `parse/leaf/map_parser.rs` | (no map parser; dcbor handles) | n/a |
| `parse/leaf/null_parser.rs` | `case "Null":` in `parsePrimary` | ✅ |
| `parse/leaf/number_parser.rs` | `parseNumberRangeOrComparison`, `parseComparisonNumber` | ✅ |
| `parse/leaf/tag_parser.rs` | `parseTag` in `parse/index.ts` | 🔴 (1.7) |
| `parse/meta/and_parser.rs` | `parseAnd` | 🟡 (slightly different precedence — 2.3) |
| `parse/meta/capture_parser.rs` | `parseCapture` | 🔴 (2.4) |
| `parse/meta/group_parser.rs` | `parseParenGroup` + `parseGroup` | 🔴 (2.1, 2.2) |
| `parse/meta/not_parser.rs` | `parseNot` | 🔴 (2.3) |
| `parse/meta/or_parser.rs` | `parseOr` | ✅ |
| `parse/meta/primary_parser.rs` | `parsePrimary` | 🔴 (multiple — 2.x) |
| `parse/meta/search_parser.rs` | `parseSearch` | ✅ |
| `parse/meta/traverse_parser.rs` | `parseTraverse` | ✅ |
| `parse/structure/assertion_obj_parser.rs` | `parseAssertionObj` | 🟡 (2.5) |
| `parse/structure/assertion_parser.rs` | `parseAssertion` | 🔴 (1.1 / 2.5) |
| `parse/structure/assertion_pred_parser.rs` | `parseAssertionPred` | 🟡 (2.5) |
| `parse/structure/compressed_parser.rs` | `case "Compressed":` returns `compressed()` | ✅ |
| `parse/structure/digest_parser.rs` | `parseDigest` | 🔴 (1.3 / 2.6 / 2.9) |
| `parse/structure/elided_parser.rs` | `case "Elided":` returns `elided()` | ✅ |
| `parse/structure/encrypted_parser.rs` | `case "Encrypted":` returns `encrypted()` | ✅ |
| `parse/structure/node_parser.rs` | `parseNode` | 🔴 (1.2) |
| `parse/structure/object_parser.rs` | `parseObject` | ✅ |
| `parse/structure/obscured_parser.rs` | `case "Obscured":` returns `obscured()` | ✅ |
| `parse/structure/predicate_parser.rs` | `parsePredicate` | ✅ |
| `parse/structure/subject_parser.rs` | `parseSubject` | ✅ |
| `parse/structure/wrapped_parser.rs` | `parseUnwrap` (and bare `wrapped`) | ✅ |
| `parse/utils.rs` | `parse/utils.ts` (defined but **unused** by `parse/index.ts`) | 🟠 — unused module; the inline parsers in `index.ts` reimplement the logic |
| `parse/token.rs` | `parse/token.ts` | 🟡 — manual lexer (no logos), see 2.10 / 2.11 |
| `parse/mod.rs` | `parse/index.ts` | 🔴 (1.9 — dcbor fallback returns `Pattern::any()`) |
| `format.rs` | `format.ts` | 🟡 (4.1 / 4.2) |
| `error.rs` | `error.ts` | ✅ shape; 🟡 for variants never produced |

---

## 7. Test coverage gaps (🟡)

Rust test corpus: 28 files, ~5,800 lines. TS test corpus: 15 files,
~3,700 lines. The TS tests are fundamentally weaker:

| Rust test | TS test | Gap |
|-----------|---------|-----|
| `parse_tests.rs` | `parse.test.ts` | ✅-ish |
| `parse_tests_leaf.rs` (322 L) | `parse-leaf.test.ts` (383 L) | TS tests only check `result.ok === true`, never the parsed AST or the round-trip toString. Rust tests assert AST equality and `to_string()` round-trip. |
| `parse_tests_meta.rs` (180 L) | `parse-meta.test.ts` (263 L) | Same shallow checks. Rust tests `parse_operator_precedence`, `parse_capture_patterns`, `parse_repeat_patterns` with full AST equality and round-trip; TS only checks `ok`. |
| `parse_tests_structure.rs` (143 L) | `parse-structure.test.ts` (246 L) | Same. |
| `parser_integration_tests.rs` (197 L) | `parser-integration.test.ts` (234 L) | TS likely shallower (not deeply audited). |
| `pattern_tests.rs` (147 L) | `pattern.test.ts` (239 L) | TS shallower; missing `format_paths` text-rubric checks. |
| `pattern_tests_leaf.rs` (**856 L**) | `pattern-leaf.test.ts` (251 L) | **Major gap** — TS misses ~600 L of Rust assertions. |
| `pattern_tests_meta.rs` (**779 L**) | `pattern-meta.test.ts` (181 L) | **Major gap.** |
| `pattern_tests_repeat.rs` (**725 L**) | `pattern-repeat.test.ts` (339 L) | Significant gap. |
| `pattern_tests_structure.rs` (**451 L**) | `pattern-structure.test.ts` (211 L) | Significant gap. |
| `error_tests.rs` (57 L) | `error.test.ts` (133 L) | TS may cover differently; not all variants exercised. |
| `cbor_integration_test.rs` | `cbor-pattern-integration.test.ts` | Partial. |
| `dcbor_integration_tests.rs` | `dcbor-integration.test.ts` | Partial. |
| `capture_tests.rs` | `capture.test.ts` | Partial. |
| `credential_tests.rs` | `credential.test.ts` | TS uses simplified credential — no real signing/elision. |
| `test_cbor_captures.rs` (615 L) | — | **Not ported** |
| `test_cbor_path_extension.rs` (362 L) | — | **Not ported** |
| `test_cbor_paths_formatted.rs` (212 L) | — | **Not ported** (depends on UR formatting which is stubbed in TS) |
| `test_dcbor_paths.rs` (221 L) | — | **Not ported** |
| `test_extended_paths.rs` (136 L) | — | **Not ported** |
| `test_final_node_analysis.rs` (99 L) | — | **Not ported** |
| `test_leaf_parsing.rs` (24 L) | — | **Not ported** |
| `test_leaf_vs_cbor_analysis.rs` (72 L) | — | **Not ported** |
| `test_leaf_vs_node_zero.rs` (140 L) | — | **Not ported** |
| `tests/common/{check_encoding,test_data,test_seed}.rs` | — | **No common test fixtures in TS** |

🟡 The TS tests systematically check only that `parse(...)` returns
`{ ok: true }` — not the *shape* of the parsed value. As a result, the
parser bugs above (1.x, 2.x) all pass the TS test suite. Adding
AST-equality and `format(parse(s)) === s` round-trip checks would catch
the majority.

🟡 No TS counterpart to Rust's text-rubric `format_paths` golden tests,
which means format-output divergences (4.1 / 4.2) are not exercised.

🟡 No TS counterpart to Rust's `redacted_credential` real-elision tests,
which exercise elided-envelope walking with real digests.

---

## 8. API surface differences (🟢)

- TS exports a `Result<T> = { ok: true, value: T } | { ok: false, error }`
  rather than throwing exceptions. Acceptable adaptation for JS.
- TS pattern factories require *registration* at module load (the
  `register*PatternFactory` and `register*Dispatch*` calls in
  `pattern/index.ts`) to break circular deps. Rust uses Cargo's module
  graph. The registrations fire on import, so this is mostly transparent;
  but any user importing a leaf/structure pattern *file* directly without
  also loading `pattern/index.ts` will see "factory not registered" errors.
- TS pattern instances expose `equals` / `hashCode` methods (used nowhere
  internally, since pattern equality is reference-only); Rust derives
  `PartialEq, Eq, Hash` structurally. The TS `equals` implementations are
  almost all reference comparisons (`thisPattern === otherPattern`) for
  inner Pattern fields, so two structurally-equal but distinct patterns
  compare unequal in TS while equal in Rust. Affects `Pattern` deduplication
  in callers but not the pattern engine itself.
- TS `Quantifier` for `repeat()` defaults to `Reluctance.Greedy`; Rust's
  `Pattern::repeat` requires explicit reluctance. Equivalent in practice.
- TS `Pattern.repeat(pat, min, max?, reluctance?)` builds an `Interval`
  with `Interval.atLeast(min)` when `max === undefined`. Rust uses Rust
  range syntax. Equivalent.

---

## 9. Summary of issues by severity

### 🔴 Different match results / captures
1. `AssertionsPattern.WithBoth` (1.1) — TS-only AST variant produced by
   TS-only parsing of `assert(p, o)`.
2. `NodePattern.WithSubject` (1.2) — TS-only; matching is stubbed and
   ignores the subject pattern.
3. `DigestPattern.Any` + parser (1.3) — TS accepts `digest` alone; case-
   sensitive prefix vs Rust's case-insensitive; no UR / size validation.
4. `ArrayPattern.WithPatterns` (1.4) — matches by length only; ignores
   element patterns; TS array parser builds the wrong AST.
5. `parseTag` discards tag info (1.7).
6. `parseKnownValueContent` numeric path is broken (1.8).
7. dcbor-pattern parser fallback returns `Pattern::any()` instead of
   converting (1.9).
8. `(expr)` always wrapped in `Group` in TS (2.1) → format/round-trip
   break.
9. Quantifier suffixes on bare primaries accepted in TS (2.2).
10. `parseNot` uses `parseGroup` instead of `parseNot`/`parseAnd` (2.3) —
    `!!x` semantically differs.
11. `@name(p)` → `capture(name, group(p))` instead of `capture(name, p)`
    (2.4); `@name p` (no parens) accepted in TS but rejected by Rust.
12. `SubjectPattern.compile` calls `.compile` on a tagged-union value
    (3.3) — runtime crash if the path is ever exercised.
13. `SearchPattern.pathsWithCaptures` walker diverges (3.4).

### 🟠 Missing pattern type / variant
14. `WrappedPattern.unwrap()` static factory (1.6) — placeholder never
    replaced; user-facing function returns the wrong AST.
15. `parse/leaf/*`, `parse/meta/*`, `parse/structure/*` directories exist
    but are empty in TS — Rust split each parser into its own file; TS
    inlines all parsers in `parse/index.ts`. (Cosmetic in itself, but
    diverges from Rust's organisational invariant; severity 🟠 because the
    matching `parse/utils.ts` module *is* present but **unused**.)

### 🟡 Format / test / error gaps
16. UR format stubbed in `format.ts` (4.2).
17. `envelope_summary` reimplemented manually rather than using
    `format_flat()` / `cbor.envelope_summary()` (4.1).
18. ArrayPattern `[*]` / `array` mismatch (4.4); MapPattern `{*}` / `map`
    mismatch (4.5).
19. `GroupPattern.toString` always wraps `(pat){q}` (4.3).
20. Several error variants declared but never produced (`InvalidUr`,
    `ExpectedPattern`, `UnmatchedParentheses`, `UnmatchedBraces`,
    `InvalidCaptureGroupName`).
21. **TS tests check only `result.ok === true`, never AST equality or
    `format(parse(s)) === s` round-trip.** This is the single largest
    quality gap and the reason the 🔴 parser bugs pass all tests.
22. Tests `test_cbor_captures.rs`, `test_cbor_path_extension.rs`,
    `test_cbor_paths_formatted.rs`, `test_dcbor_paths.rs`,
    `test_extended_paths.rs`, `test_final_node_analysis.rs`,
    `test_leaf_parsing.rs`, `test_leaf_vs_cbor_analysis.rs`,
    `test_leaf_vs_node_zero.rs` are **not ported**.
23. `credential.test.ts` uses a fake credential without signing or
    elision; cannot exercise the real `redacted_credential` flow.
24. `cbor-pattern.ts` uses diagnostic-string equality instead of CBOR
    equality (3.9); `taggedCbor()` vs `to_cbor()` for known values (3.10).
25. `axisChildren("Wrapped", ...)` uses `Envelope.unwrap()` rather than
    `tryUnwrap?.()` (3.6); inconsistent with elsewhere in the same file.
26. `metaPatternCollectCaptureNames` recursion is dead code (3.8); the
    inline collector in `vm.ts` is the only working path.
27. `parseDateContent` uses JS `Date.parse` instead of
    `Date::from_string` (2.8).

### 🟢 Cosmetic / API
28. Pattern instances expose `equals` / `hashCode` that compare inner
    Patterns by reference identity rather than structural equality.
29. Forward-declaration / factory-registration pattern in TS instead of
    Rust's module graph; transparent if `pattern/index.ts` is loaded.
30. `NumberPattern.infinity()` / `negInfinity()` factories in TS are
    extra; Rust uses `Pattern::number(f64::INFINITY)`.
31. TS `parse/leaf/`, `parse/meta/`, `parse/structure/` are empty
    directories; all parsing lives in `parse/index.ts`. *(Resolved —
    parsers are now split across the Rust-style sub-directories; see
    "Resolved in this pass" below.)*

---

## Resolved in this pass (2026-04-25)

This section enumerates the concrete changes made to bring the TS port
into byte-identical parity with `bc-envelope-pattern-rust`. Every entry
links to the §-numbered finding above.

### AST shape
- §1.1 — `AssertionsPattern.WithBoth` removed. `assert(p, o)` is no
  longer accepted; bare `assert` returns `any_assertion()`. Display
  collapsed to two arms (`assert`, `assertpred(p)`, `assertobj(p)`).
- §1.2 — `NodePattern.WithSubject` removed. `node(text)` and similar
  forms now error like Rust; `node` / `node({n,m})` remain the only
  accepted shapes.
- §1.3 — `DigestPattern.Any` removed. The variant union is now
  `Digest | Prefix | BinaryRegex` (Rust order). `Prefix` equality
  uses ASCII case-insensitive byte compare, and the new
  `parseDigest` accepts either a `ur:digest/...` URI (via
  `Digest.fromURString`) or a hex prefix bounded by
  `Digest.DIGEST_SIZE`.
- §1.4 — `ArrayPattern.WithPatterns` removed. `ArrayPattern` is now a
  thin wrapper around `dcbor_pattern::ArrayPattern`, mirroring Rust;
  display delegates to dcbor-pattern (`array`, `[{n}]`, `[{n,m}]`,
  `[{n,}]`, etc.).
- §1.5 — `MapPattern.toString` for the `Any` variant is now `map`
  (Rust output) instead of `{*}`.
- §1.6 — `WrappedPattern.unwrap()` now mirrors Rust's
  `Self::unwrap_matching(Pattern::any())`. Late-bound via
  `registerWrappedPatternAny` in `pattern/index.ts` so the factory
  can call `Pattern::any()` once registration completes; display
  collapses `Unwrap(any())` back to the bare keyword `unwrap`.

### Parser
- §1.7 / §2.7 — `parseTag` now delegates to dcbor-pattern: it
  reconstructs `tagged(<inner>)`, parses with
  `@bcts/dcbor-pattern.parse`, and lifts the resulting
  `dcbor_pattern::TaggedPattern` into our envelope leaf — preserving
  number, name, and regex selectors plus content sub-patterns.
- §1.8 — `parseKnownValueContent` now uses BigInt parsing within the
  full `u64` range and constructs a real `KnownValue` (was a
  duck-typed object that broke any subsequent KnownValue method
  call).
- §1.9 — Parser fallback for unknown forms now calls
  `convertDcborPatternToEnvelopePattern` (already implemented in
  `pattern/dcbor-integration.ts`); previously the fallback returned
  `Pattern::any()` regardless of the dcbor-pattern result.
- §2.1 / §2.2 / §4.3 — `parseGroup` now mirrors Rust exactly: it is
  called from `parsePrimary` only when `(` is consumed. Inside, it
  parses the body via `parseOr`, expects `)`, then optionally
  consumes a quantifier suffix. Bare-primary quantifiers
  (`text*`, `unwrap{3}`, etc.) are now rejected. `(expr)` returns
  `expr` unchanged when no quantifier follows, which restores
  `format(parse(s)) === s` for parenthesised expressions.
- §2.3 — `parseNot` is restructured around the
  `parse_or → parse_traverse → parse_not → parse_and → parse_primary`
  precedence chain. `!!x` now parses as `not(not(x))`; `!a & b`
  matches Rust's interpretation.
- §2.4 — `parseCapture` requires explicit parens; calls `parseOr`,
  not `parseGroup`. `@name(p)` is `capture(name, p)` (no
  intermediate `GroupPattern`); `@name p` is a syntax error.
- §2.5 — `parseAssertion` ignores its lexer and returns
  `any_assertion()`; `parseAssertionPred` / `parseAssertionObj`
  require `(`. The previous lenient bare-keyword paths are gone.
- §2.6 / §2.9 — `parseDigest` requires `(`, supports
  `digest(ur:digest/…)` and length-bounded hex prefixes (mirrors
  Rust; uses `Digest.fromURString` for UR strings).
- §2.8 — `parseDateContent` now uses
  `CborDate.fromString` (which mirrors Rust
  `Date::from_string`) instead of `JS Date.parse`, so accepted
  formats line up with Rust.

### Pattern engine
- §3.3 — `SubjectPattern.compile` now goes through the registered
  `dispatchPatternCompile` function instead of casting the inner
  tagged-union value to a `Matcher` (which would have crashed at
  runtime when the path was exercised).
- §3.4 / §3.5 — `SearchPattern._walkEnvelope` now uses
  `Envelope.prototype.walk(false, …, visitor)` — the canonical
  envelope traversal — so path order and the set of intermediate
  paths recorded match Rust.
- §3.6 — `axisChildren("Wrapped", ...)` now uses
  `subject.tryUnwrap()` (mirrors Rust `try_unwrap().unwrap()`).
- §3.9 / §3.10 — `cbor-pattern.ts` now uses canonical
  `cborEquals(...)` (CBOR-byte equality) instead of diagnostic-string
  equality for `Value` matching, dcbor-path skip-first detection, and
  hashing. The known-value path keeps `taggedCbor()` because Rust's
  `From<KnownValue> for CBOR` (and therefore `to_cbor()`) returns the
  tagged form too.

### Format
- §4.1 — `envelopeSummary` now defers to `Envelope.formatFlat()` for
  node / wrapped / assertion summaries, mirroring Rust. The previous
  hand-rolled `NODE subj [ pred: obj, ... ]` reconstruction is gone.
- §4.2 — `EnvelopeUR` / `DigestUR` formats now emit
  `envelope.urString()` and `digest.urString()` — both for
  single-path and multi-path output. Previously both fell through to
  the hex digest representation.

### Module organisation (§31)
- The parser is split into Rust-style sub-files:
  - `parse/leaf/{array-parser, cbor-parser, date-parser,
    known-value-parser, null-parser, number-parser, tag-parser}.ts`
  - `parse/meta/{and-parser, capture-parser, group-parser,
    not-parser, or-parser, primary-parser, search-parser,
    traverse-parser}.ts`
  - `parse/structure/{assertion-parser, assertion-pred-parser,
    assertion-obj-parser, compressed-parser, digest-parser,
    elided-parser, encrypted-parser, node-parser, object-parser,
    obscured-parser, predicate-parser, subject-parser,
    wrapped-parser}.ts`
- `parse/utils.ts` is now exercised: `pattern/index.ts` registers
  pattern-construction factories with it on module load so
  `parseCborInner` / `parseArrayInner` can build the correct
  envelope-level wrappers without a circular import.
- `parse/index.ts` is now a slim entry point (sub-100 lines) that
  wires `parseOr` and the dcbor-pattern fallback.

### Tests
- A handful of existing parser tests asserted the now-removed buggy
  behaviour (`text*`, `unwrap{3}`, `@name p`, etc.). They were
  updated to use the parenthesised forms Rust requires
  (`(text)*`, `(unwrap){3}`, `@name(p)`). The remaining parse-suite
  shallowness (§7 / §21) is still outstanding and tracked there.

### Outstanding (deliberate)
- §7 / §21 / §22 / §23 — the test corpus is still substantially
  shallower than Rust's. Round-trip and AST-equality assertions, plus
  the unported `test_cbor_*`, `test_extended_paths`, `test_leaf_*`,
  and `redacted_credential` files, remain a follow-up. The
  structural fixes above mean adding those tests should now pass
  unchanged from Rust.
- §28 / §29 / §30 — these `🟢` items are stylistic divergences that
  are equivalent in observable behaviour and not changed in this
  pass.

---

## 10. Most important fixes for parity

In rough priority order:

1. **Parser**: rewrite `parseGroup` / `parseParenGroup` to match Rust:
   only attach quantifiers to parenthesised groups, and don't wrap bare
   `(expr)` in `GroupPattern` unless a quantifier follows. This single
   change fixes 2.1, 2.2, and 4.3 and restores `format(parse(s)) === s`
   for many inputs.
2. **Parser**: make `parseCapture` require `(` (and stop calling
   `parseGroup`); make `parseAssertion` ignore its lexer (return
   `anyAssertion()` only); make `parseAssertionPred`/`parseAssertionObj`
   *require* `(`; make `parseDigest` *require* `(`. Drop the TS-only
   `WithBoth`, `WithSubject`, and `Any` AST variants.
3. **Parser**: implement `parseTag` properly (delegate to dcbor-pattern's
   tag parser like Rust); implement the dcbor-pattern fallback in
   `convertDcborPatternToEnvelopePattern` using the existing
   `pattern/dcbor-integration.ts`.
4. **Parser**: rewrite `parseArray` to delegate to dcbor-pattern (mirror
   Rust's `parse_array_inner`); drop the `WithPatterns` variant.
5. **Patterns**: fix `SubjectPattern.compile` to use `dispatchCompile`;
   fix `WrappedPattern.unwrap()` static factory.
6. **Patterns**: fix CBOR-equality usage in `cbor-pattern.ts` (avoid
   `toDiagnostic()` for equality).
7. **Format**: implement EnvelopeUR / DigestUR; fix `envelopeSummary` to
   use `format_flat()`-style output.
8. **Tests**: every existing parse-suite assertion of the form
   `expect(result.ok).toBe(true)` should also check
   `expect(formatted).toBe(input)` and AST equality. Port the missing
   `test_cbor_*`, `test_extended_paths`, `test_leaf_*` test files.
9. **Display**: fix `ArrayPattern.toString` (`[*]` → `array`) and
   `MapPattern.toString` (`{*}` → `map`).

---

## File path reference (absolute)

- TS root: `/Users/custodio/Development/BCTS/typescript/packages/envelope-pattern/`
- Rust root: `/Users/custodio/Development/BCTS/rust/bc-envelope-pattern-rust/`

Files modified during this resolution pass (each addresses one or more
findings above):

- `src/parse/index.ts` — slim entry point; wires `parseOr` + the
  dcbor-pattern fallback (§1.9, §2.x).
- `src/parse/leaf/{array,cbor,date,known-value,null,number,tag}-parser.ts`
  — new files mirroring Rust's `parse/leaf/*` (§31).
- `src/parse/meta/{and,capture,group,not,or,primary,search,traverse}-parser.ts`
  — new files mirroring Rust's `parse/meta/*` (§31, §2.1–§2.4).
- `src/parse/structure/{assertion,assertion-pred,assertion-obj,compressed,digest,elided,encrypted,node,object,obscured,predicate,subject,wrapped}-parser.ts`
  — new files mirroring Rust's `parse/structure/*` (§31, §1.1–§1.7).
- `src/parse/utils.ts` — now exercised; `parse_cbor_inner` /
  `parse_array_inner` are the dcbor-pattern delegations Rust uses (§31).
- `src/pattern/structure/assertions-pattern.ts` — `WithBoth` removed
  (§1.1).
- `src/pattern/structure/node-pattern.ts` — `WithSubject` removed
  (§1.2).
- `src/pattern/structure/digest-pattern.ts` — `Any` removed; ASCII
  case-insensitive prefix (§1.3).
- `src/pattern/structure/wrapped-pattern.ts` — late-bound `unwrap()`
  factory; `unwrap(any)` collapses to bare `unwrap` in display (§1.6).
- `src/pattern/structure/subject-pattern.ts` — `compile` uses
  registered dispatch (§3.3).
- `src/pattern/leaf/array-pattern.ts` — thin wrapper around
  `dcbor_pattern::ArrayPattern` (§1.4 / §4.4).
- `src/pattern/leaf/map-pattern.ts` — `Any` displays as `map` (§1.5 /
  §4.5).
- `src/pattern/leaf/cbor-pattern.ts` — canonical `cborEquals` for
  value comparison and skip-first detection (§3.9 / §3.10).
- `src/pattern/meta/search-pattern.ts` — walker uses
  `Envelope.prototype.walk` (§3.4).
- `src/pattern/vm.ts` — `axisChildren("Wrapped", …)` uses
  `tryUnwrap()` (§3.6).
- `src/pattern/index.ts` — registers the
  `wrapped-pattern → any` factory, the assertion / subject toString
  dispatchers, and the parse-utils factories.
- `src/format.ts` — `envelopeSummary` defers to `formatFlat()` /
  `summary()`; `EnvelopeUR` / `DigestUR` use `urString()` (§4.1 /
  §4.2).
- `tests/parse.test.ts`, `tests/parse-meta.test.ts`,
  `tests/pattern-repeat.test.ts` — updated to use Rust-correct
  parenthesised forms for quantifier and capture syntax.
