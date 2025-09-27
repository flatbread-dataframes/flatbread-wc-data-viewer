import { Axis } from "../axis/axis.js"
import { Columns } from "../axis/columns.js"

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
        // Return filtered columns based on selection
        const filteredValues = this._visibleColumnIndices.map(i => this.data.columns.values[i])
        const filteredDtypes = this._visibleColumnIndices.map(i => this.data.dtypes?.[i])
        const filteredFormatOptions = this._visibleColumnIndices.map(i => this.data.formatOptions?.[i])

        return new Columns(filteredValues, filteredDtypes, filteredFormatOptions)
    }

    get index() {
        // Return filtered index based on visibleIndices
        const visibleIndexValues = this.visibleIndices.map(i => this.data.index.values[i])
        return new Axis(visibleIndexValues)
    }
    get groupingLevels() {
        return this.index.groupingLevels
    }
    get values() {
        const rowFiltered = this.visibleIndices.map(i => this.data.values[i])
        if (this._visibleColumnIndices === null) {
            return rowFiltered
        }
        // Apply column filtering to each row
        return rowFiltered.map(row =>
            this._visibleColumnIndices.map(colIdx => row[colIdx])
        )
    }
    get indexNames() { return this.data.indexNames }
    get columnNames() { return this.data.columnNames }

    // Delegate other properties directly to data
    get dtypes() { return this.data.dtypes }
    get formatOptions() { return this.data.formatOptions }

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
        this.visibleIndices.sort((a, b) => {
            const valueA = this.data.values[a][columnIndex]
            const valueB = this.data.values[b][columnIndex]

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
}
