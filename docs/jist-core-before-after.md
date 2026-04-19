# Jist Core Migration — Before / After

A concrete, measured comparison of the current state vs the target state once shared logic lives in `jist-core`. The pitch is not "Rust is faster" — it's **"stop writing the same code three times."**

---

## 1. Duplication audit (measured today on `main`)

### Logic that's currently duplicated across platforms

| Concept | iOS (Swift) | Android (Kotlin) | Web (TS) | Cross-platform total |
|---|---|---|---|---|
| **Models** | `Models.swift` — 192 LOC | `Models.kt` — 154 LOC | inline in `jist-renderer.ts` — ~115 LOC | **461 LOC** |
| **Theme resolver** | `ThemeResolver.swift` — 135 LOC | `ThemeResolver.kt` — 127 LOC | (CSS handles cascade) — ~0 LOC | **262 LOC** |
| **Font resolver** (PR #7) | `ThemeResolver+FontResolver.swift` — ~141 LOC | in `JistTheme.kt` + `Renderer.kt` — ~50 LOC | CSS — ~0 LOC | **~191 LOC** |
| **Subtotal** | **~468 LOC** | **~331 LOC** | **~115 LOC** | **~914 LOC** |

**Of that ~914 LOC, roughly 530 LOC is pure redundancy** — the same algorithm written in two (or three) different languages.

### Logic that stays per-platform (and should)

| Concept | iOS (Swift) | Android (Kotlin) | Web (TS) | Total |
|---|---|---|---|---|
| **Renderer** (native view construction) | `Renderer.swift` — 477 LOC | `Renderer.kt` — 488 LOC | `jist-renderer.ts` — 410 LOC (incl. models above) | **1,375 LOC** |

Renderers emit SwiftUI / Compose / DOM respectively. They *should* stay per-platform — Jist's native-feel identity depends on it. No tool eliminates this duplication, and we don't want one to.

---

## 2. The duplication is literal

Here's `JistThemeResolver.resolve(...)` in Swift and Kotlin **side by side** from today's `main`. Read them. This is the same function in two languages.

**Swift** ([ios/Sources/Jist/ThemeResolver.swift:14](ios/Sources/Jist/ThemeResolver.swift:14)):
```swift
public func resolve(
    type: String,
    variant: String? = nil,
    group: String,
    property: String,
    state: String? = nil
) -> JistValue? {
    if let state = state {
        if isDark {
            if let v = variant,
               let val = dig(["modes", "dark", type, v, "states", state, group, property]) { return val }
            if let val = dig(["modes", "dark", type, "states", state, group, property]) { return val }
        }
        if let v = variant,
           let val = dig([type, v, "states", state, group, property]) { return val }
        if let val = dig([type, "states", state, group, property]) { return val }
    }

    if isDark {
        if let v = variant,
           let val = dig(["modes", "dark", type, v, group, property]) { return val }
        if let val = dig(["modes", "dark", type, group, property]) { return val }
    }
    if let v = variant,
       let val = dig([type, v, group, property]) { return val }
    if let val = dig([type, group, property]) { return val }

    return nil
}
```

**Kotlin** ([android/jist/src/main/java/io/customer/jist/ThemeResolver.kt:16](android/jist/src/main/java/io/customer/jist/ThemeResolver.kt:16)):
```kotlin
fun resolve(
    type: String,
    variant: String? = null,
    group: String,
    property: String,
    state: String? = null
): JsonPrimitive? {
    if (state != null) {
        if (isDark) {
            if (variant != null) {
                dig(listOf("modes", "dark", type, variant, "states", state, group, property))?.let { return it }
            }
            dig(listOf("modes", "dark", type, "states", state, group, property))?.let { return it }
        }
        if (variant != null) {
            dig(listOf(type, variant, "states", state, group, property))?.let { return it }
        }
        dig(listOf(type, "states", state, group, property))?.let { return it }
    }

    if (isDark) {
        if (variant != null) {
            dig(listOf("modes", "dark", type, variant, group, property))?.let { return it }
        }
        dig(listOf("modes", "dark", type, group, property))?.let { return it }
    }
    if (variant != null) {
        dig(listOf(type, variant, group, property))?.let { return it }
    }
    return dig(listOf(type, group, property))
}
```

Same algorithm. Same cascade order. Same edge cases. Any bug in one needs to be fixed in both — and verified via three platforms' snapshot tests. This is the drift surface.

---

## 3. After migration — what changes

### Logic layer (moves to Rust)

```
jist-core/src/
  models.rs              # ~350 LOC Rust (replaces 461 LOC across 3 platforms)
  theme_resolver.rs      # ~200 LOC Rust (replaces 262 LOC across 2 platforms)
  font_resolver.rs       # ~150 LOC Rust (replaces ~191 LOC across 2 platforms)
  validator.rs           # ~100 LOC Rust (new — consolidates per-platform AJV/etc.)
                         # ──────────
                         # ~800 LOC Rust total, replacing ~914 LOC duplicated
```

Estimates above are based on typical Rust-vs-Swift/Kotlin LOC ratios for pure data manipulation (Rust usually comes out slightly denser for this kind of code).

### Renderer layer (unchanged, stays per-platform)

```
ios/Sources/Jist/Renderer.swift       # 477 LOC — unchanged
android/.../Renderer.kt               # 488 LOC — unchanged
web/src/jist-renderer.ts              # 410 LOC — unchanged (except swap in generated models)
```

### Net effect

|                           | Today | After migration |
|---|---|---|
| Logic LOC duplicated across 2–3 platforms | **~914** | **0** |
| Shared-logic source of truth | 3 files in 3 languages | 1 set of files in Rust |
| Renderer LOC (per-platform native) | 1,375 | 1,375 |
| Platforms that must be touched for a logic bug | 2–3 | 1 |
| Platforms that must be touched for a new theme property | 3 | 1 (Rust) + 3 renderers consume the new field |
| Runtime overhead added | 0 | **~315–347 KB** Android `.so`, **~35 KB** WASM, **low-KB** iOS (after linker strips) |

---

## 4. Drift prevention (the part that matters most)

Right now, "parity" between Swift and Kotlin `ThemeResolver` is maintained by:
- Developer discipline (remember to port every change to both)
- Shared snapshot-test fixtures (catches visible drift, but only for the 9×2 = 18 tested scenarios)
- Code review (humans spotting differences in PRs)

After migration, parity is **guaranteed by construction**:
- There is one implementation, in Rust
- All three platforms call into it via FFI
- Unit tests run against the Rust implementation directly — no "iOS passed but Android failed" scenarios possible

PR #7 is the perfect example of the current pain: it added font-resolution logic to both Swift (141 LOC) and Kotlin (~50 LOC). Both now need to stay in sync forever. Today's snapshot tests caught the obvious cases — but every follow-up change is another opportunity to drift.

---

## 5. What was verified locally as part of the scaffold (commit cc06339)

| Check | Result |
|---|---|
| `cargo test` on host | ✅ 1 passed |
| `cargo build --target aarch64-apple-ios --release` | ✅ Compiled |
| `cargo build --target aarch64-apple-ios-sim --release` | ✅ Compiled |
| `cargo ndk -t arm64-v8a -t x86_64 build --release` | ✅ 315 KB / 347 KB stripped `.so` |
| `wasm-pack build --target web --release` | ✅ 35 KB `.wasm` + 5.2 KB JS |
| UniFFI Swift binding generation | ✅ `jistVersion()` idiomatic |
| UniFFI Kotlin binding generation | ✅ `jistVersion()` idiomatic |
| iOS `swift build` (existing target, unchanged) | ✅ No regressions |
| Web `tsc` build (existing target, unchanged) | ✅ No regressions |
| Android `:jist:compileReleaseKotlin` (existing target, unchanged) | ✅ No regressions |
| Working tree clean, no stray artifacts | ✅ |
| `cargo clippy` on our code | ✅ Clean (one upstream warning inside UniFFI-generated scaffolding code, not ours) |

---

## 6. The one-line pitch

> Jist's three renderers are the product. Jist's three `ThemeResolver` files are accidental duplication. This migration keeps the product, deletes the accident, and adds ≤500 KB per platform to do it.
