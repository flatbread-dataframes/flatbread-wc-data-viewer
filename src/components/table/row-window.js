import { UniformRowGeometry, VariableRowGeometry, estimateHeights } from "./row-geometry.js"
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
        // Uniform geometry: the measured height of a row
        this._rowHeight = 0
        // Variable geometry: heights per source row, estimated or measured (see VariableRowGeometry),
        // and what they were computed for (see widthsApplied)
        this._rowHeights = null
        this._heightsKey = null
    }

    // MARK: get/set
    get view() {
        return this.dataTable.view
    }

    get count() {
        return this.view.length
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

    // Wrapped rows differ in height; in no-wrap and truncate all rows have one height
    get isVariable() {
        return this.dataTable.options.cellLayout === "wrap"
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
        // heights per source row are only valid for the rows of the same view
        const sameView = this._view === this.view
        this._view = this.view
        if (this.isVariable) {
            this.geometry = sameView && this._rowHeights ? this.createVariableGeometry() : null
        } else {
            this.geometry = this._rowHeight ? new UniformRowGeometry(this.count, this._rowHeight) : null
        }

        const start = Math.min(anchor?.index ?? 0, Math.max(0, this.count - 1))
        this.renderer.render(start, Math.min(this.count, start + this.overscan))
    }

    // Measures the row height (or estimates the row heights) and renders the window for the scroll position.
    // A table without layout box (display: none on it or an ancestor) is completed in resize().
    measure(anchor = null, force = true) {
        this._laidOut = this.dataTable.getClientRects().length > 0
        if (!this._laidOut) return

        if (this.isVariable) {
            // without rows there is nothing to estimate from, nor any row that needs a height
            if (!this._rowHeights && this.count > 0) {
                this._rowHeights = this.estimateRowHeights()
                force = true
            }
            this.geometry = this.createVariableGeometry()
        } else {
            const row = this.rowAt(this.renderer.start)
            const height = row?.getBoundingClientRect().height || this._rowHeight
            if (height !== this._rowHeight) force = true
            this._rowHeight = height
            this.geometry = new UniformRowGeometry(this.count, height)
        }

        if (anchor) {
            // The spacers still have the heights of the previous geometry; a table that grows
            // (no-wrap to wrap) would clamp scrollTop to its old height
            this.renderer.updateSpacers()
            // A row that got lower (wrap to no-wrap) holds less of the distance scrolled into it:
            // stay inside the row, or the next row becomes the first visible one
            const top = this._geometry.offsetOf(anchor.index)
            const height = this._geometry.offsetOf(anchor.index + 1) - top
            this.dataTable.scrollTop = top + Math.min(anchor.delta, Math.max(0, height - 1))
        }
        this.update(force)
    }

    createVariableGeometry() {
        return new VariableRowGeometry(this.view.index.sourceIlocs, this._rowHeights ?? new Float64Array(0))
    }

    // Heights of all rows, estimated from their longest wrapping value (see estimateHeights).
    // The height of a row without wrapped values also depends on cells that never wrap (index,
    // record view icon), so it is measured: the lowest rendered row, if that has one line.
    // If every rendered row wraps, one line plus padding stands in (a few px low).
    estimateRowHeights() {
        const { columns, lineHeight, padding } = this.dataTable.columnSizer.textLayout()
        const lowest = Math.min(...this.renderer.measureRows())
        const base = lowest < 2 * lineHeight + padding ? lowest : lineHeight + padding
        return estimateHeights(this.view.data.values, columns, { base, lineHeight, padding })
    }

    // Row heights follow from the data, the visible columns and their widths (and fonts):
    // measured heights are kept while these stay the same, so that a render that changes none of them
    // (back from the record view, a height change) does not fall back to estimates.
    // Sorting and filtering keep them as well: heights are kept per source row.
    widthsApplied(widths, remeasure = false) {
        const columns = this.view.columns.sourceIlocs
        const key = { source: this.dataTable.columnSizer.columnWidths, layout: `${columns}|${widths}` }
        const same = this._heightsKey?.source === key.source && this._heightsKey.layout === key.layout
        if (remeasure || !same) this._rowHeights = null
        this._heightsKey = key
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
    // Rebuilds when the viewport comes within half the overscan of a rendered edge.
    // With variable heights a rebuild replaces estimates with measured heights, which moves the rows
    // and can leave the viewport near an edge again: check again, a few times at most.
    update(force = false) {
        if (!this._laidOut) return
        for (let pass = 0; pass < 3 && this.rebuild(force); pass++) force = false
    }

    // Returns whether the measured heights changed the geometry
    rebuild(force) {
        const { renderer, count, overscan, geometry } = this
        const top = this.dataTable.scrollTop
        const first = geometry.indexAt(top)
        // overshoots by the rows behind the sticky thead; the overscan absorbs that
        const last = geometry.indexAt(top + this.dataTable.clientHeight)
        const margin = Math.ceil(overscan / 2)

        const nearStart = renderer.start > 0 && first < renderer.start + margin
        const nearEnd = renderer.end < count && last >= renderer.end - margin
        if (!force && !nearStart && !nearEnd) return false

        const delta = top - geometry.offsetOf(first)
        renderer.update(Math.max(0, first - overscan), Math.min(count, last + 1 + overscan))
        if (!renderer.reportHeights()) return false

        // Rendered rows above the first visible row that were taller or shorter than their estimate
        // would move it: keep it where it was. Rows above the window are not affected (the top spacer
        // was set from their heights), so after scrolling down, which measures rows below, this is
        // a no-op; it moves the content when scrolling up into rows that were never rendered.
        renderer.updateSpacers()
        const target = geometry.offsetOf(first) + delta
        if (target !== this.dataTable.scrollTop) this.dataTable.scrollTop = target
        return true
    }

    // Scrolls the least distance that shows the row below the sticky thead, then renders the window.
    // With variable heights the row's own height and position may have been estimates until it was
    // rendered: a second pass uses the measured ones.
    scrollToRow(index) {
        if (!this._laidOut) return
        this.scrollIntoView(index)
        this.update()
        if (this.isVariable && this.scrollIntoView(index)) this.update()
    }

    // The row a page up (direction -1) or down (+1) from index: a viewport below the sticky thead
    // further, at least one row (a wrapped row can be taller than the viewport). Clamped to the
    // first and last row, so within a page of either end it moves there.
    pageFrom(index, direction) {
        if (!this._laidOut) return index
        const page = this.dataTable.clientHeight - this.dataTable.theadHeight
        const found = this._geometry.indexAt(this._geometry.offsetOf(index) + direction * page)
        const target = found === index ? index + direction : found
        return Math.max(0, Math.min(this.count - 1, target))
    }

    // Scrolls so that the row takes the place in the viewport of another row (PageUp/PageDown: the
    // focused row stays where it was on screen), then renders the window. Where that place is out of
    // reach (the ends of the table) or out of view (focus was parked), the row is scrolled into view.
    // With variable heights a second pass uses the measured heights, as in scrollToRow.
    scrollToRowInPlaceOf(index, other) {
        if (!this._laidOut) return
        const y = this._geometry.offsetOf(other) - this.dataTable.scrollTop
        this.placeRow(index, y)
        this.update()
        if (this.isVariable && this.placeRow(index, y)) this.update()
    }

    // Returns whether scrollTop changed
    placeRow(index, y) {
        const scrollTop = this.dataTable.scrollTop
        this.dataTable.scrollTop = this._geometry.offsetOf(index) - y
        this.scrollIntoView(index)
        return this.dataTable.scrollTop !== scrollTop
    }

    // Returns whether scrollTop changed
    scrollIntoView(index) {
        const top = this._geometry.offsetOf(index)
        const bottom = this._geometry.offsetOf(index + 1)
        const theadHeight = this.dataTable.theadHeight
        const { scrollTop, clientHeight } = this.dataTable

        if (top < scrollTop) {
            this.dataTable.scrollTop = top
        } else if (theadHeight + bottom > scrollTop + clientHeight) {
            // a wrapped row higher than the viewport shows its top, below the sticky thead
            const fits = theadHeight + bottom - top <= clientHeight
            this.dataTable.scrollTop = fits ? theadHeight + bottom - clientHeight : top
        }
        return this.dataTable.scrollTop !== scrollTop
    }
}
