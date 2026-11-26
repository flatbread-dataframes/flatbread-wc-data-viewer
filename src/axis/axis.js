export class Axis {
    // nlevels is used only when values is empty (e.g. a filtered view without rows);
    // otherwise the levels follow from the values
    constructor(values, nlevels) {
        this.values = values
        this.nlevels = Array.isArray(values[0]) ? values[0].length
            : values.length ? 1
            : nlevels ?? 1
        this.spans = this.getSpans()
        this.groupingLevels = this.getGroupingLevels()
        this.edges = this.getEdges()
    }

    // Returns length of values on axis as int
    get length() { return this.values.length }
    // Returns levels on index as array of ints
    get ilevels() { return [...Array(this.nlevels).keys()] }
    // Returns positions on axis as array of ints
    get ilocs() { return [...Array(this.length).keys()] }
    // Returns whether axis has multiple levels
    get isMultiIndex() { return this.nlevels > 1 }

    // Iterator
    [Symbol.iterator]() {
        let index = 0
        return {
            next: () => {
                if (index < this.values.length) {
                    return { value: this.values[index++], done: false }
                } else {
                    return { done: true }
                }
            }
        }
    }

    // Array-like methods
    map(callback) {
        return this.values.map(callback)
    }

    filter(callback) {
        return this.values.filter(callback)
    }

    reduce(callback, initialValue) {
        return this.values.reduce(callback, initialValue)
    }

    forEach(callback) {
        this.values.forEach(callback)
    }

    // Returns an array of integer locations of the group edges
    getEdges() {
        if ( !this.isMultiIndex ) return []
        // spans[0] is the outermost level, spans.at(-1) the innermost grouped level.
        // Its keys are the longest prefixes, so it starts a span wherever any
        // outer level does, and more. Its ilocs are therefore all edges, in order.
        const innermostSpans = this.spans.at(-1)
        return innermostSpans.map(span => span.iloc)
    }

    // Returns an array of span objects
    getSpans() {
        const levels = []
        this.ilevels.forEach(
            level => {
                if (level === this.nlevels - 1) { return } // skip final level
                const keys = this.values.map(i => i.slice(0, level + 1))
                const spans = Axis.getContiguousValueCounts(keys)
                levels.push(spans)
            }
        )
        return levels
    }

    getGroupingLevels() {
        return this.spans.map(levelSpans =>
            levelSpans.some(span => span.count > 1)
        )
    }

    /**
     * Reduces an array of values to an array of span objects.
     * Each span represents contiguous occurrences of a value.
     *
     * @param {Array} arr - The input array to process.
     * @returns {Array<Object>} An array of span objects, where each object contains:
     *   @property {number} iloc - The starting index of the span.
     *   @property {*} value - The value of the span.
     *   @property {number} count - The number of contiguous occurrences.
     *   @property {number} group - A unique identifier for each distinct span.
     *
     * @example
     * // Returns: [
     * //   { iloc: 0, value: 'A', count: 2, group: 0 },
     * //   { iloc: 2, value: 'B', count: 1, group: 1 },
     * //   { iloc: 3, value: 'A', count: 2, group: 2 }
     * // ]
     * getContiguousValueCounts(['A', 'A', 'B', 'A', 'A'])
     */
    static getContiguousValueCounts(arr) {
        const compareArrays = (arr1, arr2) => arr1.every((item, idx) => item === arr2[idx])
        let group = 0
        let prev = []
        return arr.reduce((acc, cur, idx) => {
            if ( prev.length === 0 || !compareArrays(prev, cur) ) {
                acc.push({ iloc: idx, value: cur, count: 1, group: group++ })
            } else { acc[acc.length - 1].count += 1 }
            prev = cur
            return acc
        }, [])
    }
}
