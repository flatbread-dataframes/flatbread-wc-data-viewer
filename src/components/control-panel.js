import "./action-button.js"
import { baseSheet } from "../styles/base.js"
import { interactiveSheet } from "../styles/interactive.js"

const componentSheet = new CSSStyleSheet()
componentSheet.replaceSync(`
    :host {
        display: grid;
        grid-template-columns: auto 1fr auto 1fr;
        gap: 0.5em;
        align-items: center;
        padding: 0.25em;
    }
    .status-info {
        justify-self: center;
        display: flex;
        gap: 1rem;
        font-size: 0.9em;
        font-family: monospace;
        opacity: 0.8;
    }
    action-button {
        width: 4em;
    }
    action-button[data-action="toggle-export"] {
        anchor-name: --export-anchor;
    }
    action-button[data-action="toggle-layout"] {
        anchor-name: --layout-anchor;
    }
    multi-selector {
        --ms-dropdown-background: var(--dv-bg, white);
    }
    [popover] {
        margin: 0;
        margin-top: .25rem;
        padding: 0.5em;
        border: 1px solid var(--dv-border);
        border-radius: 0.25em;
        background: var(--dv-bg, white);
        color: inherit;
        font: inherit;
        position-area: block-end span-inline-end;
    }
    [popover]:popover-open {
        display: flex;
        gap: 0.5em;
        align-items: center;
    }
    .export-popover {
        position-anchor: --export-anchor;
    }
    .layout-popover {
        position-anchor: --layout-anchor;
    }
    .layout-popover label {
        display: flex;
        gap: 0.25em;
        align-items: center;
    }
    .export-popover input {
        width: 8em;
        padding: 0.15em 0.35em;
    }
`)

export class ControlPanel extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleSelectionChange = this.handleSelectionChange.bind(this)
        this.handleToggleExport = this.handleToggleExport.bind(this)
        this.handleToggleLayout = this.handleToggleLayout.bind(this)
        this.handleExportClick = this.handleExportClick.bind(this)
        this.handleCellLayoutChange = this.handleCellLayoutChange.bind(this)
        this.handlePopoverKeydown = this.handlePopoverKeydown.bind(this)
        this.handleMultiSelectorOpen = this.handleMultiSelectorOpen.bind(this)
        this._columnData = []
    }

    // MARK: setup
    connectedCallback() {
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("change", this.handleSelectionChange)
        this.shadowRoot.addEventListener("change", this.handleCellLayoutChange)
        this.shadowRoot.addEventListener("toggle-export", this.handleToggleExport)
        this.shadowRoot.addEventListener("toggle-layout", this.handleToggleLayout)
        this.shadowRoot.addEventListener("click", this.handleExportClick)
        this.shadowRoot.addEventListener("keydown", this.handlePopoverKeydown)
        this.shadowRoot.addEventListener("ms-open", this.handleMultiSelectorOpen)
        this.addEventListener("keydown", this.handleKeydown)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("change", this.handleSelectionChange)
        this.shadowRoot.removeEventListener("change", this.handleCellLayoutChange)
        this.shadowRoot.removeEventListener("toggle-export", this.handleToggleExport)
        this.shadowRoot.removeEventListener("toggle-layout", this.handleToggleLayout)
        this.shadowRoot.removeEventListener("click", this.handleExportClick)
        this.shadowRoot.removeEventListener("keydown", this.handlePopoverKeydown)
        this.shadowRoot.removeEventListener("ms-open", this.handleMultiSelectorOpen)
        this.removeEventListener("keydown", this.handleKeydown)
    }

    // MARK: get/set
    get dataViewer() {
        return this._dataViewer
    }

    set dataViewer(value) {
        this._dataViewer = value
        if (value) {
            this.render()
        }
    }

    get navigableElements() {
        return this.shadowRoot.querySelectorAll(":where(action-button, multi-selector):not([disabled])")
    }

    get viewInfo() {
        return this._viewInfo
    }

    set viewInfo(value) {
        this._viewInfo = value
        this.updateStatusInfo()
    }

    get showFilters() {
        return this._showFilters
    }

    set showFilters(value) {
        this._showFilters = value
        this.updateToggleButton()
    }

    get columnData() {
        return this._columnData
    }

    set columnData(value) {
        this._columnData = value ?? []
        this.updateMultiSelector()
    }

    get buttonToggleFilterRow() {
        return this.shadowRoot.querySelector(`action-button[data-action="toggle-filter-row"]`)
    }

    get buttonClearFilters() {
        return this.shadowRoot.querySelector(`action-button[data-action="clear-filters"]`)
    }

    get exportPopover() {
        return this.shadowRoot.querySelector(".export-popover")
    }

    get layoutPopover() {
        return this.shadowRoot.querySelector(".layout-popover")
    }

    // The viewer owns the cell layout; the popover only shows it
    get cellLayout() {
        return this.dataViewer?.options.cellLayout
    }

    // MARK: render
    render() {
        this.shadowRoot.adoptedStyleSheets = [baseSheet, interactiveSheet, componentSheet]
        this.shadowRoot.innerHTML = `
            <div>
                <label>Filters:</label>
                <action-button data-action="toggle-filter-row">Toggle</action-button>
                <action-button data-action="clear-filters" disabled>Clear</action-button>
                <action-button data-action="toggle-export">Export</action-button>
                <action-button data-action="toggle-layout">Layout</action-button>
            </div>
            <div class="status-info">
                <span id="row-count"></span>/
                <span id="column-count"></span>
            </div>
            <label>Select columns:</label>
            <multi-selector name="columns"></multi-selector>
            <div class="export-popover" popover data-toggle="toggle-export">
                <input type="text" value="export" aria-label="filename">
                <button data-format="json">.json</button>
                <button data-format="csv">.csv</button>
            </div>
            <div class="layout-popover" popover data-toggle="toggle-layout" role="radiogroup" aria-label="cell layout">
                <label><input type="radio" name="cell-layout" value="no-wrap">no-wrap</label>
                <label><input type="radio" name="cell-layout" value="wrap">wrap</label>
                <label><input type="radio" name="cell-layout" value="truncate">truncate</label>
            </div>
        `
        this.updateMultiSelector()
        this.updateCellLayout()
    }

    // MARK: update
    updateStatusInfo() {
        const rowCountEl = this.shadowRoot.querySelector("#row-count")
        const columnCountEl = this.shadowRoot.querySelector("#column-count")

        if (!rowCountEl || !columnCountEl || !this._viewInfo) return

        const { visibleRows, totalRows, visibleColumns, totalColumns } = this._viewInfo

        // Row count logic
        if (visibleRows === totalRows) {
            rowCountEl.textContent = `${totalRows} rows`
        } else {
            rowCountEl.textContent = `${visibleRows} of ${totalRows} rows`
        }

        // Column count logic
        if (visibleColumns === totalColumns) {
            columnCountEl.textContent = `${totalColumns} columns`
        } else {
            columnCountEl.textContent = `${visibleColumns} of ${totalColumns} columns`
        }
    }

    updateToggleButton() {
        if (this.buttonToggleFilterRow) {
            this.buttonToggleFilterRow.textContent = this._showFilters ? "Hide" : "Show"
        }
    }

    updateClearButtonState(hasActiveFilters) {
        if (this.buttonClearFilters) {
            this.buttonClearFilters.disabled = !hasActiveFilters
        }
    }

    updateCellLayout() {
        const radio = this.shadowRoot.querySelector(`input[name="cell-layout"][value="${this.cellLayout}"]`)
        if (radio) radio.checked = true
    }

    updateMultiSelector() {
        const multiSelector = this.shadowRoot.querySelector("multi-selector")

        if (multiSelector && this._columnData.length > 0) {
            customElements.whenDefined("multi-selector").then(() => {
                multiSelector.data = this._columnData
            })
        }
    }

    // MARK: handlers
    // The native change of the cell layout radios reaches the shadow root too
    handleSelectionChange(event) {
        if (!event.target.matches("multi-selector")) return
        this.dispatchEvent(new CustomEvent("column-selection-changed", {
            detail: {
                selectedColumns: event.detail,
            },
            bubbles: true,
            composed: true,
        }))
    }

    handleMultiSelectorOpen(event) {
        if (!this.dataViewer) return
        const viewerHeight = this.dataViewer.getBoundingClientRect().height
        if (viewerHeight === 0) return
        const maxHeight = Math.floor(viewerHeight * 0.8) + 'px'
        event.target.style.setProperty("--ms-max-height", maxHeight)
    }

    handleKeydown(event) {
        if (event.key === "Enter") {
            const composedPath = event.composedPath()
            const multiSelector = [...this.navigableElements].find(el =>
                el.tagName === "MULTI-SELECTOR" && composedPath.includes(el)
            )
            if (multiSelector) {
                const summary = multiSelector.shadowRoot?.querySelector("details > summary")
                summary?.focus()
            }
            return
        }
        const keys = { "ArrowLeft": -1, "ArrowRight": 1 }
        if (!(event.key in keys)) return

        const elements = [...this.navigableElements]

        event.preventDefault()
        event.stopPropagation()

        const composedPath = event.composedPath()
        const currentElement = elements.find(el => composedPath.includes(el))
        const currentIndex = elements.indexOf(currentElement)

        let nextIndex = currentIndex + keys[event.key]
        nextIndex =
            nextIndex < 0
                ? elements.length - 1
                : nextIndex % elements.length

        const target = elements[nextIndex]
        if (target.tagName === "MULTI-SELECTOR") {
            target.shadowRoot?.querySelector(".trigger")?.focus()
        } else {
            target.focus()
        }
    }

    // MARK: popovers
    // Opens or closes a popover; when opened, focus moves to the element matching focusSelector
    togglePopover(popover, focusSelector) {
        popover.togglePopover()
        if (popover.matches(":popover-open")) {
            popover.querySelector(focusSelector)?.focus()
        }
    }

    // Closes a popover and returns focus to the action button that opens it
    closePopover(popover) {
        popover.hidePopover()
        this.shadowRoot.querySelector(`action-button[data-action="${popover.dataset.toggle}"]`).focus()
    }

    // Escape closes the popover (and does not clear the filters); arrow keys stay inside the popover
    // instead of moving between control panel elements or navigation levels
    handlePopoverKeydown(event) {
        const popover = event.target.closest("[popover]")
        if (!popover) return

        if (event.key === "Escape") {
            this.closePopover(popover)
            event.stopPropagation()
            return
        }
        if (popover === this.exportPopover) this.handleExportKeydown(event)
        if (event.key.startsWith("Arrow")) event.stopPropagation()
    }

    // MARK: layout
    handleToggleLayout() {
        this.togglePopover(this.layoutPopover, "input:checked")
    }

    handleCellLayoutChange(event) {
        if (!event.target.matches(`input[name="cell-layout"]`)) return
        this.dispatchEvent(new CustomEvent("cell-layout-changed", {
            detail: { cellLayout: event.target.value },
            bubbles: true,
            composed: true,
        }))
    }

    // MARK: export
    handleToggleExport() {
        this.togglePopover(this.exportPopover, "input")
    }

    handleExportClick(event) {
        const format = event.target.dataset?.format
        if (!format) return

        const input = this.exportPopover.querySelector("input")
        const baseName = this.stripExtension(input.value.trim() || "export")

        this.dispatchEvent(new CustomEvent("export-data", {
            detail: { format, filename: `${baseName}.${format}` },
            bubbles: true,
            composed: true,
        }))

        this.exportPopover.hidePopover()
    }

    stripExtension(name) {
        return name.replace(/\.(json|csv)$/i, "")
    }

    // Keys inside the export popover; Escape is handled by handlePopoverKeydown
    handleExportKeydown(event) {
        if (event.key === "Enter" && event.target.dataset?.format) {
            event.target.click()
            return
        }

        const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
        if (!direction) return

        event.preventDefault()
        event.stopPropagation()

        const focusable = [...this.exportPopover.querySelectorAll("input, button")]
        const idx = focusable.indexOf(event.target)
        const next = focusable[idx + direction]
        if (next) next.focus()
    }
}

customElements.define("control-panel", ControlPanel)
