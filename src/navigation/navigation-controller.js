export class NavigationController {
    constructor(dataViewer) {
        this.dataViewer = dataViewer
        this.currentLevel = 'control-panel'
        this.handleKeydown = this.handleKeydown.bind(this)
        this.handleNavigationBoundary = this.handleNavigationBoundary.bind(this)

        // Set up event listeners immediately
        this.dataViewer.addEventListener('keydown', this.handleKeydown)
        this.dataViewer.addEventListener('navigation-boundary', this.handleNavigationBoundary)
    }

    // MARK: cleanup
    destroy() {
        this.dataViewer.removeEventListener('keydown', this.handleKeydown)
        this.dataViewer.removeEventListener('navigation-boundary', this.handleNavigationBoundary)
    }

    // MARK: get/set
    get availableLevels() {
        const modeComponents = {
            table:  ["control-panel", "thead", "tbody"],
            record: ["control-panel", "record"]
        }
        return modeComponents[this.dataViewer.viewMode]
    }

    // MARK: handlers
    handleKeydown(event) {
        if (this.handleGlobalShortcuts(event)) {
            event.preventDefault()
            event.stopPropagation()
            return
        }

        if (!["ArrowUp", "ArrowDown"].includes(event.key)) return

        if (this.handleLevelTransitions(event)) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        // else let components handle their own navigation
    }

    handleGlobalShortcuts(event) {
        if (event.ctrlKey) {
            switch (event.key) {
                case 'h':
                    this.dataViewer.handleToggleFilterRow()
                    return true
                case 'r':
                    this.dataViewer.toggleViewMode()
                    return true
                case 'f':
                    this.dataViewer.focusFirstFilter()
                    return true
            }
        } else if (event.key === 'Escape') {
            this.dataViewer.handleClearAllFilters()
            return true
        }
        return false
    }

    handleLevelTransitions(event) {
        if (this.getCurrentFocusedElement() === this.dataViewer) {
            if (event.key === 'ArrowDown') {
                this.moveToLevel(this.availableLevels[0]) // control-panel
                return true
            }
        }
        switch (event.key) {
            case 'ArrowUp':
                return this.moveUp()
            case 'ArrowDown':
                return this.moveDown()
        }
        return false
    }

    // MARK: transitions
    moveUp() {
        const currentIndex = this.availableLevels.indexOf(this.currentLevel)

        if (currentIndex > 0) {
            const newLevel = this.availableLevels[currentIndex - 1]
            this.moveToLevel(newLevel)
            return true
        }
        return false
    }

    moveDown() {
        const currentIndex = this.availableLevels.indexOf(this.currentLevel)

        if (currentIndex < this.availableLevels.length - 1) {
            const newLevel = this.availableLevels[currentIndex + 1]
            this.moveToLevel(newLevel)
            return true
        }
        return false
    }

    moveToLevel(level) {
        const currentElement = this.getCurrentFocusedElement()
        const targetX = currentElement ? this.getElementLeftX(currentElement) : 0

        this.currentLevel = level
        this.focusClosestElement(level, targetX)
    }

    // MARK: levels
    focusLevel(level) {
        const position = this.positions[level]

        switch (level) {
            case 'control-panel':
                console.log(position)
                this.focusControlPanel(position)
                break
            case 'thead':
                this.focusThead(position)
                break
            case 'tbody':
                this.focusTbody(position)
                break
            case 'record':
                this.focusRecord(position)
                break
        }
    }

    // MARK: focus
    getCurrentFocusedElement() {
        let activeEl = this.dataViewer
        while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
            activeEl = activeEl.shadowRoot.activeElement
        }
        return activeEl
    }

    getElementLeftX(element) {
        const rect = element.getBoundingClientRect()
        return rect.left
    }

    getNavigableElements(level) {
        switch (level) {
            case 'control-panel':
                const controlPanel = this.dataViewer.controlPanel
                return controlPanel ? controlPanel.navigableElements : []
            case 'thead':
                const dataTable = this.dataViewer.dataTable
                if (!dataTable) return []
                const elements = dataTable.theadNavigableElements
                return [...elements.headerRow, ...elements.filterRow]
            default:
                return []
        }
    }

    findClosestElement(targetX, elements) {
        if (elements.length === 0) return null

        let closest = elements[0]
        let closestDistance = Math.abs(this.getElementLeftX(closest) - targetX)

        for (let i = 1; i < elements.length; i++) {
            const distance = Math.abs(this.getElementLeftX(elements[i]) - targetX)
            if (distance < closestDistance) {
                closest = elements[i]
                closestDistance = distance
            }
        }

        return closest
    }

    focusClosestElement(level, targetX) {
        const elements = this.getNavigableElements(level)
        const closest = this.findClosestElement(targetX, elements)

        if (closest) {
            closest.focus()
        }
    }

    // MARK: boundary
    handleNavigationBoundary(event) {
        const { direction, from } = event.detail

        if (direction === 'down' && from === 'thead') {
            this.moveToLevel('tbody')
        }
        // add other boundary transitions
    }
}
