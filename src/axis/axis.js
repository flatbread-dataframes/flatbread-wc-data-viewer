export class Axis {
    // nlevels is used only when values is empty (e.g. a filtered view without rows);
    // otherwise the levels follow from the values.
    // sourceIlocs is set by take(): the positions of the entries in the axis they were taken from.
    constructor(values, { names, nlevels, sourceIlocs } = {}) {
        this.values = values
        this.names = names
        this.nlevels = Array.isArray(values[0]) ? values[0].length
            : values.length ? 1
            : nlevels ?? 1
        this._sourceIlocs = sourceIlocs ?? null
        this._lookups = []
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

    // Position of every entry in the source (the data); an axis that was not taken is its own source
    get sourceIlocs() {
        return this._sourceIlocs ??= this.ilocs
    }

    // MARK: labels
    // Positions of a label, ascending; [] when unknown. An array, because labels can repeat.
    // A flat axis takes a scalar. A multi-index takes a tuple, read as a path from the outer level
    // down: a shorter tuple is a group and gives every position in it. Labels match exactly (1 ≠ "1").
    locate(label) {
        if (Array.isArray(label) !== this.isMultiIndex) return []
        const depth = this.isMultiIndex ? label.length : 1
        if (depth < 1 || depth > this.nlevels) return []
        return this.lookup(depth).get(JSON.stringify(label)) ?? []
    }

    // Label → positions for paths of one depth; built on first use and kept, as an axis does not change
    lookup(depth) {
        if (!this._lookups[depth]) {
            const lookup = new Map()
            this.values.forEach((value, iloc) => {
                const key = JSON.stringify(this.isMultiIndex ? value.slice(0, depth) : value)
                if (lookup.has(key)) lookup.get(key).push(iloc)
                else lookup.set(key, [iloc])
            })
            this._lookups[depth] = lookup
        }
        return this._lookups[depth]
    }

    // Level of a name; -1 when unknown, repeated, or null (unnamed levels cannot be found by name)
    levelOf(name) {
        if (name === null || name === undefined) return -1
        const levels = this.ilevels.filter(level => this.names?.[level] === name)
        return levels.length === 1 ? levels[0] : -1
    }

    // MARK: subsets
    // An axis of the entries at ilocs, in that order, that keeps their positions in the source.
    // Keeps the ilocs array (no copy): the caller must not change it afterwards.
    take(ilocs) {
        const sourceIlocs = this._sourceIlocs ? ilocs.map(iloc => this._sourceIlocs[iloc]) : ilocs
        return new this.constructor({ ...this.subset(ilocs), sourceIlocs })
    }

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

    // Spans of a level that overlap positions [start, end).
    // Spans cover the axis contiguously, so the first one is found by binary search.
    overlappingSpans(level, start, end) {
        const spans = this.spans[level]
        let low = 0
        let high = spans.length
        while (low < high) {
            const mid = (low + high) >> 1
            if (spans[mid].iloc + spans[mid].count <= start) low = mid + 1
            else high = mid
        }
        let stop = low
        while (stop < spans.length && spans[stop].iloc < end) stop++
        return spans.slice(low, stop)
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
