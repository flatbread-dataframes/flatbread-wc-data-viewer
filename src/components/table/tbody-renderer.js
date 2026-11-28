// Builds the tbody: a top spacer, the view rows [start, end) and a bottom spacer.
// The only code that knows how the tbody is put together;
// everything else finds rows through rowAt or data-view-row.
export class TbodyRenderer {
    constructor(dataTable) {
        this.dataTable = dataTable
        this._start = 0
        this._end = 0
        this._geometry = null
    }

    // MARK: get/set
    get start() {
        return this._start
    }

    get end() {
        return this._end
    }

    get geometry() {
        return this._geometry
    }

    set geometry(value) {
        this._geometry = value
    }

    get tbody() {
        return this.dataTable.shadowRoot.querySelector("tbody")
    }

    get rowCount() {
        return this.dataTable.tableBuilder.headerRowCount + this.dataTable.view.length
    }

    // The tr of a view row, or null outside the window
    rowAt(viewRow) {
        if (viewRow < this._start || viewRow >= this._end) return null
        // + 1 skips the top spacer
        return this.tbody?.rows[viewRow - this._start + 1] ?? null
    }

    // MARK: render
    render(start, end) {
        const tbody = this.tbody
        if (!tbody) return

        // A row or the tbody itself (parked) has focus
        const hadFocus = this.dataTable.shadowRoot.activeElement?.closest("tbody") === tbody
        const position = this.dataTable.tbodyPosition
        const [top, bottom] = this.spacerHeights(start, end)

        // The focused row leaves the window: park focus on the tbody before the row is removed,
        // so focus never falls to the body. Only then, so a rebuild during keyboard navigation
        // moves focus once (row to row), not twice (row to tbody to row).
        if (hadFocus && (position < start || position >= end)) tbody.focus({ preventScroll: true })
        // the tooltip's cell is about to be replaced
        this.dataTable.cellTooltip.hide()

        const tableBuilder = this.dataTable.tableBuilder
        const spacerCells = tableBuilder.buildSpacerCells()
        tbody.innerHTML =
            this.buildSpacer(top, spacerCells) +
            tableBuilder.buildTbody(start, end) +
            this.buildSpacer(bottom, spacerCells)
        this._start = start
        this._end = end
        // all rows of the table, not only the rendered ones (see aria-rowindex in buildTbody)
        tbody.parentElement.setAttribute("aria-rowcount", this.rowCount)

        // The focused row was replaced, or focus is parked: focus the row if it is in the window
        if (hadFocus) this.rowAt(position)?.focus({ preventScroll: true })
    }

    // Full rebuild; edge updates would replace this method
    update(start, end) {
        this.render(start, end)
    }

    // Heights of the rendered rows [start, end)
    measureRows() {
        // without the spacers
        return [...this.tbody.rows].slice(1, -1).map(row => row.getBoundingClientRect().height)
    }

    // Passes the rendered row heights to the geometry, in one call per window.
    // Returns whether they changed the geometry (only estimated heights can).
    reportHeights() {
        if (!this._geometry) return false
        return this._geometry.setMeasured(this._start, this.measureRows())
    }

    // The geometry changed after rendering: the spacers follow it, the rows stay
    updateSpacers() {
        const rows = this.tbody.rows
        const [top, bottom] = this.spacerHeights(this._start, this._end)
        rows[0].style.height = `${top}px`
        rows[rows.length - 1].style.height = `${bottom}px`
    }

    spacerHeights(start, end) {
        if (!this._geometry) return [0, 0]
        return [this._geometry.offsetOf(start), this._geometry.total - this._geometry.offsetOf(end)]
    }

    // A row of empty cells (see TableBuilder.buildSpacerCells) with the height of the rows it stands in for
    buildSpacer(height, cells) {
        return `<tr class="spacer" aria-hidden="true" style="height: ${height}px">${cells}</tr>`
    }
}
