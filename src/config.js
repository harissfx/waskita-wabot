import fs from 'node:fs'
import chalk from 'chalk'
import { fileURLToPath, pathToFileURL } from 'node:url'

global.prefa = ['.', '!', '#', '/']

// Pesan standar
global.mess = {
    success: '✅ Berhasil',
    wait: '⏳ Tunggu sebentar...',
    error: '❌ Terjadi kesalahan',
    admin: '❌ Fitur ini khusus *Admin Grup*',
    botAdmin: '❌ Jadikan bot *Admin* dulu',
    owner: '❌ Fitur ini khusus *Owner*',
    group: '❌ Fitur ini hanya bisa dipakai di *Grup*',
    private: '❌ Fitur ini hanya bisa dipakai di *Chat Pribadi*',
    selfTarget: 'Masa bot disuruh begitu ke diri sendiri 😅',
    ownerTarget: 'Tidak bisa dilakukan ke owner bot',
    adminTarget: 'Tidak bisa dilakukan ke sesama admin',
    alreadyAdmin: 'User sudah jadi admin',
    alreadyBanned: 'User sudah dibanned',
    notBanned: 'User tidak dibanned',
    alreadyOwner: 'Sudah jadi owner',
    notExtraOwner: 'Bukan owner tambahan',
    mainOwnerLocked: 'Owner utama tidak bisa dihapus lewat command, ubah di setting.json',
    lidUnreadable: 'Nomor asli user tidak bisa dibaca (ID LID).',
    videoTooLong: 'Durasi video maksimal 10 detik',
    stickerBusy: 'Bot sedang sibuk bikin stiker, coba lagi sebentar',
    convertBusy: 'Bot sedang sibuk convert, coba lagi sebentar',
    audioTooLong: 'Durasi maksimal 10 menit',
    convertFail: 'Gagal convert. Stiker animasi belum didukung (hanya stiker statis).',
    alreadyInGroup: 'User sudah ada di grup',
    addPrivacy: 'Gagal: privasi user tidak mengizinkan ditambahkan, kirim link grup saja',
    spamWarn: '⏳ Terlalu cepat! Tunggu beberapa detik sebelum memakai command lagi.',
    tooManyTargets: 'Maksimal 10 target sekali jalan',
    alreadyMuted: 'User sudah di-mute',
    notMuted: 'User tidak sedang di-mute',
}

// Jumlah peringatan (antilink dan command warn) sebelum member dikeluarkan
global.warnLimit = 3

// Kata terlarang bawaan untuk fitur antitoxic (admin bisa menambah per grup lewat addbadword)
global.badwords = [
    'anjing', 'anjir', 'bangsat', 'bajingan', 'kontol', 'memek', 'ngentot', 'jancok',
    'goblok', 'tolol', 'asu', 'babi', 'kampret', 'pepek',
]

// Anti-spam command: lebih dari `max` command dalam `windowMs` => diabaikan selama `blockMs`
global.antiSpam = { max: 5, windowMs: 10000, blockMs: 15000 }

// Template welcome / goodbye. Token: {user} {group}
global.welcomeText = {
    add: 'Halo {user} 👋\n\nSelamat datang di *{group}*.\nSemoga betah, dan jangan lupa baca deskripsi serta aturan grup ya.',
    remove: '{user} telah meninggalkan *{group}*.\nSampai jumpa 👋',
}

const file = fileURLToPath(import.meta.url)
fs.watchFile(file, { interval: 500 }, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${file}`))
    import(`${pathToFileURL(file).href}?t=${Date.now()}`)
})