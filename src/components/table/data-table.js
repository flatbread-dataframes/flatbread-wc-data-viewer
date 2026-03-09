import { TableBuilder } from "./table-builder.js"
import { Stylesheet } from "./stylesheet.js"
import { WheelHandlerMixin } from "../../mixins/wheel-handler.js"
import { ScrollManager } from "./scroll-manager.js"
import { ClickHandler } from "./click-handler.js"


export class DataTable extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })

        this.scrollManager = new ScrollManager(this)
        this.clickHandler = new ClickHandler(this)

        this.handleKeydown = this.handleKeydown.bind(this)
        this.handleTheadFocusIn = this.handleTheadFocusIn.bind(this)
        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleFilterOptionsRequest = this.handleFilterOptionsRequest.bind(this)
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleIndexSort = this.handleIndexSort.bind(this)
        this.handleWheel = WheelHandlerMixin.handleWheel.bind(this)

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
        if (this._stylesheet) {
            this._stylesheet.disconnect()
        }
    }

    addEventListeners() {
        this.addEventListener("keydown", this.handleKeydown)
        this.shadowRoot.addEventListener("focusin", this.handleTheadFocusIn)
        this.shadowRoot.addEventListener("focusin", this.handleTbodyFocusIn)
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("filter-options-request", this.handleFilterOptionsRequest)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("index-sort", this.handleIndexSort)

        this.clickHandler.addEventListeners()
        this.scrollManager.addEventListeners()
        WheelHandlerMixin.addWheelHandling.call(this)
    }

    removeEventListeners() {
        this.removeEventListener("keydown", this.handleKeydown)
        this.shadowRoot.removeEventListener("focusin", this.handleTheadFocusIn)
        this.shadowRoot.removeEventListener("focusin", this.handleTbodyFocusIn)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("filter-options-request", this.handleFilterOptionsRequest)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("index-sort", this.handleIndexSort)

        this.clickHandler.removeEventListeners()
        this.scrollManager.removeEventListeners()
        WheelHandlerMixin.removeWheelHandling.call(this)
    }

    // MARK: get/set
    get dataViewer() {
        return this._dataViewer
    }

    set dataViewer(value) {
        this._dataViewer = value
        if (value) {
            this._tableBuilder = new TableBuilder(value, value.options)
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

    get theadNavigableElements() {
        const nGroupLevels = this.view.columns.ilevels.length - 1

        const groups = Array.from({ length: nGroupLevels }, (_, level) =>
            [...this.shadowRoot.querySelectorAll(
                `thead tr.column-groups-row[data-level="${level}"] .hide-button`
            )]
        )

        return {
            groups,
            columnSort: [...this.shadowRoot.querySelectorAll("thead tr.columns-row sort-button button")],
            columnHide: [...this.shadowRoot.querySelectorAll("thead tr.columns-row .hide-button")],
            indexLabels: [...this.shadowRoot.querySelectorAll("thead tr.index-labels-row sort-button button")],
            filterIndex: [...this.shadowRoot.querySelectorAll("thead tr.filter-row th.indexFilter filter-combo")],
            filterColumns: [...this.shadowRoot.querySelectorAll("thead tr.filter-row th.columnFilter filter-combo")],
        }
    }

    // MARK: render
    render() {
        if (!this.dataViewer) return

        this.shadowRoot.innerHTML = `
            <table>
                <thead>${this._tableBuilder.buildThead()}</thead>
                <tbody>${this._tableBuilder.buildTbody(0, this.options.buffer)}</tbody>
            </table>
        `

        this._stylesheet.setupStyles()
        this._stylesheet.updateTheadOffset()
        this._stylesheet.updateIndexOffset()
        this._stylesheet.updateColumnWidths()
    }

    renderTbody() {
        const tbody = this.shadowRoot.querySelector("tbody")
        if (tbody && this._tableBuilder) {
            tbody.innerHTML = this._tableBuilder.buildTbody(0, this.options.buffer)
            this._stylesheet.updateIndexOffset()
            this._stylesheet.updateColumnWidths()
        }
    }

    // MARK: handlers
    handleKeydown(event) {
        const activeElement = this.shadowRoot.activeElement

        if (activeElement?.closest("thead")) {
            if (this.handleTheadNavigation(event)) {
                event.preventDefault()
                event.stopPropagation()
            }
            return
        }

        if (activeElement?.closest("tbody")) {
            if (this.handleTbodyNavigation(event)) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
    }

    // MARK: @filter
    handleFilterOptionsRequest(event) {
        const filterCombo = event.target
        const th = filterCombo.closest("th")

        if (th.classList.contains("columnFilter")) {
            const col = parseInt(th.dataset.col)
            const values = this.view.values.map(row => row[col])
            this.setFilterOptions(filterCombo, values)
        } else if (th.classList.contains("indexFilter")) {
            const level = parseInt(th.dataset.level)
            const values = this.view.index.values.map(v => Array.isArray(v) ? v[level] : v)
            this.setFilterOptions(filterCombo, values)
        }
    }

    setFilterOptions(filterCombo, values, threshold = 30) {
        const unique = [...new Set(values)].filter(v => v != null).sort()
        filterCombo.options = unique.length <= threshold ? unique : null
    }

    handleFilterInput(event) {
        const allFilters = {
            indexFilters: this.getIndexFilters(),
            columnFilters: this.getColumnFilters()
        }

        this.dispatchEvent(new CustomEvent("filters-changed", {
            detail: allFilters,
            bubbles: true,
            composed: true
        }))

        this.shadowRoot.querySelectorAll("filter-combo").forEach(fc => fc.invalidateOptions())
    }

    getIndexFilters() {
        const indexFilterInputs = this.shadowRoot.querySelectorAll(".indexFilter filter-combo")
        return Array.from(indexFilterInputs).map(filterEl => {
            const th = filterEl.closest("th")
            const level = parseInt(th.dataset.level)
            return { level, value: filterEl.value.trim() }
        }).filter(filter => filter.value !== "")
    }

    getColumnFilters() {
        const columnFilterInputs = this.shadowRoot.querySelectorAll(".columnFilter filter-combo")
        return Array.from(columnFilterInputs).map(filterEl => {
            const th = filterEl.closest("th")
            const col = parseInt(th.dataset.col)
            return { col, value: filterEl.value.trim() }
        }).filter(filter => filter.value !== "")
    }

    clearAllFilters() {
        const allFilterInputs = this.shadowRoot.querySelectorAll("filter-combo")
        allFilterInputs.forEach(filterInput => filterInput.clear())

        this.dispatchEvent(new CustomEvent("filters-changed", {
            detail: {
                indexFilters: [],
                columnFilters: []
            },
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @sort
    handleIndexSort(event) {
        this.clearAllSorts()
        const clickedHeader = event.target
        if (clickedHeader && event.detail.sortState !== "none") {
            clickedHeader.sortState = event.detail.sortState
        }

        this.dispatchEvent(new CustomEvent("index-sort", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    handleColumnSort(event) {
        this.clearAllSorts()
        const clickedHeader = event.target
        if (clickedHeader && event.detail.sortState !== "none") {
            clickedHeader.sortState = event.detail.sortState
        }

        this.dispatchEvent(new CustomEvent("column-sort", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    clearAllSorts() {
        this.shadowRoot.querySelectorAll('sort-button').forEach(btn => {
            btn.clearSort()
        })
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
                        if (els.filterIndex.length) {
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
                this.ensureRowRendered(next)
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
                this.ensureRowRendered(this._tbodyPosition)
                this.focusTbodyRow(this._tbodyPosition)
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

    ensureRowRendered(index) {
        const tbody = this.shadowRoot.querySelector("tbody")
        const renderedCount = tbody.rows.length
        if (index < renderedCount) return

        const end = index + this.dataViewer.options.buffer
        tbody.innerHTML += this._tableBuilder.buildTbody(renderedCount, end)
        this._stylesheet.updateIndexOffset()
        this._stylesheet.updateColumnWidths()
    }

    focusTbodyRow(index) {
        this.ensureRowRendered(index)
        const tbody = this.shadowRoot.querySelector("tbody")
        const row = tbody.rows[index]
        if (row) {
            row.focus()
            this.scrollRowIntoView(row)
        }
    }

    scrollRowIntoView(row) {
        const containerRect = this.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()

        // account for sticky thead
        const thead = this.shadowRoot.querySelector("thead")
        const theadHeight = thead ? thead.getBoundingClientRect().height : 0

        if (rowRect.top < containerRect.top + theadHeight) {
            this.scrollTop -= (containerRect.top + theadHeight - rowRect.top)
        } else if (rowRect.bottom > containerRect.bottom) {
            this.scrollTop += (rowRect.bottom - containerRect.bottom)
        }
    }

    handleTbodyFocusIn(event) {
        const row = event.target.closest("tr")
        if (row && row.closest("tbody")) {
            const index = Array.from(row.parentNode.children).indexOf(row)
            this._tbodyPosition = index
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
