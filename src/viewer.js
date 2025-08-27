import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import { TableBuilder } from "./build/table-builder.js"
import { RecordBuilder } from "./build/record-builder.js"
import { Stylesheet } from "./build/stylesheet.js"
import "./components/control-panel.js"
import "./components/filter-input.js"
import "./components/sortable-column-header.js"
import "https://lcvriend.github.io/wc-multi-selector/src/wc-multi-selector.js"


export class DataViewer extends HTMLElement {
    static get observedAttributes() {
        return [
            "view", "src", "locale", "na-rep",
            "hide-group-borders", "hide-row-borders",
            "hide-thead-border", "hide-index-border",
        ]
    }

    static get defaults() {
        return {
            locale: "default",
            naRep: "-",
            buffer: 30,
            styling: {
                groupBorders: true,
                rowBorders: true,
                hoverEffect: true,
                theadBorder: true,
                indexBorder: true,
            }
        }
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.options = { ...DataViewer.defaults }
        this.handleDataChange = this.handleDataChange.bind(this)
        this.handleTableClick = this.handleTableClick.bind(this)
        this.handleRecordViewClick = this.handleRecordViewClick.bind(this)
        this.handleRecordNavigation = this.handleRecordNavigation.bind(this)
        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleClearAllFilters = this.handleClearAllFilters.bind(this)
        this.handleColumnSelectionChange = this.handleColumnSelectionChange.bind(this)
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleScroll = this.handleScroll.bind(this)

        this._data = new Data()
        this.stylesheet = new Stylesheet(this, this.data, this.options)
        this._tableBuilder = new TableBuilder(this, this.options)
        this._recordBuilder = new RecordBuilder(this, this.options)

        this._viewMode = "table"
        this._currentRecordIndex = 0
    }

    // MARK: setup
    connectedCallback() {
        // set default mode if not provided
        if (!this.hasAttribute("view")) {
            this.setAttribute("view", "table")
        }

        // initialize internal state
        this._viewMode = this.getAttribute("view") === "record" ? "record" : "table"

        // setup
        this.addEventListeners()
        this.stylesheet.setupStyles()
        this.render()
    }

    disconnectedCallback() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.removeEventListeners()
        this.stylesheet.disconnect()
    }

    addEventListeners() {
        this.data.addEventListener("data-changed", this.handleDataChange)
        this.shadowRoot.addEventListener("click", this.handleTableClick)
        this.shadowRoot.addEventListener("click", this.handleRecordViewClick)
        this.shadowRoot.addEventListener("click", this.handleRecordNavigation)
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.addEventListener("scroll", this.handleScroll, { capture: true })
    }

    removeEventListeners() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.shadowRoot.removeEventListener("click", this.handleTableClick)
        this.shadowRoot.removeEventListener("click", this.handleRecordViewClick)
        this.shadowRoot.removeEventListener("click", this.handleRecordNavigation)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.removeEventListener("scroll", this.handleScroll)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        switch (name) {
            case "view":
                this._viewMode = newValue === "record" ? "record" : "table"
                // only render when connected and not initializing
                if (this.isConnected && oldValue !== null) {
                    this.render()
                }
                break
            case "src":
                this.loadDataFromSrc(newValue)
                break
            case "locale":
                this.options.locale = newValue ?? DataViewer.defaults.locale
                this.render()
                break
            case "na-rep":
                this.options.naRep = newValue ?? DataViewer.defaults.naRep
                this.render()
                break
            case "hide-group-borders":
                this.options.styling.groupBorders = newValue === null
                this.render()
                break
            case "hide-row-borders":
                this.options.styling.rowBorders = newValue === null
                this.render()
                break
            case "hide-index-border":
                this.options.styling.indexBorder = newValue === null
                this.render()
                break
            case "hide-thead-border":
                this.options.styling.theadBorder = newValue === null
                this.render()
                break
        }
    }

    async loadDataFromSrc(src) {
        try {
            const response = await fetch(src)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const rawData = await response.json()
            this.data = rawData
        } catch (error) {
            console.error("Failed to fetch data:", error)
            this.showErrorMessage("Failed to load data")
        }
    }

    // MARK: get/set
    get data() {
        return this._data
    }

    set data(value) {
        this._data.setData(value)
    }

    get view() {
        if (!this._view || this._viewNeedsUpdate) {
            this._view = new View(this.data)
            this._viewNeedsUpdate = false
        }
        return this._view
    }

    get viewMode() {
        return this._viewMode
    }

    get currentRecordIndex() {
        return this._currentRecordIndex
    }

    get currentRecord() {
        if (this._viewMode !== "record" || this.view.visibleIndices.length === 0) {
            return null
        }

        const originalIndex = this.view.visibleIndices[this._currentRecordIndex]
        const values = this.view.values[this._currentRecordIndex]
        const indexValue = this.view.index.values[this._currentRecordIndex]

        return {
            originalIndex,
            indexValue,
            values
        }
    }

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <control-panel></control-panel>
                <div class="table-container"></div>
                <div class="record-container"></div>
            `
        }

        this.updateControlPanel()
        if (this._viewMode === "table") {
            this.renderTable()
        } else {
            this.renderRecord()
        }
    }

    renderTable() {
        if (!this.data.hasColumns) return

        const tableContainer = this.shadowRoot.querySelector(".table-container")
        tableContainer.innerHTML = `
            <table>
                <thead>${this._tableBuilder.buildThead()}</thead>
                <tbody></tbody>
            </table>
        `

        this.stylesheet.setupStyles()
        this.stylesheet.updateTheadOffset()
        this.stylesheet.updateIndexOffset()
        this.renderTbody()
    }

    renderTbody() {
        const tbody = this.shadowRoot.querySelector("tbody")
        tbody.innerHTML = this._tableBuilder.buildTbody(0, this.options.buffer)
        this.stylesheet.updateColumnWidths()
    }

    renderRecord() {
        const recordContainer = this.shadowRoot.querySelector(".record-container")
        recordContainer.innerHTML = this._recordBuilder.buildRecord()
    }

    updateControlPanel() {
        if (!this.data.hasColumns) return

        const columnTree = this.buildColumnTree()
        const controlPanel = this.shadowRoot.querySelector("control-panel")
        controlPanel.columnData = columnTree
    }

    // MARK: handlers
    handleDataChange(event) {
        this._viewNeedsUpdate = true
        // if data structure changes then do full re-render
        event.detail.isValuesOnly ? this.renderTbody() : this.render()
        this.dispatchEvent(new CustomEvent("data-changed", { detail: this.data }))
    }

    handleTableClick(event) {
        const cell = event.target.closest("th, td")
        if (!cell) return

        const tr = cell.closest("tr")
        const isInHead = tr.closest("thead") !== null
        const isInBody = tr.closest("tbody") !== null

        let source, row, col

        if (isInHead) {
            source = "column"
            row = Array.from(tr.parentNode.children).indexOf(tr)
            col = Array.from(tr.children).indexOf(cell)
        } else if (isInBody) {
            if (cell.tagName === "TH") {
                source = "index"
                row = Array.from(tr.parentNode.children).indexOf(tr)
                col = Array.from(tr.children).filter(c => c.tagName === "TH").indexOf(cell)
            } else {
                source = "values"
                row = Array.from(tr.parentNode.children).indexOf(tr)
                col = Array.from(tr.children).filter(c => c.tagName === "TD").indexOf(cell)
            }
        } else {
            return // Not in thead or tbody, ignore
        }

        const value = cell.textContent

        this.dispatchEvent(new CustomEvent("cell-click", {
            detail: { value, source, row, col },
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @mode
    handleRecordViewClick(event) {
        if (!event.target.matches(".recordViewIcon button")) return

        event.stopPropagation() // prevent triggering cell-click
        const viewRowIndex = parseInt(event.target.closest("th").dataset.viewRow)
        this.enterRecordView(viewRowIndex)
    }

    enterRecordView(viewRowIndex) {
        this._currentRecordIndex = viewRowIndex
        this.setAttribute("view", "record")
    }

    exitRecordView() {
        this.setAttribute("view", "table")
    }

    navigateRecord(direction) {
        const totalRecords = this.view.visibleIndices.length
        if (totalRecords === 0) return

        switch (direction) {
            case "first":
                this._currentRecordIndex = 0
                break
            case "prev":
                this._currentRecordIndex = (this._currentRecordIndex - 1 + totalRecords) % totalRecords
                break
            case "next":
                this._currentRecordIndex = (this._currentRecordIndex + 1) % totalRecords
                break
            case "last":
                this._currentRecordIndex = totalRecords - 1
                break
        }

        this.renderRecord()
    }

        handleRecordNavigation(event) {
            const navButton = event.target.closest("[data-nav]")
            if (!navButton) return

            event.stopPropagation()

            const action = navButton.dataset.nav

            switch (action) {
                case "first":
                case "prev":
                case "next":
                case "last":
                    this.navigateRecord(action)
                    break
                case "exit":
                    this.exitRecordView()
                    break
            }
        }

    // MARK: @filter
    handleFilterInput(event) {
        const filterInputs = this.shadowRoot.querySelectorAll("thead filter-input")
        const filters = Array.from(filterInputs).map((filterEl) => {
            const th = filterEl.closest("th")
            const col = parseInt(th.dataset.col)
            return {
                col,
                value: filterEl.value.trim()
            }
        }).filter(filter => filter.value !== "")

        this.applyFilters(filters)
    }

    // FIXME: filter state management needs architectural fix
    // problem: column filtering breaks row filters because filter.col indices
    // become misaligned with actual visible columns. current patch works but
    // doesn't handle filter persistence across column selection changes.
    // need to decide: preserve filters by column identity or clear on column changes?
    applyFilters(filters) {
        if (filters.length === 0) {
            this.view.reset()
        } else {
            const predicate = (rowValues, rowIndex) => {
                return filters.every(filter => {
                    // Map filtered column index to original column index
                    const originalColumnIndex = this.view._visibleColumnIndices
                        ? this.view._visibleColumnIndices[filter.col]
                        : filter.col

                    const cellValue = rowValues[originalColumnIndex]
                    return cellValue != null &&
                        cellValue.toString().toLowerCase().includes(filter.value.toLowerCase())
                })
            }
            this.view.filter(predicate)
        }
        this.renderTbody()
    }

    handleClearAllFilters() {
        const filterInputs = this.shadowRoot.querySelectorAll("thead filter-input")
            filterInputs.forEach(filterInput => filterInput.clear())
    }

    // MARK: @column
    handleColumnSelectionChange(event) {
        const selectedColumnIndices = event.detail.selectedColumns
        this.applyColumnFilter(selectedColumnIndices)
    }

    applyColumnFilter(selectedColumnIndices) {
        if (selectedColumnIndices.length === 0) {
            this.view.filterColumns(null)
        } else {
            this.view.filterColumns(selectedColumnIndices)
        }

        this.render()
    }

    buildColumnTree() {
        if (!this.data.columns.isMultiIndex) {
            return this.buildFlatColumnTree()
        }
        return this.buildLevel(0, 0, this.data.columns.length)
    }

    buildFlatColumnTree() {
        return this.data.columns.values.map((value, iloc) => ({
            label: value,
            value: iloc,
            selected: true,
            children: [],
        }))
    }

    buildLevel(level, start, end) {
        if (level === this.data.columns.nlevels - 1) {
            // leaf level: create actual column nodes
            const result = []
            for (let iloc = start; iloc < end; iloc++) {
                const columnValue = this.data.columns.values[iloc]
                const label = Array.isArray(columnValue) ? columnValue[level] : columnValue
                result.push({
                    label: label,
                    value: iloc,
                    selected: true,
                    children: []
                })
            }
            return result
        }

        // intermediate level: group by spans
        const result = []
        const spans = this.data.columns.spans[level]

        for (const span of spans) {
            const spanEnd = span.iloc + span.count
            if (spanEnd <= start || span.iloc >= end) continue

            const spanStart = Math.max(span.iloc, start)
            const clampedEnd = Math.min(spanEnd, end)

            const children = this.buildLevel(level + 1, spanStart, clampedEnd)

            result.push({
                value: span.value[level],
                children: children
            })
        }

        return result
    }

    // MARK: @sort
    handleColumnSort(event) {
        // reset all other column headers
        this.shadowRoot.querySelectorAll('sortable-column-header').forEach(header => {
            if (header !== event.target) header.clearSort()
        })

        // apply sort to view
        const { columnIndex, sortState } = event.detail
        if (sortState === "none") {
            this.view.reset()
        } else {
            this.view.sortByColumn(columnIndex, sortState)
        }
        this.renderTbody()
    }

    // MARK: @scroll
    handleScroll(event) {
        if (!event.target.matches(".table-container")) return
        const tableContainer = event.target.closest(".table-container")

        event.preventDefault()
        event.stopPropagation()

        const tbody = this.shadowRoot.querySelector("tbody")
        if ( tableContainer.scrollHeight - (tableContainer.scrollTop + tableContainer.clientHeight) < 150 ) {
            const start = tbody.rows.length
            const end = start + this.options.buffer
            tbody.innerHTML += this._tableBuilder.buildTbody(start, end)
        }
    }

    showErrorMessage(message) {
        this.shadowRoot.innerHTML = `
            ${this.getStyleSheet()}
            <p style="color: red;">${message}</p>
        `
    }
}


window.customElements.define('data-viewer', DataViewer)
