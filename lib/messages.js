import chalk from 'chalk'
import moment from 'moment-timezone'
import { setting } from './state.js'

const STALE_TOLERANCE_SEC = 2
function isStaleMessage(msg, startedAtMs) {
    const raw = msg?.messageTimestamp
    const ts = Number(typeof raw === 'object' && raw !== null ? (raw.low ?? raw.toNumber?.()) : raw) || 0
    if (!ts) return false
    return ts < Math.floor(startedAtMs / 1000) - STALE_TOLERANCE_SEC
}

const seenMessages = new Map()
const SEEN_TTL_MS = 10 * 60 * 1000
function isDuplicateMessage(msg) {
    const id = msg?.key?.id
    if (!id) return false
    const key = `${msg.key.remoteJid}|${id}`
    const now = Date.now()
    for (const [k, t] of seenMessages) {
        if (now - t > SEEN_TTL_MS) seenMessages.delete(k)
        else break
    }
    if (seenMessages.has(key)) {
        console.log(chalk.gray(`[~] Pesan duplikat dilewati (id=${String(id).slice(0, 8)}…)`))
        return true
    }
    seenMessages.set(key, now)
    return false
}

const MSG_TYPE_LABEL = {
    imageMessage: 'Gambar', videoMessage: 'Video', audioMessage: 'Audio',
    stickerMessage: 'Stiker', documentMessage: 'Dokumen', documentWithCaptionMessage: 'Dokumen',
    contactMessage: 'Kontak', contactsArrayMessage: 'Kontak', locationMessage: 'Lokasi',
    liveLocationMessage: 'Lokasi Live', pollCreationMessage: 'Polling', pollCreationMessageV3: 'Polling',
    reactionMessage: 'Reaksi', viewOnceMessage: 'Sekali Lihat', viewOnceMessageV2: 'Sekali Lihat',
    buttonsResponseMessage: 'Tombol', listResponseMessage: 'Pilihan List',
    templateButtonReplyMessage: 'Tombol', interactiveResponseMessage: 'Interaktif',
}

async function mentionsToNumbers(Hanz, m, text) {
    const lids = (m.mentionedJid || []).filter((j) => j?.endsWith('@lid'))
    if (!lids.length || !text) return text
    const meta = m.isGroup ? await Hanz.getGroupMeta(m.chat).catch(() => null) : null
    for (const jid of lids) {
        const lid = jid.split('@')[0].split(':')[0]
        let pn = meta?.participants?.find((p) => [p.id, p.lid].some((x) => x?.split('@')[0].split(':')[0] === lid))?.phoneNumber
        if (!pn) {
            try { pn = await Hanz.signalRepository?.lidMapping?.getPNForLID?.(jid) } catch {}
        }
        const num = String(pn || '').split('@')[0].split(':')[0]
        if (num) text = text.split('@' + lid).join('@' + num)
    }
    return text
}

async function logMessage(Hanz, m) {
    const time = moment().tz(setting.timezone).format('HH:mm:ss')
    const pn = [m.senderAlt, m.sender].find((j) => j?.endsWith('@s.whatsapp.net'))
    const number = (pn || m.sender || '').split('@')[0]
    const name = m.fromMe ? 'Bot' : m.pushName || 'Tanpa Nama'

    const theme = m.isGroup
        ? { badge: chalk.bgGreen.black.bold(' GRUP '), bar: chalk.green('▎'), accent: chalk.green }
        : { badge: chalk.bgBlue.white.bold(' PRIVAT '), bar: chalk.blue('▎'), accent: chalk.blueBright }

    let head = theme.badge
    if (m.isGroup) {
        const meta = await Hanz.getGroupMeta(m.chat).catch(() => null)
        head += ' ' + theme.accent.bold(meta?.subject || 'Grup tanpa nama')
    }
    head += '  ' + chalk.gray(time)

    const raw = (await mentionsToNumbers(Hanz, m, m.body || '')).replace(/\s+/g, ' ').trim()
    const typeLabel = MSG_TYPE_LABEL[m.mtype]
    const isCmd = /^[.!#/]\S/.test(raw)

    let content
    if (raw) {
        const text = raw.length > 100 ? raw.slice(0, 100) + '…' : raw
        const tag = typeLabel ? chalk.magenta(`[${typeLabel}] `) : ''
        content = isCmd
            ? chalk.yellow.bold('❯ ' + text)
            : chalk.gray('› ') + tag + chalk.white(text)
    } else {
        content = chalk.gray('› ') + chalk.magenta(`[${typeLabel || m.mtype || 'Tidak diketahui'}]`)
    }

    const who = (m.fromMe ? chalk.blueBright.bold(name) : chalk.white.bold(name)) + chalk.gray(`  ${number}`)
    const b = theme.bar + ' '
    console.log(b + head + '\n' + b + who + '\n' + b + content + '\n')
}

export { isStaleMessage, isDuplicateMessage, logMessage }