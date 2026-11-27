// Measures the cost of window updates in the table (step 7 of the windowed rendering design).
// Test code: it reaches into data-table's row window, the renderer and the component stylesheet
// on purpose, to time and vary what the component does not expose.

const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve(performance.now())))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function settle() {
    await frame()
    await frame()
    await sleep(0)
}

function busyWait(ms) {
    const until = performance.now() + ms
    while (performance.now() < until) { }
}

// Runs op at the start of a frame. sync: op itself (including the layout it forces);
// frame: until the frame has been rendered (a message task runs after the rendering steps)
function frameCost(op) {
    return new Promise(resolve => requestAnimationFrame(() => {
        const start = performance.now()
        op()
        const sync = performance.now() - start
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve({ sync, frame: performance.now() - start })
        channel.port2.postMessage(null)
    }))
}

// MARK: stats
const median = values => quantile(values, .5)
const p95 = values => quantile(values, .95)
function quantile(values, q) {
    if (!values.length) return NaN
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]
}
const ms = value => Number.isNaN(value) ? "-" : value.toFixed(1)
const pair = values => values.length ? `${ms(median(values))} / ${ms(p95(values))}` : "-"

function formatTable(header, rows) {
    const widths = header.map((cell, i) => Math.max(cell.length, ...rows.map(row => String(row[i]).length)))
    const line = row => row.map((cell, i) => String(cell).padEnd(widths[i])).join("  ").trimEnd()
    return [line(header), ...rows.map(line)].join("\n")
}

// MARK: data
function seeded(seed) {
    let state = seed
    return () => (state = (state * 16807) % 2147483647) / 2147483647
}

const WORDS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"]

// float, int and text columns; text values of one to four words, so truncate cuts them off
function makeColumns(nrows, ncols, rnd) {
    const dtypes = Array.from({ length: ncols }, (_, col) => ["float", "int", "str"][col % 3])
    const pick = () => WORDS[Math.floor(rnd() * WORDS.length)]
    const values = Array.from({ length: nrows }, () => dtypes.map(dtype =>
        dtype === "float" ? rnd() * 10000 - 5000
            : dtype === "int" ? Math.floor(rnd() * 100000)
                : Array.from({ length: 1 + Math.floor(rnd() * 4) }, pick).join(" ")
    ))
    return { columns: { values: dtypes.map((dtype, col) => `c${col}_${dtype}`), names: ["column"], dtypes }, values }
}

function makeFlat(nrows, ncols) {
    const { columns, values } = makeColumns(nrows, ncols, seeded(1))
    const index = { values: Array.from({ length: nrows }, (_, i) => `row${i}`), names: ["id"] }
    return { index, columns, values }
}

// Three levels: groups of 2000 and 200 rows, larger than any window
function makeMulti(nrows, ncols) {
    const { columns, values } = makeColumns(nrows, ncols, seeded(2))
    const index = {
        values: Array.from({ length: nrows }, (_, i) => [`g${Math.floor(i / 2000)}`, `s${Math.floor(i / 200)}`, `r${i}`]),
        names: ["group", "sub", "row"],
    }
    return { index, columns, values }
}

const DATASETS = {
    flat: () => makeFlat(50000, 30),
    multi: () => makeMulti(20000, 30),
}

// MARK: matrix
const HEIGHTS = ["500px", "800px"]
const LAYOUTS = ["no-wrap", "truncate"]
const OVERSCANS = [10, 20, 40]
const POSITIONS = 25
const SPEEDS = [1500, 4000]
const SCROLL_SECONDS = 4

// Each variant edits the component sheet; the sheet is restored afterwards
const STYLE_VARIANTS = {
    "all rules": () => { },
    "no transitions (record view buttons)": rules => removeProperty(rules, "transition"),
    "no sticky": rules => removeProperty(rules, "position", "sticky"),
    "no :has() (fixed layout kept)": rules => deleteRules(rules, text => text.includes(":has(") && !text.includes("colgroup")),
    "no hover, group lines, borders": rules => deleteRules(rules, text => /:hover|data-group-start|group-edge|last-of-type|index-edge/.test(text)),
    "minimal (fixed layout, spacers)": rules => deleteRules(rules, text => !/colgroup|tr\.spacer >/.test(text)),
}

function removeProperty(sheet, property, value = null) {
    for (const rule of sheet.cssRules) {
        if (rule.style && (value === null || rule.style.getPropertyValue(property) === value)) {
            rule.style.removeProperty(property)
        }
    }
}

function deleteRules(sheet, predicate) {
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
        if (predicate(sheet.cssRules[i].selectorText ?? sheet.cssRules[i].cssText)) sheet.deleteRule(i)
    }
}

// MARK: bench
class WindowingBench {
    constructor() {
        this.container = document.querySelector("#viewer-container")
        this.status = document.querySelector("#status")
        this.feelStats = document.querySelector("#feel-stats")

        this.viewer = null
        this.datasetName = null
        this.delay = 0
        this.rebuilds = []
        this.results = ""
        this.running = false
        this._datasets = {}
        this._rebuildStart = 0

        this.handleRun = this.handleRun.bind(this)
        this.handleCopy = this.handleCopy.bind(this)
        this.handleFeelLoad = this.handleFeelLoad.bind(this)
        this.handleFeelOption = this.handleFeelOption.bind(this)
        this.handleDelayInput = this.handleDelayInput.bind(this)
    }

    addEventListeners() {
        document.querySelector("#run").addEventListener("click", this.handleRun)
        document.querySelector("#copy").addEventListener("click", this.handleCopy)
        document.querySelector("#feel-load").addEventListener("click", this.handleFeelLoad)
        document.querySelector("#feel-overscan").addEventListener("change", this.handleFeelOption)
        document.querySelector("#feel-layout").addEventListener("change", this.handleFeelOption)
        document.querySelector("#feel-delay").addEventListener("input", this.handleDelayInput)
    }

    // MARK: get/set
    get dataTable() {
        return this.viewer.dataTable
    }

    get rowWindow() {
        return this.dataTable.rowWindow
    }

    get renderer() {
        return this.rowWindow.renderer
    }

    get geometry() {
        return this.rowWindow.geometry
    }

    dataset(name) {
        return this._datasets[name] ??= DATASETS[name]()
    }

    // MARK: viewer
    async loadViewer(name, { height = "800px", overscan = 20, layout = "no-wrap" } = {}) {
        this.viewer?.remove()
        this.viewer = document.createElement("flatbread-data-viewer")
        this.viewer.style.height = height
        this.viewer.setAttribute("cell-layout", layout)
        this.container.append(this.viewer)
        this.viewer.options.overscan = overscan
        this.viewer.data = this.dataset(name)
        this.datasetName = name
        await settle()
        await settle()
        this.instrument()
    }

    // Times every rebuild from renderer.update until the heights are read (which forces layout)
    // and adds the feel delay. Replaces the methods on this renderer instance only.
    instrument() {
        const renderer = this.renderer
        const { update, reportHeights } = Object.getPrototypeOf(renderer)
        renderer.update = (start, end) => {
            this._rebuildStart = performance.now()
            update.call(renderer, start, end)
            if (this.delay) busyWait(this.delay)
        }
        renderer.reportHeights = () => {
            reportHeights.call(renderer)
            this.rebuilds.push(performance.now() - this._rebuildStart)
            this.updateFeelStats()
        }
    }

    forceLayout() {
        this.renderer.tbody.lastElementChild.getBoundingClientRect()
    }

    // MARK: measurements
    async handleRun() {
        this.running = true
        this.delay = 0
        document.querySelector("#feel-delay").value = 0
        document.querySelector("#feel-delay-value").value = "0 ms"
        this.setControlsDisabled(true)
        try {
            const sections = [
                await this.measureEnvironment(),
                await this.measureRebuilds(),
                await this.measureScrolling(),
                await this.measureStylesheet(),
            ]
            this.results = sections.join("\n\n")
        } catch (error) {
            this.results = `ERROR ${error.stack ?? error}`
        }
        this.running = false
        this.showResults()
        this.setControlsDisabled(false)
    }

    async measureEnvironment() {
        const intervals = []
        let last = await frame()
        for (let i = 0; i < 120; i++) {
            const now = await frame()
            intervals.push(now - last)
            last = now
        }
        this.frameInterval = median(intervals)
        return [
            "# Windowing bench",
            `browser  ${navigator.userAgent}`,
            `display  ${Math.round(1000 / this.frameInterval)} Hz, devicePixelRatio ${devicePixelRatio}, window ${innerWidth} × ${innerHeight}`,
        ].join("\n")
    }

    // Full rebuild for the move of the window a hysteresis update makes: down by overscan − margin rows
    async measureRebuilds() {
        const rows = []
        for (const name of Object.keys(DATASETS)) {
            for (const height of HEIGHTS) {
                for (const layout of LAYOUTS) {
                    await this.loadViewer(name, { height, layout })
                    for (const overscan of OVERSCANS) {
                        this.setStatus(`rebuilds: ${name}, ${height}, ${layout}, overscan ${overscan}`)
                        this.viewer.options.overscan = overscan
                        rows.push([name, height, overscan, layout, ...await this.measurePositions(overscan)])
                    }
                }
            }
        }
        return [
            `## Rebuild cost (ms, median / p95 over ${POSITIONS} positions; the window moves down by "shift" rows)`,
            "sync: update until layout is done. frame: until the frame is rendered.",
            formatTable(["data", "height", "overscan", "layout", "rows", "shift", "sync", "frame", "frame/row"], rows),
        ].join("\n")
    }

    async measurePositions(overscan) {
        const shift = overscan - Math.ceil(overscan / 2)
        const rnd = seeded(overscan)
        const full = []
        let rows = 0
        for (let i = 0; i < POSITIONS; i++) {
            const count = this.geometry.count
            const position = 2 * overscan + Math.floor(rnd() * (count - 200 - 2 * overscan))
            this.dataTable.scrollTop = this.geometry.offsetOf(position)
            await settle()
            this.rowWindow.update(true)
            await frame()
            const { start, end } = this.renderer
            rows = end - start

            full.push(await frameCost(() => {
                this.renderer.update(start + shift, end + shift)
                this.forceLayout()
            }))
            this.rowWindow.update(true)
        }
        const fullFrame = full.map(cost => cost.frame)
        return [
            rows, shift,
            pair(full.map(cost => cost.sync)), pair(fullFrame),
            ms(median(fullFrame) / shift),
        ]
    }

    // Scrolls at a constant speed from requestAnimationFrame, as smooth scrolling would
    async measureScrolling() {
        const rows = []
        for (const name of Object.keys(DATASETS)) {
            await this.loadViewer(name)
            for (const speed of SPEEDS) {
                this.setStatus(`scrolling: ${name}, ${speed} px/s`)
                rows.push([name, speed, ...await this.scrollRun(speed)])
            }
        }
        const longFrame = 1.5 * this.frameInterval
        return [
            `## Scripted scrolling (height 800px, overscan 20, no-wrap, ${SCROLL_SECONDS} s per run)`,
            `long: frame interval over ${ms(longFrame)} ms (a missed frame). uncovered: frames that show spacer in the viewport.`,
            formatTable(["data", "px/s", "frames", "interval med", "interval p95", "long", "rebuilds", "rebuild med / p95", "uncovered"], rows),
        ].join("\n")
    }

    async scrollRun(speed) {
        const { dataTable } = this
        dataTable.scrollTop = 0
        await settle()
        this.rebuilds = []

        const intervals = []
        let uncovered = 0
        let y = 0
        let last = await frame()
        const end = last + SCROLL_SECONDS * 1000
        while (last < end) {
            const now = await frame()
            intervals.push(now - last)
            y += speed * (now - last) / 1000
            last = now
            // painted in this frame with the current window; the scroll event comes next frame
            dataTable.scrollTop = y
            if (!this.covers(dataTable.scrollTop)) uncovered++
        }
        await settle()

        const long = intervals.filter(interval => interval > 1.5 * this.frameInterval).length
        return [
            intervals.length, ms(median(intervals)), ms(p95(intervals)), long,
            this.rebuilds.length, pair(this.rebuilds), uncovered,
        ]
    }

    covers(scrollTop) {
        const { renderer, geometry } = this
        const first = geometry.indexAt(scrollTop)
        const last = geometry.indexAt(scrollTop + this.dataTable.clientHeight)
        return first >= renderer.start && (last < renderer.end || renderer.end === geometry.count)
    }

    // Full rebuild cost with parts of the component stylesheet removed
    async measureStylesheet() {
        await this.loadViewer("multi")
        const sheet = this.dataTable.shadowRoot.adoptedStyleSheets.at(-1)
        const original = [...sheet.cssRules].map(rule => rule.cssText).join("\n")
        const rows = []
        for (const [variant, apply] of Object.entries(STYLE_VARIANTS)) {
            this.setStatus(`stylesheet: ${variant}`)
            apply(sheet)
            await settle()
            const [, , , fullFrame] = await this.measurePositions(20)
            rows.push([variant, fullFrame, sheet.cssRules.length])
            sheet.replaceSync(original)
        }
        return [
            "## Stylesheet variants (multi-index, height 800px, overscan 20, no-wrap; full rebuild frame ms, median / p95)",
            formatTable(["variant", "full frame", "rules"], rows),
        ].join("\n")
    }

    showResults() {
        document.querySelector("#result")?.remove()
        const pre = document.createElement("pre")
        pre.id = "result"
        pre.textContent = this.results
        document.body.append(pre)
        document.querySelector("#copy").disabled = false
        this.setStatus("done")
    }

    async handleCopy() {
        try {
            await navigator.clipboard.writeText(this.results)
            this.setStatus("copied")
        } catch {
            getSelection().selectAllChildren(document.querySelector("#result"))
            this.setStatus("selected: copy with Ctrl+C")
        }
    }

    // MARK: feel
    async handleFeelLoad() {
        this.setStatus("loading")
        await this.loadViewer(document.querySelector("#feel-data").value, this.feelOptions)
        this.rebuilds = []
        this.setStatus("")
        this.updateFeelStats()
    }

    handleFeelOption() {
        if (!this.viewer) return
        const { overscan, layout } = this.feelOptions
        this.viewer.options.overscan = overscan
        this.viewer.setAttribute("cell-layout", layout)
        this.rebuilds = []
        this.updateFeelStats()
    }

    handleDelayInput(event) {
        this.delay = Number(event.target.value)
        document.querySelector("#feel-delay-value").value = `${this.delay} ms`
        this.rebuilds = []
        this.updateFeelStats()
    }

    get feelOptions() {
        return {
            overscan: Number(document.querySelector("#feel-overscan").value),
            layout: document.querySelector("#feel-layout").value,
        }
    }

    // Not while measuring: the text change would be part of the measured frames
    updateFeelStats() {
        if (this.running) return
        this.feelStats.textContent = `rebuilds ${this.rebuilds.length}, median ${ms(median(this.rebuilds))} ms incl. delay`
    }

    // MARK: helpers
    setStatus(text) {
        this.status.textContent = text
    }

    setControlsDisabled(disabled) {
        document.querySelectorAll("button, select, input").forEach(control => control.disabled = disabled)
    }
}

const bench = new WindowingBench()
bench.addEventListeners()
if (new URLSearchParams(location.search).has("run")) bench.handleRun()
