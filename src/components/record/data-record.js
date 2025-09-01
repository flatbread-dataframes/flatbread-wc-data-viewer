import { RecordBuilder } from "./record-builder.js"
import { WheelHandlerMixin } from "../../mixins/wheel-handler.js"

export class DataRecord extends HTMLElement {
    static styles = `
        :host {
            padding-bottom: 12px;
            padding-inline: 12px;
            display: block;
        }
        .record-view {
            margin: 0 auto;
        }
        .record-navigation {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 1rem;
            align-items: center;
            padding: 0.5rem 0;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color, currentColor);
            position: sticky;
            top: 0;
            background: var(--background-color, white);
            z-index: 10;
        }
        .nav-buttons {
            display: flex;
            gap: 0.25rem;
        }
        .nav-buttons button,
        .exit-button {
            padding: 0.25rem 0.5rem;
            border: 1px solid var(--border-color, currentColor);
            border-radius: 0.25rem;
            background: var(--background-color, white);
            cursor: pointer;
            font: inherit;
            color: inherit;
        }
        .nav-buttons button:hover,
        .exit-button:hover {
            background-color: var(--hover-color, #f4f3ee);
        }
        .record-info {
            justify-self: center;
            display: flex;
            align-items: center;
            gap: 1.5em;
            font-size: 0.9em;
            font-family: monospace;
            opacity: 0.8;
        }
        .record-position {
            font-weight: 500;
            font-size: 0.9em;
            opacity: 0.8;
        }
        .record-index {
            font-weight: 600;
            font-size: 1.1em;
        }
        .field-group {
            margin-bottom: 2rem;
        }
        .group-title {
            margin: 0 0 1rem 0;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--border-color, currentColor);
            font-size: 1.1em;
            font-weight: 600;
        }
        .record-fields {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }
        .record-field {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.5rem;
            align-items: baseline;
        }
        .field-label {
            font-weight: 500;
            text-align: right;
            white-space: nowrap;
        }
        .field-value {
            padding: 0.25rem 0.5rem;
            background-color: var(--hover-color, #f4f3ee);
            border-radius: 0.25rem;
            font-family: monospace;
        }
        .field-value[data-dtype="int"],
        .field-value[data-dtype="float"] {
            text-align: right;
        }
    `

    static get observedAttributes() {
        return ["record-index"]
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleRecordNavigation = this.handleRecordNavigation.bind(this)
        this.handleFieldClick = this.handleFieldClick.bind(this)
        this.handleWheel = WheelHandlerMixin.handleWheel.bind(this)

        this._dataViewer = null
        this._recordBuilder = null
        this._currentRecordIndex = 0
    }

    // MARK: setup
    connectedCallback() {
        this.addEventListeners()
        this.render()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("click", this.handleRecordNavigation)
        this.shadowRoot.addEventListener("click", this.handleFieldClick)
        WheelHandlerMixin.addWheelHandling.call(this)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("click", this.handleRecordNavigation)
        this.shadowRoot.removeEventListener("click", this.handleFieldClick)
        WheelHandlerMixin.removeWheelHandling.call(this)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        if (name === "record-index") {
            this._currentRecordIndex = parseInt(newValue) ?? 0
            this.render()
        }
    }

    // MARK: get/set
    get dataViewer() {
        return this._dataViewer
    }

    set dataViewer(value) {
        this._dataViewer = value
        if (value) {
            this._recordBuilder = new RecordBuilder(value, value.options)
            this.render()
        }
    }

    get recordIndex() {
        return this._currentRecordIndex
    }

    set recordIndex(value) {
        this._currentRecordIndex = value
        this.setAttribute("record-index", value.toString())
    }

    get currentRecord() {
        if (!this.dataViewer || !this.dataViewer.view.visibleIndices.length) {
            return null
        }

        const originalIndex = this.dataViewer.view.visibleIndices[this._currentRecordIndex]
        const values = this.dataViewer.view.values[this._currentRecordIndex]
        const indexValue = this.dataViewer.view.index.values[this._currentRecordIndex]

        return {
            originalIndex,
            indexValue,
            values
        }
    }

    // MARK: render
    render() {
        this.shadowRoot.innerHTML = `
            <style>${DataRecord.styles}</style>
            ${this.buildRecord()}
        `
    }

    buildRecord() {
        if (!this._recordBuilder) {
            return '<div class="record-view"><p>No record to display</p></div>'
        }
        return this._recordBuilder.buildRecord()
    }

    // MARK: handlers
    handleRecordNavigation(event) {
        const navButton = event.target.closest("[data-nav]")
        if (!navButton) return

        event.stopPropagation()
        const action = navButton.dataset.nav

        switch (action) {
            case "first":
            case "prev":
            case "next":
            case "last":
                this.navigateRecord(action)
                break
            case "exit":
                this.dispatchEvent(new CustomEvent("exit-record-view", {
                    bubbles: true,
                    composed: true
                }))
                break
        }
    }

    navigateRecord(direction) {
        if (!this.dataViewer) return

        const totalRecords = this.dataViewer.view.visibleIndices.length
        if (totalRecords === 0) return

        switch (direction) {
            case "first":
                this._currentRecordIndex = 0
                break
            case "prev":
                this._currentRecordIndex = (this._currentRecordIndex - 1 + totalRecords) % totalRecords
                break
            case "next":
                this._currentRecordIndex = (this._currentRecordIndex + 1) % totalRecords
                break
            case "last":
                this._currentRecordIndex = totalRecords - 1
                break
        }

        this.recordIndex = this._currentRecordIndex
        this.render()
    }

    handleFieldClick(event) {
        if (event.target.closest("[data-nav]")) return

        const fieldElement = event.target.closest(".record-field")
        if (!fieldElement) return

        const isLabel = event.target.closest(".field-label")
        const isValue = event.target.closest(".field-value")

        if (!isLabel && !isValue) return

        const label = fieldElement.querySelector(".field-label").textContent.replace(":", "")
        const value = fieldElement.querySelector(".field-value").textContent
        const dtype = fieldElement.querySelector(".field-value").dataset.dtype

        this.dispatchEvent(new CustomEvent("field-click", {
            detail: {
                label,
                value,
                dtype,
                source: isLabel ? "field-label" : "field-value",
                recordIndex: this._currentRecordIndex
            },
            bubbles: true,
            composed: true
        }))
    }
}

customElements.define("data-record", DataRecord)
