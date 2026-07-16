# KMP size probe — results (2026-07-16)

Question: would Kotlin Multiplatform cost the same app size as the Rust core?

Method: the same logic slice jist-core carries (main's own `Models.kt` verbatim +
a platform-free port of the theme cascade), compiled with Kotlin/Native 2.1.20
as a static release framework (iosArm64), linked into the same bare SwiftUI app
used to measure the Rust numbers. Release device build, `strip -STx`, binary diff.

| Configuration                        | Stripped binary | Delta vs bare |
|--------------------------------------|-----------------|---------------|
| Bare app                             | 67 KB           | —             |
| + pure-Swift Jist (pre-Rust, main)   | 372 KB          | 305 KB        |
| + Rust-core Jist (full SDK)          | 1,089 KB        | 1,022 KB      |
| Rust core premium (vs pure Swift)    |                 | **~717 KB**   |
| + KMP probe (logic only, no renderer)| 2,339 KB        | **~2,272 KB** |

- KMP framework artifact: 6.1 MB (static, release).
- The KMP delta is the *floor*: Kotlin/Native runtime + GC + stdlib +
  kotlinx-serialization + our logic, dead-stripped. ~3.2× the Rust premium.
- Web: no KMP path to the Rust core's ~79 KB gzipped wasm (Kotlin/Wasm needs
  WasmGC and produces substantially larger bundles; Kotlin/JS larger still).

Not measured here (acknowledged KMP advantages): Kotlin language homogeneity
with the Android team, JetBrains/Google backing, Swift Export maturing through
2026, optional Compose Multiplatform UI sharing (which would, however, replace
the native renderers Jist's identity depends on).
