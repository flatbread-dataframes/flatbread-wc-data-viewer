export class EventCoordinator {
    constructor(dataViewer) {
        this.dataViewer = dataViewer

        this.handleCellClick = this.handleCellClick.bind(this)
        this.handleFieldClick = this.handleFieldClick.bind(this)
        this.handleEnterRecordView = this.handleEnterRecordView.bind(this)
        this.handleExitRecordView = this.handleExitRecordView.bind(this)
        this.handleToggleFilterRow = this.handleToggleFilterRow.bind(this)
        this.handleFiltersChanged = this.handleFiltersChanged.bind(this)
        this.handleClearAllFilters = this.handleClearAllFilters.bind(this)
        this.handleColumnSelectionChange = this.handleColumnSelectionChange.bind(this)
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleIndexSort = this.handleIndexSort.bind(this)
        this.handleLoadMoreRows = this.handleLoadMoreRows.bind(this)
        this.handleDataChange = this.handleDataChange.bind(this)
        this.handleMouseEnter = this.handleMouseEnter.bind(this)
    }

    // MARK: setup
    addEventListeners() {
        const { shadowRoot, data } = this.dataViewer

        this.dataViewer.addEventListener('mouseenter', this.handleMouseEnter)
        data.addEventListener("data-changed", this.handleDataChange)
        shadowRoot.addEventListener("cell-click", this.handleCellClick)
        shadowRoot.addEventListener("field-click", this.handleFieldClick)
        shadowRoot.addEventListener("enter-record-view", this.handleEnterRecordView)
        shadowRoot.addEventListener("exit-record-view", this.handleExitRecordView)
        shadowRoot.addEventListener("toggle-filter-row", this.handleToggleFilterRow)
        shadowRoot.addEventListener("filters-changed", this.handleFiltersChanged)
        shadowRoot.addEventListener("clear-filters", this.handleClearAllFilters)
        shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        shadowRoot.addEventListener("index-sort", this.handleIndexSort)
        shadowRoot.addEventListener("column-selection-changed", this.handleColumnSelectionChange)
        shadowRoot.addEventListener("load-more-rows", this.handleLoadMoreRows)
    }

    removeEventListeners() {
        const { shadowRoot, data } = this.dataViewer

        this.dataViewer.removeEventListener('mouseenter', this.handleMouseEnter)
        data.removeEventListener("data-changed", this.handleDataChange)
        shadowRoot.removeEventListener("cell-click", this.handleCellClick)
        shadowRoot.removeEventListener("field-click", this.handleFieldClick)
        shadowRoot.removeEventListener("enter-record-view", this.handleEnterRecordView)
        shadowRoot.removeEventListener("exit-record-view", this.handleExitRecordView)
        shadowRoot.removeEventListener("toggle-filter-row", this.handleToggleFilterRow)
        shadowRoot.removeEventListener("filters-changed", this.handleFiltersChanged)
        shadowRoot.removeEventListener("clear-filters", this.handleClearAllFilters)
        shadowRoot.removeEventListener("column-sort", this.handleColumnSort)
        shadowRoot.removeEventListener("index-sort", this.handleIndexSort)
        shadowRoot.removeEventListener("column-selection-changed", this.handleColumnSelectionChange)
        shadowRoot.removeEventListener("load-more-rows", this.handleLoadMoreRows)
    }

    destroy() {
        this.removeEventListeners()
    }

    // MARK: handlers
    handleDataChange(event) {
        this.dataViewer._viewNeedsUpdate = true

        if (event.detail.isValuesOnly) {
            this.dataViewer.updateDataTable()
            this.dataViewer.updateDataRecord()
            if (this.dataViewer.dataTable) this.dataViewer.dataTable.renderTbody()
        } else {
            this.dataViewer.render()
            this.dataViewer.updateControlPanel()
        }

        this.dataViewer.dispatchEvent(new CustomEvent("data-changed", { detail: this.dataViewer.data }))
    }

    handleMouseEnter() {
        this.dataViewer.focus()
    }

    // MARK: @interaction
    handleCellClick(event) {
        this.dataViewer.dispatchEvent(new CustomEvent("cell-click", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    handleFieldClick(event) {
        this.dataViewer.dispatchEvent(new CustomEvent("field-click", {
            detail: event.detail,
            bubbles: true,
            composed: true
        }))
    }

    // MARK: @view
    handleEnterRecordView(event) {
        const { viewRowIndex } = event.detail
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

    handleFiltersChanged(event) {
        const { indexFilters, columnFilters } = event.detail

        this.dataViewer._filterManager.applyFilters(this.dataViewer.view, indexFilters, columnFilters)

        // Update UI components
        const hasActiveFilters = indexFilters.length > 0 || columnFilters.length > 0
        this.dataViewer.controlPanel?.updateClearButtonState(hasActiveFilters)
        this.dataViewer.dataTable?.renderTbody()
        this.dataViewer.updateControlPanelStatus()
    }

    handleClearAllFilters() {
        if (this.dataViewer.dataTable) {
            this.dataViewer.dataTable.clearAllFilters()
        }
        this.dataViewer.focus()
    }

    // MARK: @column
    handleColumnSelectionChange(event) {
        const selectedColumnIndices = event.detail.selectedColumns
        this.dataViewer.applyColumnFilter(selectedColumnIndices)
        this.dataViewer.updateControlPanelStatus()
    }

    // MARK: @sort
    handleColumnSort(event) {
        const { columnIndex, sortState } = event.detail
        if (sortState === "none") {
            this.dataViewer.view.reset()
        } else {
            this.dataViewer.view.sortByColumn(columnIndex, sortState)
        }

        if (this.dataViewer.dataTable) {
            this.dataViewer.dataTable.renderTbody()
        }
    }

    handleIndexSort(event) {
        const { level, sortState } = event.detail
        if (sortState === "none") {
            this.dataViewer.view.reset()
        } else {
            this.dataViewer.view.sortByIndex(level, sortState)
        }

        if (this.dataViewer.dataTable) {
            this.dataViewer.dataTable.renderTbody()
        }
    }

    // MARK: @scroll
    handleLoadMoreRows(event) {
        const { currentRowCount, bufferSize } = event.detail

        if (this.dataViewer.dataTable) {
            const tbody = this.dataViewer.dataTable.shadowRoot.querySelector("tbody")
            if (tbody) {
                const start = currentRowCount
                const end = start + bufferSize
                tbody.innerHTML += this.dataViewer.dataTable._tableBuilder.buildTbody(start, end)
            }
        }
    }
}
