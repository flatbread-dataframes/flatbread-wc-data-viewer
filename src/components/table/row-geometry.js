// Maps scroll positions to view rows and back, for rows of one fixed height.
// Positions are relative to the top of the tbody.
export class UniformRowGeometry {
    constructor(count, height) {
        this._count = count
        this._height = height
    }

    // MARK: get/set
    get count() {
        return this._count
    }

    get height() {
        return this._height
    }

    get total() {
        return this._count * this._height
    }

    // MARK: geometry
    offsetOf(index) {
        return index * this._height
    }

    indexAt(y) {
        if (this._count === 0 || this._height === 0) return 0
        return Math.min(this._count - 1, Math.max(0, Math.floor(y / this._height)))
    }

    // Uniform rows: measured heights are not used, so they never change the geometry
    setMeasured(start, heights) {
        return false
    }
}

// Maps scroll positions to view rows and back, for rows of different heights (wrap mode).
// Heights are kept per source row, in an array shared with the geometries of later views,
// so measured heights survive sorting and filtering. Unmeasured rows hold an estimate.
export class VariableRowGeometry {
    constructor(indices, heights) {
        // view row → source row
        this._indices = indices
        this._heights = heights
        // offsets[i]: top of view row i; offsets[count]: the full height
        this._offsets = new Float64Array(indices.length + 1)
        this.updateOffsets(0)
    }

    // MARK: get/set
    get count() {
        return this._indices.length
    }

    get total() {
        return this._offsets[this.count]
    }

    // MARK: geometry
    offsetOf(index) {
        return this._offsets[index]
    }

    // The last row whose top is at or above y (binary search)
    indexAt(y) {
        let low = 0
        let high = Math.max(0, this.count - 1)
        while (low < high) {
            const middle = (low + high + 1) >> 1
            if (this._offsets[middle] <= y) low = middle
            else high = middle - 1
        }
        return low
    }

    // Returns whether a height differed from what the geometry held
    setMeasured(start, heights) {
        let changed = false
        heights.forEach((height, i) => {
            const row = this._indices[start + i]
            if (this._heights[row] === height) return
            this._heights[row] = height
            changed = true
        })
        if (changed) this.updateOffsets(start)
        return changed
    }

    updateOffsets(from) {
        for (let i = from; i < this.count; i++) {
            this._offsets[i + 1] = this._offsets[i] + this._heights[this._indices[i]]
        }
    }
}

// Estimated height per source row: the lines of its longest wrapping value plus the cell padding,
// and at least the height of a row without wrapped values (base; cells that never wrap, such as
// the record view icon, can make that more than one line plus padding).
// columns: the wrapping columns as { col (source iloc), charsPerLine }
// Character counts of the raw values stand in for their formatted widths.
export function estimateHeights(values, columns, { base, lineHeight, padding }) {
    const heights = new Float64Array(values.length)
    values.forEach((row, i) => {
        let lines = 1
        for (const { col, charsPerLine } of columns) {
            const value = row[col]
            if (value != null) lines = Math.max(lines, countLines(String(value), charsPerLine))
        }
        heights[i] = Math.max(base, lines * lineHeight + padding)
    })
    return heights
}

// Lines a text takes when wrapped at spaces into lines of `perLine` characters (greedy, as browsers do).
// A word longer than a line is broken anywhere (overflow-wrap: anywhere).
export function countLines(text, perLine) {
    if (text.length <= perLine) return 1
    let lines = 1
    let used = 0
    for (const word of text.split(/\s+/)) {
        if (!word) continue
        if (used && used + 1 + word.length <= perLine) {
            used += 1 + word.length
            continue
        }
        if (used) lines++
        const extra = Math.ceil(word.length / perLine) - 1
        lines += extra
        used = word.length - extra * perLine
    }
    return lines
}
