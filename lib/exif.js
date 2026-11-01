import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { tmpdir } from 'node:os'
import ff from 'fluent-ffmpeg'
import webp from 'node-webpmux'

const tmp = (ext) => path.join(tmpdir(), `${crypto.randomBytes(8).toString('hex')}.${ext}`)
const rm = (...files) => files.forEach((f) => { try { fs.unlinkSync(f) } catch {} })

const STICKER_FILTER =
    'scale=320:320:force_original_aspect_ratio=decrease,fps=15,' +
    'pad=320:320:-1:-1:color=white@0.0,split[a][b];' +
    '[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse'

const FFMPEG_TIMEOUT_MS = 60_000

const run = (input, output, options, format) =>
    new Promise((resolve, reject) => {
        let done = false
        const finish = (fn, arg) => { if (done) return; done = true; clearTimeout(timer); fn(arg) }
        const cmd = ff(input)
            .on('error', (err) => finish(reject, err))
            .on('end', () => finish(resolve))
            .addOutputOptions(options)
        const timer = setTimeout(() => {
            try { cmd.kill('SIGKILL') } catch {}
            finish(reject, new Error('ffmpeg timeout'))
        }, FFMPEG_TIMEOUT_MS)
        if (format) cmd.toFormat(format)
        cmd.save(output)
    })

async function convert(media, inExt, extraOptions = []) {
    const input = tmp(inExt)
    const output = tmp('webp')
    fs.writeFileSync(input, media)
    try {
        await run(input, output, ['-vcodec', 'libwebp', '-vf', STICKER_FILTER, ...extraOptions], 'webp')
        return fs.readFileSync(output)
    } finally {
        rm(input, output)
    }
}

const imageToWebp = (media) => convert(media, 'jpg')

const videoToWebp = (media) =>
    convert(media, 'mp4', ['-loop', '0', '-ss', '00:00:00', '-t', '00:00:08', '-preset', 'default', '-an', '-vsync', '0'])

async function addExif(webpBuffer, { packname = '', author = '', categories = [''] } = {}) {
    {
        const img = new webp.Image()
        await img.load(webpBuffer)
        const json = {
            'sticker-pack-id': crypto.randomBytes(16).toString('hex'),
            'sticker-pack-name': packname,
            'sticker-pack-publisher': author,
            emojis: categories,
        }
        const head = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const body = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([head, body])
        exif.writeUIntLE(body.length, 14, 4)
        img.exif = exif
        return await img.save(null)
    }
}

const writeExifImg = async (media, meta) => addExif(await imageToWebp(media), meta)
const writeExifVid = async (media, meta) => addExif(await videoToWebp(media), meta)

async function webpToPng(media) {
    const input = tmp('webp')
    const output = tmp('png')
    fs.writeFileSync(input, media)
    try {
        await run(input, output, ['-frames:v', '1'])
        return fs.readFileSync(output)
    } finally {
        rm(input, output)
    }
}

async function convertAudio(media, kind) {
    const isVn = kind === 'vn'
    const input = tmp('bin')
    const output = tmp(isVn ? 'ogg' : 'mp3')
    fs.writeFileSync(input, media)
    try {
        const options = isVn
            ? ['-t', '600', '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1']
            : ['-t', '600', '-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100']
        await run(input, output, options, isVn ? 'ogg' : 'mp3')
        return fs.readFileSync(output)
    } finally {
        rm(input, output)
    }
}

export { imageToWebp, videoToWebp, writeExifImg, writeExifVid, webpToPng, convertAudio, addExif }