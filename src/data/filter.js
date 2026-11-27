// A part is quoted only as a whole: "…" or ="…", with "" for a quote inside. A quoted part may
// contain commas; anything else (an unclosed quote, "a"*) is split on commas and read as text.
const QUOTED = /^(=?)"((?:[^"]|"")*)"$/
const PART = /\s*=?"(?:[^"]|"")*"\s*(?=,|$)|[^,]+/g

export function splitParts(expression) {
    return (expression.match(PART) ?? []).map(part => part.trim()).filter(Boolean)
}

// The exact, case-sensitive part that matches value literally
export function quoteExact(value) {
    return `="${String(value).replaceAll("\"", "\"\"")}"`
}

export function parseFilterValue(expression) {
    return splitParts(expression).map(part => {
        const quoted = part.match(QUOTED)
        if (quoted) {
            const pattern = quoted[2].replaceAll("\"\"", "\"")
            return { type: quoted[1] ? "exact" : "contains", pattern, caseSensitive: true }
        }
        return parseUnquoted(part.toLowerCase())
    })
}

// Unquoted parts are case-insensitive: lowercased here, matched against the lowercased value
function parseUnquoted(part) {
    if (part === "null") {
        return { type: "null" }
    }
    if (part === "!null") {
        return { type: "notNull" }
    }
    if (part === "empty") {
        return { type: "empty" }
    }

    if (part.startsWith("=")) {
        return { type: "exact", pattern: part.slice(1) }
    }
    if (part.endsWith("*") && !part.startsWith("*")) {
        return { type: "startsWith", pattern: part.slice(0, -1) }
    }
    if (part.startsWith("*") && !part.endsWith("*")) {
        return { type: "endsWith", pattern: part.slice(1) }
    }
    return { type: "contains", pattern: part }
}

// filters: Map key → expression; valueGetter(key) returns a function data iloc → value.
// Returns a predicate on data ilocs, or null without filters. Expressions are parsed once, here;
// one without parts (",") filters nothing.
export function createPredicate(filters, valueGetter) {
    const tests = [...filters].flatMap(([key, expression]) => {
        const parts = parseFilterValue(expression)
        if (!parts.length) return []
        const valueAt = valueGetter(key)
        return [i => matches(valueAt(i), parts)]
    })
    return tests.length ? i => tests.every(test => test(i)) : null
}

function matches(value, parts) {
    const text = value == null ? null : String(value)
    let lower
    return parts.some(({ type, pattern, caseSensitive }) => {
        if (type === "null") return text === null
        if (type === "notNull") return text !== null
        if (type === "empty") return text === null || text === ""
        if (text === null) return false

        const subject = caseSensitive ? text : (lower ??= text.toLowerCase())
        switch (type) {
            case "exact": return subject === pattern
            case "startsWith": return subject.startsWith(pattern)
            case "endsWith": return subject.endsWith(pattern)
            case "contains": return subject.includes(pattern)
            default: return false
        }
    })
}
