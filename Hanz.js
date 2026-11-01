/**
 * @file Titik masuk utama Main entry point untuk templat bot WhatsApp.
 * @license MIT
 * Lihat file LICENSE di direktori root untuk detail lisensi selengkapnya.
 * Copyright (c) 2026 harissync & contributors (kalau ada hihihi)
 */
import './src/config.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import util from 'node:util'
import chalk from 'chalk'
import moment from 'moment-timezone'
import sharp from 'sharp'
import { exec } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from 'baileys'
import { runtime, sleep, formatp, getGroupAdmins, decodeJid, saveJSON, toBuffer, parseNumber, parseNumbers } from './lib/myfunc.js'
import { renderCategory, renderAll } from './lib/menu.js'
import { markDeleted } from './lib/state.js'
import { webpToPng, convertAudio, addExif } from './lib/exif.js'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = import.meta.dirname

const settingFile = path.join(__dirname, 'src', 'setting.json')
let thumb = fs.readFileSync(path.join(__dirname, 'src', 'media', 'menu.png'))
let thumbCache
const getThumb = () => thumbCache ??= sharp(thumb).resize(300, 300).jpeg({ quality: 80 }).toBuffer()

const fmeta = {
  key: {
    remoteJid: "13135550002@s.whatsapp.net",
    fromMe: false,
    id: "HanzOfc",
    participant: "13135550002@s.whatsapp.net",
  },
  message: {
    viewOnceMessage: {
      message: {
        contactMessage: {
          displayName: "Meta AI",
          vcard:
            "BEGIN:VCARD\n" +
            "VERSION:3.0\n" +
            "N:;;;;\n" +
            "FN:Meta AI\n" +
            "item1.TEL;waid=13135550002:+13135550002\n" +
            "item1.X-ABLabel:Ponsel\n" +
            "END:VCARD",
        },
      },
    },
  },
}

const getUcapan = (tz = 'Asia/Jakarta') => {
  const h = moment().tz(tz).hour()
  if (h < 5) return 'Selamat Malam 🌌'
  if (h < 11) return 'Selamat Pagi 🌅'
  if (h < 15) return 'Selamat Siang 🏞️'
  if (h < 18) return 'Selamat Sore 🌆'
  if (h < 19) return 'Selamat Petang 🌃'
  return 'Selamat Malam 🌌'
}

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' }
const normText = (s) => ' ' + String(s || '').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z]+/g, ' ').trim() + ' '
const findBadword = (text, list) => {
    const t = normText(text)
    return list.map(normText).find((w) => w.trim() && t.includes(w))
}

const MENU = {
    main: { title: 'MAIN COMMAND', cmds: ['menu', 'allmenu', 'ping', 'runtime', 'owner', 'prefix'] },
    tools: { title: 'TOOLS MENU', cmds: ['sticker', 'toimg', 'tomp3', 'tovn', 'take nama|author', 'afk [alasan]', 'getpp @user', 'del'] },
    group: {
        title: 'GROUP MENU',
        cmds: [
            'kick @user', 'add 628xxx', 'promote @user', 'demote @user',
            'tagall [teks]', 'hidetag [teks]', 'tagadmin [teks]', 'listadmin',
            'warn @user', 'unwarn @user', 'listwarn',
            'mute @user', 'unmute @user', 'listmute',
            'linkgc', 'revoke', 'setname [teks]', 'setdesc [teks]', 'group buka/tutup',
            'welcome on/off', 'setwelcome [teks]', 'setbye [teks]', 'antilink on/off',
            'antidelete on/off', 'antitoxic on/off', 'addbadword [kata]', 'delbadword [kata]', 'listbadword',
        ],
    },
    owner: {
        title: 'OWNER MENU',
        cmds: [
            'join [link]', 'leave', 'bc [teks]', 'setppbot', 'ban @user', 'unban @user',
            'addowner @user', 'delowner @user', 'self', 'public', 'setprefix [prefix]', 'noprefix on/off', 'restart', 'rvo',
        ],
    },
}

const KNOWN = new Set([...fs.readFileSync(__filename, 'utf8').matchAll(/^\s*case\s+'([^']+)'\s*:/gm)].map((x) => x[1]))

const spamState = new Map()

const inviteCache = new Map()
const getOwnInviteCode = async (jid) => {
    const hit = inviteCache.get(jid)
    if (hit && Date.now() - hit.time < 5 * 60 * 1000) return hit.code
    const code = await Hanz_ref.groupInviteCode(jid).catch(() => null)
    if (code) inviteCache.set(jid, { code, time: Date.now() })
    return code
}
let Hanz_ref = null

const infoCache = new WeakMap()
const groupInfo = (participants) => {
    let info = infoCache.get(participants)
    if (info) return info
    const entries = participants.map((p) => [p.id, p.jid, p.phoneNumber, p.lid].filter(Boolean).map(decodeJid))
    const byUser = new Map()
    for (const ids of entries) {
        for (const id of ids) {
            const u = String(id).split('@')[0].split(':')[0]
            if (!byUser.has(u)) byUser.set(u, new Set())
            for (const x of ids) byUser.get(u).add(x)
        }
    }
    info = { groupAdmins: getGroupAdmins(participants), byUser }
    infoCache.set(participants, info)
    return info
}

const STICKER_CD_MS = 8000
const STICKER_MAX = 2
const stickerCooldown = new Map()
let stickerBusy = 0

export default async (Hanz, m, store, setting, db) => {
    let ownerFlag = !!m.fromMe
    Hanz_ref = Hanz
    try {
        var body = (m.mtype === 'conversation') ? m.message.conversation
            : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption
            : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption
            : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text
            : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId
            : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId
            : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId
            : (m.mtype === 'messageContextInfo')
                ? (m.message.buttonsResponseMessage?.selectedButtonId
                    || m.message.listResponseMessage?.singleSelectReply.selectedRowId
                    || m.text)
                : (m.body || m.text || '')

        if (!body && m.message?.interactiveResponseMessage) {
            try {
                const raw = m.message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson
                if (raw) {
                    const parsed = JSON.parse(raw)
                    body = parsed?.id || parsed?.selectedId || body
                }
            } catch {}
        }
        if (typeof body !== 'string') body = ''

        var budy = (typeof m.text == 'string' ? m.text : (body || ''))
        const basePrefa = (Array.isArray(global.prefa) && global.prefa.length ? global.prefa : [setting.prefix || '.']).map(String)
        const prefList = (Array.isArray(setting.prefixes) && setting.prefixes.length ? setting.prefixes.map(String) : basePrefa.filter(Boolean))
        const noPrefixMode = typeof setting.noPrefix === 'boolean' ? setting.noPrefix : basePrefa.includes('')
        const matchedPrefix = prefList
            .filter((p) => p && new RegExp('^' + escapeRegExp(p)).test(body))
            .sort((a, b) => b.length - a.length)[0]
        const prefix = matchedPrefix ?? (noPrefixMode ? '' : (prefList[0] || '.'))
        const hasPrefix = matchedPrefix !== undefined || noPrefixMode

        const cmdBody = (prefix ? body.slice(prefix.length) : body).trim()
        const rawCmd = cmdBody.split(/\s/)[0]
        const command = hasPrefix ? rawCmd.toLowerCase() : ''
        const isCmd = hasPrefix && command.length > 0
        const args = cmdBody.slice(rawCmd.length).trim().split(/ +/).filter(Boolean)
        const pushname = m.pushName || 'No Name'
        const botNumber = Hanz.decodeJid(Hanz.user.id)
        const owners = [...(setting.owner || []), ...db.owner].map((n) => String(n).replace(/\D/g, ''))
        const userOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
        const itsMe = m.sender == botNumber
        const text = args.join(' ')
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''
        const isMedia = /image|video|sticker|audio/.test(mime)
        const sender = m.isGroup ? (m.key.participant ? m.key.participant : m.participant) : m.key.remoteJid
        const senderNum = (m.sender || sender || '').split('@')[0]
        const groupMetadata = m.isGroup ? await Hanz.getGroupMeta(m.chat).catch(() => null) : null
        const groupName = m.isGroup ? (groupMetadata?.subject || '') : ''
        const participants = m.isGroup ? (groupMetadata?.participants || []) : []
        const info = m.isGroup ? groupInfo(participants) : null
        const groupAdmins = info ? info.groupAdmins : []
        const relatedIds = (jid) => info?.byUser.get(userOf(jid)) || []
        const selfIds = [botNumber, decodeJid(Hanz.user?.lid)].filter(Boolean)
        const isBotAdmins = m.isGroup ? selfIds.some((i) => groupAdmins.includes(i)) : false

        const senderIds = new Set([m.sender, m.senderAlt].filter(Boolean).map(decodeJid))
        for (const y of [...senderIds]) for (const x of relatedIds(y)) senderIds.add(x)
        if (m.sender?.endsWith('@lid') && ![...senderIds].some((x) => x.endsWith('@s.whatsapp.net'))) {
            try {
                const pn = await Hanz.signalRepository?.lidMapping?.getPNForLID?.(m.sender)
                if (pn) senderIds.add(decodeJid(pn))
            } catch {}
        }
        const senderNums = [...new Set([...senderIds].map(userOf).filter(Boolean))]
        const displayNum = userOf([...senderIds].find((i) => i.endsWith('@s.whatsapp.net'))) || senderNum
        const isOwner = m.fromMe || senderNums.some((n) => owners.includes(n)) || senderIds.has(botNumber)
        const isAdmins = m.isGroup ? [...senderIds].some((i) => groupAdmins.includes(i)) : false
        ownerFlag = isOwner

        const resolveNum = async (jid, strict = false) => {
            if (!jid) return null
            jid = decodeJid(jid)
            if (jid.endsWith('@s.whatsapp.net')) return userOf(jid)
            const pn = [...relatedIds(jid)].find((x) => x.endsWith('@s.whatsapp.net'))
            if (pn) return userOf(pn)
            try {
                const pn = await Hanz.signalRepository?.lidMapping?.getPNForLID?.(jid)
                if (pn) return userOf(pn)
            } catch {}
            return strict ? null : userOf(jid)
        }

        const groupData = m.isGroup ? db.group(m.chat) : {}
        const isWelkom = !!groupData.welcome
        const isAntilink = !!groupData.antilink
        const isBan = senderNums.some((n) => (db.hasUser ? db.hasUser(n) : true) && db.user(n).banned)

        const reply = (teks) => Hanz.sendMessage(m.chat, { text: teks }, { quoted: m })

        const getTargets = () => {
            if (m.mentionedJid?.length) return [...new Set(m.mentionedJid)]
            if (m.quoted?.sender) return [m.quoted.sender]
            return parseNumbers(text).map((n) => `${n}@s.whatsapp.net`)
        }
        const getTarget = () => {
            if (m.mentionedJid?.[0]) return m.mentionedJid[0]
            if (m.quoted?.sender) return m.quoted.sender
            const num = parseNumber(text)
            return num ? `${num}@s.whatsapp.net` : null
        }
        const replyMention = (teks, mentions = []) => Hanz.sendMessage(m.chat, { text: teks, mentions }, { quoted: m })

        const collectIds = (target) => {
            const t = decodeJid(target)
            const ids = new Set([t])
            for (const x of relatedIds(t)) ids.add(x)
            return ids
        }

        const guardTarget = async (target) => {
            const ids = collectIds(target)
            if (selfIds.some((s) => ids.has(s))) return mess.selfTarget
            if ([...ids].some((i) => owners.includes(userOf(i)))) return mess.ownerTarget
            if (!isOwner && [...ids].some((i) => groupAdmins.includes(i))) return mess.adminTarget
            return null
        }

        const toggleFeature = async (name, label) => {
            const g = db.group(m.chat)
            const opt = (args[0] || '').toLowerCase()
            if (opt === 'on') {
                if (g[name]) return reply(`${label} sudah aktif`)
                g[name] = true
                db.saveGroups()
                return reply(`${label} diaktifkan ✅`)
            }
            if (opt === 'off') {
                if (!g[name]) return reply(`${label} memang belum aktif`)
                g[name] = false
                db.saveGroups()
                return reply(`${label} dimatikan ✅`)
            }
            return reply(`${label}: *${g[name] ? 'ON' : 'OFF'}*\nContoh: ${prefix}${command} on/off`)
        }
        const sendMenu = async (menuText) => Hanz.sendLocationButtons(m.chat, {
            name: `✦ Halo 👋 ${pushname}`,
            address: `Perkenalkan saya ${setting.botName}`,
            url: 'https://hanzofc.my.id',
            jpegThumbnail: await getThumb(),
            text: menuText,
            footer: setting.botName,
            buttons: [
                { id: `${prefix}allmenu`, text: 'ALL MENU' },
                { id: `${prefix}menu`, text: 'KEMBALI' },
            ],
        })

        let moderated = false

        /*_________AntiLink____________*/
        if (m.isGroup && !m.fromMe && isAntilink && isBotAdmins && !isAdmins && !isOwner) {
            const groupCodes = [...body.matchAll(/chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/gi)].map((x) => x[1])
            const hasWebLink = /(?:https?:\/\/|www\.)\S+/i.test(body.replace(/\S*chat\.whatsapp\.com\/\S*/gi, ''))

            let reason = null
            if (groupCodes.length) {
                const ownCode = await getOwnInviteCode(m.chat)
                if (ownCode && groupCodes.some((c) => c !== ownCode)) reason = 'link grup lain'
            }
            if (!reason && hasWebLink) reason = 'link'

            if (reason) {
                moderated = true
                const tag = '@' + m.sender.split('@')[0]
                markDeleted(m.key.id)
                await Hanz.sendMessage(m.chat, { delete: m.key }).catch(() => {})
                const limit = global.warnLimit || 3
                const n = (groupData.warns[displayNum] = (groupData.warns[displayNum] || 0) + 1)
                if (n >= limit) {
                    delete groupData.warns[displayNum]
                    db.saveGroups()
                    await Hanz.sendMessage(m.chat, {
                        text: `*🔥 ANTI LINK 🔥*\n\n${tag} mengirim ${reason} (${n}/${limit}) dan dikeluarkan.`,
                        mentions: [m.sender],
                    }).catch(() => {})
                    await Hanz.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {})
                } else {
                    db.saveGroups()
                    await Hanz.sendMessage(m.chat, {
                        text: `*⚠️ ANTI LINK ⚠️*\n\n${tag}, dilarang mengirim ${reason} di grup ini.\nPeringatan ${n}/${limit}`,
                        mentions: [m.sender],
                    }).catch(() => {})
                }
                return
            }
        }

        /*_________AntiToxic____________*/
        if (m.isGroup && !m.fromMe && !moderated && groupData.antitoxic && isBotAdmins && !isAdmins && !isOwner && body) {
            const hit = findBadword(body, [...(global.badwords || []), ...(groupData.badwords || [])])
            if (hit) {
                const tag = '@' + m.sender.split('@')[0]
                markDeleted(m.key.id)
                await Hanz.sendMessage(m.chat, { delete: m.key }).catch(() => {})
                const limit = global.warnLimit || 3
                const n = (groupData.warns[displayNum] = (groupData.warns[displayNum] || 0) + 1)
                if (n >= limit) {
                    delete groupData.warns[displayNum]
                    db.saveGroups()
                    await Hanz.sendMessage(m.chat, {
                        text: `*🤬 ANTI TOXIC 🤬*\n\n${tag} berkata kasar (${n}/${limit}) dan dikeluarkan.`,
                        mentions: [m.sender],
                    }).catch(() => {})
                    await Hanz.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {})
                } else {
                    db.saveGroups()
                    await Hanz.sendMessage(m.chat, {
                        text: `*⚠️ ANTI TOXIC ⚠️*\n\n${tag}, jaga ucapanmu ya.\nPeringatan ${n}/${limit}`,
                        mentions: [m.sender],
                    }).catch(() => {})
                }
                return
            }
        }

        /*_________Mute____________*/
        if (m.isGroup && !m.fromMe && isBotAdmins && !isAdmins && !isOwner && groupData.muted?.length) {
            if (senderNums.some((n) => groupData.muted.includes(n))) {
                markDeleted(m.key.id)
                await Hanz.sendMessage(m.chat, { delete: m.key }).catch(() => {})
                return
            }
        }

        if (!Hanz.public && !isOwner && !m.key.fromMe) return

        if (isOwner && budy.startsWith('=> ')) {
            const Return = (sul) => {
                let sat = JSON.stringify(sul, null, 2)
                let bang = util.format(sat)
                if (sat == undefined) bang = util.format(sul)
                return reply(bang)
            }
            try {
                const code = budy.slice(3)
                let fn
                try { fn = eval(`(async () => { return ${code} })`) }
                catch (e) {
                    if (!(e instanceof SyntaxError)) throw e
                    fn = eval(`(async () => { ${code}\n })`)
                }
                const out = await fn()
                if (out !== undefined) reply(util.format(out))
            } catch (e) {
                reply(String(e))
            }
            return
        }

        if (isOwner && budy.startsWith('> ')) {
            try {
                let evaled = await eval(budy.slice(2))
                if (typeof evaled !== 'string') evaled = util.inspect(evaled)
                await reply(evaled)
            } catch (err) {
                await reply(String(err))
            }
            return
        }

        if (isOwner && budy.startsWith('$ ')) {
            exec(budy.slice(2), (err, stdout) => {
                if (err) return reply(String(err))
                if (stdout) return reply(stdout)
            })
            return
        }

        /*_________AFK____________*/
        if (!isBan && !(isCmd && command === 'afk')) {
            const afkNum = senderNums.find((n) => db.hasUser(n) && db.user(n).afk)
            if (afkNum) {
                const u = db.user(afkNum)
                const dur = runtime((Date.now() - u.afk.time) / 1000)
                u.afk = null
                db.saveUsers()
                await Hanz.sendMessage(m.chat, { text: `👋 @${userOf(m.sender)} kembali dari AFK (${dur})`, mentions: [m.sender] }, { quoted: m })
            }
            if (m.isGroup && !m.fromMe) {
                const ids = [...new Set([...(m.mentionedJid || []), m.quoted?.sender].filter(Boolean))].slice(0, 5)
                const lines = []
                const tagged = []
                for (const jid of ids) {
                    const num = await resolveNum(jid)
                    if (!num || !db.hasUser(num)) continue
                    const t = db.user(num)
                    if (!t.afk) continue
                    lines.push(`💤 @${userOf(jid)} sedang AFK sejak ${runtime((Date.now() - t.afk.time) / 1000)} lalu\nAlasan: ${t.afk.reason}`)
                    tagged.push(jid)
                }
                if (lines.length) await replyMention(lines.join('\n\n'), tagged)
            }
        }

        if (!isCmd || !KNOWN.has(command)) return
        if (isBan && !isOwner) return

        /*_________AntiSpam____________*/
        if (!isOwner) {
            const cfg = { max: 5, windowMs: 10000, blockMs: 15000, ...global.antiSpam }
            const now = Date.now()
            const st = spamState.get(displayNum) || { hits: [], blockedUntil: 0 }
            if (spamState.size > 500) spamState.clear()
            if (now < st.blockedUntil) return
            st.hits = st.hits.filter((t) => now - t < cfg.windowMs)
            st.hits.push(now)
            if (st.hits.length > cfg.max) {
                st.hits = []
                st.blockedUntil = now + cfg.blockMs
                spamState.set(displayNum, st)
                return reply(mess.spamWarn)
            }
            spamState.set(displayNum, st)
        }
/*_______________MULAI_____________*/
        switch (command) {
            case 'menu':
            case 'help':
            case 'list': {
                let menulist = `Hallo ${pushname} ${getUcapan(setting.timezone || 'Asia/Jakarta')}
● Nomor : ${displayNum}
● Status : ${isOwner ? 'Owner' : (isAdmins ? 'Admin' : 'User')}
● Prefix : ${prefix || '(no prefix)'}
● Mode : ${Hanz.public ? 'Public' : 'Self'}
● Runtime : ${runtime(process.uptime())}

Waktu : ${moment().tz(setting.timezone || 'Asia/Jakarta').format('HH:mm:ss')}
Tanggal : ${moment().tz(setting.timezone || 'Asia/Jakarta').format('DD/MM/YYYY')}`

                await Hanz.sendMessage(m.chat, {
                    text: menulist,
                    footer: `© ${setting.botName}`,
                    image: thumb,
                    buttons: [
                        { 
                            name: "cta_url", 
                            buttonParamsJson: JSON.stringify({ display_text: "Lapor Bug", url: "https://t.me/HanzOfc" }) 
                        },
                        { 
                            name: "single_select", 
                            buttonParamsJson: JSON.stringify({ 
                                title: "『 Simpel Menu 』", 
                                sections: [
                                    { title: "『 Simpel Menu 』", highlight_label: "", rows: [{ title: "Main Menu", description: "Menampilkan menu utama dan informasi bot", id: `${prefix}mainmenu` }] },
                                    { highlight_label: "", rows: [{ title: "Tools Menu", description: "Fitur utilitas seperti stiker dan converter", id: `${prefix}toolsmenu` }] },
                                    { highlight_label: "", rows: [{ title: "Group Menu", description: "Pengaturan grup, kick, add, dan hidetag", id: `${prefix}groupmenu` }] },
                                    { highlight_label: "", rows: [{ title: "Owner Menu", description: "Kontrol khusus pemilik bot dan manajemen sistem", id: `${prefix}ownermenu` }] },
                                    { title: "Lainnya", highlight_label: "", rows: [{ title: "Owner", description: "Menampilkan kontak atau info pemilik bot", id: `${prefix}owner` }] },
                                    { highlight_label: "", rows: [{ title: "AllMenu", description: "Menampilkan seluruh daftar menu bot secara lengkap", id: `${prefix}allmenu` }] }
                                ]
                            }) 
                        }
                    ],
                }, { 
                    quoted: fmeta,
                    contextInfo: {
                        mentionedJid: ["0@s.whatsapp.net"],
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: setting.channelId,
                            newsletterName: setting.botName,
                            serverMessageId: 1,
                        },
                    },
                })
            }
            break

            case 'mainmenu':
            case 'toolsmenu':
            case 'groupmenu':
            case 'ownermenu':
            case 'allmenu': {
                await sendMenu(command === 'allmenu'
                    ? renderAll(MENU, prefix, pushname)
                    : renderCategory(MENU, command.replace('menu', ''), prefix))
            }
            break
/*____________________________BATAS__________________________*/

            case 'ping':
            case 'speed': {
                const bar = (pct) => '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
                const t0 = performance.now()
                const sent = await reply('🏓 Mengukur...')
                const rtt = Math.round(performance.now() - t0)
                const light = rtt < 300 ? '🟢' : rtt < 800 ? '🟡' : '🔴'

                const mem = process.memoryUsage()
                const total = os.totalmem()
                const usedHost = total - os.freemem()
                const hostPct = Math.round((usedHost / total) * 100)
                const cores = os.cpus().length
                const load = os.loadavg()[0]
                const cpuLine = process.platform === 'win32'
                    ? `${cores} core`
                    : `${load.toFixed(2)} (${Math.min(100, Math.round((load / cores) * 100))}% dari ${cores} core)`

                const result =
                    `╭──❍『PING』\n` +
                    `│\n` +
                    `│⭔ Respon : ${light} ${rtt} ms\n` +
                    `│⭔ Aktif : ${runtime(process.uptime())}\n` +
                    `│\n` +
                    `│⭔ RAM bot : ${formatp(mem.rss)}\n` +
                    `│⭔ Heap : ${formatp(mem.heapUsed)} / ${formatp(mem.heapTotal)}\n` +
                    `│⭔ RAM host : ${formatp(usedHost)} / ${formatp(total)}\n` +
                    `│   ${bar(hostPct)} ${hostPct}%\n` +
                    `│⭔ CPU load : ${cpuLine}\n` +
                    `│⭔ Server aktif : ${runtime(os.uptime())}\n` +
                    `│\n` +
                    `│⭔ Node : ${process.version}\n` +
                    `│⭔ OS : ${os.type()} ${os.arch()}\n` +
                    `╰────❍`

                if (sent?.key) {
                    await Hanz.sendMessage(m.chat, { text: result, edit: sent.key }).catch(() => reply(result))
                } else {
                    await reply(result)
                }
            }
            break

            case 'runtime':
            case 'uptime': {
                reply(
                    `╭──❍『RUNTIME』\n` +
                    `│\n` +
                    `│⭔ Bot aktif selama\n` +
                    `│⭔ ${runtime(process.uptime())}\n` +
                    `│\n` +
                    `╰────❍`
                )
            }
            break

            case 'owner':
            case 'creator': {
                const numbers = [...(setting.owner || []), ...db.owner].map((n) => String(n).replace(/\D/g, ''))
                await Hanz.sendContact(m.chat, [...new Set(numbers)], m)
            }
            break

            case 's':
            case 'sticker':
            case 'stiker':
            case 'sgif': {
                const target = m.quoted || m
                const tmime = (target.msg || target).mimetype || ''
                if (!/image|video/.test(tmime)) return reply(`Kirim / balas gambar atau video dengan caption *${prefix}${command}*`)
                if (/video/.test(tmime) && ((target.msg || target).seconds || 0) > 10) return reply(mess.videoTooLong)
                if (!isOwner) {
                    const left = STICKER_CD_MS - (Date.now() - (stickerCooldown.get(displayNum) || 0))
                    if (left > 0) return reply(`Tunggu ${Math.ceil(left / 1000)} detik lagi`)
                }
                if (stickerBusy >= STICKER_MAX) return reply(mess.stickerBusy)
                if (stickerCooldown.size > 500) stickerCooldown.clear()
                stickerCooldown.set(displayNum, Date.now())
                stickerBusy++
                try {
                    await reply(mess.wait)
                    const media = await target.download()
                    if (/video/.test(tmime)) await Hanz.sendVideoAsSticker(m.chat, media, m)
                    else await Hanz.sendImageAsSticker(m.chat, media, m)
                } finally {
                    stickerBusy--
                }
            }
            break

            case 'toimg':
            case 'toimage': {
                if (!m.quoted || !/webp/.test(mime)) return reply(`Balas stiker dengan *${prefix}${command}*`)
                await reply(mess.wait)
                try {
                    const png = await webpToPng(await m.quoted.download())
                    await Hanz.sendMessage(m.chat, { image: png }, { quoted: m })
                } catch {
                    reply(mess.convertFail)
                }
            }
            break

            case 'tomp3':
            case 'tovn': {
                const target = m.quoted || m
                const tmime = (target.msg || target).mimetype || ''
                if (!/audio|video/.test(tmime)) return reply(`Kirim / balas video atau audio dengan caption *${prefix}${command}*`)
                if (((target.msg || target).seconds || 0) > 600) return reply(mess.audioTooLong)
                if (!isOwner) {
                    const left = STICKER_CD_MS - (Date.now() - (stickerCooldown.get(displayNum) || 0))
                    if (left > 0) return reply(`Tunggu ${Math.ceil(left / 1000)} detik lagi`)
                }
                if (stickerBusy >= STICKER_MAX) return reply(mess.convertBusy)
                if (stickerCooldown.size > 500) stickerCooldown.clear()
                stickerCooldown.set(displayNum, Date.now())
                stickerBusy++
                try {
                    await reply(mess.wait)
                    const audio = await convertAudio(await target.download(), command === 'tovn' ? 'vn' : 'mp3')
                    if (command === 'tovn') await Hanz.sendMessage(m.chat, { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m })
                    else await Hanz.sendMessage(m.chat, { audio, mimetype: 'audio/mpeg' }, { quoted: m })
                } finally {
                    stickerBusy--
                }
            }
            break

            case 'take':
            case 'swm': {
                if (!m.quoted || !/webp/.test(mime)) return reply(`Balas stiker dengan *${prefix}${command} nama|author*`)
                const [pack, auth] = text.split('|').map((s) => s.trim())
                if ((pack || '').length > 40 || (auth || '').length > 40) return reply('Maksimal 40 karakter per bagian')
                const sticker = await addExif(await m.quoted.download(), { packname: pack || pushname, author: auth ?? setting.author })
                await Hanz.sendMessage(m.chat, { sticker }, { quoted: m })
            }
            break

            case 'afk': {
                const reason = text.trim().slice(0, 100) || '-'
                db.user(displayNum).afk = { time: Date.now(), reason }
                db.saveUsers()
                await replyMention(`💤 @${userOf(m.sender)} sekarang AFK\nAlasan: ${reason}`, [m.sender])
            }
            break

            case 'getpp': {
                const target = getTarget() || m.sender
                const num = await resolveNum(target, true)
                const jid = num ? `${num}@s.whatsapp.net` : target
                const url = await Hanz.profilePictureUrl(jid, 'image').catch(() => null)
                if (!url) return reply('Foto profil tidak ada atau disembunyikan oleh user')
                await Hanz.sendMessage(m.chat, { image: { url }, caption: `Foto profil @${userOf(jid)}`, mentions: [jid] }, { quoted: m })
            }
            break

            case 'rvo': {
                if (!isOwner) return reply(mess.owner)
                const qv = m.quoted
                const qmime = qv?.mimetype || ''
                if (!/image|video|audio/.test(qmime)) return reply(`Balas pesan *sekali lihat* dengan *${prefix}${command}*`)
                const buf = await qv.download()
                if (/image/.test(qmime)) await Hanz.sendMessage(m.chat, { image: buf, caption: qv.caption || '' }, { quoted: m })
                else if (/video/.test(qmime)) await Hanz.sendMessage(m.chat, { video: buf, caption: qv.caption || '' }, { quoted: m })
                else await Hanz.sendMessage(m.chat, { audio: buf, mimetype: qmime, ptt: !!qv.ptt }, { quoted: m })
            }
            break

            case 'del':
            case 'delete': {
                if (!m.quoted) return reply(`Balas pesan yang mau dihapus dengan *${prefix}${command}*`)
                if (!m.quoted.fromMe) {
                    if (!m.isGroup) return reply(mess.group)
                    if (!isAdmins && !isOwner) return reply(mess.admin)
                    if (!isBotAdmins) return reply(mess.botAdmin)
                }
                markDeleted(m.quoted.id)
                await m.quoted.delete()
            }
            break

            case 'kick': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const targets = getTargets()
                if (!targets.length) return reply(`Tag / reply user.\nContoh: ${prefix}kick @user1 @user2`)
                if (targets.length > 10) return reply(mess.tooManyTargets)
                const okList = []
                const skipped = []
                for (const t of targets) {
                    const blocked = await guardTarget(t)
                    if (blocked) skipped.push({ jid: t, blocked })
                    else okList.push(t)
                }
                if (targets.length === 1 && skipped.length) return reply(skipped[0].blocked)
                const failed = []
                if (okList.length) {
                    const res = await Hanz.groupParticipantsUpdate(m.chat, okList, 'remove')
                    if (Array.isArray(res)) {
                        for (const r of res) if (String(r?.status) !== '200') failed.push({ jid: r.jid || okList[0], blocked: `gagal (status ${r?.status ?? 'unknown'})` })
                    }
                }
                const removed = okList.length - failed.length
                if (!skipped.length && !failed.length) return reply(mess.success)
                const problems = [...skipped, ...failed]
                await replyMention(
                    `${removed > 0 ? `✅ Dikeluarkan: ${removed} user\n` : ''}⚠️ Tidak berhasil:\n` +
                    problems.map((x) => `• @${userOf(x.jid)} : ${x.blocked}`).join('\n'),
                    problems.map((x) => x.jid)
                )
            }
            break

            case 'add': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const target = getTarget()
                if (!target) return reply(`Contoh: ${prefix}add 628xxxxxxxxxx`)
                const res = await Hanz.groupParticipantsUpdate(m.chat, [target], 'add')
                const status = String(res?.[0]?.status || '')
                if (status === '200') reply(mess.success)
                else if (status === '409') reply(mess.alreadyInGroup)
                else if (status === '403') reply(mess.addPrivacy)
                else reply(`Gagal menambahkan (status ${status || 'unknown'})`)
            }
            break

            case 'promote':
            case 'demote': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const target = getTarget()
                if (!target) return reply(`Tag / reply user.\nContoh: ${prefix}${command} @user`)
                if (command === 'demote') {
                    const blocked = await guardTarget(target)
                    if (blocked) return reply(blocked)
                } else {
                    const ids = collectIds(target)
                    if (selfIds.some((i) => ids.has(i))) return reply(mess.selfTarget)
                    if ([...ids].some((i) => groupAdmins.includes(i))) return reply(mess.alreadyAdmin)
                }
                const res = await Hanz.groupParticipantsUpdate(m.chat, [target], command)
                const st = Array.isArray(res) ? String(res[0]?.status ?? '200') : '200'
                if (st !== '200') return reply(`Gagal ${command} (status ${st})`)
                reply(mess.success)
            }
            break

            case 'tagall': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const list = participants.map((p) => `│ ◦ @${p.id.split('@')[0]}`).join('\n')
                await Hanz.sendMessage(m.chat, {
                    text: `╭──「 📢 *TAG ALL* 」\n│ Pesan : ${text || '-'}\n│\n${list}\n╰──────────────`,
                    mentions: participants.map((p) => p.id),
                }, { quoted: m })
            }
            break

            case 'hidetag': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const htText = text || m.quoted?.text || ''
                if (!htText) return reply(`Teksnya mana?\nContoh: ${prefix}${command} halo semua`)
                await Hanz.sendMessage(m.chat, {
                    text: htText,
                    mentions: participants.map((p) => p.id),
                }, { quoted: m })
            }
            break

            case 'tagadmin':
            case 'listadmin': {
                if (!m.isGroup) return reply(mess.group)
                const admins = participants.filter((p) => p.admin)
                if (!admins.length) return reply('Admin grup tidak terdeteksi')
                const list = admins.map((p) => `│ ◦ @${p.id.split('@')[0]}${p.admin === 'superadmin' ? ' 👑' : ''}`).join('\n')
                const head = command === 'tagadmin'
                    ? `╭──「 📢 *TAG ADMIN* 」\n│ Pesan : ${text || '-'}\n│\n`
                    : `╭──「 👮 *DAFTAR ADMIN* 」\n│\n`
                await replyMention(`${head}${list}\n╰──────────────`, admins.map((p) => p.id))
            }
            break

            case 'warn': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const target = getTarget()
                if (!target) return reply(`Tag / reply user.\nContoh: ${prefix}warn @user`)
                const blocked = await guardTarget(target)
                if (blocked) return reply(blocked)
                const num = await resolveNum(target)
                const limit = global.warnLimit || 3
                const n = (groupData.warns[num] = (groupData.warns[num] || 0) + 1)
                const tag = `@${userOf(target)}`
                if (n < limit) {
                    db.saveGroups()
                    return replyMention(`⚠️ ${tag} diperingatkan (${n}/${limit})`, [target])
                }
                if (!isBotAdmins) {
                    db.saveGroups()
                    return replyMention(`⚠️ ${tag} sudah ${n}/${limit} peringatan, tapi bot belum admin sehingga tidak bisa mengeluarkan.`, [target])
                }
                delete groupData.warns[num]
                db.saveGroups()
                await replyMention(`🔥 ${tag} mencapai ${limit}/${limit} peringatan dan dikeluarkan.`, [target])
                await Hanz.groupParticipantsUpdate(m.chat, [target], 'remove')
            }
            break

            case 'unwarn': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const target = getTarget()
                if (!target) return reply(`Tag / reply user.\nContoh: ${prefix}unwarn @user`)
                const num = await resolveNum(target)
                if (!groupData.warns[num]) return reply('User tidak punya peringatan')
                delete groupData.warns[num]
                db.saveGroups()
                reply('Peringatan user direset ✅')
            }
            break

            case 'listwarn': {
                if (!m.isGroup) return reply(mess.group)
                const limit = global.warnLimit || 3
                const entries = Object.entries(groupData.warns || {}).filter(([, n]) => n > 0)
                if (!entries.length) return reply('Belum ada member yang diperingatkan')
                await replyMention(
                    `╭──「 ⚠️ *DAFTAR PERINGATAN* 」\n│\n${entries.map(([num, n]) => `│ ◦ @${num} : ${n}/${limit}`).join('\n')}\n╰──────────────`,
                    entries.map(([num]) => `${num}@s.whatsapp.net`)
                )
            }
            break

            case 'mute':
            case 'unmute': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const target = getTarget()
                if (!target) return reply(`Tag / reply user.\nContoh: ${prefix}${command} @user`)
                const num = await resolveNum(target)
                if (command === 'mute') {
                    const blocked = await guardTarget(target)
                    if (blocked) return reply(blocked)
                    if (groupData.muted.includes(num)) return reply(mess.alreadyMuted)
                    groupData.muted.push(num)
                } else {
                    const idx = groupData.muted.indexOf(num)
                    if (idx === -1) return reply(mess.notMuted)
                    groupData.muted.splice(idx, 1)
                }
                db.saveGroups()
                reply(mess.success)
            }
            break

            case 'listmute': {
                if (!m.isGroup) return reply(mess.group)
                if (!groupData.muted.length) return reply('Tidak ada member yang di-mute')
                await replyMention(
                    `╭──「 🔇 *DAFTAR MUTE* 」\n│\n${groupData.muted.map((num) => `│ ◦ @${num}`).join('\n')}\n╰──────────────`,
                    groupData.muted.map((num) => `${num}@s.whatsapp.net`)
                )
            }
            break

            case 'setwelcome':
            case 'setbye': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const isWel = command === 'setwelcome'
                const field = isWel ? 'welcomeText' : 'goodbyeText'
                const label = isWel ? 'Welcome' : 'Goodbye'
                const raw = text.trim()
                if (!raw) {
                    return reply(
                        `${label} saat ini:\n${groupData[field] || (isWel ? global.welcomeText.add : global.welcomeText.remove)}\n\n` +
                        `Contoh: ${prefix}${command} Halo {user}, selamat datang di {group}!\n` +
                        `Token: {user} {group}\nKembali ke bawaan: ${prefix}${command} reset`
                    )
                }
                if (raw.toLowerCase() === 'reset') {
                    groupData[field] = null
                    db.saveGroups()
                    return reply(`${label} dikembalikan ke teks bawaan ✅`)
                }
                if (raw.length > 500) return reply('Maksimal 500 karakter')
                groupData[field] = raw
                db.saveGroups()
                reply(`${label} diubah ✅` + (groupData.welcome ? '' : `\nWelcome belum aktif, nyalakan dengan ${prefix}welcome on`))
            }
            break

            case 'linkgc':
            case 'linkgroup': {
                if (!m.isGroup) return reply(mess.group)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const code = await Hanz.groupInviteCode(m.chat)
                reply(`*${groupName}*\nhttps://chat.whatsapp.com/${code}`)
            }
            break

            case 'revoke':
            case 'resetlink': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const code = await Hanz.groupRevokeInvite(m.chat)
                reply(`Link grup direset ✅\nhttps://chat.whatsapp.com/${code}`)
            }
            break

            case 'setname':
            case 'setdesc': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                if (!text) return reply(`Teksnya mana?\nContoh: ${prefix}${command} teks baru`)
                if (command === 'setname') await Hanz.groupUpdateSubject(m.chat, text)
                else await Hanz.groupUpdateDescription(m.chat, text)
                reply(mess.success)
            }
            break

            case 'group':
            case 'grup': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                const opt = (args[0] || '').toLowerCase()
                if (['buka', 'open'].includes(opt)) {
                    await Hanz.groupSettingUpdate(m.chat, 'not_announcement')
                    reply('Grup dibuka, semua member bisa kirim pesan 🔓')
                } else if (['tutup', 'close'].includes(opt)) {
                    await Hanz.groupSettingUpdate(m.chat, 'announcement')
                    reply('Grup ditutup, hanya admin yang bisa kirim pesan 🔒')
                } else {
                    reply(`Contoh: ${prefix}${command} buka/tutup`)
                }
            }
            break

            case 'welcome': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                await toggleFeature('welcome', 'Welcome')
            }
            break

            case 'antilink': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                await toggleFeature('antilink', 'Antilink')
            }
            break

            case 'antidelete': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                await toggleFeature('antidelete', 'Antidelete')
            }
            break

            case 'antitoxic': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                if (!isBotAdmins) return reply(mess.botAdmin)
                await toggleFeature('antitoxic', 'Antitoxic')
            }
            break

            case 'addbadword':
            case 'delbadword': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const word = text.trim().toLowerCase()
                if (!word) return reply(`Contoh: ${prefix}${command} kata`)
                if (word.length > 30) return reply('Maksimal 30 karakter')
                const list = groupData.badwords
                if (command === 'addbadword') {
                    if (list.includes(word)) return reply('Kata sudah ada di daftar')
                    if (list.length >= 200) return reply('Maksimal 200 kata per grup')
                    list.push(word)
                } else {
                    const idx = list.indexOf(word)
                    if (idx === -1) return reply('Kata tidak ada di daftar grup (kata bawaan tidak bisa dihapus)')
                    list.splice(idx, 1)
                }
                db.saveGroups()
                reply(mess.success)
            }
            break

            case 'listbadword': {
                if (!m.isGroup) return reply(mess.group)
                if (!isAdmins && !isOwner) return reply(mess.admin)
                const list = groupData.badwords
                reply(`Kata tambahan grup (${list.length}):\n${list.length ? list.map((w) => `• ${w}`).join('\n') : '-'}\n\nKata bawaan: ${(global.badwords || []).length} kata`)
            }
            break

            case 'join': {
                if (!isOwner) return reply(mess.owner)
                const code = text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i)?.[1]
                if (!code) return reply(`Link grup tidak valid.\nContoh: ${prefix}join https://chat.whatsapp.com/xxxx`)
                await Hanz.groupAcceptInvite(code)
                reply(mess.success)
            }
            break

            case 'leave': {
                if (!isOwner) return reply(mess.owner)
                if (!m.isGroup) return reply(mess.group)
                await reply('Sampai jumpa 👋')
                await Hanz.groupLeave(m.chat)
            }
            break

            case 'bc':
            case 'broadcast': {
                if (!isOwner) return reply(mess.owner)
                if (!text) return reply(`Teksnya mana?\nContoh: ${prefix}${command} halo semua`)
                const groups = Object.keys(await Hanz.groupFetchAllParticipating())
                await reply(`Mengirim broadcast ke ${groups.length} grup...`)
                let ok = 0
                for (const id of groups) {
                    try {
                        await Hanz.sendMessage(id, { text: `*「 BROADCAST 」*\n\n${text}` })
                        ok++
                    } catch {}
                    await sleep(1500)
                }
                reply(`Broadcast selesai: ${ok}/${groups.length} grup ✅`)
            }
            break

            case 'setppbot': {
                if (!isOwner) return reply(mess.owner)
                const target = m.quoted || m
                if (!/image/.test((target.msg || target).mimetype || '')) return reply(`Kirim / balas gambar dengan caption *${prefix}${command}*`)
                await Hanz.updateProfilePicture(botNumber, await target.download())
                reply(mess.success)
            }
            break

            case 'ban':
            case 'unban': {
                if (!isOwner) return reply(mess.owner)
                const target = getTarget()
                if (!target) return reply(`Tag / reply user.\nContoh: ${prefix}${command} @user`)
                const num = await resolveNum(target)
                const u = db.user(num)
                if (command === 'ban') {
                    if (u.banned) return reply(mess.alreadyBanned)
                    u.banned = true
                } else {
                    if (!u.banned) return reply(mess.notBanned)
                    u.banned = false
                }
                db.saveUsers()
                reply(mess.success)
            }
            break

            case 'addowner':
            case 'delowner': {
                if (!isOwner) return reply(mess.owner)
                const target = getTarget()
                if (!target) return reply(`Tag / reply user atau tulis nomornya.\nContoh: ${prefix}${command} 628xxxxxxxxxx`)
                const num = await resolveNum(target, true)
                if (!num) return reply(`${mess.lidUnreadable}\nPakai nomornya langsung, contoh: ${prefix}${command} 628xxxxxxxxxx`)
                const mainOwners = [].concat(setting.owner || []).map((n) => String(n).replace(/\D/g, ''))
                if (command === 'addowner') {
                    if (owners.includes(num)) return reply(mess.alreadyOwner)
                    db.owner.push(num)
                } else {
                    if (mainOwners.includes(num)) return reply(mess.mainOwnerLocked)
                    if (!db.owner.includes(num)) return reply(mess.notExtraOwner)
                    db.owner.splice(db.owner.indexOf(num), 1)
                }
                db.saveOwner()
                reply(mess.success)
            }
            break

            case 'prefix': {
                const list = prefList.join('  ')
                reply(`Prefix: *${list}*\nTanpa prefix: *${noPrefixMode ? 'ON' : 'OFF'}*\nContoh: ${prefList[0]}menu`)
            }
            break

            case 'noprefix': {
                if (!isOwner) return reply(mess.owner)
                const opt = (args[0] || '').toLowerCase()
                if (!['on', 'off'].includes(opt)) return reply(`Tanpa prefix: *${noPrefixMode ? 'ON' : 'OFF'}*\nContoh: ${prefix}${command} on/off`)
                setting.noPrefix = opt === 'on'
                saveJSON(settingFile, setting)
                reply(`Mode tanpa prefix: *${setting.noPrefix ? 'ON' : 'OFF'}* ✅` +
                    (setting.noPrefix ? '\n⚠️ Di grup, kata biasa yang sama dengan nama command ikut memicu bot.' : ''))
            }
            break

            case 'setprefix': {
                if (!isOwner) return reply(mess.owner)
                const list = [...new Set(args.map((a) => a.trim()).filter(Boolean))]
                if (!list.length) return reply(`Prefix sekarang: *${prefList.join('  ')}*\nContoh: ${prefix}${command} . ! # /`)
                if (list.length > 10) return reply('Maksimal 10 prefix')
                const bad = list.find((p) => p.length > 3 || /[a-z0-9\s]/i.test(p) || /^[>$=]/.test(p))
                if (bad) return reply(`Prefix "${bad}" tidak valid.\nAturan: 1-3 karakter, bukan huruf/angka/spasi, dan tidak boleh diawali > $ =`)
                setting.prefixes = list
                saveJSON(settingFile, setting)
                reply(`Prefix diganti: *${list.join('  ')}* ✅\nContoh: ${list[0]}menu`)
            }
            break

            case 'restart': {
                if (!isOwner) return reply(mess.owner)
                await reply('🔄 Restarting...')
                try {
                    fs.writeFileSync(path.join(__dirname, 'database', '.restart.json'), JSON.stringify({ chat: m.chat, time: Date.now() }))
                } catch {}
                setTimeout(() => process.exit(42), 300)
            }
            break

            case 'self':
            case 'public': {
                if (!isOwner) return reply(mess.owner)
                Hanz.public = command === 'public'
                setting.public = Hanz.public
                saveJSON(settingFile, setting)
                reply(`Mode bot: *${Hanz.public ? 'Public' : 'Self'}* ✅`)
            }
            break

            default:
                break
        }
    } catch (err) {
        console.log(chalk.redBright('[ERROR Hanz]'), err)
        try {
            const detail = ownerFlag ? `\n${err.message || ''}` : ''
            await Hanz.sendMessage(m.chat, { text: mess.error + detail }, { quoted: m })
        } catch {}
    }
}