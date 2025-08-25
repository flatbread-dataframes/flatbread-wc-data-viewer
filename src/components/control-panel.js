export class ControlPanel extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleSelectionChange = this.handleSelectionChange.bind(this)
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
            <style>
                :host {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: .5em;
                    align-items: center;
                    padding: .25em;
                }
                multi-selector::part(dropdown) {
                    background-color: var(--background-color);
                }
            </style>
            <label>Select columns:</label>
            <multi-selector name="columns"></multi-selector>
        `
        this.updateMultiSelector()
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("change", this.handleSelectionChange)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("change", this.handleSelectionChange)
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
