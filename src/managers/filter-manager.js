export class FilterManager {
    parseFilterValue(filterValue) {
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

    applyFilters(view, indexFilters, columnFilters) {
        if (indexFilters.length === 0 && columnFilters.length === 0) {
            view.reset()
        } else {
            const predicates = []
            if (indexFilters.length > 0) predicates.push(this.createIndexPredicate(view, indexFilters))
            if (columnFilters.length > 0) predicates.push(this.createColumnPredicate(view, columnFilters))

            const combinedPredicate = (rowValues, rowIndex) => {
                return predicates.every(predicate => predicate(rowValues, rowIndex))
            }

            view.filter(combinedPredicate)
        }
    }

    createIndexPredicate(view, indexFilters) {
        return (rowValues, rowIndex) => {
            return indexFilters.every(filter => {
                const indexValue = view.data.index.values[rowIndex]
                const levelValue = Array.isArray(indexValue)
                    ? indexValue[filter.level]
                    : indexValue

                const parsedFilters = this.parseFilterValue(filter.value.toLowerCase())
                return parsedFilters.some(({ type, pattern }) => {
                    if (type === "null") {
                        return levelValue === null || levelValue === undefined
                    }
                    if (type === "notNull") {
                        return levelValue !== null && levelValue !== undefined
                    }
                    if (type === "empty") {
                        return levelValue === null || levelValue === undefined || levelValue === ""
                    }
                    if (levelValue == null) return false

                    const levelStr = levelValue.toString().toLowerCase()

                    switch (type) {
                        case "exact": return levelStr === pattern
                        case "startsWith": return levelStr.startsWith(pattern)
                        case "endsWith": return levelStr.endsWith(pattern)
                        case "contains": return levelStr.includes(pattern)
                        default: return false
                    }
                })
            })
        }
    }

    createColumnPredicate(view, columnFilters) {
        return (rowValues, rowIndex) => {
            return columnFilters.every(filter => {
                const originalColumnIndex = view._visibleColumnIndices
                    ? view._visibleColumnIndices[filter.col]
                    : filter.col
                const cellValue = rowValues[originalColumnIndex]

                const parsedFilters = this.parseFilterValue(filter.value.toLowerCase())

                return parsedFilters.some(({ type, pattern }) => {
                    if (type === "null") {
                        return cellValue === null || cellValue === undefined
                    }
                    if (type === "notNull") {
                        return cellValue !== null && cellValue !== undefined
                    }
                    if (type === "empty") {
                        return cellValue === null || cellValue === undefined || cellValue === ""
                    }

                    if (cellValue == null) return false

                    const cellStr = cellValue.toString().toLowerCase()

                    switch (type) {
                        case "exact": return cellStr === pattern
                        case "startsWith": return cellStr.startsWith(pattern)
                        case "endsWith": return cellStr.endsWith(pattern)
                        case "contains": return cellStr.includes(pattern)
                        default: return false
                    }
                })
            })
        }
    }
}
