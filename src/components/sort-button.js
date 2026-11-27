export class SortButton extends HTMLElement {
    static get observedAttributes() {
        return ["sort-state"]
    }

    constructor() {
        super()
        this.handleClick = this.handleClick.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
        this._sortState = "none"
    }

    connectedCallback() {
        this.render()
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
    }

    render() {
        this.innerHTML = `<button tabindex="-1"><span>▲</span></button>`
        this.updateMarker()
    }

    addEventListeners() {
        this.button.addEventListener("click", this.handleClick)
        this.button.addEventListener("keydown", this.handleKeydown)
    }

    removeEventListeners() {
        this.button.removeEventListener("click", this.handleClick)
        this.button.removeEventListener("keydown", this.handleKeydown)
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        if (name === "sort-state") {
            this._sortState = newValue ?? "none"
            this.updateMarker()
        }
    }

    // MARK: handlers
    handleClick() {
        this.cycleSort()
    }

    handleKeydown(event) {
        if (event.key === "Escape" && this._sortState !== "none") {
            event.preventDefault()
            event.stopPropagation()
            this.setSortAndNotify("none")
        }
    }

    // MARK: sort
    cycleSort() {
        const next = { none: "asc", asc: "desc", desc: "none" }[this._sortState] ?? "asc"
        this.setSortAndNotify(next)
    }

    // Composed: handled by the viewer, which writes the state back to every sort button
    setSortAndNotify(sortState) {
        this.sortState = sortState
        this.dispatchEvent(new CustomEvent("sort-change", {
            detail: { key: this.dataset.key, direction: sortState },
            bubbles: true,
            composed: true
        }))
    }

    updateMarker() {
        const span = this.querySelector("span")
        if (!span) return
        span.textContent = this._sortState === "desc" ? "▼" : "▲"
    }

    // MARK: public API
    get button() {
        return this.querySelector("button")
    }

    get sortState() {
        return this._sortState
    }

    set sortState(value) {
        const valid = ["none", "asc", "desc"]
        if (!valid.includes(value)) return
        this._sortState = value
        this.setAttribute("sort-state", value)
        this.updateMarker()
    }
}

customElements.define("sort-button", SortButton)
