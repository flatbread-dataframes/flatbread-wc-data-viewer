import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import { HTMLBuilder } from "./build/builder.js"
import { Stylesheet } from "./build/stylesheet.js"
import "./components/control-panel.js"
import "./components/filter-input.js"
import "./components/sortable-column-header.js"
import "https://lcvriend.github.io/wc-multi-selector/src/wc-multi-selector.js"

export class DataViewer extends HTMLElement {
    static get observedAttributes() {
        return [
            "src", "locale", "na-rep",
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
        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleColumnSelectionChange = this.handleColumnSelectionChange.bind(this)
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleScroll = this.handleScroll.bind(this)

        this._data = new Data()
        this.stylesheet = new Stylesheet(this, this.data, this.options)
        this._htmlBuilder = new HTMLBuilder(this, this.options)
    }

    // MARK: setup
    connectedCallback() {
        this.data.addEventListener("data-changed", this.handleDataChange)
        this.render()
        this.addEventListeners()
        this.stylesheet.setupStyles()
    }

    disconnectedCallback() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.removeEventListeners()
        this.stylesheet.disconnect()
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("click", this.handleTableClick)
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.addEventListener("scroll", this.handleScroll, { capture: true })
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("click", this.handleTableClick)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.removeEventListener("column-selection-changed", this.handleColumnSelectionChange)
        this.shadowRoot.removeEventListener("scroll", this.handleScroll)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        switch (name) {
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

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <control-panel></control-panel>
                <div class="table-container"></div>
            `
        }

        this.updateControlPanel()
        this.renderTable()
    }

    renderTable() {
        if (!this.data.hasColumns) return

        const tableContainer = this.shadowRoot.querySelector(".table-container")
        tableContainer.innerHTML = `
            <table>
                <thead>${this._htmlBuilder.buildThead()}</thead>
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
        tbody.innerHTML = this._htmlBuilder.buildTbody(0, this.options.buffer)
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

        if (event.detail.isValuesOnly) {
            this.renderTbody()
        } else {
            // Data structure changed - full render including control panel update
            this.render()
        }

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

    applyFilters(filters) {
        if (filters.length === 0) {
            this.view.reset()
        } else {
            const predicate = (rowValues, rowIndex) => {
                return filters.every(filter => {
                    const cellValue = rowValues[filter.col]
                    return cellValue != null &&
                        cellValue.toString().toLowerCase().includes(filter.value.toLowerCase())
                })
            }
            this.view.filter(predicate)
        }
        this.renderTbody()
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

        this.renderTable()
    }

    buildColumnTree() {
        if (!this.data.columns.isMultiIndex) {
            // Simple case: flat column structure
            return this.data.columns.values.map((value, iloc) => ({
                label: value,
                value: iloc,
                selected: true,
                children: [],
            }))
        }
        return this.buildLevel(0, 0, this.data.columns.length)
    }

    buildLevel(level, start, end) {
        if (level === this.data.columns.nlevels - 1) {
            // Leaf level: create actual column nodes
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

        // Intermediate level: group by spans
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
        // Reset all other column headers
        this.shadowRoot.querySelectorAll('sortable-column-header').forEach(header => {
            if (header !== event.target) header.clearSort()
        })

        // Apply sort to view
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
            tbody.innerHTML += this._htmlBuilder.buildTbody(start, end)
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
