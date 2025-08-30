import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import { TableBuilder } from "./build/table-builder.js"
import { Stylesheet } from "./build/stylesheet.js"
import "./components/data-record.js"
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
        this.handleExitRecordView = this.handleExitRecordView.bind(this)

        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleClearAllFilters = this.handleClearAllFilters.bind(this)

        this.handleColumnSelectionChange = this.handleColumnSelectionChange.bind(this)
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleIndexSort = this.handleIndexSort.bind(this)

        this.handleScroll = this.handleScroll.bind(this)

        this._data = new Data()
        this.stylesheet = new Stylesheet(this, this.data, this.options)
        this._tableBuilder = new TableBuilder(this, this.options)
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
        this.shadowRoot.addEventListener("exit-record-view", this.handleExitRecordView)
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("index-sort", this.handleIndexSort)
        this.shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.addEventListener("scroll", this.handleScroll, { capture: true })
    }

    removeEventListeners() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.shadowRoot.removeEventListener("click", this.handleTableClick)
        this.shadowRoot.removeEventListener("exit-record-view", this.handleExitRecordView)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("clear-all-filters", this.handleClearAllFilters)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("index-sort", this.handleIndexSort)
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
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.recordIndex : 0
    }

    get currentRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.currentRecord : null
    }

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <control-panel></control-panel>
                <div class="table-container"></div>
                <data-record></data-record>
            `
        }

        this.updateControlPanel()
        this.renderTable()
        this.updateDataRecord()
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
        this.renderTbody()
    }

    renderTbody() {
        const tbody = this.shadowRoot.querySelector("tbody")
        tbody.innerHTML = this._tableBuilder.buildTbody(0, this.options.buffer)
        this.stylesheet.updateIndexOffset()
        this.stylesheet.updateColumnWidths()
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
        if (event.target.matches(".recordViewIcon button")) {
            event.stopPropagation()
            const viewRowIndex = parseInt(event.target.closest("th").dataset.viewRow)
            this.enterRecordView(viewRowIndex)
            return
        }

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

    handleExitRecordView(event) {
        event.stopPropagation()
        this.setAttribute("view", "table")
    }

    updateDataRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.dataViewer = this
        }
    }

    enterRecordView(viewRowIndex) {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.recordIndex = viewRowIndex
        }
        this.setAttribute("view", "record")
    }

    // MARK: @filter
    handleFilterInput(event) {
        this.applyFilters()
    }

    // FIXME: filter state management needs architectural fix
    // problem: column filtering breaks row filters because filter.col indices
    // become misaligned with actual visible columns. current patch works but
    // doesn't handle filter persistence across column selection changes.
    // need to decide: preserve filters by column identity or clear on column changes?
    applyFilters() {
        const indexFilters = this.getIndexFilters()
        const columnFilters = this.getColumnFilters()

        if (indexFilters.length === 0 && columnFilters.length === 0) {
            this.view.reset()
        } else {
            const predicates = []
            if (indexFilters.length > 0) predicates.push(this.createIndexPredicate(indexFilters))
            if (columnFilters.length > 0) predicates.push(this.createColumnPredicate(columnFilters))

            const combinedPredicate = (rowValues, rowIndex) => {
                return predicates.every(predicate => predicate(rowValues, rowIndex))
            }

            this.view.filter(combinedPredicate)
        }
        this.renderTbody()
    }

    getIndexFilters() {
        const indexFilterInputs = this.shadowRoot.querySelectorAll(".indexFilter filter-input")
        return Array.from(indexFilterInputs).map(filterEl => {
            const th = filterEl.closest("th")
            const level = parseInt(th.dataset.level)
            return { level, value: filterEl.value.trim() }
        }).filter(filter => filter.value !== "")
    }

    getColumnFilters() {
        const columnFilterInputs = this.shadowRoot.querySelectorAll(".columnFilter filter-input")
        return Array.from(columnFilterInputs).map(filterEl => {
            const th = filterEl.closest("th")
            const col = parseInt(th.dataset.col)
            return { col, value: filterEl.value.trim() }
        }).filter(filter => filter.value !== "")
    }

    createIndexPredicate(indexFilters) {
        return (rowValues, rowIndex) => {
            return indexFilters.every(filter => {
                const indexValue = this.data.index.values[rowIndex]
                const levelValue = Array.isArray(indexValue)
                    ? indexValue[filter.level]
                    : indexValue
                return levelValue != null &&
                    levelValue.toString().toLowerCase().includes(filter.value.toLowerCase())
            })
        }
    }

    createColumnPredicate(columnFilters) {
        return (rowValues, rowIndex) => {
            return columnFilters.every(filter => {
                const originalColumnIndex = this.view._visibleColumnIndices
                    ? this.view._visibleColumnIndices[filter.col]
                    : filter.col
                const cellValue = rowValues[originalColumnIndex]
                return cellValue != null &&
                    cellValue.toString().toLowerCase().includes(filter.value.toLowerCase())
            })
        }
    }

    handleClearAllFilters() {
        const allFilterInputs = this.shadowRoot.querySelectorAll("filter-input")
        allFilterInputs.forEach(filterInput => filterInput.clear())
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
        this.clearAllSorts()
        event.target.sortState = event.detail.sortState

        // apply sort to view
        const { columnIndex, sortState } = event.detail
        if (sortState === "none") {
            this.view.reset()
        } else {
            this.view.sortByColumn(columnIndex, sortState)
        }
        this.renderTbody()
    }

    handleIndexSort(event) {
        this.clearAllSorts()
        event.target.sortState = event.detail.sortState

        // apply sort to view
        const { level, sortState } = event.detail
        if (sortState === "none") {
            this.view.reset()
        } else {
            this.view.sortByIndex(level, sortState)
        }
        this.renderTbody()
    }

    clearAllSorts() {
        this.shadowRoot.querySelectorAll('sortable-column-header').forEach(header => {
            header.clearSort()
        })
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
