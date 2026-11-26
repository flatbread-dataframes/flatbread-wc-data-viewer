// Measures the formatted values of the full dataset (not the filtered view) once,
// so column widths do not change while scrolling, filtering or hiding columns.
//
// Two stages:
// - candidates (constructor): the strings worth measuring per column / index level.
//   Depends on the data and the formatter; the expensive part.
// - measure(fonts): canvas widths of the candidates. Depends on fonts; cheap,
//   repeated after a font load.
export class ColumnWidths {
    constructor(data, formatter) {
        const { columns, index } = data

        this._columnCandidates = columns.ilocs.map(col => {
            const { dtype, formatOptions } = columns.attrs[col]
            const format = value => String(formatter.formatValue(value, dtype, formatOptions))
            return candidatesFor(dtype)(data.values.map(row => row[col]), format)
        })

        this._indexCandidates = index.ilevels.map(level => {
            const { dtype, formatOptions } = index.attrs[level]
            const format = value => String(formatter.formatValue(value, dtype, formatOptions))
            const values = index.values.map(value => Array.isArray(value) ? value[level] : value)
            return candidatesFor(dtype)(values, format)
        })

        this._columnWidths = this._columnCandidates.map(() => 0)
        this._indexWidths = this._indexCandidates.map(() => 0)
        this._isMeasured = false
    }

    get isMeasured() {
        return this._isMeasured
    }

    // fonts: { cell, index } as CSS font shorthands (td font, tbody th font)
    measure({ cell, index }) {
        const context = new OffscreenCanvas(1, 1).getContext("2d")
        const widest = (strings, font) => {
            context.font = font
            return strings.reduce((max, string) => Math.max(max, context.measureText(string).width), 0)
        }
        this._columnWidths = this._columnCandidates.map(strings => widest(strings, cell))
        this._indexWidths = this._indexCandidates.map(strings => widest(strings, index))
        this._isMeasured = true
    }

    // Text widths in px, rounded up with 1px to absorb differences between canvas and DOM text layout
    columnWidth(originalCol) {
        return Math.ceil(this._columnWidths[originalCol]) + 1
    }

    indexWidth(level) {
        return Math.ceil(this._indexWidths[level]) + 1
    }
}

// MARK: candidates
// Candidate selection per dtype: (values, format) => strings.
// Add dtype-specific entries here to change the strategy (e.g. picking number candidates
// from the raw values and formatting only those).
const CANDIDATES = {
    default: (values, format) => longest(values.map(format)),
}

function candidatesFor(dtype) {
    return CANDIDATES[dtype] ?? CANDIDATES.default
}

// The distinct strings within `tolerance` of the longest character count, at most `limit`
function longest(strings, tolerance = .9, limit = 50) {
    const max = strings.reduce((max, string) => Math.max(max, string.length), 0)
    const long = strings.filter(string => string.length >= max * tolerance)
    return [...new Set(long)]
        .sort((a, b) => b.length - a.length)
        .slice(0, limit)
}

// MARK: excess
// Widens columns so header cells spanning several columns fit.
// widths: px widths of the leaf columns in table order
// spans:  [{ start, count, width }], outer levels first
// Strategy: the excess goes to the last column of the span.
export function distributeExcess(widths, spans) {
    const result = [...widths]
    for (const { start, count, width } of spans) {
        const sum = result.slice(start, start + count).reduce((a, b) => a + b, 0)
        if (width > sum) result[start + count - 1] += width - sum
    }
    return result
}
