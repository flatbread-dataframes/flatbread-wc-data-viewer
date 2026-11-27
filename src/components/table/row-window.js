import { UniformRowGeometry } from "./row-geometry.js"
import { TbodyRenderer } from "./tbody-renderer.js"

// Decides which view rows are rendered: the rows in the viewport plus overscan on each side.
// Scroll positions and rows are mapped through the RowGeometry; the TbodyRenderer builds the rows.
export class RowWindow {
    constructor(dataTable) {
        this.dataTable = dataTable
        this.renderer = new TbodyRenderer(dataTable)

        this._geometry = null
        this._view = null
        this._laidOut = false
    }

    // MARK: get/set
    get view() {
        return this.dataTable.view
    }

    get count() {
        return this.view.visibleIndices.length
    }

    get overscan() {
        return this.dataTable.options.overscan
    }

    get geometry() {
        return this._geometry
    }

    set geometry(value) {
        this._geometry = value
        this.renderer.geometry = value
    }

    get isLaidOut() {
        return this._laidOut
    }

    // First visible row and the distance scrolled into it, or null when the view changed.
    // Read it before the table is replaced: reading scrollTop lays out,
    // which would clamp it to a table without spacers.
    get anchor() {
        if (!this._laidOut || !this._geometry || this._view !== this.view) return null
        const top = this.dataTable.scrollTop
        const index = this._geometry.indexAt(top)
        return { index, delta: top - this._geometry.offsetOf(index) }
    }

    rowAt(viewRow) {
        return this.renderer.rowAt(viewRow)
    }

    // MARK: render
    // First rows, before column widths and row height are known (column widths need a real row).
    // With the previous row height the spacers give the table its full height,
    // so the layout forced by measuring does not clamp scrollTop.
    renderInitial(anchor = null) {
        this._view = this.view
        const height = this._geometry?.height
        this.geometry = height ? new UniformRowGeometry(this.count, height) : null

        const start = Math.min(anchor?.index ?? 0, Math.max(0, this.count - 1))
        this.renderer.render(start, Math.min(this.count, start + this.overscan))
    }

    // Measures the row height and renders the window for the scroll position.
    // A table without layout box (display: none on it or an ancestor) is completed in resize().
    measure(anchor = null, force = true) {
        this._laidOut = this.dataTable.getClientRects().length > 0
        if (!this._laidOut) return

        const row = this.rowAt(this.renderer.start)
        const height = row?.getBoundingClientRect().height || this._geometry?.height || 0
        if (height !== this._geometry?.height) force = true
        this.geometry = new UniformRowGeometry(this.count, height)

        if (anchor) this.dataTable.scrollTop = this._geometry.offsetOf(anchor.index) + anchor.delta
        this.update(force)
    }

    // Filter and sort: other rows at the same position, so back to the top
    reset() {
        this.dataTable.scrollTop = 0
        this.renderInitial()
        this.measure()
    }

    // The container resized, or got a layout box for the first time
    resize() {
        if (!this.renderer.tbody) return
        const anchor = this.anchor
        if (!this._laidOut) {
            this.dataTable.applyColumnWidths()
            this.measure()
        } else {
            this.measure(anchor, false)
        }
    }

    // MARK: update
    // Rebuilds only when the viewport comes within half the overscan of a rendered edge
    update(force = false) {
        if (!this._laidOut) return

        const { renderer, count, overscan } = this
        const top = this.dataTable.scrollTop
        const first = this._geometry.indexAt(top)
        // overshoots by the rows behind the sticky thead; the overscan absorbs that
        const last = this._geometry.indexAt(top + this.dataTable.clientHeight)
        const margin = Math.ceil(overscan / 2)

        const nearStart = renderer.start > 0 && first < renderer.start + margin
        const nearEnd = renderer.end < count && last >= renderer.end - margin
        if (!force && !nearStart && !nearEnd) return

        renderer.update(Math.max(0, first - overscan), Math.min(count, last + 1 + overscan))
        renderer.reportHeights()
    }

    // Scrolls the least distance that shows the row below the sticky thead, then renders the window
    scrollToRow(index) {
        if (!this._laidOut) return

        const top = this._geometry.offsetOf(index)
        const bottom = this._geometry.offsetOf(index + 1)
        const theadHeight = this.dataTable.theadHeight
        const { scrollTop, clientHeight } = this.dataTable

        if (top < scrollTop) {
            this.dataTable.scrollTop = top
        } else if (theadHeight + bottom > scrollTop + clientHeight) {
            this.dataTable.scrollTop = theadHeight + bottom - clientHeight
        }
        this.update()
    }
}
