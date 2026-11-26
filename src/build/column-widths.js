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
        const getCandidates = (values, { dtype, formatOptions }) => {
            const format = value => String(formatter.formatValue(value, dtype, formatOptions))
            const getNumberFormat = () => formatter.getFormat("float", formatOptions)
            return longest(candidatesFor(dtype)(values, format, getNumberFormat))
        }

        this._columnCandidates = columns.ilocs.map(col =>
            getCandidates(data.values.map(row => row[col]), columns.attrs[col])
        )
        this._indexCandidates = index.ilevels.map(level =>
            getCandidates(index.values.map(value => Array.isArray(value) ? value[level] : value), index.attrs[level])
        )

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
// Candidate selection per dtype: (values, format, getNumberFormat) => formatted strings,
// from which the longest are measured. getNumberFormat returns the column's Intl.NumberFormat.
const CANDIDATES = {
    int: numberCandidates,
    float: numberCandidates,
    default: distinctCandidates,
}

function candidatesFor(dtype) {
    return CANDIDATES[dtype] ?? CANDIDATES.default
}

// Exact: every distinct raw value formatted once (dates and text repeat a lot)
function distinctCandidates(values, format) {
    return [...new Set(values)].map(format)
}

// With standard notation and fraction digit rounding, the length of a formatted number follows from
// its sign, its number of integer digits and the number of fraction digits shown. One value per
// combination is formatted, plus the largest per sign and digit count (rounding can add a digit).
// Other notations and roundings fall back to distinctCandidates.
function numberCandidates(values, format, getNumberFormat) {
    const options = getNumberFormat().resolvedOptions()
    const isDigitBased = options.notation === "standard"
        && options.maximumSignificantDigits === undefined
        && (options.trailingZeroDisplay ?? "auto") === "auto"
    if (!isDigitBased) return distinctCandidates(values, format)

    const { minimumFractionDigits: minFraction, maximumFractionDigits: maxFraction } = options
    const factor = options.style === "percent" ? 100 : 1
    const scale = 10 ** maxFraction
    const shapes = new Map()
    const largest = new Map()
    const others = new Set()

    for (const value of values) {
        if (typeof value !== "number") {
            others.add(value)
            continue
        }
        const abs = Math.abs(value * factor)
        const digits = abs >= 1 ? Math.floor(Math.log10(abs)) + 1 : 0
        const magnitude = `${value < 0 ? "-" : "+"}${digits}`

        // fraction digits shown: trailing zeros of the rounded value are dropped, down to the minimum
        let rounded = Math.round(abs * scale)
        let fraction = maxFraction
        while (fraction > minFraction && rounded % 10 === 0) {
            rounded /= 10
            fraction--
        }

        const shape = `${magnitude}.${fraction}`
        if (!shapes.has(shape)) shapes.set(shape, value)
        if (!largest.has(magnitude) || abs > Math.abs(largest.get(magnitude) * factor)) largest.set(magnitude, value)
    }
    return [...others, ...shapes.values(), ...largest.values()].map(format)
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
