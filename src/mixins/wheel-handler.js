export const WheelHandlerMixin = {
    addWheelHandling() {
        this.addEventListener("wheel", this.handleWheel, {
            passive: false,
            capture: true
        })
    },

    removeWheelHandling() {
        this.removeEventListener("wheel", this.handleWheel)
    },

    handleWheel(event) {
        event.stopPropagation()

        const atTop = this.scrollTop === 0
        const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - 1

        const scrollingUp = event.deltaY < 0
        const scrollingDown = event.deltaY > 0

        if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
            event.preventDefault()
        }
    }
}
