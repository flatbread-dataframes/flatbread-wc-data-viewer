import { TableBuilder } from "./table-builder.js"
import { Stylesheet } from "./stylesheet.js"
import { WheelHandlerMixin } from "../../mixins/wheel-handler.js"
import { ScrollManager } from "./scroll-manager.js"
import { ClickHandler } from "./click-handler.js"
import { ColumnSizer } from "./column-sizer.js"
import { RowWindow } from "./row-window.js"
import { CellTooltip } from "./cell-tooltip.js"
import { ColumnResizer } from "./column-resizer.js"


export class DataTable extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })

        this.scrollManager = new ScrollManager(this)
        this.clickHandler = new ClickHandler(this)
        this.columnSizer = new ColumnSizer(this)
        this.rowWindow = new RowWindow(this)
        this.cellTooltip = new CellTooltip(this)
        this.columnResizer = new ColumnResizer(this)

        this.handleKeydown = this.handleKeydown.bind(this)
        this.handleTheadFocusIn = this.handleTheadFocusIn.bind(this)
        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleFilterOptionsRequest = this.handleFilterOptionsRequest.bind(this)
        this.handleWheel = WheelHandlerMixin.handleWheel.bind(this)
        this.handleFontsLoaded = this.handleFontsLoaded.bind(this)

        this._dataViewer = null
        this._tableBuilder = null
        this._stylesheet = null

        this._theadPosition = { zone: "filter-columns", col: 0, sub: null, level: null }
        this._tbodyPosition = 0
        this.handleTbodyFocusIn = this.handleTbodyFocusIn.bind(this)
    }

    // MARK: setup
    connectedCallback() {
        this.addEventListeners()
        this.render()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    addEventListeners() {
        this.addEventListener("keydown", this.handleKeydown)
        this.shadowRoot.addEventListener("focusin", this.handleTheadFocusIn)
        this.shadowRoot.addEventListener("focusin", this.handleTbodyFocusIn)
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("filter-options-request", this.handleFilterOptionsRequest)
        document.fonts.addEventListener("loadingdone", this.handleFontsLoaded)

        this.clickHandler.addEventListeners()
        this.scrollManager.addEventListeners()
        this.cellTooltip.addEventListeners()
        this.columnResizer.addEventListeners()
        WheelHandlerMixin.addWheelHandling.call(this)
    }

    removeEventListeners() {
        this.removeEventListener("keydown", this.handleKeydown)
        this.shadowRoot.removeEventListener("focusin", this.handleTheadFocusIn)
        this.shadowRoot.removeEventListener("focusin", this.handleTbodyFocusIn)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("filter-options-request", this.handleFilterOptionsRequest)
        document.fonts.removeEventListener("loadingdone", this.handleFontsLoaded)

        this.clickHandler.removeEventListeners()
        this.scrollManager.removeEventListeners()
        this.cellTooltip.removeEventListeners()
        this.columnResizer.removeEventListeners()
        WheelHandlerMixin.removeWheelHandling.call(this)
    }

    // MARK: get/set
    get dataViewer() {
        return this._dataViewer
    }

    set dataViewer(value) {
        this._dataViewer = value
        if (value) {
            this._tableBuilder = new TableBuilder(value)
            this._stylesheet = new Stylesheet(this, value.data, value.options)
            if (this.isConnected) {
                this.render()
            }
        }
    }

    get view() {
        return this._dataViewer?.view
    }

    get options() {
        return this._dataViewer?.options
    }

    get tableBuilder() {
        return this._tableBuilder
    }

    get tbodyPosition() {
        return this._tbodyPosition
    }

    // Where focus is inside the table: "thead", "tbody" (a row, or the tbody while the row is
    // outside the window) or null
    get focusZone() {
        const activeElement = this.shadowRoot.activeElement
        if (activeElement?.closest("thead")) return "thead"
        if (activeElement?.closest("tbody")) return "tbody"
        return null
    }

    get theadHeight() {
        return this.shadowRoot.querySelector("thead")?.getBoundingClientRect().height ?? 0
    }

    get theadNavigableElements() {
        const nGroupLevels = this.view.columns.ilevels.length - 1

        const groups = Array.from({ length: nGroupLevels }, (_, level) =>
            [...this.shadowRoot.querySelectorAll(
                `thead tr.column-groups-row[data-level="${level}"] .hide-button`
            )]
        )

        return {
            groups,
            columnSort: [...this.shadowRoot.querySelectorAll(
                "thead tr.columns-row sort-button button")],
            columnHide: [...this.shadowRoot.querySelectorAll(
                "thead tr.columns-row .hide-button")],
            indexLabels: [...this.shadowRoot.querySelectorAll(
                "thead tr.index-labels-row sort-button button")],
            filterIndex: [...this.shadowRoot.querySelectorAll(
                "thead tr.filter-row th.indexFilter filter-combo")],
            filterColumns: [...this.shadowRoot.querySelectorAll(
                "thead tr.filter-row th.columnFilter filter-combo")],
        }
    }

    // MARK: render
    // Keeps the first visible row when the view is the same (column changes, view mode toggles)
    render() {
        if (!this.dataViewer) return

        // before the table is replaced (see RowWindow.anchor)
        const anchor = this.rowWindow.anchor

        this.shadowRoot.innerHTML = `
            <table>
                <colgroup></colgroup>
                <thead>${this._tableBuilder.buildThead()}</thead>
                <tbody tabindex="-1"></tbody>
            </table>
            <div class="cell-tooltip" popover="manual" aria-hidden="true"></div>
        `
        this.syncControls()

        this._stylesheet.setupStyles()
        this.rowWindow.renderInitial(anchor)
        this.applyColumnWidths()
        this.rowWindow.measure(anchor)
    }

    // Filter and sort
    renderTbody() {
        if (this.shadowRoot.querySelector("tbody") && this._tableBuilder) {
            this.rowWindow.reset()
        }
    }

    // After a change of the filters or the sort: the controls follow the view, rows from the top
    updateRows() {
        this.syncControls()
        this.shadowRoot.querySelectorAll("filter-combo").forEach(combo => combo.refreshOptions())
        this.renderTbody()
        this.resetTbodyPosition()
    }

    // The filter inputs and sort buttons show the view's state; the thead is built with empty controls
    syncControls() {
        this.shadowRoot.querySelectorAll("filter-combo").forEach(combo => {
            const expression = this.view.filterFor(combo.dataset.key)
            // only a real difference is written, so the input being typed in keeps its caret
            if (combo.value.trim() !== expression.trim()) combo.value = expression
        })
        this.shadowRoot.querySelectorAll("sort-button").forEach(button => {
            button.sortState = this.view.sortStateFor(button.dataset.key)
        })
    }

    // Cell layout change: the same rows with other column widths, so the first visible row is kept
    updateCellLayout() {
        if (!this.shadowRoot.querySelector("table")) return
        const anchor = this.rowWindow.anchor
        this._stylesheet.updateComposedStyles()
        this.applyColumnWidths()
        this.rowWindow.measure(anchor)
    }

    // Fixes the column widths; the table switches to fixed layout once the colgroup has cols
    applyColumnWidths(remeasure = false) {
        const widths = this.columnSizer.measure(remeasure)
        this.rowWindow.widthsApplied(widths, remeasure)
        this.shadowRoot.querySelector("colgroup").innerHTML = this._tableBuilder.buildColgroup(widths)
        this._stylesheet.updateIndexOffsets(widths.slice(0, this.view.index.nlevels + 1))
        this.updateNarrowedColumns()
        this._stylesheet.updateTheadOffset()
        this._stylesheet.updateIndexOffset()
    }

    // MARK: user widths
    // The only entry points for user column widths (drag, reset, reset all; later a host property).
    // key: ColumnSizer.keyOf(iloc)
    get userWidthCount() {
        return this.columnSizer.userWidthCount
    }

    setColumnWidth(key, width) {
        this.columnSizer.setOverride(key, width)
        this.commitColumnWidths()
    }

    resetColumnWidth(key) {
        if (this.columnSizer.deleteOverride(key)) this.commitColumnWidths()
    }

    resetColumnWidths() {
        if (this.columnSizer.clearOverrides()) this.commitColumnWidths()
    }

    // Other widths, the same rows: the first visible row is kept
    commitColumnWidths() {
        if (!this.shadowRoot.querySelector("table")) return
        const anchor = this.rowWindow.anchor
        this.applyColumnWidths()
        this.rowWindow.measure(anchor)
    }

    // A width during a drag: only the <col> and the column's truncation, the rest follows on commit
    previewColumnWidth(iloc, width) {
        const col = this.shadowRoot.querySelectorAll("colgroup col")[this.columnSizer.indexCount + iloc]
        col.style.width = `${width}px`
        this.updateNarrowedColumns({ iloc, width })
    }

    // Text columns narrower than their content truncate; preview: { iloc, width } of a column being dragged
    updateNarrowedColumns(preview = null) {
        const ilocs = this.view.columns.ilocs.filter(iloc => iloc === preview?.iloc
            ? preview.width < this.columnSizer.contentWidth(iloc)
            : this.columnSizer.isNarrowed(iloc))
        this._stylesheet.updateNarrowedColumns(ilocs)
    }

    // MARK: handlers
    handleKeydown(event) {
        const zone = this.focusZone
        const handled =
            zone === "thead" ? this.handleTheadNavigation(event)
            : zone === "tbody" ? this.handleTbodyNavigation(event)
            : false

        if (handled) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    handleFontsLoaded() {
        if (!this.shadowRoot.querySelector("table")) return
        const anchor = this.rowWindow.anchor
        this.applyColumnWidths(true)
        this.rowWindow.measure(anchor)
    }

    // MARK: @filter
    // The combo's key selects the column or index level, so hidden columns do not shift it
    handleFilterOptionsRequest(event) {
        const combo = event.target
        const values = this.view.optionValues(combo.dataset.key)
        // TEMPORARY until the combo caps its own list (design step 3): null shows "too many"
        combo.options = values.length <= 30 ? values : null
    }

    // The combo knows no key: it is read here and sent on, composed, to the viewer
    handleFilterInput(event) {
        this.dispatchEvent(new CustomEvent("filter-change", {
            detail: { key: event.target.dataset.key, expression: event.detail.value },
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @thead
    handleTheadNavigation(event) {
        const navKeys = [
            "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
            "Home", "End", "PageUp", "PageDown",
        ]
        if (!navKeys.includes(event.key)) return false

        const els = this.theadNavigableElements
        const pos = this._theadPosition
        let handled = false
        let shouldRefocus = true

        const boundary = (dir) => {
            shouldRefocus = false
            this.dispatchEvent(new CustomEvent("navigation-boundary", {
                detail: { direction: dir, from: "thead" },
                bubbles: true,
                composed: true,
            }))
        }

        switch (event.key) {
            case "ArrowLeft":
                switch (pos.zone) {
                    case "filter-index":
                        if (pos.col > 0) { pos.col--; handled = true }
                        break
                    case "filter-columns":
                        if (pos.col > 0) { pos.col--; handled = true }
                        else if (els.filterIndex.length) {
                            pos.zone = "filter-index"
                            pos.col = els.filterIndex.length - 1
                            handled = true
                        }
                        break
                    case "columns":
                        if (pos.sub === "hide") { pos.sub = "sort"; handled = true }
                        else if (pos.col > 0) { pos.col--; pos.sub = "hide"; handled = true }
                        else {
                            pos.zone = "index-labels"
                            pos.col = els.filterIndex.length - 1
                            pos.sub = "sort"
                            handled = true
                        }
                        break
                    case "index-labels":
                        if (pos.col > 0) { pos.col--; handled = true }
                        break
                    case "groups":
                        if (pos.col > 0) { pos.col--; handled = true }
                        break
                }
                break

            case "ArrowRight":
                switch (pos.zone) {
                    case "filter-index":
                        if (pos.col < els.filterIndex.length - 1) { pos.col++; handled = true }
                        else if (els.filterColumns.length) {
                            pos.zone = "filter-columns"
                            pos.col = 0
                            handled = true
                        }
                        break
                    case "filter-columns":
                        if (pos.col < els.filterColumns.length - 1) { pos.col++; handled = true }
                        break
                    case "columns":
                        if (pos.sub === "sort") { pos.sub = "hide"; handled = true }
                        else if (pos.col < els.columnSort.length - 1) { pos.col++; pos.sub = "sort"; handled = true }
                        break
                    case "index-labels":
                        if (pos.col < els.indexLabels.length - 1) { pos.col++; handled = true }
                        else if (els.columnSort.length) {
                            pos.zone = "columns"
                            pos.col = 0
                            pos.sub = "sort"
                            handled = true
                        }
                        break
                    case "groups":
                        if (pos.col < els.groups[pos.level].length - 1) { pos.col++; handled = true }
                        break
                }
                break

            case "ArrowUp":
                switch (pos.zone) {
                    case "filter-index":
                        if (els.indexLabels.length) {
                            pos.zone = "index-labels"
                            pos.col = Math.min(pos.col, els.indexLabels.length - 1)
                            handled = true
                        } else {
                            boundary("up"); handled = true
                        }
                        break
                    case "filter-columns":
                        pos.zone = "columns"
                        pos.sub = "sort"
                        pos.col = Math.min(pos.col, els.columnSort.length - 1)
                        handled = true
                        break
                    case "index-labels":
                        boundary("up"); handled = true
                        break
                    case "columns": {
                        if (els.groups.length) {
                            const lastLevel = els.groups.length - 1
                            const spans = this.view.columns.spans[lastLevel]
                            const spanIdx = spans.findIndex(s => pos.col >= s.iloc && pos.col < s.iloc + s.count)
                            pos.zone = "groups"
                            pos.level = lastLevel
                            pos.col = spanIdx !== -1 ? spanIdx : 0
                        } else {
                            boundary("up")
                        }
                        handled = true
                        break
                    }
                    case "groups":
                        if (pos.level > 0) {
                            const span = this.view.columns.spans[pos.level][pos.col]
                            const parentSpans = this.view.columns.spans[pos.level - 1]
                            const parentIdx = parentSpans.findIndex(s => span.iloc >= s.iloc && span.iloc < s.iloc + s.count)
                            pos.level--
                            pos.col = parentIdx !== -1 ? parentIdx : 0
                        } else {
                            boundary("up")
                        }
                        handled = true
                        break
                }
                break

            case "ArrowDown":
                switch (pos.zone) {
                    case "filter-index":
                    case "filter-columns":
                        boundary("down"); handled = true
                        break
                    case "index-labels":
                        if (els.filterIndex.length && !this.options.styling.hideFilters) {
                            pos.zone = "filter-index"
                            pos.col = Math.min(pos.col, els.filterIndex.length - 1)
                            handled = true
                        } else {
                            boundary("down"); handled = true
                        }
                        break
                    case "columns":
                        pos.zone = "filter-columns"
                        pos.col = Math.min(pos.col, els.filterColumns.length - 1)
                        pos.sub = null
                        handled = true
                        break
                    case "groups": {
                        const span = this.view.columns.spans[pos.level][pos.col]
                        if (pos.level < els.groups.length - 1) {
                            const nextSpans = this.view.columns.spans[pos.level + 1]
                            const nextIdx = nextSpans.findIndex(s => span.iloc >= s.iloc && span.iloc < s.iloc + s.count)
                            pos.level++
                            pos.col = nextIdx !== -1 ? nextIdx : 0
                        } else {
                            pos.zone = "columns"
                            pos.col = span.iloc
                            pos.sub = "sort"
                            pos.level = null
                        }
                        handled = true
                        break
                    }
                }
                break

            case "Home":
                switch (pos.zone) {
                    case "filter-index": pos.col = 0; handled = true; break
                    case "filter-columns": pos.col = 0; handled = true; break
                    case "columns": pos.col = 0; pos.sub = "sort"; handled = true; break
                    case "index-labels": pos.col = 0; handled = true; break
                    case "groups": pos.col = 0; handled = true; break
                }
                break

            case "End":
                switch (pos.zone) {
                    case "filter-index": pos.col = els.filterIndex.length - 1; handled = true; break
                    case "filter-columns": pos.col = els.filterColumns.length - 1; handled = true; break
                    case "columns": pos.col = els.columnSort.length - 1; pos.sub = "hide"; handled = true; break
                    case "index-labels": pos.col = els.indexLabels.length - 1; handled = true; break
                    case "groups": pos.col = els.groups[pos.level].length - 1; handled = true; break
                }
                break

            case "PageUp":
                if (pos.zone === "columns" || pos.zone === "filter-columns") {
                    const edges = this.view.columns.edges
                    const prevEdge = [...edges].reverse().find(e => e < pos.col)
                    pos.col = prevEdge ?? 0
                    if (pos.zone === "columns") pos.sub = "sort"
                    handled = true
                }
                break

            case "PageDown":
                if (pos.zone === "columns" || pos.zone === "filter-columns") {
                    const edges = this.view.columns.edges
                    const maxCol = pos.zone === "columns"
                        ? els.columnSort.length - 1
                        : els.filterColumns.length - 1
                    const nextEdge = edges.find(e => e > pos.col)
                    pos.col = nextEdge ?? maxCol
                    if (pos.zone === "columns") pos.sub = "sort"
                    handled = true
                }
                break
        }

        if (handled && shouldRefocus) this.focusTheadElement()
        return handled
    }

    focusTheadElement() {
        const els = this.theadNavigableElements
        const { zone, col, sub, level } = this._theadPosition
        let target

        switch (zone) {
            case "filter-index": target = els.filterIndex[col]; break
            case "filter-columns": target = els.filterColumns[col]; break
            case "index-labels": target = els.indexLabels[col]; break
            case "columns": target = sub === "sort" ? els.columnSort[col] : els.columnHide[col]; break
            case "groups": target = els.groups[level]?.[col]; break
        }

        if (target) {
            target.focus()
            this.scrollElementIntoView(target)
        }
    }

    handleTheadFocusIn(event) {
        const target = event.target
        const isNavigable =
            target.matches("sort-button button") ||
            target.matches(".hide-button") ||
            target.matches("filter-combo")

        if (isNavigable) this.initializeTheadPosition(target)
    }

    initializeTheadPosition(element) {
        const els = this.theadNavigableElements
        let idx

        idx = els.filterIndex.indexOf(element)
        if (idx !== -1) { this._theadPosition = { zone: "filter-index", col: idx, sub: null, level: null }; return }

        idx = els.filterColumns.indexOf(element)
        if (idx !== -1) { this._theadPosition = { zone: "filter-columns", col: idx, sub: null, level: null }; return }

        idx = els.columnSort.indexOf(element)
        if (idx !== -1) { this._theadPosition = { zone: "columns", col: idx, sub: "sort", level: null }; return }

        idx = els.columnHide.indexOf(element)
        if (idx !== -1) { this._theadPosition = { zone: "columns", col: idx, sub: "hide", level: null }; return }

        idx = els.indexLabels.indexOf(element)
        if (idx !== -1) { this._theadPosition = { zone: "index-labels", col: idx, sub: null, level: null }; return }

        for (let level = 0; level < els.groups.length; level++) {
            idx = els.groups[level].indexOf(element)
            if (idx !== -1) { this._theadPosition = { zone: "groups", col: idx, sub: null, level }; return }
        }
    }

    // MARK: @tbody
    handleTbodyNavigation(event) {
        const totalRows = this.view.visibleIndices.length

        switch (event.key) {
            case "ArrowUp": {
                if (this._tbodyPosition === 0) {
                    return false
                }
                this._tbodyPosition -= 1
                this.focusTbodyRow(this._tbodyPosition)
                return true
            }
            case "ArrowDown": {
                const next = this._tbodyPosition + 1
                const totalRows = this.view.visibleIndices.length
                if (next >= totalRows) return true
                this._tbodyPosition = next
                this.focusTbodyRow(next)
                return true
            }
            case "Home": {
                this._tbodyPosition = 0
                this.focusTbodyRow(0)
                return true
            }
            case "End": {
                this._tbodyPosition = totalRows - 1
                this.focusTbodyRow(this._tbodyPosition)
                return true
            }
            // Handled also at the first and last row: the browser would scroll the table without moving focus
            case "PageUp":
            case "PageDown": {
                const from = this._tbodyPosition
                const target = this.rowWindow.pageFrom(from, event.key === "PageDown" ? 1 : -1)
                if (target === from) return true
                this._tbodyPosition = target
                this.rowWindow.scrollToRowInPlaceOf(target, from)
                this.rowWindow.rowAt(target)?.focus({ preventScroll: true })
                return true
            }
            case "Enter": {
                this.dispatchEvent(new CustomEvent("enter-record-view", {
                    detail: { viewRowIndex: this._tbodyPosition },
                    bubbles: true,
                    composed: true
                }))
                return true
            }
        }
        return false
    }

    // Sets the position as well: focusin does not fire when the document has no focus
    focusTbodyRow(index) {
        this._tbodyPosition = index
        this.rowWindow.scrollToRow(index)
        this.rowWindow.rowAt(index)?.focus({ preventScroll: true })
    }

    handleTbodyFocusIn(event) {
        const row = event.target.closest("tr[data-view-row]")
        if (row?.closest("tbody")) {
            this._tbodyPosition = Number(row.dataset.viewRow)
        }
    }

    resetTbodyPosition() {
        this._tbodyPosition = 0
    }

    // MARK: focus
    getStickyIndexWidth() {
        const columnLevelNameLabel = this.shadowRoot.querySelector('.columnLevelNameLabel')
        return columnLevelNameLabel ? columnLevelNameLabel.getBoundingClientRect().width : 0
    }

    scrollElementIntoView(element) {
        if (!element) return

        const tableContainer = this
        const elementRect = element.getBoundingClientRect()
        const containerRect = tableContainer.getBoundingClientRect()

        // Only handle left side - sticky column obstruction
        const stickyIndexWidth = this.getStickyIndexWidth()
        const elementLeft = elementRect.left - containerRect.left
        const isHiddenBehindSticky = elementLeft < stickyIndexWidth

        if (isHiddenBehindSticky) {
            const scrollOffset = stickyIndexWidth - elementLeft + 10
            tableContainer.scrollLeft = Math.max(0, tableContainer.scrollLeft - scrollOffset)
        }
    }
}

customElements.define("data-table", DataTable)
