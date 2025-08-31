export class ControlPanel extends HTMLElement {
    static styles = `
        :host {
            display: grid;
            grid-template-columns: auto auto 1fr;
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
        multi-selector::part(dropdown) {
            background-color: var(--background-color);
        }
    `

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleSelectionChange = this.handleSelectionChange.bind(this)
        this.handleClick = this.handleClick.bind(this)
        this._columnData = []
    }

    connectedCallback() {
        this.render()
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>${ControlPanel.styles}</style>
            <button type="button" id="clear-filters">Clear filters</button>
            <label>Select columns:</label>
            <multi-selector name="columns"></multi-selector>
        `
        this.updateMultiSelector()
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("change", this.handleSelectionChange)
        this.shadowRoot.addEventListener("click", this.handleClick)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("change", this.handleSelectionChange)
    }

    handleClick(event) {
        if (!event.target.matches("#clear-filters")) return

        const newEvent = new CustomEvent("clear-all-filters", {
            bubbles: true,
            composed: true
        })
        this.dispatchEvent(newEvent)
    }

    handleSelectionChange(event) {
        this.dispatchEvent(new CustomEvent("column-selection-changed", {
            detail: {
                selectedColumns: event.detail,
            },
            bubbles: true,
            composed: true
        }))
    }

    updateMultiSelector() {
        const multiSelector = this.shadowRoot.querySelector("multi-selector")

        if (multiSelector && this._columnData.length > 0) {
            customElements.whenDefined("multi-selector").then(() => {
                multiSelector.data = this._columnData
            })
        }
    }

    get columnData() {
        return this._columnData
    }

    set columnData(value) {
        this._columnData = value ?? []
        this.updateMultiSelector()
    }
}

customElements.define("control-panel", ControlPanel)
