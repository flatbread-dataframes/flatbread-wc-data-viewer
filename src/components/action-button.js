export class ActionButton extends HTMLElement {
    static styles = `
        :host {
            display: inline-block;
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
            user-select: none;
            width: 100%;
        }

        button:hover {
            opacity: 1;
        }

        button:disabled {
            opacity: 0.3;
            cursor: default;
        }

        button:focus {
            outline: 1px solid;
            outline-offset: 1px;
        }

        button:focus:not(:focus-visible) {
            outline: none;
        }
    `

    static get observedAttributes() {
        return ["disabled", "data-action"]
    }

    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        this.handleClick = this.handleClick.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
    }

    // MARK: setup
    connectedCallback() {
        this.setAttribute("tabindex", "0")
        this.render()
        this.addEventListeners()
    }

    disconnectedCallback() {
        this.removeEventListeners()
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
        this.updateAttributes()
    }

    updateAttributes() {
        if (!this.button) return

        this.button.disabled = this.hasAttribute("disabled")
    }

    // MARK: get/set
    get button() {
        return this.shadowRoot.querySelector("button")
    }

    // MARK: render
    render() {
        this.shadowRoot.innerHTML = `
            <style>${ActionButton.styles}</style>
            <button type="button" tabindex="-1">
                <slot></slot>
            </button>
        `
        this.updateAttributes()
    }

    // MARK: handlers
    handleClick() {
        this.dispatchAction()
    }

    handleKeydown(event) {
        if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation()
            event.preventDefault()
            this.dispatchAction()
        }
    }

    dispatchAction() {
        const action = this.getAttribute("data-action")
        if (action) {
            const newEvent = new CustomEvent(action, {
                bubbles: true,
                composed: true
            })
            this.dispatchEvent(newEvent)
        }
    }

    // MARK: api
    get disabled() {
        return this.hasAttribute("disabled")
    }

    set disabled(value) {
        if (value) {
            this.setAttribute("disabled", "")
        } else {
            this.removeAttribute("disabled")
        }
    }
}

customElements.define("action-button", ActionButton)
