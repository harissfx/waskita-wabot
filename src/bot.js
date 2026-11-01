import './config.js'
import fs from 'node:fs'
import path from 'node:path'
import pino from 'pino'
import chalk from 'chalk'
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} from 'baileys'
import { smsg, decodeJid, sleep } from '../lib/myfunc.js'
import { spinnies } from '../lib/terminal.js'
import { setting, db, store, groupCache, sessionDir } from '../lib/state.js'
import { logEvent, ask, printBanner } from '../lib/logger.js'
import { isSessionReady, FORBIDDEN_CODE, reasonOf, countCommands, currentPrefixInfo } from '../lib/session.js'
import { isStaleMessage, isDuplicateMessage, logMessage } from '../lib/messages.js'
import attachHelpers from '../lib/socket.js'
import { importFresh, watchFresh } from '../lib/reload.js'
import antiDelete from '../lib/antidelete.js'

const HANZ_FILE = path.join(import.meta.dirname, '..', 'Hanz.js')
watchFresh(HANZ_FILE)

let pairingNumber = String(setting.pairingNumber || '').replace(/\D/g, '')

let retries = 0

async function autoFollowChannel(Hanz) {
    const channelId = String(setting.channelId || '').trim()
    if (setting.autoFollowChannel === false || !/^\d+@newsletter$/.test(channelId)) return
    try {
        await Hanz.newsletterFollow(channelId)
    } catch {}
}

async function startHanz() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const alreadyRegistered = isSessionReady(state)

    if (!global.__hanzBannerShown) {
        global.__hanzBannerShown = true
        printBanner(alreadyRegistered)
        logEvent('START', `Bot dijalankan (PID ${process.pid}, Node ${process.version})`, 'info')
    }

    let version
    try {
        version = (await fetchLatestBaileysVersion()).version
    } catch {
        console.log(chalk.yellow('[!] Gagal ambil versi WA terbaru, pakai default Baileys'))
    }

    const startedAt = (global.__hanzStartedAt ??= Date.now())
    const silent = pino({ level: 'silent' })
    const Hanz = makeWASocket({
        ...(version ? { version } : {}),
        logger: silent,
        printQRInTerminal: false,
        browser: ["Linux", "Firefox", "120.0"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, silent),
        },
        syncFullHistory: false,
        markOnlineOnConnect: false,
        cachedGroupMetadata: async (jid) => groupCache.get(jid)?.data,
        getMessage: async (key) => store.load(key.remoteJid, key.id)?.message,
    })

    global.__hanzSock = Hanz  

    attachHelpers(Hanz)

    /* ───────────── Koneksi ───────────── */

    Hanz.ev.on('creds.update', saveCreds)

    let closed = false
    let openedAt = null

    let pairingReadyResolve = null
    const pairingReady = alreadyRegistered
        ? null
        : new Promise((resolve) => { pairingReadyResolve = resolve })

    Hanz.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr && setting.usePairingCode === false) {
            spinnies.remove()
            try {
                console.log(chalk.magenta('\n[➔] Scan QR di bawah: WhatsApp > Perangkat tertaut > Tautkan perangkat\n'))
                const { default: qrcode } = await import('qrcode-terminal')
                qrcode.generate(qr, { small: true })
            } catch {
                console.log(chalk.red('[!] Modul qrcode-terminal belum terpasang. Jalankan: npm install'))
            }
        }

        if (connection === 'connecting' && pairingReadyResolve) {
            setTimeout(() => {
                if (pairingReadyResolve) {
                    const fn = pairingReadyResolve
                    pairingReadyResolve = null
                    fn()
                }
            }, 5000)
        }

        if (connection === 'close') {
            spinnies.remove()
            if (Hanz.__stopped) return

            const statusCode = lastDisconnect?.error?.output?.statusCode ?? null
            const upFor = openedAt ? `, sempat aktif ${Math.round((Date.now() - openedAt) / 1000)}d` : ''
            openedAt = null
            closed = true

            const codeTxt = statusCode == null ? 'tanpa kode' : `${statusCode} ${reasonOf(statusCode)}`
            const errMsg = lastDisconnect?.error?.message ? ` — ${lastDisconnect.error.message}` : ''
            const why = `${codeTxt}${errMsg}${upFor}`

            if (statusCode === DisconnectReason.loggedOut) {
                logEvent('KONEKSI', 'Sesi keluar (logged out). Sesi lama dihapus, silakan pairing ulang', 'err')
                fs.rmSync(sessionDir, { recursive: true, force: true })
                return boot()
            }

            if (statusCode === DisconnectReason.connectionReplaced) {
                logEvent('KONEKSI', 'Sesi dipakai di tempat lain (connection replaced), bot dihentikan', 'err')
                return process.exit(1)
            }

            if (statusCode === FORBIDDEN_CODE) {
                logEvent('KONEKSI', `Koneksi ditolak WhatsApp (${codeTxt}). Nomor kemungkinan diblokir/dibatasi`, 'err')
                                console.log(chalk.gray(
                    `    Session tidak dihapus (${sessionDir}). Cek akun WhatsApp-nya, tunggu bila ini ` +
                    'pembatasan sementara, lalu jalankan ulang bot.'
                ))
                return process.exit(1)
            }

            if (statusCode === DisconnectReason.badSession || statusCode === DisconnectReason.multideviceMismatch) {
                logEvent('KONEKSI', `Sesi rusak/tidak cocok (${codeTxt}), bot dihentikan`, 'err')
                console.log(chalk.gray(
                    `    Hapus folder ${sessionDir} lalu jalankan ulang untuk pairing baru.`
                ))
                return process.exit(1)
            }

            const isNormalRestart = statusCode === DisconnectReason.restartRequired || statusCode === 408

            if (!isSessionReady(Hanz.authState) && !isNormalRestart) {
                logEvent('KONEKSI', `Koneksi terputus (${statusCode}) saat pairing belum selesai`, 'err')
                console.log(chalk.yellow('    Silakan jalankan ulang "npm start" secara manual dan coba lagi.'))
                return process.exit(1)
            }

            const afterLogin = statusCode === DisconnectReason.restartRequired && !upFor

            if (afterLogin) {
                logEvent('KONEKSI', 'Restart koneksi setelah login/pairing, menyambung ulang...', 'info')
            } else if (isNormalRestart) {
                logEvent('KONEKSI', `Restart koneksi (${why}), menyambung ulang...`, 'info')
            } else {
                logEvent('KONEKSI', `Terputus (${why}), menyambung ulang...`, 'warn')
            }

            const delay = isNormalRestart ? 3000 : Math.min(60000, 3000 * 2 ** Math.min(retries++, 5))
            if (!isNormalRestart && retries > 1) logEvent('KONEKSI', `Percobaan sambung ke-${retries}, tunggu ${delay / 1000}d`, 'warn')
            await sleep(delay)
            return boot()
        }

        if (connection === 'open') {
            openedAt = Date.now()
            retries = 0
            const cleanName = String(Hanz.user?.name || '').replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '').trim()
            const name = cleanName || decodeJid(Hanz.user?.id).split('@')[0] || 'Unknown'

            let groupCount = 0
            try {
                const all = await Hanz.groupFetchAllParticipating()
                const now = Date.now()
                for (const [id, data] of Object.entries(all)) {
                    groupCache.set(id, { data, time: now })
                    groupCount++
                }
            } catch {}

            const mode = Hanz.public ? 'Public (semua bisa pakai)' : 'Self (khusus owner)'
            const pref = currentPrefixInfo()
            const coOwnerCount = [].concat(db.owner || []).filter(Boolean).length

            const info = [
                ['ID/No', name],
                ['Prefix', `${pref.text}${pref.noPrefix ? ' (bisa tanpa prefix)' : ''}`],
                ['Mode', mode],
                ['Owner', [].concat(setting.owner)[0] || '-'],
                ['Add-Owner', coOwnerCount ? `${coOwnerCount} nomor` : '-'],
                ['Grup Aktif', `${groupCount} grup`],
                ['Commands', `${countCommands()} fitur aktif`],
            ]
            const labelWidth = Math.max(...info.map(([label]) => label.length))

            const firstOpen = !global.__hanzEverOpened
            global.__hanzEverOpened = true
            logEvent('KONEKSI', `${firstOpen ? 'Tersambung' : 'Tersambung kembali'} sebagai ${name} (${groupCount} grup)`, 'ok')

            if (firstOpen) {
                console.log(chalk.hex('#39FF14')('STATUS: Bot Berhasil Terhubung!'))
                for (const [label, value] of info) {
                    console.log(chalk.white(` • ${label.padEnd(labelWidth)} : ${value}`))
                }
                console.log('')
            }

            spinnies.remove()
            spinnies.add()

            try {
                const f = path.join(import.meta.dirname, '..', 'database', '.restart.json')
                if (fs.existsSync(f)) {
                    const { chat, time } = JSON.parse(fs.readFileSync(f, 'utf8'))
                    fs.unlinkSync(f)
                    if (chat && Date.now() - time < 2 * 60 * 1000) {
                        const elapsed = ((Date.now() - time) / 1000).toFixed(1)
                        await Hanz.sendMessage(chat, { text: `✅ Bot berhasil restart (${elapsed}d)` }).catch(() => {})
                    }
                }
            } catch {}

            if (firstOpen) autoFollowChannel(Hanz).catch(() => {})
        }
    })

    /* ───────────── Pesan masuk ───────────── */

    const SYSTEM_MSG_TYPES = new Set(['protocolMessage', 'senderKeyDistributionMessage'])

    Hanz.ev.on('messages.upsert', async ({ messages, type }) => {
        if (closed) return
        if (type !== 'notify') return messages.forEach((mek) => store.save(mek))
        for (const mek of messages) {
            try {
                if (!mek.message) continue
                const types = Object.keys(mek.message).filter((t) => t !== 'messageContextInfo')
                if (!types.length || types.every((t) => SYSTEM_MSG_TYPES.has(t))) continue

                const jid = mek.key.remoteJid
                if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue

                store.save(mek)

                if (isStaleMessage(mek, startedAt) || isDuplicateMessage(mek)) continue
                spinnies.touch()

                const m = smsg(Hanz, mek)
                logMessage(Hanz, m).catch(() => {})

                const { default: handler } = await importFresh(HANZ_FILE)
                handler(Hanz, m, store, setting, db)
            } catch (err) {
                console.log(chalk.red('[messages.upsert]'), err)
            }
        }
    })

    Hanz.ev.on('messages.update', (updates) => { if (!closed) antiDelete(Hanz, updates) })

    /* ───────────── Grup ───────────── */

    Hanz.ev.on('groups.update', (updates) => updates.forEach((u) => groupCache.delete(u.id)))

    Hanz.ev.on('group-participants.update', async ({ id, participants, action }) => {
        groupCache.delete(id)
        try {
            const g = db.group(id)
            if (!g.welcome || !['add', 'remove'].includes(action)) return
            const meta = await Hanz.getGroupMeta(id)
            const template = action === 'add'
                ? (g.welcomeText || global.welcomeText.add)
                : (g.goodbyeText || global.welcomeText.remove)
            for (const p of participants) {
                const jid = typeof p === 'string' ? p : p.phoneNumber || p.id
                const text = template
                    .replace(/{user}/g, () => '@' + jid.split('@')[0])
                    .replace(/{group}/g, () => meta.subject)
                await Hanz.sendMessage(id, { text, mentions: [jid] })
            }
        } catch (err) {
            console.log(chalk.red('[group-participants]'), err.message)
        }
    })

    /* ───────────── Login: pairing code (default) atau QR (usePairingCode: false) ───────────── */

    const stillNeedLogin = !alreadyRegistered && !Hanz.authState?.creds?.registered

    if (stillNeedLogin && setting.usePairingCode === false) {
        console.log(chalk.gray('Mode login: QR. Menunggu QR dari server WhatsApp...'))
    } else if (stillNeedLogin) {
        if (!pairingNumber) {
            console.log(chalk.white('Format nomor gunakan kode negara, contoh: 6212345xxxxx\n'))
            const input = await ask(chalk.green('📱 Masukkan Nomor WhatsApp: '))
            pairingNumber = input.replace(/\D/g, '')
        }

        if (!/^\d{10,15}$/.test(pairingNumber)) {
            console.log(chalk.red('Nomor tidak valid! Aplikasi dihentikan.'))
            process.exit(1)
        }

        console.log(chalk.gray('Menunggu koneksi ke server WhatsApp...'))
        await pairingReady

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const code = await Hanz.requestPairingCode(pairingNumber)
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code
                console.log(chalk.magenta('\n[➔] PAIRING CODE ANDA: ') + chalk.white.bold(formattedCode))
                console.log(chalk.gray('Silakan masukkan kode di atas pada menu: Linked Devices -> Link with phone number\n'))
                break
            } catch (err) {
                console.log(chalk.yellow(`[!] Percobaan ${attempt}/3 gagal: ${err.message}`))
                if (attempt >= 3) {
                    console.log(chalk.red('❌ Gagal generate pairing code setelah 3 percobaan.'))
                    process.exit(1)
                }
                await sleep(5000)
            }
        }
    }

    return Hanz
}

async function boot() {
    for (let attempt = 1; ; attempt++) {
        try {
            return await startHanz()
        } catch (err) {
            const wait = Math.min(30000, 3000 * attempt)
            logEvent('KONEKSI', `Gagal memulai koneksi (percobaan ${attempt}): ${err?.message || err}. Coba lagi ${wait / 1000}d`, 'err')
            await sleep(wait)
        }
    }
}

boot()