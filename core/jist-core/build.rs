fn main() {
    uniffi::generate_scaffolding("src/jist_core.udl").expect("UniFFI scaffolding generation failed");
}
