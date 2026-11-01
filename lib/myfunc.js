import { getContentType, jidDecode } from 'baileys'
import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'

/* ───────────── Umum ───────────── */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const runtime = (seconds) => {
    seconds = Number(seconds)
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return [d && `${d} hari`, h && `${h} jam`, m && `${m} menit`, `${s} detik`].filter(Boolean).join(' ')
}

export const formatp = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let n = Number(bytes) || 0
    let i = 0
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
    return `${n.toFixed(2).replace(/\.00$/, '')} ${units[i]}`
}

/* ───────────── Network ───────────── */

export const getBuffer = async (url, options = {}) => {
    const res = await axios({ method: 'get', url, responseType: 'arraybuffer', ...options })
    return Buffer.from(res.data)
}

export const toBuffer = async (input) => {
    if (Buffer.isBuffer(input)) return input
    if (typeof input !== 'string') throw new Error('Input media tidak valid')
    if (/^data:.*?\/.*?;base64,/i.test(input)) return Buffer.from(input.split(',')[1], 'base64')
    if (/^https?:\/\//i.test(input)) return getBuffer(input)
    if (fs.existsSync(input)) return fs.readFileSync(input)
    throw new Error('File media tidak ditemukan')
}

/* ───────────── JSON database ───────────── */

export const loadJSON = (file, fallback) => {
    try {
        if (!fs.existsSync(file)) {
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2))
            return fallback
        }
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (err) {
        try {
            if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`)
        } catch {}
        console.log(`[loadJSON] ${path.basename(file)} rusak (${err.message}), dipakai data kosong. Salinan disimpan.`)
        return fallback
    }
}

export const saveJSON = (file, data) => {
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, file)
}

/* ───────────── JID & Grup ───────────── */

export const decodeJid = (jid) => {
    if (!jid || typeof jid !== 'string') return jid
    if (/:\d+@/.test(jid)) {
        const d = jidDecode(jid) || {}
        return d.user && d.server ? `${d.user}@${d.server}` : jid
    }
    return jid
}

export const getGroupAdmins = (participants = []) => {
    const ids = new Set()
    for (const p of participants) {
        if (!p.admin) continue
        for (const v of [p.id, p.jid, p.phoneNumber, p.lid]) if (v) ids.add(decodeJid(v))
    }
    return [...ids]
}

export const parseNumber = (raw) => {
    const t = String(raw ?? '').trim().replace(/^@/, '')
    if (!/^\+?\d[\d\s-]{6,}$/.test(t)) return null
    const num = t.replace(/\D/g, '')
    return num.length >= 8 && num.length <= 15 ? num : null
}

export const parseNumbers = (raw) => {
    const whole = parseNumber(raw)
    if (whole) return [whole]
    const toks = String(raw ?? '').split(/[\s,]+/).filter(Boolean)
    if (!toks.length) return []
    const out = []
    for (const tok of toks) {
        const n = parseNumber(tok)
        if (!n) return []
        if (!out.includes(n)) out.push(n)
    }
    return out
}

/* ───────────── Serialize pesan ───────────── */

const WRAPPERS = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']

const unwrap = (message) => {
    let msg = message
    while (msg) {
        const type = getContentType(msg)
        if (!WRAPPERS.includes(type) || !msg[type]?.message) break
        msg = msg[type].message
    }
    return msg
}
export { unwrap }

const toNumber = (t) => {
    if (!t) return 0
    if (typeof t === 'object') return typeof t.toNumber === 'function' ? t.toNumber() : Number(t.low) || 0
    return Number(t) || 0
}
export { toNumber }

const extractText = (type, c) => {
    if (typeof c === 'string') return c
    if (!c) return ''
    switch (type) {
        case 'interactiveResponseMessage':
            try {
                return JSON.parse(c.nativeFlowResponseMessage?.paramsJson || '{}').id || c.body?.text || ''
            } catch {
                return c.body?.text || ''
            }
        case 'buttonsResponseMessage': return c.selectedButtonId || ''
        case 'listResponseMessage': return c.singleSelectReply?.selectedRowId || ''
        case 'templateButtonReplyMessage': return c.selectedId || ''
        default: return c.text || c.caption || c.contentText || ''
    }
}

export const smsg = (conn, m) => {
    if (!m) return m
    const botJid = decodeJid(conn.user?.id)
    const botIds = [conn.user?.id, conn.user?.lid].filter(Boolean).map(decodeJid)

    if (m.key) {
        m.id = m.key.id
        m.chat = decodeJid(m.key.remoteJid)
        m.fromMe = !!m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = decodeJid(m.fromMe ? botJid : m.key.participant || m.chat)
        m.senderAlt = decodeJid(m.key.participantAlt || m.key.participantPn || m.key.senderPn || (!m.isGroup && m.key.remoteJidAlt) || '') || ''
    }
    m.timestamp = toNumber(m.messageTimestamp)

    m.mtype = ''
    m.msg = {}
    m.body = ''
    m.mentionedJid = []
    m.quoted = null

    if (m.message) {
        m.message = unwrap(m.message)
        m.mtype = getContentType(m.message) || ''
        m.msg = m.message[m.mtype] || {}
        m.body = extractText(m.mtype, m.msg)
        const ctx = (typeof m.msg === 'object' && m.msg.contextInfo) || {}
        m.mentionedJid = ctx.mentionedJid || []

        if (ctx.quotedMessage) {
            const qMsg = unwrap(ctx.quotedMessage)
            const qtype = getContentType(qMsg)
            const raw = qMsg[qtype]
            const q = typeof raw === 'string' ? { text: raw } : { ...raw }
            q.mtype = qtype
            q.id = ctx.stanzaId
            q.chat = decodeJid(ctx.remoteJid || m.chat)
            q.sender = decodeJid(ctx.participant || q.chat)
            q.fromMe = botIds.includes(q.sender)
            q.text = extractText(qtype, raw)
            q.mentionedJid = ctx.mentionedJid || []
            q.key = { remoteJid: q.chat, fromMe: q.fromMe, id: q.id, ...(m.isGroup ? { participant: q.sender } : {}) }
            q.delete = () => conn.sendMessage(m.chat, { delete: q.key })
            q.download = () => conn.downloadMediaMessage(q)
            m.quoted = q
        }
    }

    m.text = m.body
    m.download = () => conn.downloadMediaMessage(m)
    m.reply = (text, options = {}) => conn.sendMessage(m.chat, { text, ...options }, { quoted: m })
    return m
}