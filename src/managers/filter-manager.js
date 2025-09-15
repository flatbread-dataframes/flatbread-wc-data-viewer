export class FilterManager {
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
                return levelValue != null &&
                    levelValue.toString().toLowerCase().includes(filter.value.toLowerCase())
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
                return cellValue != null &&
                    cellValue.toString().toLowerCase().includes(filter.value.toLowerCase())
            })
        }
    }
}
