import XCTest
@testable import Jist

/// Unit tests for the CSS font-family stack parser used by `JistThemeResolver.resolveFont`.
/// The portal emits web-safe families unquoted (`Helvetica, sans-serif`) but custom families
/// quoted (`'Abril Fatface', sans-serif`); browsers strip those quotes and so must we, or a
/// quoted custom family never matches a registered font and always falls back to system.
final class FontStackParsingTests: XCTestCase {

    func test_unquotedStack_splitsAndTrims() {
        XCTAssertEqual(parseFontStack("Helvetica, sans-serif"), ["Helvetica", "sans-serif"])
    }

    func test_singleQuotedCustomFamily_stripsQuotes() {
        XCTAssertEqual(parseFontStack("'Abril Fatface', sans-serif"), ["Abril Fatface", "sans-serif"])
    }

    func test_doubleQuotedCustomFamily_stripsQuotes() {
        XCTAssertEqual(parseFontStack("\"Courier New\", monospace"), ["Courier New", "monospace"])
    }

    func test_extraWhitespaceAroundQuotes_trimmed() {
        XCTAssertEqual(parseFontStack("  '  Abril Fatface  '  , sans-serif "), ["Abril Fatface", "sans-serif"])
    }

    func test_singleFamilyNoStack_returnsOne() {
        XCTAssertEqual(parseFontStack("'Abril Fatface'"), ["Abril Fatface"])
    }

    func test_emptyEntries_dropped() {
        XCTAssertEqual(parseFontStack("Helvetica, , ''"), ["Helvetica"])
    }
}
