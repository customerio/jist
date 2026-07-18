package io.customer.jist

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for [normalizeFontName], the per-name normaliser used by [buildFontCache] to match a
 * theme's CSS font-family stack against the host-injected `fonts` map.
 *
 * The portal emits web-safe families unquoted (`Helvetica, sans-serif`) but custom families quoted
 * (`'Abril Fatface', sans-serif`); browsers strip those quotes and so must we, otherwise a quoted
 * custom family never matches an injected font and always falls back to the platform default.
 */
class FontNameNormalizationTest {

    @Test
    fun unquotedName_trimmedAndLowercased() {
        assertEquals("helvetica", normalizeFontName(" Helvetica "))
    }

    @Test
    fun singleQuotedName_quotesStripped() {
        assertEquals("abril fatface", normalizeFontName("'Abril Fatface'"))
    }

    @Test
    fun doubleQuotedName_quotesStripped() {
        assertEquals("courier new", normalizeFontName("\"Courier New\""))
    }

    @Test
    fun whitespaceInsideQuotes_trimmed() {
        assertEquals("abril fatface", normalizeFontName("  '  Abril Fatface  '  "))
    }

    @Test
    fun quotedAndUnquotedForms_normaliseEqual() {
        assertEquals(normalizeFontName("Abril Fatface"), normalizeFontName("'Abril Fatface'"))
    }
}
