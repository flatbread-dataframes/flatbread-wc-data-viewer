function buildRows(view) {
    return view.visibleIndices.map((_, rowIdx) => {
        const row = {}

        const idx = view.index.values[rowIdx]
        if (Array.isArray(idx)) {
            view.indexNames?.forEach((name, level) => {
                row[name ?? `index_${level}`] = idx[level]
            })
        } else {
            row[view.indexNames?.[0] ?? "index"] = idx
        }

        view.columns.values.forEach((col, colIdx) => {
            const key = Array.isArray(col) ? col.join(" > ") : col
            row[key] = view.values[rowIdx][colIdx]
        })

        return row
    })
}

function toJSON(view) {
    return JSON.stringify(buildRows(view), null, 2)
}

function toCSV(view) {
    const rows = buildRows(view)
    if (rows.length === 0) return ""

    const headers = Object.keys(rows[0])
    const lines = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row =>
            headers.map(h => escapeCSV(row[h])).join(",")
        )
    ]
    return lines.join("\n")
}

function escapeCSV(value) {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

export { toJSON, toCSV, download }