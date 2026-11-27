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

    get columnCount() {
        const view = this.dataTable.view
        // index levels + record view icon + data columns
        return view.index.nlevels + 1 + view.columns.length
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

        const hadFocus = this.dataTable.shadowRoot.activeElement?.closest("tbody") === tbody
        const top = this._geometry ? this._geometry.offsetOf(start) : 0
        const bottom = this._geometry ? this._geometry.total - this._geometry.offsetOf(end) : 0

        tbody.innerHTML =
            this.buildSpacer(top) +
            this.dataTable.tableBuilder.buildTbody(start, end) +
            this.buildSpacer(bottom)
        this._start = start
        this._end = end

        // The focused row was replaced; focus its successor if it is still in the window
        if (hadFocus) this.rowAt(this.dataTable.tbodyPosition)?.focus({ preventScroll: true })
    }

    // Full rebuild; edge updates would replace this method
    update(start, end) {
        this.render(start, end)
    }

    // Passes the rendered row heights to the geometry
    reportHeights() {
        if (!this._geometry) return
        for (let i = this._start; i < this._end; i++) {
            this._geometry.setMeasured(i, this.rowAt(i).getBoundingClientRect().height)
        }
    }

    buildSpacer(height) {
        return `<tr class="spacer" aria-hidden="true"><td colspan="${this.columnCount}" style="height: ${height}px"></td></tr>`
    }
}
