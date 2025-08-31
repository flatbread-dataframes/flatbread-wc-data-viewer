export class SortableColumnHeader extends HTMLElement {
    static styles = `
        :host {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            gap: 0.25em;
            cursor: pointer;
            padding: inherit;
        }

        :host(:focus) {
            outline: 1px solid;
            outline-offset: 2px;
        }

        :host(:focus:not(:focus-visible)) {
            outline: none;
        }

        #sort-marker {
            font-size: 0.8em;
            line-height: 1;
            visibility: hidden;
            user-select: none;
        }

        #sort-marker.visible {
            visibility: visible;
        }
    `

    static get observedAttributes() {
        return ["data-col", "data-level", "sort-state"]
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleClick = this.handleClick.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
        this._sortState = "none" // none, asc, desc
    }

    connectedCallback() {
        this.render()
        this.addEventListeners()
        this.setAttribute("role", "button")
        this.setAttribute("tabindex", "0")
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>${SortableColumnHeader.styles}</style>
            <slot></slot>
            <span id="sort-marker">▲</span>
        `
        this.updateMarker()
    }

    addEventListeners() {
        this.addEventListener("click", this.handleClick)
        this.addEventListener("keydown", this.handleKeydown)
    }

    removeEventListeners() {
        this.removeEventListener("click", this.handleClick)
        this.removeEventListener("keydown", this.handleKeydown)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        if (name === "sort-state") {
            this._sortState = newValue ?? "none"
            this.updateMarker()
        }
    }

    handleClick() {
        this.cycleSort()
    }

    handleKeydown(event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            this.cycleSort()
        }
    }

    cycleSort() {
        const nextState = this.getNextSortState()
        this.sortState = nextState

        const isColumnSort = this.hasAttribute("data-col")
        const eventName = isColumnSort ? "column-sort" : "index-sort"

        const detail = isColumnSort
            ? { columnIndex: parseInt(this.dataset.col), sortState: nextState }
            : { level: parseInt(this.dataset.level), sortState: nextState }

        this.dispatchEvent(new CustomEvent(eventName, {
            detail: detail,
            bubbles: true
        }))
    }

    getNextSortState() {
        switch (this._sortState) {
            case "none": return "asc"
            case "asc": return "desc"
            case "desc": return "none"
            default: return "asc"
        }
    }

    updateMarker() {
        const marker = this.shadowRoot.getElementById("sort-marker")
        if (!marker) return

        marker.classList.toggle("visible", this._sortState !== "none")

        switch (this._sortState) {
            case "asc":
                marker.textContent = "▲"
                break
            case "desc":
                marker.textContent = "▼"
                break
            default:
                marker.textContent = "▲"
        }
    }

    // Public API
    get sortState() {
        return this._sortState
    }

    set sortState(value) {
        const validStates = ["none", "asc", "desc"]
        if (validStates.includes(value)) {
            this._sortState = value
            this.setAttribute("sort-state", value)
            this.updateMarker()
        }
    }

    get columnIndex() {
        return parseInt(this.dataset.col) ?? 0
    }

    set columnIndex(value) {
        this.dataset.col = value.toString()
    }

    get level() {
        return parseInt(this.dataset.level) ?? 0
    }

    set level(value) {
        this.dataset.level = value.toString()
    }

    clearSort() {
        this.sortState = "none"
    }
}

customElements.define("sortable-column-header", SortableColumnHeader)
