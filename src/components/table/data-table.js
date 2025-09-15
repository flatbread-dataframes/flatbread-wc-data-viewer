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
        this.handleColumnSort = this.handleColumnSort.bind(this)
        this.handleIndexSort = this.handleIndexSort.bind(this)
        this.handleWheel = WheelHandlerMixin.handleWheel.bind(this)

        this._dataViewer = null
        this._tableBuilder = null
        this._stylesheet = null

        this._theadPosition = { row: 'header', col: 0 }
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
        this.shadowRoot.addEventListener("filter-input", this.handleFilterInput)
        this.shadowRoot.addEventListener("column-sort", this.handleColumnSort)
        this.shadowRoot.addEventListener("index-sort", this.handleIndexSort)

        this.clickHandler.addEventListeners()
        this.scrollManager.addEventListeners()
        WheelHandlerMixin.addWheelHandling.call(this)
    }

    removeEventListeners() {
        this.removeEventListener("keydown", this.handleKeydown)
        this.shadowRoot.removeEventListener("focusin", this.handleTheadFocusIn)
        this.shadowRoot.removeEventListener("filter-input", this.handleFilterInput)
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
        const indexHeaders = this.shadowRoot.querySelectorAll('th.indexLevelNameLabel sortable-column-header')
        const columnHeaders = this.shadowRoot.querySelectorAll('th[data-col] sortable-column-header')
        const indexFilters = this.shadowRoot.querySelectorAll('th.indexFilter filter-input')
        const columnFilters = this.shadowRoot.querySelectorAll('th.columnFilter filter-input')

        return {
            headerRow: [...indexHeaders, ...columnHeaders],
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
            activeElement.matches('sortable-column-header') ||
            activeElement.matches('filter-input') ||
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
    }

    // MARK: @filter
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

    clearAllFilters() {
        const allFilterInputs = this.shadowRoot.querySelectorAll("filter-input")
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
        this.shadowRoot.querySelectorAll('sortable-column-header').forEach(header => {
            header.clearSort()
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
        if (target.matches('sortable-column-header') || target.matches('filter-input')) {
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
