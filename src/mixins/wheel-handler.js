export const WheelHandlerMixin = {
    addWheelHandling() {
        // passive: the handler only stops propagation, it never prevents scrolling
        this.addEventListener("wheel", this.handleWheel, { passive: true, capture: true })
    },

    removeWheelHandling() {
        this.removeEventListener("wheel", this.handleWheel, { capture: true })
    },

    handleWheel(event) {
        const atTop = this.scrollTop === 0
        const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - 1

        const scrollingUp = event.deltaY < 0
        const scrollingDown = event.deltaY > 0

        // boundary: let event bubble up naturally for parent scrolling
        if ((atTop && scrollingUp) || (atBottom && scrollingDown)) return

        // prevent bubbling
        event.stopPropagation()
    }
}
