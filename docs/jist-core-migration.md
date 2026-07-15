# Jist Core Migration — Shared Rust Core via UniFFI

**Status:** Core migration complete on all three platforms (2026-07-15). Models, parsing, JSON value type, and the theme resolver live in `jist-core` (Rust); iOS/Android/Web consume generated bindings. All four test suites green. Remaining: FontResolver growth (PR 5), validator (PR 6), CI + distribution packaging.
**Branch:** `feat/jist-core-migration`
**Owner:** TBD

## Progress

| PR | Status | Commit |
|---|---|---|
| PR 1 — Tagged schemas + validator | ✅ Landed | `746ee89` |
| PR 2a — Rust workspace + UniFFI hello world scaffold | ✅ Landed | `cc06339` |
| PR 3a — Canonical Models + parser in Rust (`core/jist-core/src/models.rs`) | ✅ 16 tests pass | — |
| PR 3b (web) — Web consumes Rust model via wasm; inline TS types deleted | ✅ 16/16 snapshots | — |
| PR 3b (iOS) — iOS consumes Rust model via UniFFI; `Models.swift` + `JistValue.swift` deleted | ✅ 16/16 snapshots | — |
| PR 3b (Android) — Android consumes Rust model via UniFFI; `Models.kt` deleted | ✅ 16/16 Paparazzi vs committed baselines | — |
| PR 4 — ThemeResolver in Rust (cascade + hex + font-weight buckets); Swift/Kotlin resolvers are thin shims | ✅ 7 Rust tests + both snapshot suites | — |
| PR 5 — Port FontResolver to Rust | ⏳ Pending (weight table already in Rust; family/fallback logic when it grows) |
| PR 6 — Template validator to Rust | ⏳ Pending |
| Packaging — XCFramework / AAR-embedded `.so` / npm, CI Rust builds | ⏳ Next (local dev uses `ios/Libs` + `jniLibs` + `web/src/wasm`) |

### Measured result (2026-07-15)

Hand-written, per-platform model/value/resolver code, before → after:

| Platform | Before | After | Δ |
|---|---|---|---|
| iOS (`Models.swift` + `JistValue.swift` + `ThemeResolver.swift`) | 397 | 133 (shim + conveniences) | **−264** |
| Android (`Models.kt` + `ThemeResolver.kt`) | 281 | 145 (shim + aliases) | **−136** |
| Web (inline model types in `jist-renderer.ts`) | 410 | 351 | **−59** |
| **Per-platform total** | **1,088** | **429** | **−659 (−61%)** |

Replaced by **one** Rust source: 751 production LOC (`models.rs` 525 + `theme_resolver.rs` 226) plus 369 LOC of unit tests — coverage that previously did not exist on any platform (23 tests, run on every build, against the real `shared/` fixtures).

Verification (all on 2026-07-15):
- `cargo test -p jist-core` → 23/23
- iOS `swift test` (macOS host, snapshot A/B against pre-change output) → 16/16 byte-identical
- Android `./gradlew :jist:verifyPaparazziDebug` → 16/16 **against the committed baselines**
- Web Playwright → 16/16
- Android example app compiles (fixed pre-existing missing `res/raw` — it had never compiled)

Artifact sizes: web wasm 213 KB; Android `.so` 571 KB (arm64, stripped) — above the ≤500 KB target; the main lever is cfg-ing the UniFFI scaffolding out of the wasm build and trimming `serde_json`. Tracked as follow-up.

### Reality re-audit (2026-07-14)

Re-measured against current `main`. The pitch holds — more strongly than at the time of the original before/after doc:

- **The theme cascade is copy-paste across languages.** `ThemeResolver.swift:22-42` and `ThemeResolver.kt:23-45` are the same seven-branch dark/variant/state fallback, statement for statement. Every future branch must be hand-added twice.
- **The image `width` field has already drifted into three representations** of one JSON concept: iOS enum `JistImageWidth`, Android untyped `JsonPrimitive` + getters, Web `number | "fill"` union. Drift the pitch predicted has already happened.
- **Font-weight table is a latent trap:** Swift maps `<200 → ultraLight`, Kotlin maps `<200 → Thin`. They correspond only because a human knows iOS `ultraLight` ≈ Android `Thin` ≈ weight 100. Nothing enforces it.
- **Hex color parsing** (6/8-digit) is reimplemented in Swift `Color(hex:)` and Kotlin `parseHexColor`.
- **`missing type` handling already diverges:** Swift throws, Kotlin returns `Unknown`, Web skips. Rust unifies this by construction (`models.rs` → `JistNode::Unknown` for unknown `type`).

Verdict: porting Models + ThemeResolver collapses ~530 LOC of genuinely redundant logic to one and closes four live drift risks. Renderers (~1,375 LOC) correctly stay native.

### What's been verified locally

Running `core/build-all.sh` end-to-end:

| Target | Result | Artifact size |
|---|---|---|
| Host (`aarch64-apple-darwin`) | ✅ `cargo test` passes | n/a |
| `aarch64-apple-ios` (device) | ✅ Cross-compile | 36 MB unstripped `.a` (shrinks hugely when linked) |
| `aarch64-apple-ios-sim` | ✅ Cross-compile | 36 MB unstripped `.a` |
| `arm64-v8a` (Android) | ✅ via cargo-ndk | **315 KB** stripped `.so` |
| `x86_64` (Android) | ✅ via cargo-ndk | **347 KB** stripped `.so` |
| `wasm32-unknown-unknown` | ✅ via wasm-pack | **35 KB** `.wasm` + 5 KB JS loader |
| UniFFI Swift bindings | ✅ Generated | `jistVersion()` exposed as idiomatic Swift |
| UniFFI Kotlin bindings | ✅ Generated | `jistVersion()` exposed as idiomatic Kotlin |
| Web TypeScript compile | ✅ Unchanged | No regressions from schema tagging |
| iOS Swift package build | ✅ Unchanged | No regressions from schema tagging |

These sizes are for the hello-world scaffold only; they'll grow as logic ports land. The `≤500 KB per platform` budget documented below is against final sizes, not today's.

### Also verified after initial scaffold

- **Android `:jist:compileReleaseKotlin`** — compiles unchanged (`./gradlew :jist:compileReleaseKotlin`)
- **Web Playwright snapshot tests** — **all 16 pass** byte-for-byte (`npx playwright test`): 9 template variants × light/dark modes. Schema tagging caused zero visual regressions.

### Not yet verified

- iOS snapshot tests (swift-snapshot-testing) — need a specific simulator boot flow; low risk since the Swift package build + compilation already succeeds with no model/schema consumption of `x-jist-tag`
- Android Paparazzi snapshot tests — similar story; unit-level Kotlin compile succeeds
- Builder app runtime (uses AJV with `strict: false`, so `x-jist-tag` is ignored; low risk)

---

---

## TL;DR

Introduce a shared Rust core (`jist-core`) that owns all non-rendering logic — models, theme resolution, font resolution, template validation, and (later) an expression engine — exposed to iOS, Android, and Web via auto-generated idiomatic bindings. Each platform keeps its native renderer (SwiftUI / Compose / Custom Elements) and its snapshot-test suite. We eliminate 3× duplication of logic while preserving everything that makes Jist distinct.

**Binary footprint:** ~200–500 KB per platform (static Rust core) vs ~15–20 MB for Kotlin Multiplatform. Acceptable for a lean library.

**Prior art:** Signal's [libsignal](https://github.com/signalapp/libsignal), Mozilla's [application-services](https://github.com/mozilla/application-services), 1Password — all ship Rust cores across iOS + Android + Web in production.

---

## Goals

- **Single source of truth** for non-rendering logic; stop hand-porting every feature three times.
- **Zero runtime tax** beyond what a statically linked Rust library costs. Jist must stay lean.
- **Per-platform native rendering preserved** — SwiftUI, Compose, Custom Elements continue to own the view layer.
- **Snapshot-test parity preserved** — the pixel-regression moat stays intact on all three platforms.
- **Idiomatic host APIs** — iOS consumers write Swift, Android consumers write Kotlin, Web consumers write TS. They never see Rust.
- **Incremental, reversible rollout** — each PR in the stack is independently reviewable, shippable, and revertible.

## Non-goals

- Rendering logic in Rust. Native renderers stay.
- Compose Multiplatform, Kotlin Multiplatform, or any shared-UI framework.
- Replacing Jist's JSON-driven philosophy. Authoring stays JSON.
- Feature expansion during the migration. Each port is behavior-preserving; new capabilities (expression DSL, etc.) are follow-on work.

---

## Target architecture

```
                spec/*.json  (canonical schema, tagged IDs)
                    │
                    ▼
        ┌───────────────────────────┐
        │    jist-core  (Rust)      │
        │  ├── models               │
        │  ├── theme_resolver       │
        │  ├── font_resolver        │
        │  ├── validator            │
        │  └── (later) expressions  │
        │                           │
        │    UniFFI interface (.udl)│
        └─────┬─────────┬──────────┬┘
              │         │          │
      cargo + │  cargo + │    wasm-│
      cbindgen│  cargo-ndk│   pack │
              ▼         ▼          ▼
         XCFramework   AAR      npm pkg
         (iOS)        (Android) (.wasm + TS)
              │         │          │
              ▼         ▼          ▼
         Swift       Kotlin      TypeScript
         renderer    renderer    custom element
         (SwiftUI)   (Compose)   (DOM)
              │         │          │
         snapshot   snapshot   snapshot (Playwright)
         tests      tests      tests
```

Each renderer calls into `jist-core` for logic (e.g., `resolve_theme`, `resolve_font`, `validate_template`) and handles all view construction itself.

---

## Stacked PR sequence

Each PR is independently mergeable and additive. If we stop at any point, what we have is still a net improvement.

### **PR 1** — Tagged schemas + quicktype model codegen *(no Rust yet)*

**Scope**
- Add stable numeric `tag` identifiers to every component, property, and event in `spec/*.json` (protobuf-style discipline, inspired by Redwood's schema format).
- Introduce a build step that runs [quicktype](https://github.com/quicktype/quicktype) on `spec/*.json` to generate:
  - `web/src/generated/models.ts`
  - `ios/Sources/Jist/Generated/Models.swift`
  - `android/jist/src/main/java/io/customer/jist/generated/Models.kt`
- Replace hand-written model types with generated ones.
- CI check: schemas + generated models are in sync; tag collisions and removals fail the build.

**Why first**
- Immediate dedup win for type definitions.
- Validates "schema as source of truth" before committing to Rust.
- Tags are prerequisite infrastructure for every subsequent PR — they become Rust struct field tags and wire identities.
- Reversible with minimal blast radius.

**Done criteria**
- Three platforms build against generated models.
- All existing snapshot tests pass unchanged.
- CI fails on tag collision, tag removal, or schema/generated-code drift.

**Estimated size:** Medium. ~1–2 weeks.

---

### **PR 2** — Rust infrastructure + hello-world `jist-core` *(the toolchain pilot)*

**Scope**
- Add `/core/` directory with Cargo workspace.
- Set up UniFFI interface (`.udl`) exposing one trivial function: `fn jist_version() -> String`.
- iOS: `cargo build --target aarch64-apple-ios` + `aarch64-apple-ios-sim` + `x86_64-apple-ios-sim`, bundled into an XCFramework, consumed via SwiftPM binary target.
- Android: `cargo-ndk` build for `arm64-v8a`, `armeabi-v7a`, `x86_64`; packaged into an AAR; consumed via Gradle dependency.
- Web: `wasm-pack build --target web`; published as a local workspace package, consumed by the web renderer.
- CI: build all three artifacts on every PR; verify they load and `jist_version()` returns a value on each platform.
- `docs/rust-build.md` covering local build steps.

**Why second**
- Proves the toolchain end-to-end before any real code is ported.
- Isolates build-pipeline risk from logic-port risk.
- Smallest possible real-world test of UniFFI bindings on all three targets.

**Done criteria**
- All three platforms can call `jist_version()` from their renderer code.
- CI builds Rust artifacts for all targets and caches them appropriately.
- Binary-size delta measured and documented (baseline: current Jist bundle sizes).

**Estimated size:** Large. ~2–3 weeks. Most of the risk is in this PR — build-system integration always has surprises.

---

### **PR 3** — Port `Models` to Rust

Split into two independently reviewable halves. **3a is written** (`core/jist-core/src/models.rs`); 3b needs a compiler.

#### PR 3a — Canonical model + parser *(written 2026-07-14)*

**Delivered**
- `core/jist-core/src/models.rs`: `JistTemplate`, the `JistNode` union (internally tagged on `type`), every node type, `JistSpacing`, the `ImageWidth` union (`number | "fill"`), `JistActionEvent`, `JistMode`.
- `parse_template()` and `parse_registry()` via `serde_json`.
- Unknown `type` → `JistNode::Unknown` (unifies the Swift-throws / Kotlin-Unknown / Web-skips divergence). Unknown *properties* on known nodes are ignored (forward compat).
- Unit-test suite covering every node type, the width union (fill/fixed/absent), meta preservation, forward-compat, serialize→parse round-trip, and **the real `shared/templates.json` registry** (all 9 templates).

**Verification status — validated 2026-07-14**
- ✅ `cargo test -p jist-core` → **15 passed, 0 failed** on `rustc 1.93.1` (14 model tests + the existing version smoke test).
- ✅ Cross-compiles for platform targets with the new module: `aarch64-apple-ios` (`libjist_core.a`, 36M unstripped) and `wasm32-unknown-unknown` (`jist_core.wasm`, 52K).
- ✅ `cargo clippy` clean for `models.rs`/`lib.rs`. (One pre-existing lint remains in UniFFI-*generated* scaffolding under `-D warnings`; not introduced by PR 3.)
- Reproduce:
  ```bash
  cd core
  cargo test  -p jist-core
  cargo build -p jist-core --target aarch64-apple-ios     --release
  cargo build -p jist-core --target wasm32-unknown-unknown --release
  ```

#### PR 3b (web) — Web consumes the Rust model via wasm *(done, validated 2026-07-14)*

**Delivered**
- `parse_template(json)` exposed from `jist-core` to the web via `wasm-bindgen` (`lib.rs`, cfg-gated to `wasm32`). The `<jist-template>` element initializes the wasm once (top-level `await`), then parses/normalizes every template through Rust on the synchronous render path.
- Model **types** generated from the Rust structs via `tsify` (cfg-gated to `wasm32` so iOS/host builds are untouched). `web/src/jist-renderer.ts` deleted its hand-written node interfaces and now imports/re-exports the generated types.

**Result (measured)**
- `web/src/jist-renderer.ts`: **410 → 351 lines** (−59). Net **−45 lines** of hand-maintained TS across the web source; **~92 lines of hand-written model types → 0** (now generated from Rust).
- Web Playwright snapshots: **16/16 pass**, byte-for-byte — rendering through the Rust-parsed tree is identical.
- Host `cargo test` (15/15) and the iOS cross-build stay green — tsify never enters the non-wasm dependency tree.
- `jist_core_bg.wasm` ≈ 196 KB unoptimized (UniFFI scaffolding is currently compiled into the wasm too; `wasm-opt` is disabled. Cfg-gating UniFFI out of wasm + enabling `wasm-opt` is a follow-up size win).

#### PR 3b (iOS/Android) — Expose the model across UniFFI *(next)*

**Scope**
- UniFFI (Swift/Kotlin): expose `parse_template(json) -> JistTemplate` returning the typed tree. The recursive `JistNode` maps to a UDL `[Enum] interface` / Rust recursive enum.
- Platform renderers consume the Rust-provided tree; delete `Models.swift`, `Models.kt`, `JistValue.swift`.

**Key FFI decision:** arbitrary JSON (`meta`, action `data`) crosses the boundary as a **raw JSON `String`**, not a typed map — UniFFI/UDL has no `Any`/`JsonObject` type, and the renderers only forward these bags to host callbacks. Keep the Rust model rich (`serde_json::Value`) and stringify at the FFI edge. (On web this is already handled: `meta` surfaces as `Record<string, unknown>`.)

**Done criteria**
- `shared/` fixtures parse through Rust and produce equivalent in-memory trees on iOS + Android.
- Snapshot tests pass unchanged.
- Hand-written model files deleted.

**Estimated size:** 3a — done. 3b web — done. 3b iOS/Android — Medium, ~1 week (recursive UniFFI enum is the main risk).

---

### **PR 4** — Port `ThemeResolver` to Rust *(biggest dedup win)*

**Scope**
- Theme cascade (base → variant → dark-mode override) moves to Rust.
- UniFFI exposes `resolve_theme(theme: Theme, variant: Option<String>, mode: ColorMode) -> ResolvedTheme`.
- iOS/Android/Web theme-resolution code deleted; renderers call into the Rust resolver.
- Parity enforced by existing snapshot tests + new Rust unit tests for the resolver itself.

**Why**
- Theme logic is the most duplicated, most subtle logic in Jist today — genuine three-way divergence risk.
- High visibility of correctness via snapshot diffs.

**Done criteria**
- All 18 baseline snapshots (9 templates × 2 modes) per platform match byte-for-byte.
- `jist-core::theme_resolver` has ≥90% unit test coverage.

**Estimated size:** Medium. ~1–2 weeks.

---

### **PR 5** — Port `FontResolver` to Rust *(consolidate PR #7's logic)*

**Scope**
- Weight-matching + fallback-stack resolution moves to Rust.
- Font *registration* stays per-platform (`CTFontManager` on iOS, `res/font` on Android, `@font-face` on web) because those are platform APIs that can't cross FFI.
- UniFFI exposes `resolve_font(family: String, weight: u16, stack: Vec<String>, available: Vec<FontDescriptor>) -> FontSpec`.
- Platform code calls `resolve_font` to pick which concrete font to load.

**Why**
- PR #7 just added this logic three times. Consolidate before it diverges.
- Font weight matching is subtle — centralizing prevents drift.

**Done criteria**
- All existing PR-#7 snapshot baselines match.
- Each platform's font registration code is a thin shim over the Rust resolver.

**Estimated size:** Small–Medium. ~1 week.

---

### **PR 6** — Template validator in Rust

**Scope**
- JSON Schema validation moves into Rust (crate: `jsonschema` or equivalent).
- UniFFI exposes `validate_template(json: String) -> ValidationResult`.
- Platform-specific AJV/equivalent validators removed.

**Why**
- Validation semantics were never perfectly identical across platforms. Fix by construction.

**Done criteria**
- Identical validation errors (same codes, same paths) on all three platforms for the same input.

**Estimated size:** Small. ~3–5 days.

---

### **PR 7+** — Future work (not part of this migration)

Opportunities once the core is in place:
- **Expression engine** — DivKit-style `@{}` interpolation, typed variables, ternary, try-operator. Pure computation, perfect Rust fit.
- **Action system** — structured events with payload types.
- **Variant state machines** — runtime variable mutation driving component state.

Each is a standalone follow-on PR; none are blocking.

---

## Technical decisions

### Why UniFFI (not cbindgen + hand-written wrappers)
- Generates idiomatic Swift and Kotlin — enums map to Swift enums / Kotlin sealed classes, `Option<T>` becomes Swift `Optional` / Kotlin nullable, errors propagate as exceptions.
- Used in production by Mozilla (Firefox Sync, Firefox Accounts) and others.
- Reduces the hand-written-glue surface to near zero.

### Why static linking (not dynamic frameworks)
- Smaller binary on iOS.
- Fewer App Store review surprises.
- No dlopen / runtime loading complexity.

### Web: WASM vs Kotlin/JS vs JS-compiled-from-Rust
- **WASM chosen.** Ships as `.wasm` + ~50–200 KB JS loader shim. Modern browser support is universal. `wasm-pack` produces a clean ESM module.
- Bundle cost is real but smaller than any equivalent alternative.
- If the bundle cost proves unacceptable for specific deployments, web can fall back to hand-written TS for that release — it's decoupled.

### Versioning & API stability
- `jist-core` is an internal implementation detail, not a public API. No semver commitment to external consumers of the Rust crate.
- The *Swift/Kotlin/TS APIs exposed by the generated bindings* follow Jist's existing public-API semver policy.

### Build & CI
- Rust toolchain pinned via `rust-toolchain.toml`.
- Pre-built artifacts cached per-commit; rebuilt only when `core/**` changes.
- Snapshot-test CI runs unchanged — the Rust artifacts are just another input.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **FFI complexity surprises the team** | PR 2 is the pilot; we accept a longer timeline for it and don't proceed until the toolchain is green on all three platforms. |
| **Rust skill gap on the team** | Scope is small (~2–3k LOC of pure computation). Pair on PR 2. Every PR is reviewable by someone who doesn't read Rust — the Swift/Kotlin/TS surface is what matters for consumers. |
| **Debugging across FFI is harder** | UniFFI generates sensible error types. Log at the boundary. Keep Rust panics impossible (use `Result` everywhere). |
| **Build times regress** | Cache Rust artifacts aggressively. Only rebuild on `core/**` changes. Measure and report on every PR. |
| **iOS binary size grows unacceptably** | PR 2 documents the baseline. Target: ≤500 KB added per platform. If exceeded, reassess. |
| **Web WASM bundle too heavy for a specific consumer** | Keep the hand-written TS renderer buildable as a fallback. WASM is the default; not a lock-in. |
| **We regret the migration partway** | Every PR in the stack is reversible. Stop after any PR and what remains is a net improvement (tags + generated models alone are worth it). |

---

## Testing strategy

- **Snapshot tests** (existing) — the primary parity enforcement mechanism. Every port PR must pass all existing baselines byte-for-byte. No rebaselining allowed in a port PR; baselines only change in explicit feature PRs.
- **Rust unit tests** (new) — each Rust module has its own unit-test suite. `jist-core` targets ≥85% coverage.
- **FFI smoke tests** (new) — each platform has a small integration test that exercises the UniFFI boundary directly (not via the renderer).
- **Binary-size check** (new, PR 2) — CI measures and reports binary delta on every PR.

---

## Sequencing & dependencies

```
PR 1 (tagged schemas + quicktype)
  │
  ▼
PR 2 (Rust infra + hello world)  ← longest, riskiest
  │
  ▼
PR 3 (Models to Rust — replaces quicktype)
  │
  ├──▶ PR 4 (ThemeResolver)     ─┐
  ├──▶ PR 5 (FontResolver)       │  Can parallelize after PR 3 lands
  └──▶ PR 6 (Validator)         ─┘
```

PRs 4–6 are independent after PR 3 and can be authored/reviewed in parallel by different people.

---

## Open questions for sign-off

1. **Team Rust readiness** — who owns PR 2? Comfort level with cargo + UniFFI + platform build systems?
2. **Binary-size ceiling** — is ≤500 KB per platform acceptable? Need to confirm with consumers of Jist.
3. **Web WASM** — any known deployment context that can't load WASM? (Older browsers, strict CSPs without `wasm-unsafe-eval`.)
4. **CI budget** — adding Rust builds adds CI minutes. Is there a budget constraint?
5. **Timeline** — do we want all 6 PRs landed in one quarter, or stretched across two?

---

## Sources / prior art

- [Signal libsignal — Rust shared across all platforms](https://github.com/signalapp/libsignal)
- [Mozilla application-services — UniFFI in production](https://github.com/mozilla/application-services)
- [Mozilla UniFFI — Rust → Swift/Kotlin bindings](https://github.com/mozilla/uniffi-rs)
- [Redwood schema format (tagged IDs inspiration)](https://github.com/cashapp/redwood/blob/trunk/redwood-layout-schema/redwood-api.xml)
- [quicktype — JSON Schema → multi-language models](https://github.com/quicktype/quicktype)
