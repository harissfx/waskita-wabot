import { getContentType, proto } from 'baileys'
import { unwrap, toNumber } from './myfunc.js'
import { db, store, botDeleted } from './state.js'

const REVOKE = proto.WebMessageInfo?.StubType?.REVOKE ?? 1
const MAX_BYTES = 20 * 1024 * 1024
const MEDIA = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']
const CAPTIONABLE = ['imageMessage', 'videoMessage', 'documentMessage']

const done = new Set()
const userOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
const idsOf = (key) => [key?.participant, key?.participantAlt, key?.participantPn].filter(Boolean).map(userOf)

async function restore(Hanz, key) {
    const jid = key.remoteJid
    const orig = store.load(jid, key.id)
    if (!orig?.message || orig.key.fromMe) return

    const author = idsOf(orig.key)
    const deleter = idsOf(key)
    if (deleter.length && author.length && !deleter.some((d) => author.includes(d))) return

    const msg = unwrap(orig.message)
    const type = getContentType(msg)
    const content = msg?.[type]
    if (!type || content?.viewOnce) return

    const text = typeof content === 'string' ? content : content?.text || ''
    if (!text && !MEDIA.includes(type)) return

    const who = [orig.key.participantAlt, orig.key.participant].find((j) => j?.endsWith('@s.whatsapp.net')) || orig.key.participant
    const head = `🗑️ *ANTI DELETE*\n@${userOf(who)} menghapus pesan`
    const mentions = who ? [who] : []

    if (text) {
        await Hanz.sendMessage(jid, { text: `${head}:\n\n${text}`, mentions })
        return
    }

    let buf = null
    if (toNumber(content.fileLength) <= MAX_BYTES) {
        buf = await Hanz.downloadMediaMessage({ msg: content, mtype: type }).catch(() => null)
    }
    if (!buf) {
        await Hanz.sendMessage(jid, { text: `${head} (media tidak bisa dipulihkan)`, mentions })
        return
    }

    const caption = `${head}${content.caption ? `:\n\n${content.caption}` : ''}`
    if (CAPTIONABLE.includes(type)) {
        const payload = {
            imageMessage: { image: buf, caption },
            videoMessage: { video: buf, caption, gifPlayback: !!content.gifPlayback },
            documentMessage: { document: buf, caption, mimetype: content.mimetype, fileName: content.fileName || 'file' },
        }[type]
        await Hanz.sendMessage(jid, { ...payload, mentions })
        return
    }

    await Hanz.sendMessage(jid, { text: head, mentions })
    if (type === 'stickerMessage') await Hanz.sendMessage(jid, { sticker: buf })
    else await Hanz.sendMessage(jid, { audio: buf, mimetype: content.mimetype || 'audio/mpeg', ptt: !!content.ptt })
}

export default async function antiDelete(Hanz, updates) {
    for (const { key, update } of updates) {
        try {
            if (!key?.remoteJid?.endsWith('@g.us') || key.fromMe || !key.id) continue
            if (update?.messageStubType !== REVOKE && update?.message !== null) continue
            if (!db.group(key.remoteJid).antidelete) continue
            if (botDeleted.has(key.id)) continue
            if (done.has(key.id)) continue
            if (done.size > 500) done.clear()
            done.add(key.id)
            await restore(Hanz, key)
        } catch (err) {
            console.log('[antidelete]', err.message)
        }
    }
}