@testable import Jist
import SwiftUI
import XCTest

/// Unit coverage for `JistImageLoader`, the load/dedup logic behind the iOS 13/14 `AsyncImage`
/// backport (`JistAsyncImage`). The loader isn't `#available`-gated, so — unlike the view wrapper —
/// it runs on the iOS 15+ CI simulator, giving direct coverage of the behavior raised in review:
/// repeated appearances during an in-flight request must NOT restart the load, and a URL change must.
@MainActor
final class JistImageLoaderTests: XCTestCase {
    /// Records each fetch and lets the test resolve them on demand (simulating in-flight requests).
    private final class FakeFetch {
        private(set) var urls: [URL] = []
        private var completions: [@Sendable (Data?) -> Void] = []
        func fetch(_ url: URL, _ completion: @escaping @Sendable (Data?) -> Void) {
            urls.append(url)
            completions.append(completion)
        }

        func resolveFirst(_ data: Data?) { completions.first?(data) }
        func resolveLast(_ data: Data?) { completions.last?(data) }
    }

    private let url1 = URL(string: "https://example.com/a.png")!
    private let url2 = URL(string: "https://example.com/b.png")!

    func test_load_whenSameURLRepeatedWhileInFlight_fetchesOnce() {
        let fake = FakeFetch()
        let loader = JistImageLoader(fetch: fake.fetch)
        // Three appearances (e.g. scroll off/on) while the first request is still in flight.
        loader.load(url: url1) { _ in }
        loader.load(url: url1) { _ in }
        loader.load(url: url1) { _ in }
        XCTAssertEqual(fake.urls, [url1]) // exactly one request, not three
    }

    func test_load_whenURLChanges_fetchesAgain() {
        let fake = FakeFetch()
        let loader = JistImageLoader(fetch: fake.fetch)
        loader.load(url: url1) { _ in }
        loader.load(url: url2) { _ in }
        XCTAssertEqual(fake.urls, [url1, url2])
    }

    func test_load_whenNewURL_emitsLoadingImmediately() {
        let fake = FakeFetch()
        let loader = JistImageLoader(fetch: fake.fetch)
        var phases: [String] = []
        loader.load(url: url1) { phases.append($0.label) }
        XCTAssertEqual(phases, ["loading"])
    }

    func test_load_whenStaleResultArrivesAfterURLChange_isIgnored() {
        let fake = FakeFetch()
        let loader = JistImageLoader(fetch: fake.fetch)
        var lastPhase: String?
        loader.load(url: url1) { lastPhase = $0.label } // request #1 (superseded below)
        loader.load(url: url2) { lastPhase = $0.label } // request #2 becomes current; emits .loading

        let exp = expectation(description: "stale result ignored")
        fake.resolveFirst(nil) // request #1 resolves LATE (url1 no longer current)
        DispatchQueue.main.async {
            // url1's result must be dropped, so the last emitted phase stays url2's `.loading`.
            XCTAssertEqual(lastPhase, "loading")
            exp.fulfill()
        }
        wait(for: [exp], timeout: 1)
    }

    #if canImport(UIKit)
    func test_load_whenDataDecodes_emitsSuccess() {
        let fake = FakeFetch()
        let loader = JistImageLoader(fetch: fake.fetch)
        let exp = expectation(description: "success")
        loader.load(url: url1) { if case .success = $0 { exp.fulfill() } }
        fake.resolveLast(Self.onePixelPNG)
        wait(for: [exp], timeout: 1)
    }

    func test_load_whenDataNil_emitsFailure() {
        let fake = FakeFetch()
        let loader = JistImageLoader(fetch: fake.fetch)
        let exp = expectation(description: "failure")
        loader.load(url: url1) { if case .failure = $0 { exp.fulfill() } }
        fake.resolveLast(nil)
        wait(for: [exp], timeout: 1)
    }

    /// A minimal valid 1×1 PNG so `UIImage(data:)` decodes to a real image.
    private static let onePixelPNG = Data(
        base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
    )!
    #endif
}

private extension JistImageLoader.Phase {
    var label: String {
        switch self {
        case .loading: return "loading"
        case .success: return "success"
        case .failure: return "failure"
        }
    }
}
