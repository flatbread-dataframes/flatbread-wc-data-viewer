export function parseFilterValue(filterValue) {
    const parts = filterValue.split(",").map(part => part.trim())

    return parts.map(part => {
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
    })
}

// filters: Map key → expression; valueGetter(key) returns a function data iloc → value.
// Returns a predicate on data ilocs, or null without filters. Expressions are parsed once, here.
export function createPredicate(filters, valueGetter) {
    const tests = [...filters].map(([key, expression]) => {
        const valueAt = valueGetter(key)
        const parts = parseFilterValue(expression.toLowerCase())
        return i => matches(valueAt(i), parts)
    })
    return tests.length ? i => tests.every(test => test(i)) : null
}

function matches(value, parts) {
    const text = value == null ? null : value.toString().toLowerCase()
    return parts.some(({ type, pattern }) => {
        if (type === "null") return text === null
        if (type === "notNull") return text !== null
        if (type === "empty") return text === null || text === ""
        if (text === null) return false

        switch (type) {
            case "exact": return text === pattern
            case "startsWith": return text.startsWith(pattern)
            case "endsWith": return text.endsWith(pattern)
            case "contains": return text.includes(pattern)
            default: return false
        }
    })
}
