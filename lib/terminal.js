const _orig = (global.__hanzConsole = global.__hanzConsole || {
    log: console.log, warn: console.warn, info: console.info, error: console.error,
})

const MUTED_NOISE = [
    'Closing open session', 'Closing stale open session', 'Closing session',
    'incoming prekey bundle', 'outgoing prekey bundle',
    'Session already closed', 'Session already open',
    'Removing old closed session', 'Opening session:', 'Closing session:',
    'Failed to decrypt', 'Session error', 'Bad MAC', 'Migrating session',
    'No matching sessions', 'decrypted message with closed session',
]

function shouldMuteBaileysNoise(args) {
    const s = args[0]
    if (typeof s === 'string') return MUTED_NOISE.some((m) => s.includes(m))
    if (s && typeof s === 'object' && (s._chains !== undefined || s.constructor?.name === 'SessionEntry')) return true
    return false
}

function clearSpinnerLine() {
    try {
        if (process.stdout.isTTY && spinnies.hasActiveSpinners()) process.stdout.write('\r\x1b[2K')
    } catch {}
}

for (const level of ['log', 'warn', 'info', 'error']) {
    console[level] = function (...args) {
        if (shouldMuteBaileysNoise(args)) return
        clearSpinnerLine()
        _orig[level].apply(console, args)
    }
}

const spinnies = (() => {
    if (global.__hanzSpin) global.__hanzSpin.remove()

    const TICK_MS = 50
    const BRAILLE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    const BASE = [74, 111, 165]
    const GLOW = [190, 235, 255]
    const GREEN_GLOW = [120, 255, 170]
    const AMBER = [255, 190, 80]
    const PHRASES = [
        'Menunggu pesan...',
        'Siap menerima perintah',
        'Bot standby, silakan chat',
        'Mendengarkan grup...',
    ]
    const MAX_LEN = Math.max(...PHRASES.map((p) => p.length))
    const HOLD = 18
    const GAP = 6
    const TOTAL = PHRASES.reduce((a, p) => a + p.length * 4 + HOLD + GAP, 0)

    const rgb = (c, str) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m${str}\x1b[0m`
    const dim = (str) => `\x1b[2m${str}\x1b[0m`
    const lerp = (a, b, t) => Math.round(a + (b - a) * t)
    const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
    function hsl(h, sat, l) {
        h = (((h % 360) + 360) % 360) / 360
        const a = sat * Math.min(l, 1 - l)
        const f = (n) => {
            const k = (n + h * 12) % 12
            return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
        }
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
    }
    const fmtElapsed = (ms) => {
        const sec = Math.floor(ms / 1000)
        if (sec >= 3600) return `${Math.floor(sec / 3600)}j ${Math.floor((sec % 3600) / 60)}m`
        return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`
    }

    let timer = null
    let tick = 0
    let lastMsg = Date.now()

    function frame() {
        let x = tick % TOTAL
        let shown = ''
        let typing = false
        for (const p of PHRASES) {
            const len = p.length
            const dur = len * 4 + HOLD + GAP
            if (x >= dur) {
                x -= dur
                continue
            }
            const typeEnd = len * 3
            const holdEnd = typeEnd + HOLD
            const delEnd = holdEnd + len
            let n = 0
            if (x < typeEnd) {
                n = Math.floor(x / 3)
                typing = true
            } else if (x < holdEnd) n = len
            else if (x < delEnd) {
                n = len - (x - holdEnd)
                typing = true
            }
            shown = p.slice(0, n)
            break
        }

        const hue = 215 + 35 * Math.sin(tick / 12)
        const spin = rgb(hsl(hue, 0.85, 0.7), BRAILLE[tick % BRAILLE.length])

        const pos = ((tick * 0.5) % (MAX_LEN + 10)) - 4
        const text = [...shown]
            .map((ch, i) => {
                const k = Math.max(0, 1 - Math.abs(i - pos) / 3)
                return rgb(mix(BASE, GLOW, k), ch)
            })
            .join('')
        const cursor = typing || Math.floor(tick / 4) % 2 === 0 ? rgb(hsl(hue, 0.85, 0.72), '▌') : ' '
        const pad = ' '.repeat(MAX_LEN - shown.length)

        const cols = process.stdout.columns || 80
        if (cols < 50) return `${spin} ${text}${cursor}`

        const idle = Date.now() - lastMsg
        const fresh = idle < 4000
        const dot = rgb(mix(GREEN_GLOW, AMBER, Math.min(1, idle / 600000)), '●')
        const label = (fresh ? 'baru ada pesan' : 'sepi ' + fmtElapsed(idle)).padEnd(14)
        const status = `${dot} ${fresh ? rgb(GREEN_GLOW, label) : dim(label)}`

        return `${spin} ${text}${cursor}${pad}  ${status}`
    }

    function stop() {
        if (!timer) return
        clearInterval(timer)
        timer = null
        try {
            process.stdout.write('\r\x1b[2K\x1b[?25h')
        } catch {}
    }

    const api = {
        add() {
            if (!process.stdout.isTTY) return
            if (timer) return
            tick = 0
            lastMsg = Date.now()
            process.stdout.write('\x1b[?25l')
            timer = setInterval(() => {
                try {
                    process.stdout.write('\r' + frame() + '\x1b[K')
                    tick++
                } catch {}
            }, TICK_MS)
            if (timer.unref) timer.unref()
        },
        remove() {
            stop()
        },
        hasActiveSpinners() {
            return !!timer
        },
        touch() {
            lastMsg = Date.now()
        },
    }
    global.__hanzSpin = api
    return api
})()

export { spinnies }