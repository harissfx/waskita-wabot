import fs from 'node:fs'
import path from 'node:path'
import { DisconnectReason } from 'baileys'
import { setting, sessionDir } from './state.js'

function isSessionReady(state) {
    try {
        if (state?.creds?.registered) return true
        if (state?.creds?.me?.id || state?.creds?.me?.lid) return true
        const credsPath = path.join(sessionDir, 'creds.json')
        if (fs.existsSync(credsPath)) {
            const raw = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
            if (raw?.registered || raw?.me?.id || raw?.me?.lid) return true
        }
    } catch {}
    return false
}

const FORBIDDEN_CODE = DisconnectReason?.forbidden ?? 403

function reasonOf(code) {
    const names = Object.entries(DisconnectReason || {})
        .filter(([, v]) => v === code)
        .map(([k]) => k)
    return names.length ? names.join('/') : 'unknown'
}

function countCommands() {
    try {
        const code = fs.readFileSync(path.join(import.meta.dirname, '..', 'Hanz.js'), 'utf8')
        return new Set([...code.matchAll(/^\s*case\s+'([^']+)'\s*:/gm)].map((x) => x[1])).size
    } catch {
        return 0
    }
}

function currentPrefixInfo() {
    const base = (Array.isArray(global.prefa) && global.prefa.length ? global.prefa : [setting.prefix || '.']).map(String)
    const list = Array.isArray(setting.prefixes) && setting.prefixes.length ? setting.prefixes.map(String) : base.filter(Boolean)
    const noPrefix = typeof setting.noPrefix === 'boolean' ? setting.noPrefix : base.includes('')
    return { text: list.join(' ') || '-', noPrefix }
}

export { isSessionReady, FORBIDDEN_CODE, reasonOf, countCommands, currentPrefixInfo }