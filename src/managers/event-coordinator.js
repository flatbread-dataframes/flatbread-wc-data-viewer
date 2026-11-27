import { toJSON, toCSV, download } from "../export/exporter.js"

export class EventCoordinator {
    constructor(dataViewer) {
        this.dataViewer = dataViewer

        this.handleCellClick = this.handleCellClick.bind(this)
        this.handleFieldClick = this.handleFieldClick.bind(this)
        this.handleEnterRecordView = this.handleEnterRecordView.bind(this)
        this.handleExitRecordView = this.handleExitRecordView.bind(this)
        this.handleToggleFilterRow = this.handleToggleFilterRow.bind(this)
        this.handleFilterChange = this.handleFilterChange.bind(this)
        this.handleClearAllFilters = this.handleClearAllFilters.bind(this)
        this.handleColumnSelectionChange = this.handleColumnSelectionChange.bind(this)
        this.handleCellLayoutChange = this.handleCellLayoutChange.bind(this)
        this.handleResetColumnWidths = this.handleResetColumnWidths.bind(this)
        this.handleSortChange = this.handleSortChange.bind(this)
        this.handleDataChange = this.handleDataChange.bind(this)
        this.handleExportData = this.handleExportData.bind(this)
    }

    // MARK: setup
    addEventListeners() {
        const { shadowRoot, data } = this.dataViewer

        data.addEventListener("data-changed", this.handleDataChange)
        shadowRoot.addEventListener("cell-click", this.handleCellClick)
        shadowRoot.addEventListener("field-click", this.handleFieldClick)
        shadowRoot.addEventListener("enter-record-view", this.handleEnterRecordView)
        shadowRoot.addEventListener("exit-record-view", this.handleExitRecordView)
        shadowRoot.addEventListener("toggle-filter-row", this.handleToggleFilterRow)
        shadowRoot.addEventListener("filter-change", this.handleFilterChange)
        shadowRoot.addEventListener("clear-filters", this.handleClearAllFilters)
        shadowRoot.addEventListener("sort-change", this.handleSortChange)
        shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        shadowRoot.addEventListener("cell-layout-changed", this.handleCellLayoutChange)
        shadowRoot.addEventListener("reset-column-widths", this.handleResetColumnWidths)
        shadowRoot.addEventListener("export-data", this.handleExportData)
    }

    removeEventListeners() {
        const { shadowRoot, data } = this.dataViewer

        data.removeEventListener("data-changed", this.handleDataChange)
        shadowRoot.removeEventListener("cell-click", this.handleCellClick)
        shadowRoot.removeEventListener("field-click", this.handleFieldClick)
        shadowRoot.removeEventListener("enter-record-view", this.handleEnterRecordView)
        shadowRoot.removeEventListener("exit-record-view", this.handleExitRecordView)
        shadowRoot.removeEventListener("toggle-filter-row", this.handleToggleFilterRow)
        shadowRoot.removeEventListener("filter-change", this.handleFilterChange)
        shadowRoot.removeEventListener("clear-filters", this.handleClearAllFilters)
        shadowRoot.removeEventListener("sort-change", this.handleSortChange)
        shadowRoot.removeEventListener("column-selection-changed", this.handleColumnSelectionChange)
        shadowRoot.removeEventListener("cell-layout-changed", this.handleCellLayoutChange)
        shadowRoot.removeEventListener("reset-column-widths", this.handleResetColumnWidths)
        shadowRoot.removeEventListener("export-data", this.handleExportData)
    }

    // MARK: handlers
    handleDataChange(event) {
        this.dataViewer._viewNeedsUpdate = true
        this.dataViewer.invalidateColumnWidths()

        if (event.detail.isValuesOnly) {
            this.dataViewer.updateDataTable()
            this.dataViewer.updateDataRecord()
        } else {
            this.dataViewer.render()
            this.dataViewer.updateControlPanel()
        }

        this.dataViewer.dispatchEvent(new CustomEvent("data-changed", { detail: this.dataViewer.data }))
    }

    // MARK: @interaction
    // The internal event is replaced by one from the viewer; stopped so the host sees one event
    handleCellClick(event) {
        event.stopPropagation()
        this.dataViewer.dispatchEvent(new CustomEvent("cell-click", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    handleFieldClick(event) {
        event.stopPropagation()
        this.dataViewer.dispatchEvent(new CustomEvent("field-click", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @view
    // The viewer opens the record view on the focused row (tbodyPosition)
    handleEnterRecordView(event) {
        this.dataViewer.setAttribute("view", "record")
    }

    handleExitRecordView(event) {
        event.stopPropagation()
        this.dataViewer.setAttribute("view", "table")
    }

    // MARK: @filter
    handleToggleFilterRow(event) {
        if (this.dataViewer.hasAttribute("hide-filter-row")) {
            this.dataViewer.removeAttribute("hide-filter-row")
        } else {
            this.dataViewer.setAttribute("hide-filter-row", "")
        }
        this.dataViewer.controlPanel.showFilters = !this.dataViewer.hasAttribute("hide-filter-row")
    }

    // Filter and sort events are internal: composed to leave the table, stopped here
    handleFilterChange(event) {
        event.stopPropagation()
        const { key, expression } = event.detail
        this.dataViewer.view.setFilter(key, expression)
        this.dataViewer.updateRows()
    }

    handleClearAllFilters() {
        this.dataViewer.view.clearFilters()
        this.dataViewer.updateRows()
        this.dataViewer.focus()
    }

    // MARK: @column
    handleColumnSelectionChange(event) {
        const selectedColumnIndices = event.detail.selectedColumns.map(Number)
        this.dataViewer.applyColumnFilter(selectedColumnIndices)
        this.dataViewer.updateControlPanelStatus()
    }

    // MARK: @layout
    // Through the attribute, so a change from the control panel and one from the host take the same path
    handleCellLayoutChange(event) {
        this.dataViewer.setAttribute("cell-layout", event.detail.cellLayout)
    }

    handleResetColumnWidths() {
        this.dataViewer.dataTable?.resetColumnWidths()
    }

    // MARK: @sort
    handleSortChange(event) {
        event.stopPropagation()
        const { key, direction } = event.detail
        this.dataViewer.view.sort = direction === "none" ? null : { key, direction }
        this.dataViewer.updateRows()
    }

    // MARK: @export
    handleExportData(event) {
        const { format, filename } = event.detail
        const view = this.dataViewer.view

        const mimeTypes = { json: "application/json", csv: "text/csv" }
        const serializers = { json: toJSON, csv: toCSV }

        const content = serializers[format](view)
        download(content, filename, mimeTypes[format])
    }
}
