import fs from 'node:fs'
import chalk from 'chalk'
import { pathToFileURL } from 'node:url'

const cache = new Map()

export async function importFresh(file) {
    const mtime = fs.statSync(file).mtimeMs
    const hit = cache.get(file)
    if (hit && hit.mtime === mtime) return hit.mod
    if (hit?.failedMtime === mtime) return hit.mod

    try {
        const mod = await import(`${pathToFileURL(file).href}?v=${mtime}`)
        if (hit) console.log(chalk.redBright(`Update ${file}`))
        cache.set(file, { mtime, mod })
        return mod
    } catch (err) {
        if (!hit) throw err
        console.log(chalk.red(`[reload] Gagal memuat ${file}, tetap pakai versi sebelumnya:`), err.message)
        cache.set(file, { ...hit, failedMtime: mtime })
        return hit.mod
    }
}

export function watchFresh(file, interval = 500) {
    importFresh(file).catch((err) => console.log(chalk.red(`[reload] Gagal memuat ${file}:`), err.message))
    fs.watchFile(file, { interval }, () => {
        importFresh(file).catch(() => {})
    })
}