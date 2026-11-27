import { distributeExcess } from "../../build/column-widths.js"

// Computes the fixed column widths of the table from the rendered thead
// and the value widths measured over the full dataset.
// Columns in table order: index levels, record view icon, data columns.
export class ColumnSizer {
    constructor(dataTable) {
        this.dataTable = dataTable
        // Last measured width of the record view icon column; kept for renders without rows
        this._iconWidth = 0
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
        return distributeExcess(widths, spans)
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

        const icon = this.root.querySelector("tbody .recordViewIcon")
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
    // (td and th share padding and group-edge borders; the thead is always rendered)
    measureValues() {
        const nIndex = this.indexCount
        const values = Array(nIndex + this.view.columns.length).fill(0)
        if (!this.columnWidths.isMeasured) return values

        this.view.index.ilevels.forEach(level => {
            const label = this.root.querySelector(`thead .indexLevelNameLabel[data-level="${level}"]`)
            values[level] = this.columnWidths.indexWidth(level) + horizontalPadding(label)
        })
        this.view.columns.ilocs.forEach(iloc => {
            const header = this.root.querySelector(`thead .columns-row th[data-col="${iloc}"]`)
            const original = this.view.getOriginalColumnIndex(iloc)
            values[nIndex + iloc] = this.columnWidths.columnWidth(original) + horizontalExtra(header)
        })
        return values
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

function horizontalExtra(cell) {
    const style = getComputedStyle(cell)
    return horizontalPadding(cell) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
}
