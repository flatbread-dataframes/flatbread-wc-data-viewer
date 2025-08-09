import { Data } from "./data/data.js"
import { View } from "./data/view.js"
import { HTMLBuilder } from "./build/builder.js"
import { Stylesheet } from "./build/stylesheet.js"

export class DataViewer extends HTMLElement {
    static get observedAttributes() {
        return [
            "src", "locale", "na-rep",
            "hide-group-borders", "hide-row-borders",
            "hide-thead-border", "hide-index-border",
        ]
    }

    static get defaults() {
        return {
            locale: "default",
            naRep: "-",
            buffer: 30,
            styling: {
                groupBorders: true,
                rowBorders: true,
                hoverEffect: true,
                theadBorder: true,
                indexBorder: true,
            }
        }
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.options = { ...DataViewer.defaults }
        this.handleDataChange = this.handleDataChange.bind(this)
        this.handleTableClick = this.handleTableClick.bind(this)
        this.handleFilterInput = this.handleFilterInput.bind(this)
        this.handleScroll = this.handleScroll.bind(this)

        this._data = new Data()
        this.stylesheet = new Stylesheet(this, this.data, this.options)
        this._htmlBuilder = new HTMLBuilder(this, this.options)
    }

    // MARK: setup
    connectedCallback() {
        this.data.addEventListener("data-changed", this.handleDataChange)
        this.render()
        this.addEventListeners()
        this.stylesheet.setupStyles()
    }

    disconnectedCallback() {
        this.data.removeEventListener("data-changed", this.handleDataChange)
        this.removeEventListeners()
        this.stylesheet.disconnect()
    }

    addEventListeners() {
        this.shadowRoot.addEventListener("click", this.handleTableClick)
        this.shadowRoot.addEventListener("input", this.handleFilterInput)
        this.addEventListener("scroll", this.handleScroll)
    }

    removeEventListeners() {
        this.shadowRoot.removeEventListener("click", this.handleTableClick)
        this.shadowRoot.removeEventListener("input", this.handleFilterInput)
        this.shadowRoot.removeEventListener("scroll", this.handleScroll)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        switch (name) {
            case "src":
                this.loadDataFromSrc(newValue)
                break
            case "locale":
                this.options.locale = newValue ?? DataViewer.defaults.locale
                this.render()
                break
            case "na-rep":
                this.options.naRep = newValue ?? DataViewer.defaults.naRep
                this.render()
                break
            case "hide-group-borders":
                this.options.styling.groupBorders = newValue === null
                this.render()
                break
            case "hide-row-borders":
                this.options.styling.rowBorders = newValue === null
                this.render()
                break
            case "hide-index-border":
                this.options.styling.indexBorder = newValue === null
                this.render()
                break
            case "hide-thead-border":
                this.options.styling.theadBorder = newValue === null
                this.render()
                break
        }
    }

    async loadDataFromSrc(src) {
        try {
            const response = await fetch(src)
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const rawData = await response.json()
            this.data = rawData
        } catch (error) {
            console.error("Failed to fetch data:", error)
            this.showErrorMessage("Failed to load data")
        }
    }

    // MARK: getter/setter
    get data() {
        return this._data
    }

    set data(value) {
        this._data.setData(value)
    }

    get view() {
        if (!this._view || this._viewNeedsUpdate) {
            this._view = new View(this.data)
            this._viewNeedsUpdate = false
        }
        return this._view
    }

    // MARK: render
    render() {
        if (!this.data.hasColumns) return

        this.shadowRoot.innerHTML = `
            <table>
                <thead>${this._htmlBuilder.buildThead()}</thead>
                <tbody></tbody>
            </table>
        `
        this.stylesheet.setupStyles()
        this.stylesheet.updateTheadOffset()
        this.stylesheet.updateIndexOffset()

        this.renderTbody()
    }

    renderTbody() {
        const tbody = this.shadowRoot.querySelector("tbody")
        tbody.innerHTML = this._htmlBuilder.buildTbody(0, this.options.buffer)
        this.stylesheet.updateColumnWidths()
    }

    // MARK: handlers
    handleDataChange(event) {
        this._viewNeedsUpdate = true
        event.detail.isValuesOnly ? this.renderTbody() : this.render()
        this.dispatchEvent(new CustomEvent("data-changed", { detail: this.data }))
    }

    handleTableClick(event) {
        const cell = event.target.closest("th, td")
        if (!cell) return

        const tr = cell.closest("tr")
        const isInHead = tr.closest("thead") !== null
        const isInBody = tr.closest("tbody") !== null

        let source, row, col

        if (isInHead) {
            source = "column"
            row = Array.from(tr.parentNode.children).indexOf(tr)
            col = Array.from(tr.children).indexOf(cell)
        } else if (isInBody) {
            if (cell.tagName === "TH") {
                source = "index"
                row = Array.from(tr.parentNode.children).indexOf(tr)
                col = Array.from(tr.children).filter(c => c.tagName === "TH").indexOf(cell)
            } else {
                source = "values"
                row = Array.from(tr.parentNode.children).indexOf(tr)
                col = Array.from(tr.children).filter(c => c.tagName === "TD").indexOf(cell)
            }
        } else {
            return // Not in thead or tbody, ignore
        }

        const value = cell.textContent

        this.dispatchEvent(new CustomEvent("cell-click", {
            detail: { value, source, row, col },
            bubbles: true,
            composed: true
        }))
    }

    handleFilterInput(event) {
        const input = event.target
        if (input.tagName !== "INPUT" || !input.closest("thead")) return

        const filterInputs = this.shadowRoot.querySelectorAll("thead input[type='text']")
        const filters = Array.from(filterInputs).map((input, index) => {
            const th = input.closest("th")
            const col = parseInt(th.dataset.col)
            return {
                col,
                value: input.value.trim()
            }
        }).filter(filter => filter.value !== "") // Only keep non-empty filters
        this.applyFilters(filters)
    }

    applyFilters(filters) {
        if (filters.length === 0) {
            this.view.reset()
        } else {
            const predicate = (rowValues, rowIndex) => {
                return filters.every(filter => {
                    const cellValue = rowValues[filter.col]
                    return cellValue != null &&
                        cellValue.toString().toLowerCase().includes(filter.value.toLowerCase())
                })
            }
            this.view.filter(predicate)
        }
        this.renderTbody()
    }

    handleScroll(event) {
        event.preventDefault()
        event.stopPropagation()
        const el = event.target
        const tbody = this.shadowRoot.querySelector("tbody")
        if ( el.scrollHeight - (el.scrollTop + el.clientHeight) < 150 ) {
            const start = tbody.rows.length
            const end = start + this.options.buffer
            tbody.innerHTML += this._htmlBuilder.buildTbody(start, end)
        }
    }

    showErrorMessage(message) {
        this.shadowRoot.innerHTML = `
            ${this.getStyleSheet()}
            <p style="color: red;">${message}</p>
        `
    }
}


window.customElements.define('data-viewer', DataViewer)
