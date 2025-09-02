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
            button {
                padding: .25em .5em;
                border: 1px solid;
                border-radius: .25em;
                background: transparent;
                font: inherit;
                color: inherit;
                cursor: pointer;
                opacity: 0.7;
            }
            button:hover {
                opacity: 1;
            }
            .status-info {
                justify-self: center;
                display: flex;
                gap: 1rem;
                font-size: 0.9em;
                font-family: monospace;
                opacity: 0.8;
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
        this.handleClick = this.handleClick.bind(this)
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
        this.shadowRoot.addEventListener("click", this.handleClick)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("change", this.handleSelectionChange)
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

    // MARK: render
    render() {
        this.shadowRoot.innerHTML = `
            <style>${this.styles}</style>
            <div>
                <label>Filters:</label>
                <button type="button" id="toggle-filter-row">Toggle</button>
                <button type="button" id="clear-filters">Clear</button>
            </div>
            <div class="status-info">
                <span id="row-count"></span>/
                <span id="column-count"></span>
            </div>
            <label>Select columns:</label>
            <multi-selector name="columns"></multi-selector>
        `
        this.updateMultiSelector()
    }

    // MARK: handlers
    handleClick(event) {
        if (event.target.matches("#clear-filters")) {
            const newEvent = new CustomEvent("clear-all-filters", {
                bubbles: true,
                composed: true,
            })
            this.dispatchEvent(newEvent)
        } else if (event.target.matches("#toggle-filter-row")) {
            const newEvent = new CustomEvent("toggle-filter-row", {
                bubbles: true,
                composed: true,
            })
            this.dispatchEvent(newEvent)
        }
    }

    handleSelectionChange(event) {
        this.dispatchEvent(new CustomEvent("column-selection-changed", {
            detail: {
                selectedColumns: event.detail,
            },
            bubbles: true,
            composed: true,
        }))
    }

    // MARK: updates
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
        const button = this.shadowRoot.querySelector("#toggle-filter-row")
        if (button) {
            button.textContent = this._showFilters ? "Hide" : "Show"
        }
    }

    updateMultiSelector() {
        const multiSelector = this.shadowRoot.querySelector("multi-selector")

        if (multiSelector && this._columnData.length > 0) {
            customElements.whenDefined("multi-selector").then(() => {
                multiSelector.data = this._columnData
            })
        }
    }
}

customElements.define("control-panel", ControlPanel)
