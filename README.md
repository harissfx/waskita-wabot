<div align="center">

# Waskita

**Base bot WhatsApp berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) yang simpel.**

![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/baileys-7.0.0--rc-25D366)
![Module](https://img.shields.io/badge/module-ESM-f7df1e)

</div>

---

## Tentang Project

Waskita adalah base bot WhatsApp yang dibuat buat jadi titik awal, bukan produk jadi yang penuh fitur nggak kepakai. Koneksi, logika command, dan modul pendukung dipisah dengan jelas, jadi kamu bisa baca seluruh alurnya dalam waktu singkat lalu langsung mulai modifikasi.

Cocok kalau kamu mau:

- punya fondasi yang bersih untuk bot WhatsApp pribadi,
- belajar cara kerja Baileys lewat kode yang gampang diikuti,
- pakai bot manajemen grup yang tinggal jalan.

## Fitur

**Dasar**

- Login lewat pairing code atau scan QR.
- Mode `public` dan `self`, lengkap dengan owner utama dan owner tambahan.
- Prefix bisa diganti langsung dari chat, termasuk mode tanpa prefix.
- Anti-spam command dan menu yang dibuat otomatis dari satu daftar.
- Auto reconnect, plus hot reload untuk `Hanz.js` dan `src/config.js`.
- Supervisor bawaan, jadi command `restart` jalan tanpa process manager.

**Manajemen Grup**

- `kick` (bisa banyak target sekaligus), `add`, `promote`, `demote`.
- `tagall`, `hidetag`, `tagadmin`.
- `warn` dan `mute` per member.
- `antilink` bertahap: pesan dihapus, pengirim diperingatkan, lalu dikeluarkan setelah melewati batas warn.
- `antitoxic` dengan daftar kata bawaan, bisa ditambah per grup. Deteksinya tahan trik huruf berulang dan angka pengganti huruf.
- `antidelete` untuk memulihkan pesan yang dihapus member.
- `welcome` dan `goodbye` dengan teks yang bisa diatur per grup.

**Tools**

- Pembuat stiker (gambar dan video), `toimg`, `tomp3`, `tovn`, dan `take`.
- `afk` dan `getpp`.

**Untuk Developer**

- Database JSON ringan untuk data user dan grup.
- Helper pesan interaktif (quick reply, URL, copy, call, dropdown) dalam satu fungsi.
- Helper kirim gambar, video, audio, dokumen, kontak, dan polling.
- Eval JavaScript dan eksekusi shell langsung dari chat (khusus owner).

## Persyaratan

- [Node.js](https://nodejs.org/) 22 atau lebih baru.
- [ffmpeg](https://ffmpeg.org/) terpasang di sistem. Dipakai oleh stiker, `toimg`, `tomp3`, dan `tovn`.

## Instalasi

```bash
git clone https://github.com/harissfx/waskita-wabot.git
cd waskita-wabot
npm install
```

Buat file `src/setting.json`, lalu isi sesuai kebutuhan:

```json
{
  "botName": "Waskita",
  "ownerName": "Nama Kamu",
  "owner": ["628xxxxxxxxxx"],
  "packname": "Waskita",
  "author": "Nama Kamu",
  "sessionName": "session",
  "usePairingCode": true,
  "pairingNumber": "628xxxxxxxxxx",
  "public": true,
  "noPrefix": false,
  "timezone": "Asia/Jakarta"
}
```

Nomor ditulis dengan kode negara, tanpa tanda `+` (contoh: `628123456789`). Kalau ada kunci yang tidak diisi, bot memakai nilai bawaan.

Setelah itu jalankan:

```bash
npm start
```

### Login

Metode login diatur lewat `usePairingCode` di `src/setting.json`.

| Nilai | Cara kerja |
| --- | --- |
| `true` (bawaan) | Bot menampilkan kode pairing di terminal. Di WhatsApp buka **Perangkat Tertaut** > **Tautkan dengan nomor telepon**, lalu masukkan kodenya. Kalau `pairingNumber` kosong, bot akan menanyakan nomornya di terminal. |
| `false` | Bot menampilkan QR code di terminal. Scan lewat **Perangkat Tertaut** > **Tautkan Perangkat**. |

Sesi login tersimpan di `database/<sessionName>/` (bawaannya `database/session/`). Selama folder itu ada, kamu tidak perlu login ulang.

## Konfigurasi

### `src/setting.json`

| Kunci | Keterangan |
| --- | --- |
| `botName` | Nama bot untuk menu dan banner terminal. |
| `ownerName` | Nama owner, ditampilkan saat command `owner` dipakai. |
| `owner` | Array nomor owner, contoh `["628123456789"]`. |
| `packname`, `author` | Metadata stiker. |
| `prefix` | Prefix cadangan kalau `global.prefa` di `config.js` kosong. |
| `noPrefix` | `true` supaya command bisa dipakai tanpa prefix. |
| `sessionName` | Nama folder sesi di dalam `database/`. |
| `usePairingCode` | `true` untuk pairing code, `false` untuk QR. |
| `pairingNumber` | Nomor bot untuk pairing otomatis tanpa prompt. |
| `public` | `true` untuk semua orang, `false` hanya owner (mode self). |
| `timezone` | Zona waktu, contoh `Asia/Jakarta`. |
| `channelId` | ID channel WhatsApp (opsional) untuk header menu. |

Beberapa nilai (`prefixes`, `noPrefix`, `public`) bisa diubah owner langsung dari chat lewat `setprefix`, `noprefix`, `self`, dan `public`. Perubahannya otomatis ditulis ke `setting.json`.

> **Soal `noPrefix`:** kalau aktif, kata biasa di grup yang kebetulan sama dengan nama command (misalnya `list` atau `add`) ikut memicu bot. Sebaiknya matikan di grup yang ramai.

### `src/config.js`

Untuk pengaturan yang lebih dalam:

| Variabel | Fungsi |
| --- | --- |
| `global.prefa` | Daftar prefix bawaan (`. ! # /`). |
| `global.mess` | Kumpulan pesan standar bot. |
| `global.warnLimit` | Batas warn sebelum member dikeluarkan (bawaan `3`). |
| `global.badwords` | Daftar kata terlarang bawaan untuk `antitoxic`. |
| `global.antiSpam` | Batas anti-spam command. Bawaan: lebih dari 5 command dalam 10 detik, diabaikan selama 15 detik. |
| `global.welcomeText` | Template welcome dan goodbye (token `{user}` dan `{group}`). |

## Daftar Command

Contoh di bawah memakai prefix `.`, sesuaikan dengan konfigurasi kamu.

| Kategori | Command |
| --- | --- |
| **Umum** | `menu` (`help`, `list`), `allmenu`, `ping` (`speed`), `runtime` (`uptime`), `owner` (`creator`), `prefix` |
| **Tools** | `sticker` (`s`, `stiker`, `sgif`), `toimg` (`toimage`), `tomp3`, `tovn`, `take` (`swm`), `afk`, `getpp`, `del` (`delete`) |
| **Grup** | `kick`, `add`, `promote`, `demote`, `tagall`, `hidetag`, `tagadmin`, `listadmin`, `warn`, `unwarn`, `listwarn`, `mute`, `unmute`, `listmute`, `linkgc` (`linkgroup`), `revoke` (`resetlink`), `setname`, `setdesc`, `group` (buka/tutup), `welcome`, `setwelcome`, `setbye`, `antilink`, `antidelete`, `antitoxic`, `addbadword`, `delbadword`, `listbadword` |
| **Owner** | `join`, `leave`, `bc` (`broadcast`), `setppbot`, `ban`, `unban`, `addowner`, `delowner`, `setprefix`, `noprefix`, `self`, `public`, `restart`, `rvo` |

Command grup yang mengubah sesuatu (seperti `kick`, `promote`, `antilink`) hanya bisa dipakai admin grup, dan bot juga harus sudah jadi admin.

Ada juga menu per kategori: `mainmenu`, `toolsmenu`, `groupmenu`, dan `ownermenu`.

### Shortcut Developer (khusus owner)

| Awalan | Fungsi |
| --- | --- |
| `=> ` | Menjalankan kode JavaScript (async, bisa pakai `return`). |
| `> ` | Evaluasi satu ekspresi JavaScript dan menampilkan hasilnya. |
| `$ ` | Menjalankan perintah shell. |

Pastikan ada spasi setelah simbolnya. Fitur ini sangat kuat, jadi **jangan pernah** menjadikan orang yang tidak kamu percaya sebagai owner.

## Struktur Project

```
├── index.js            Entry point: jalankan supervisor, lalu muat src/bot.js
├── Hanz.js             Logika command (switch-case) dan daftar menu
├── src/
│   ├── bot.js          Koneksi Baileys dan event handler (koneksi, pesan, grup)
│   ├── config.js       Prefix, pesan standar, welcome, dan anti-spam
│   ├── setting.json    Konfigurasi utama (diabaikan git)
│   └── media/          Aset media (gambar menu)
├── lib/
│   ├── supervisor.js   Menjalankan bot sebagai child process, menangani Ctrl+C dan restart
│   ├── reload.js       Hot reload modul ESM
│   ├── terminal.js     Filter log Baileys dan indikator status terminal
│   ├── state.js        Setting, database, serta cache pesan dan grup
│   ├── logger.js       Logging, banner, penanganan sinyal dan error
│   ├── session.js      Helper sesi login, alasan disconnect, info prefix
│   ├── messages.js     Penyaringan pesan duplikat/basi dan log pesan masuk
│   ├── socket.js       Helper socket (kirim media, pesan interaktif, dll.)
│   ├── myfunc.js       Serializer pesan dan fungsi utilitas
│   ├── db.js           Database JSON untuk data user dan grup
│   ├── menu.js         Pembuat teks menu dari daftar MENU di Hanz.js
│   ├── antidelete.js   Pemulih pesan yang dihapus
│   ├── exif.js         Konversi media dan pembuat stiker via ffmpeg
│   └── color.js        Pewarnaan teks terminal
└── database/           Dibuat otomatis saat bot jalan
    ├── session/        Sesi login WhatsApp
    ├── users.json      Data user (banned, afk)
    ├── groups.json     Konfigurasi dan data tiap grup
    └── owner.json      Owner tambahan dari command addowner
```

Pembagian tugasnya sederhana: `src/bot.js` mengurus koneksi, `Hanz.js` mengurus semua command, dan `lib/` berisi utilitas yang dipakai bersama.

## Menjalankan Bot

### Node.js biasa

```bash
npm start
```

Bot jalan sebagai child process di bawah supervisor. `Ctrl+C` menghentikan bot dengan rapi, dan command `restart` otomatis menyalakan ulang prosesnya. Kalau tidak butuh supervisor, jalankan dengan `NO_SUPERVISOR=1`.

### PM2

```bash
pm2 start index.js --name waskita
pm2 save
```

Di bawah PM2, supervisor internal dilewati dan proses restart sepenuhnya diurus PM2.

### Cara kerja `restart`

Saat command `restart` dipakai, bot menulis penanda ke `database/.restart.json` lalu keluar dengan kode `42`. Supervisor (atau PM2) menyalakan ulang bot, dan bot mengirim pesan konfirmasi ke chat tempat command tadi dijalankan.

## Menambah Command

Tambahkan blok `case` baru di dalam `switch (command)` pada `Hanz.js`:

```js
case 'halo': {
    if (!m.isGroup) return reply(mess.group)   // opsional: hanya di grup
    if (!isAdmins) return reply(mess.admin)    // opsional: hanya admin grup
    reply(`Halo juga, ${pushname}!`)
}
break
```

Supaya command muncul di menu, daftarkan namanya di objek `MENU` di bagian atas `Hanz.js`. Menu kategori dan `allmenu` akan ikut diperbarui otomatis.

## Panduan Developer

Variabel berikut tersedia di setiap `case`.

**Properti pesan (`m`)**

| Properti | Isi |
| --- | --- |
| `m.chat` | JID chat tujuan (grup atau pribadi). |
| `m.sender`, `m.senderAlt` | JID pengirim dan varian alternatifnya (LID atau nomor). |
| `m.isGroup`, `m.fromMe` | Apakah dari grup, dan apakah dikirim oleh bot sendiri. |
| `m.pushName` | Nama tampilan pengirim. |
| `m.body`, `m.text` | Isi teks pesan. |
| `m.mentionedJid` | Daftar JID yang di-mention. |
| `m.quoted` | Pesan yang di-reply (`null` kalau tidak ada). |
| `m.reply(text)` | Balas cepat dengan mengutip pesan. |

**Hasil parsing command**

| Variabel | Isi |
| --- | --- |
| `prefix` | Prefix yang terdeteksi (`''` kalau tanpa prefix). |
| `command` | Nama command, huruf kecil, tanpa prefix. |
| `args` | Array argumen setelah command. |
| `text` | Semua argumen digabung jadi satu string. |

**Helper**

| Helper | Fungsi |
| --- | --- |
| `reply(teks)` | Balas pesan dengan mengutip pesan asal. |
| `replyMention(teks, jids)` | Balas sekaligus mention. |
| `getTarget()`, `getTargets()` | Ambil target dari mention, reply, atau nomor. |
| `db.user(id)`, `db.group(id)` | Ambil (atau buat) data user dan grup. |
| `db.saveUsers()`, `db.saveGroups()` | Simpan perubahan ke database. |

Flag yang juga tersedia: `isOwner`, `isAdmins`, `isBotAdmins`, `groupMetadata`, dan `participants`.

## Catatan Penting

- **Risiko akun.** Baileys memakai protokol WhatsApp Web yang tidak resmi. Pakai nomor cadangan, dan hindari kirim pesan massal supaya risiko dibatasi atau diblokir lebih kecil.
- **Keamanan data.** `src/setting.json`, folder sesi, dan file JSON di `database/` sudah masuk `.gitignore`. Jangan pernah membagikan folder sesi, karena siapa pun yang memilikinya bisa mengakses akun bot.
- **Hot reload.** Perubahan di `Hanz.js` dan `src/config.js` langsung berlaku tanpa restart. Karena sifat ESM, versi modul lama tetap tertahan di memori sampai proses di-restart. Kalau kamu mengubah `index.js`, `src/bot.js`, atau isi `lib/`, restart manual dulu.
- **Stiker.** Video untuk stiker maksimal 10 detik, dan ada batas proses bersamaan serta cooldown supaya bot tidak kewalahan. Konversi stiker animasi ke gambar (`toimg`) belum didukung.

## Kontribusi

Bug report, saran, dan pull request sangat diterima. Tolong jaga supaya perubahan tetap sejalan dengan tujuan project ini: ringan, bersih, mudah dibaca, dan hemat dependensi.

## Kredit

- [Baileys](https://github.com/WhiskeySockets/Baileys) oleh WhiskeySockets sebagai library utama.
- Dikembangkan dari basis struktur milik Haris S, dengan apresiasi untuk Wong Hore Team dan Pancuran Group.
- Semua kontributor dan pengguna yang sudah memberi masukan dan dukungan.