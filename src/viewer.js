import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import { EventCoordinator } from "./managers/event-coordinator.js"
import { FilterManager } from "./managers/filter-manager.js"
import { NavigationController } from "./managers/navigation-controller.js"
import "./components/record/data-record.js"
import "./components/table/data-table.js"
import "./components/control-panel.js"
import "./components/filter-input.js"
import "./components/sortable-column-header.js"
// import "./wc-multi-selector.js"
import "https://lcvriend.github.io/wc-multi-selector/src/wc-multi-selector.js"


export class DataViewer extends HTMLElement {
    get styles() {
        return `
            :root {
                box-sizing: border-box;
            }
            :host {
                display: grid;
                height: ${this.options.height};
                grid-template-areas:
                    "control-panel"
                    "view";
                grid-template-rows: auto 1fr;
            }

            control-panel {
                grid-area: control-panel;
            }

            data-table,
            data-record {
                grid-area: view;
                overflow-y: auto;
                scrollbar-gutter: stable;
            }

            :host([view="record"]) data-table {
                visibility: hidden;
            }
            :host([view="record"]) data-record {
                display: block;
            }
            :host([view="table"]) data-table {
                visibility: visible;
            }
            :host([view="table"]) data-record {
                display: none;
            }
        `
    }

    static get observedAttributes() {
        return [
            "view", "src", "locale", "na-rep", "height",
            "hide-group-borders", "hide-row-borders",
            "hide-thead-border", "hide-index-border",
            "hide-filter-row",
        ]
    }

    static get defaults() {
        return {
            locale: "default",
            naRep: "-",
            buffer: 30,
            height: "600px",
            styling: {
                groupBorders: true,
                rowBorders: true,
                hoverEffect: true,
                theadBorder: true,
                indexBorder: true,
                hideFilters: false,
            }
        }
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.options = { ...DataViewer.defaults }

        this._data = new Data()
        this._eventCoordinator = new EventCoordinator(this)
        this._filterManager = new FilterManager()
        this._navigationController = new NavigationController(this)
    }

    // MARK: setup
    connectedCallback() {
        // set default mode if not provided
        if (!this.hasAttribute("view")) {
            this.setAttribute("view", "table")
        }

        this.setAttribute("tabindex", "0")

        // initialize internal state
        this._viewMode = this.getAttribute("view") === "record" ? "record" : "table"

        // setup
        this.addEventListeners()

        const src = this.getAttribute("src")
        if (src) {
            this.loadDataFromSrc(src)
        }
    }

    disconnectedCallback() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.removeEventListeners()
        this.stylesheet.disconnect()
        this._eventCoordinator.destroy()
        this._navigationController.destroy()
    }

    addEventListeners() {
        this._eventCoordinator.addEventListeners()
    }

    removeEventListeners() {
        this._eventCoordinator.removeEventListeners()
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        // Handle special cases first
        switch (name) {
            case "view":
                this._viewMode = newValue === "record" ? "record" : "table"
                if (this.isConnected && this._data.hasColumns) {
                    this.render()
                    this._viewMode === "record" ? this.dataRecord.focus() : this.dataTable.focus()
                }
                return
            case "src":
                this.loadDataFromSrc(newValue)
                return
        }

        // Styling-only attributes - update stylesheet
        const stylingAttributes = ["hide-group-borders", "hide-row-borders", "hide-index-border", "hide-thead-border", "hide-filter-row"]
        if (stylingAttributes.includes(name)) {
            switch (name) {
                case "hide-group-borders":
                    this.options.styling.groupBorders = newValue === null
                    break
                case "hide-row-borders":
                    this.options.styling.rowBorders = newValue === null
                    break
                case "hide-index-border":
                    this.options.styling.indexBorder = newValue === null
                    break
                case "hide-thead-border":
                    this.options.styling.theadBorder = newValue === null
                    break
                case "hide-filter-row":
                    this.options.styling.hideFilters = newValue !== null
                    break
            }
            this.updateStylesheet()
            return
        }

        // Attributes that require full render
        switch (name) {
            case "locale":
                this.options.locale = newValue ?? DataViewer.defaults.locale
                break
            case "na-rep":
                this.options.naRep = newValue ?? DataViewer.defaults.naRep
                break
            case "height":
                this.options.height = newValue ?? DataViewer.defaults.height
                break
        }
        this.render()
    }

async loadDataFromSrc(src) {
    try {
        const response = await fetch(src)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        const rawData = await response.json()
        this.data = rawData // This should trigger handleDataChange
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

    get navigationController() {
        return this._navigationController
    }

    get controlPanel() {
        return this.shadowRoot.querySelector("control-panel")
    }

    get dataTable() {
        return this.shadowRoot.querySelector("data-table")
    }

    get dataRecord() {
        return this.shadowRoot.querySelector("data-record")
    }

    get currentRecordIndex() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.recordIndex : 0
    }

    get currentRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        return dataRecord ? dataRecord.currentRecord : null
    }

    get resolvedColors() {
        const background = getComputedStyle(this).backgroundColor || 'white'

        return {
            background,
            hover: `color-mix(in srgb, ${background} 90%, currentColor 10%)`,
            border: 'currentColor'
        }
    }

    // MARK: render
    render() {
        if (!this.shadowRoot.querySelector("control-panel")) {
            this.shadowRoot.innerHTML = `
                <style>${this.styles}</style>
                <control-panel></control-panel>
                <data-table></data-table>
                <data-record></data-record>
            `
        }
        if (this.data.hasColumns) {
            this.updateDataTable()
            this.updateDataRecord()
            this.updateControlPanel()
        }
    }

    updateDataTable() {
        if (this.dataTable) {
            this.dataTable.dataViewer = this
        }
    }

    updateStylesheet() {
        if (this.dataTable && this.dataTable._stylesheet) {
            this.dataTable._stylesheet.updateComposedStyles()
        }
    }

    updateDataRecord() {
        const dataRecord = this.shadowRoot.querySelector("data-record")
        if (dataRecord) {
            dataRecord.dataViewer = this
        }
    }

    updateControlPanel() {
        if (!this.data.hasColumns) return

        const columnTree = this.buildColumnTree()
        this.controlPanel.dataViewer = this
        this.controlPanel.columnData = columnTree

        // Add view info for status display
        this.controlPanel.viewInfo = {
            visibleRows: this.view.visibleIndices.length,
            totalRows: this.data.index.length,
            visibleColumns: this.view.columns.length,
            totalColumns: this.data.columns.length
        }
    }

    // MARK: @record
    enterRecordView(viewRowIndex) {
        this.setAttribute("view", "record")
    }

    // MARK: @column
    applyColumnFilter(selectedColumnIndices) {
        if (selectedColumnIndices.length === 0) {
            this.view.filterColumns(null)
        } else {
            this.view.filterColumns(selectedColumnIndices)
        }

        if (this.dataTable) {
            this.dataTable.render()
        }
        this.updateDataRecord()
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

    updateControlPanelStatus() {
        const controlPanel = this.shadowRoot.querySelector("control-panel")
        if (controlPanel) {
            controlPanel.viewInfo = {
                visibleRows: this.view.visibleIndices.length,
                totalRows: this.data.index.length,
                visibleColumns: this.view.columns.length,
                totalColumns: this.data.columns.length
            }
        }
    }

    // MARK: @keyboard
    toggleViewMode() {
        const newView = this._viewMode === "table" ? "record" : "table"
        this.setAttribute("view", newView)
    }

    focusFirstFilter() {
        if (this.dataTable && this._viewMode === "table") {
            const firstFilter = this.dataTable.shadowRoot.querySelector(".columnFilter filter-input")
            if (firstFilter) {
                firstFilter.focus()
            }
        }
    }

    // MARK: @error
    showErrorMessage(message) {
        this.shadowRoot.innerHTML = `
            ${this.getStyleSheet()}
            <p style="color: red;">${message}</p>
        `
    }
}


window.customElements.define('data-viewer', DataViewer)
