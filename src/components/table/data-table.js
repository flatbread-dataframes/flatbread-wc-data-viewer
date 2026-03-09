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

        this._theadPosition = { row: 'header', col: 0 }
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
        const headerButtons = this.shadowRoot.querySelectorAll(
            "thead tr:not(.filter-row) :is(sort-button button, .hide-button)"
        )
        const indexFilters = this.shadowRoot.querySelectorAll("th.indexFilter filter-combo")
        const columnFilters = this.shadowRoot.querySelectorAll("th.columnFilter filter-combo")

        return {
            headerRow: [...headerButtons],
            filterRow: [...indexFilters, ...columnFilters]
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

        const isInThead = activeElement && (
            activeElement.closest("sort-button") ||
            activeElement.matches(".hide-button") ||
            activeElement.matches('filter-combo') ||
            activeElement.closest('thead')
        )

        // only handle internal thead navigation
        // vertical navigation between levels is handled by NavigationController
        if (isInThead) {
            const isHorizontal = ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
            const isVerticalWithinThead =
                (event.key === 'ArrowUp' && this._theadPosition.row === 'filter') ||
                (event.key === 'ArrowDown' && this._theadPosition.row === 'header')

            if ((isHorizontal || isVerticalWithinThead) && this.handleTheadNavigation(event)) {
                event.preventDefault()
                event.stopPropagation()
                return
            }
        }
        const isInTbody = activeElement && activeElement.closest("tbody")
        if (isInTbody) {
            if (this.handleTbodyNavigation(event)) {
                event.preventDefault()
                event.stopPropagation()
                return
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
        const elements = this.theadNavigableElements
        const currentRow = elements[this._theadPosition.row + 'Row']

        if (!currentRow.length) return false

        let handled = false

        switch (event.key) {
            case 'ArrowLeft':
                this._theadPosition.col = (this._theadPosition.col - 1 + currentRow.length) % currentRow.length
                this.focusTheadElement()
                handled = true
                break

            case 'ArrowRight':
                this._theadPosition.col = (this._theadPosition.col + 1) % currentRow.length
                this.focusTheadElement()
                handled = true
                break

            case 'Home':
                this._theadPosition.col = 0
                this.focusTheadElement()
                handled = true
                break

            case 'End':
                this._theadPosition.col = currentRow.length - 1
                this.focusTheadElement()
                handled = true
                break

            case 'ArrowUp':
                if (this._theadPosition.row === 'filter') {
                    this._theadPosition.row = 'header'
                    this._theadPosition.col = Math.min(this._theadPosition.col, elements.headerRow.length - 1)
                    this.focusTheadElement()
                    handled = true
                } else {
                    const boundaryEvent = new CustomEvent('navigation-boundary', {
                        detail: { direction: 'up', from: 'thead' },
                        bubbles: true
                    })
                    this.dispatchEvent(boundaryEvent)
                    handled = true
                }
                break

            case 'ArrowDown':
                if (this._theadPosition.row === 'header') {
                    this._theadPosition.row = 'filter'
                    // clamp column to available elements
                    this._theadPosition.col = Math.min(this._theadPosition.col, elements.filterRow.length - 1)
                    this.focusTheadElement()
                    handled = true
                } else {
                    const boundaryEvent = new CustomEvent('navigation-boundary', {
                        detail: { direction: 'down', from: 'thead' },
                        bubbles: true
                    })
                    this.dispatchEvent(boundaryEvent)
                    handled = true
                }
                break
        }

        return handled
    }

    focusTheadElement() {
        const elements = this.theadNavigableElements
        const currentRow = elements[this._theadPosition.row + 'Row']
        const targetElement = currentRow[this._theadPosition.col]

        if (targetElement) {
            targetElement.focus()
            this.scrollElementIntoView(targetElement)
        }
    }

    handleTheadFocusIn(event) {
        const target = event.target
        const isHeaderButton = target.matches("sort-button button") || target.matches(".hide-button")
        if (isHeaderButton || target.matches("filter-combo")) {
            this.initializeTheadPosition(target)
        }
    }

    initializeTheadPosition(targetElement) {
        const elements = this.theadNavigableElements

        const headerIndex = elements.headerRow.indexOf(targetElement)
        const filterIndex = elements.filterRow.indexOf(targetElement)

        if (headerIndex !== -1) {
            this._theadPosition = { row: 'header', col: headerIndex }
        } else if (filterIndex !== -1) {
            this._theadPosition = { row: 'filter', col: filterIndex }
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
