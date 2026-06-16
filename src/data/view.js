import { Columns } from "../axis/columns.js"
import { Index } from "../axis/index.js"

export class View {
    constructor(data) {
        this.data = data

        this._visibleIndices = null
        this._visibleColumnIndices = null
        this._viewIndex = null
        this._viewColumns = null
        this._viewValues = null
    }

    get visibleIndices() {
        if (this._visibleIndices === null) {
            this._visibleIndices = [...this.data.index.ilocs]
        }
        return this._visibleIndices
    }

    get columns() {
        if (this._visibleColumnIndices === null) {
            return this.data.columns
        }
        const src = this.data.columns
        return new Columns({
            values: this._visibleColumnIndices.map(i => src.values[i]),
            names: src.names,
            dtypes: this._visibleColumnIndices.map(i => src.dtypes?.[i]),
            formatOptions: this._visibleColumnIndices.map(i => src.formatOptions?.[i]),
        })
    }

    get index() {
        const src = this.data.index
        return new Index({
            values: this.visibleIndices.map(i => src.values[i]),
            names: src.names,
            dtypes: src.dtypes,
            formatOptions: src.formatOptions,
        })
    }

    get groupingLevels() {
        return this.index.groupingLevels
    }

    get values() {
        const rowFiltered = this.visibleIndices.map(i => this.data.values[i])
        if (this._visibleColumnIndices === null) {
            return rowFiltered
        }
        return rowFiltered.map(row =>
            this._visibleColumnIndices.map(colIdx => row[colIdx])
        )
    }

    // Filtering methods
    filter(predicate) {
        this._visibleIndices = this.data.index.ilocs.filter(i => predicate(this.data.values[i], i))
        return this
    }

    filterColumns(columnIndices) {
        this._visibleColumnIndices = columnIndices
        this.invalidateCache()
        return this
    }

    // Sorting methods
    sortByColumn(columnIndex, direction = "asc") {
        const originalColumnIndex = this._visibleColumnIndices
            ? this._visibleColumnIndices[columnIndex]
            : columnIndex

        this.visibleIndices.sort((a, b) => {
            const valueA = this.data.values[a][originalColumnIndex]
            const valueB = this.data.values[b][originalColumnIndex]

            if (valueA === valueB) return 0
            if (valueA === null || valueA === undefined) return 1
            if (valueB === null || valueB === undefined) return -1

            const comparison = valueA < valueB ? -1 : 1
            return direction === "asc" ? comparison : -comparison
        })
        this.invalidateCache()
        return this
    }

    sortByIndex(level = -1, direction = "asc") {
        this.visibleIndices.sort((a, b) => {
            const indexA = this.data.index.values[a]
            const indexB = this.data.index.values[b]

            const valueA = Array.isArray(indexA) ? indexA[level] || indexA.at(level) : indexA
            const valueB = Array.isArray(indexB) ? indexB[level] || indexB.at(level) : indexB

            if (valueA === valueB) return 0
            if (valueA === null || valueA === undefined) return 1
            if (valueB === null || valueB === undefined) return -1

            const comparison = valueA < valueB ? -1 : 1
            return direction === "asc" ? comparison : -comparison
        })
        this.invalidateCache()
        return this
    }

    // Reset to original order
    reset() {
        this._visibleIndices = [...this.data.index.ilocs]
        this.invalidateCache()
        return this
    }

    // Clear cached computed properties
    invalidateCache() {
        this._viewIndex = null
        this._viewColumns = null
        this._viewValues = null
    }

    // Utility methods
    get length() {
        return this.visibleIndices.length
    }

    isVisible(originalIndex) {
        return this.visibleIndices.includes(originalIndex)
    }

    getOriginalIndex(viewIndex) {
        return this.visibleIndices[viewIndex]
    }

    getOriginalColumnIndex(viewColIndex) {
        return this._visibleColumnIndices
            ? this._visibleColumnIndices[viewColIndex]
            : viewColIndex
    }
}
