// Robustness suite: the parsing/resolution surface consumes untrusted,
// network-delivered JSON on end users' devices, and native panics abort the
// host app (panic=abort). These tests assert the one shared implementation
// never panics on hostile input — a guarantee that previously had to be
// established three times (Swift, Kotlin, TS) and was, in practice,
// established zero times.
//
// Dependency-free by design (seeded xorshift instead of proptest) so it runs
// on the pinned stable toolchain with no network. Deterministic seeds keep
// failures reproducible.

use jist_core::models::{parse_data, parse_registry, parse_template};
use jist_core::theme_resolver::{parse_hex_color, ThemeResolver};

const REGISTRY: &str = include_str!("../../../shared/templates.json");
const THEME: &str = include_str!("../../../shared/theme.json");

struct XorShift(u64);

impl XorShift {
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

/// Random byte soup (forced through UTF-8 lossy) must never panic any parser.
#[test]
fn random_garbage_never_panics() {
    let mut rng = XorShift(0x9E37_79B9_7F4A_7C15);
    for _ in 0..20_000 {
        let len = rng.below(256);
        let bytes: Vec<u8> = (0..len).map(|_| rng.next() as u8).collect();
        let s = String::from_utf8_lossy(&bytes);
        let _ = parse_template(&s);
        let _ = parse_registry(&s);
        let _ = parse_data(&s);
        let _ = parse_hex_color(&s);
    }
}

/// Real production templates with random byte corruption — the shape a
/// truncated download, bad cache, or malicious payload actually takes.
#[test]
fn mutated_real_templates_never_panic() {
    let mut rng = XorShift(0xDEAD_BEEF_CAFE_F00D);
    let original = REGISTRY.as_bytes();
    for _ in 0..3_000 {
        let mut bytes = original.to_vec();
        for _ in 0..=rng.below(8) {
            let i = rng.below(bytes.len());
            bytes[i] = rng.next() as u8;
        }
        let s = String::from_utf8_lossy(&bytes);
        // Must return Ok or Err — never abort.
        let _ = parse_registry(&s);
        let _ = parse_template(&s);
    }
}

/// Hex colors get the same treatment: random unicode, emoji, half-multibyte
/// sequences. (A byte-slicing panic here aborted the app before 2026-07-15.)
#[test]
fn random_hex_inputs_never_panic() {
    let mut rng = XorShift(0x1234_5678_9ABC_DEF0);
    for _ in 0..50_000 {
        let len = rng.below(12);
        let s: String = (0..len)
            .filter_map(|_| char::from_u32(rng.next() as u32 % 0x11_0000))
            .collect();
        let _ = parse_hex_color(&s);
        let _ = parse_hex_color(&format!("#{s}"));
    }
}

/// Deep-nesting bombs must be *rejected* (serde_json's recursion limit), not
/// blow the stack. 100k-deep arrays and 10k-deep node trees both return Err.
#[test]
fn hostile_nesting_is_rejected_not_stack_overflow() {
    let array_bomb = "[".repeat(100_000);
    assert!(parse_data(&format!("{{\"k\":{array_bomb}")).is_err());

    let node_bomb = format!(
        "{{\"version\":\"1\",\"root\":{}",
        "{\"type\":\"layout\",\"direction\":\"vertical\",\"children\":[".repeat(10_000)
    );
    assert!(parse_template(&node_bomb).is_err());
}

/// The resolver cascade must tolerate arbitrary lookup keys against a real
/// theme — including empty strings, unicode, and absurd lengths.
#[test]
fn resolver_lookups_never_panic() {
    let theme = parse_data(THEME).expect("real theme parses");
    let resolver = ThemeResolver::new(theme, true);
    let mut rng = XorShift(0x0F0F_F0F0_1111_2222);
    let weird = ["", "é", "🎨", "modes", "states", &"x".repeat(4096)];
    for _ in 0..5_000 {
        let pick = |rng: &mut XorShift| weird[rng.below(weird.len())].to_string();
        let _ = resolver.resolve(pick(&mut rng), Some(pick(&mut rng)), pick(&mut rng), pick(&mut rng), Some(pick(&mut rng)));
        let _ = resolver.resolve_int(pick(&mut rng), None, pick(&mut rng), pick(&mut rng));
        let _ = resolver.resolve_color(pick(&mut rng), None, pick(&mut rng), pick(&mut rng), None);
    }
}
