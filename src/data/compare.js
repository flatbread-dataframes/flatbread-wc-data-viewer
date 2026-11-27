const isNull = value => value === null || value === undefined

// Ascending comparison of two non-null values of one dtype
export function createComparator(dtype, locale) {
    switch (dtype) {
        case "int":
        case "float": return (a, b) => a - b
        case "date":
        case "datetime": return (a, b) => new Date(a) - new Date(b)
        default: {
            const collator = new Intl.Collator(locale, { numeric: true })
            return (a, b) => collator.compare(String(a), String(b))
        }
    }
}

// Nulls last in both directions, so direction can't be applied by negating the whole comparison
export function sortComparator(compare, direction = "asc") {
    const sign = direction === "desc" ? -1 : 1
    return (a, b) => {
        if (isNull(a)) return isNull(b) ? 0 : 1
        if (isNull(b)) return -1
        return sign * compare(a, b)
    }
}
