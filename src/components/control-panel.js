import "./action-button.js"

export class ControlPanel extends HTMLElement {
    get styles() {
        return `
            :host {
                display: grid;
                grid-template-columns: auto 1fr auto 1fr;
                gap: .5em;
                align-items: center;
                padding: .25em;
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
            multi-selector::part(dropdown) {
                background-color: ${this.colors.background};
            }
        `
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleSelectionChange = this.handleSelectionChange.bind(this)
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
        this.addEventListener("keydown", this.handleKeydown)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("change", this.handleSelectionChange)
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

    get colors() {
        return this.dataViewer?.resolvedColors ?? { background: "white" }
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

    // MARK: render
    render() {
        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            <div>
                <label>Filters:</label>
                <action-button data-action="toggle-filter-row">Toggle</action-button>
                <action-button data-action="clear-filters" disabled>Clear</action-button>
            </div>
            <div class="status-info">
                <span id="row-count"></span>/
                <span id="column-count"></span>
            </div>
            <label>Select columns:</label>
            <multi-selector name="columns" tabindex="0"></multi-selector>
        `
        this.updateMultiSelector()
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

    updateMultiSelector() {
        const multiSelector = this.shadowRoot.querySelector("multi-selector")

        if (multiSelector && this._columnData.length > 0) {
            customElements.whenDefined("multi-selector").then(() => {
                multiSelector.data = this._columnData

                if (this.dataViewer) {
                    const viewerHeight = this.dataViewer.getBoundingClientRect().height
                    const maxHeight = Math.floor(viewerHeight * 0.8) + 'px'
                    multiSelector.style.setProperty("--ms-max-height", maxHeight)
                }
            })
        }
    }

    // MARK: handlers
    handleSelectionChange(event) {
        this.dispatchEvent(new CustomEvent("column-selection-changed", {
            detail: {
                selectedColumns: event.detail,
            },
            bubbles: true,
            composed: true,
        }))
    }

    handleKeydown(event) {
        const keys = {"ArrowLeft": -1, "ArrowRight": 1}
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

        elements[nextIndex].focus()
    }
}

customElements.define("control-panel", ControlPanel)
