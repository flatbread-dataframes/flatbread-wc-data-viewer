import { distributeExcess } from "../../build/column-widths.js"
import { isTruncatable } from "./cell-layout.js"

// Computes the fixed column widths of the table from the rendered thead
// and the value widths measured over the full dataset.
// Columns in table order: index levels, record view icon, data columns.
export class ColumnSizer {
    constructor(dataTable) {
        this.dataTable = dataTable
        // Last measured width of the record view icon column; kept for renders without rows
        this._iconWidth = 0
        // Widths of the last measure, in table order
        this._widths = []
    }

    // MARK: get/set
    get view() {
        return this.dataTable.view
    }

    get columnWidths() {
        return this.dataTable.dataViewer.columnWidths
    }

    get root() {
        return this.dataTable.shadowRoot
    }

    get isTruncating() {
        return this.dataTable.options.cellLayout === "truncate"
    }

    get indexCount() {
        // index levels + record view icon
        return this.view.index.nlevels + 1
    }

    // MARK: measure
    // Returns px widths for all columns in table order
    measure(remeasure = false) {
        if (remeasure || !this.columnWidths.isMeasured) this.measureFonts()

        const { leaves, spans } = this.measureHeaders()
        const values = this.measureValues()
        const widths = leaves.map((width, i) => Math.max(width, values[i]))
        return this._widths = distributeExcess(widths, spans)
    }

    // Fonts are read from the first rendered row; without rows there is nothing to measure yet
    measureFonts() {
        const row = this.root.querySelector("tbody tr[data-view-row]")
        const cell = row?.querySelector("td")
        const index = row?.querySelector("th")
        if (!cell || !index) return
        this.columnWidths.measure({ cell: fontOf(cell), index: fontOf(index) })
    }

    measureHeaders() {
        const nIndex = this.indexCount
        const leaves = Array(nIndex + this.view.columns.length).fill(0)
        const spans = []

        // a data row: the spacers have an icon cell without a button
        const icon = this.root.querySelector("tbody tr[data-view-row] .recordViewIcon")
        if (icon) this._iconWidth = requiredWidth(icon)
        leaves[nIndex - 1] = this._iconWidth

        // The filter row is left out: filter-combo shrinks to the column width
        for (const row of this.root.querySelectorAll("thead tr:not(.filter-row)")) {
            let start = 0
            for (const th of row.cells) {
                const count = th.colSpan
                const width = requiredWidth(th)
                if (count === 1) {
                    leaves[start] = Math.max(leaves[start], width)
                } else if (start + count === nIndex) {
                    // Spans ending at the record view icon: excess goes to the last index level
                    spans.push({ start, count: count - 1, width: width - leaves[nIndex - 1] })
                } else {
                    spans.push({ start, count, width })
                }
                start += count
            }
        }
        return { leaves, spans }
    }

    // Value widths plus cell padding and borders, read from the thead cells of the same column
    // (td and th share padding and group-edge borders; the thead is always rendered).
    // In truncate mode the values of truncatable columns do not count: the header sets the width.
    measureValues() {
        const nIndex = this.indexCount
        const values = Array(nIndex + this.view.columns.length).fill(0)
        if (!this.columnWidths.isMeasured) return values

        this.view.index.ilevels.forEach(level => {
            const label = this.root.querySelector(`thead .indexLevelNameLabel[data-level="${level}"]`)
            values[level] = this.columnWidths.indexWidth(level) + horizontalPadding(label)
        })
        this.view.columns.ilocs.forEach(iloc => {
            if (this.isTruncating && isTruncatable(this.view.columns.attrs[iloc].dtype)) return
            const header = this.root.querySelector(`thead .columns-row th[data-col="${iloc}"]`)
            const original = this.view.getOriginalColumnIndex(iloc)
            values[nIndex + iloc] = this.columnWidths.columnWidth(original) + horizontalExtra(header)
        })
        return values
    }

    // MARK: text
    // For estimating wrapped row heights, after measure(): the text columns (original column and
    // characters that fit on a line), the height of a line of text in a data cell and the cell's
    // vertical padding and borders. Needs a rendered data row.
    textLayout() {
        const nIndex = this.indexCount
        const columns = this.view.columns.ilocs
            .filter(iloc => isTruncatable(this.view.columns.attrs[iloc].dtype))
            .map(iloc => {
                const header = this.root.querySelector(`thead .columns-row th[data-col="${iloc}"]`)
                const col = this.view.getOriginalColumnIndex(iloc)
                const width = this._widths[nIndex + iloc] - horizontalExtra(header)
                const charWidth = this.columnWidths.charWidth(col)
                // at least one character per line: a value never takes more lines than characters
                return { col, charsPerLine: charWidth ? Math.max(1, width / charWidth) : Infinity }
            })
        const cell = this.root.querySelector("tbody tr[data-view-row] td")
        return { columns, lineHeight: this.measureLineHeight(cell), padding: verticalExtra(cell) }
    }

    // Distance between two lines of text in the cell's font: with line-height normal it comes from
    // the font (including its line gap, which canvas text metrics leave out), so it is measured
    measureLineHeight(cell) {
        const style = getComputedStyle(cell)
        const probe = document.createElement("div")
        for (const property of ["fontStyle", "fontWeight", "fontSize", "fontFamily", "lineHeight"]) {
            probe.style[property] = style[property]
        }
        probe.style.position = "absolute"
        probe.style.visibility = "hidden"
        probe.innerHTML = "x<br>x"
        this.root.append(probe)
        const height = probe.getBoundingClientRect().height / 2
        probe.remove()
        return height
    }
}

// MARK: helpers
function fontOf(element) {
    const style = getComputedStyle(element)
    return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}

// Content width (first child at its own size) plus padding and borders
function requiredWidth(cell) {
    const content = cell.firstElementChild?.getBoundingClientRect().width ?? 0
    return Math.ceil(content + horizontalExtra(cell))
}

function horizontalPadding(cell) {
    const style = getComputedStyle(cell)
    return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
}

function verticalExtra(cell) {
    const style = getComputedStyle(cell)
    return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
}

function horizontalExtra(cell) {
    const style = getComputedStyle(cell)
    return horizontalPadding(cell) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
}
