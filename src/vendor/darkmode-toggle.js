const style = `
    button {
        color: inherit;
        cursor: pointer;
        font-size: 1.125em;
        background: transparent;
        border: none;
        border-radius: 4px;
        height: 1.5em;

        span { display: inline-block; }

        &:focus-visible {
            outline: 2px solid var(--fg-accent);
        }
    }
    .hidden {
        display: none;
    }
    @keyframes toggle-swap {
        0%   { transform: scale(1) }
        50%  { transform: scale(.25) }
        100% { transform: scale(1) }
    }
`

export class DarkModeToggle extends HTMLElement {
    static get observedAttributes() {
        return ["scheme"]
    }

    config = {
        buttonTitle: "Click to switch themes"
    }

    constructor(config = {}) {
        super()
        this.config = { ...this.config, ...config }
        this.shadow = this.attachShadow({ mode: 'open' })
        this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        this._scheme = this.getUserPreference()
        this.handleClick = this.handleClick.bind(this)
        this.handleMediaQueryChange = this.handleMediaQueryChange.bind(this)
        this.dispatch = this.dispatch.bind(this)
    }

    connectedCallback() {
        this.render()
        this._button.addEventListener("click", this.handleClick)
        this.mediaQuery.addEventListener("change", this.handleMediaQueryChange)
        this.scheme = this._scheme
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "scheme" && oldValue !== newValue) {
            this._scheme = newValue
            this.updateState()
        }
    }

    get scheme() { return this._scheme }
    set scheme(value) {
        this._scheme = value
        document.documentElement.dataset.scheme = value
        this.setAttribute("scheme", value)
        this.updateState()
        this.dispatch()
    }
    get _button() { return this.shadow.querySelector("button") }
    get _sun() { return this.shadow.getElementById("sun") }
    get _moon() { return this.shadow.getElementById("moon") }

    handleClick() {
        if (this._animating) return
        this._animating = true

        const duration = 300
        this._button.style.animation = `toggle-swap ${duration}ms ease-in-out`

        setTimeout(() => {
            this.scheme = this.scheme === "dark" ? "light" : "dark"
            localStorage.setItem("prefers-color-scheme", this.scheme)
        }, duration / 2)

        setTimeout(() => {
            this._button.style.animation = ""
            this._animating = false
        }, duration)
    }

    handleMediaQueryChange(event) {
        this.scheme = event.matches ? "dark" : "light"
        localStorage.setItem("prefers-color-scheme", this.scheme)
    }

    dispatch() {
        const event = new CustomEvent("color-scheme-change", {
            composed: true,
            bubbles: true,
            detail: { scheme: this.scheme }
        })
        this.dispatchEvent(event)
    }

    getUserPreference() {
        const storedMode = localStorage.getItem("prefers-color-scheme")
        const prefersDarkMode =
            (this.mediaQuery.matches && storedMode === null) || storedMode === "dark"
        return prefersDarkMode ? "dark" : "light"
    }

    render() {
        this.shadow.innerHTML =
            `<style>${style}</style>
        <button title="${this.config.buttonTitle}">
            <span id="sun">☼</span>
            <span id="moon">☽</span>
        </button>`
        this.updateState()
    }

    updateState() {
        if (this.scheme === "dark") {
            this._sun.classList.add("hidden")
            this._moon.classList.remove("hidden")
        } else {
            this._sun.classList.remove("hidden")
            this._moon.classList.add("hidden")
        }
    }

    toggle() {
        this.handleClick()
    }

    focus() {
        this._button.focus()
    }
}

customElements.define("darkmode-toggle", DarkModeToggle)