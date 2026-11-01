import {
    downloadContentFromMessage,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    proto,
} from 'baileys'
import { writeExifImg, writeExifVid } from './exif.js'
import { decodeJid, toBuffer } from './myfunc.js'
import { setting, store, groupCache, GROUP_TTL } from './state.js'

export default function attachHelpers(Hanz) {
    Hanz.public = setting.public !== false
    Hanz.decodeJid = decodeJid
    Hanz.getGroupMeta = async (jid) => {
        const cached = groupCache.get(jid)
        if (cached && Date.now() - cached.time < GROUP_TTL) return cached.data
        const data = await Hanz.groupMetadata(jid)
        groupCache.set(jid, { data, time: Date.now() })
        return data
    }

    /* ── Teks ── */
    Hanz.sendText = (jid, text, quoted, options = {}) =>
        Hanz.sendMessage(jid, { text, ...options }, { quoted })

    Hanz.reply = (jid, text, quoted, options = {}) =>
        Hanz.sendMessage(jid, { text, ...options }, { quoted })

    /* ── Media ── */
    Hanz.sendImage = async (jid, media, caption = '', quoted, options = {}) => {
        const image = await toBuffer(media)
        return Hanz.sendMessage(jid, { image, caption, ...options }, { quoted })
    }

    Hanz.sendVideo = async (jid, media, caption = '', quoted, options = {}) => {
        const video = await toBuffer(media)
        return Hanz.sendMessage(jid, { video, caption, ...options }, { quoted })
    }

    Hanz.sendAudio = async (jid, media, quoted, options = {}) => {
        const audio = await toBuffer(media)
        return Hanz.sendMessage(jid, { audio, mimetype: options.mimetype || 'audio/mpeg', ptt: !!options.ptt, ...options }, { quoted })
    }

    Hanz.sendPtt = async (jid, media, quoted, options = {}) =>
        Hanz.sendAudio(jid, media, quoted, { ...options, ptt: true, mimetype: 'audio/ogg; codecs=opus' })

    Hanz.sendDocument = async (jid, media, options = {}, quoted) => {
        const document = await toBuffer(media)
        return Hanz.sendMessage(jid, {
            document,
            mimetype: options.mimetype || 'application/octet-stream',
            fileName: options.fileName || 'file',
            caption: options.caption || '',
            ...options,
        }, { quoted })
    }

    Hanz.sendGif = async (jid, media, caption = '', quoted, options = {}) => {
        const video = await toBuffer(media)
        return Hanz.sendMessage(jid, { video, gifPlayback: true, caption, ...options }, { quoted })
    }

    /* ── Stiker ── */
    Hanz.sendImageAsSticker = async (jid, media, quoted, options = {}) => {
        const sticker = await writeExifImg(await toBuffer(media), {
            packname: options.packname ?? setting.packname,
            author: options.author ?? setting.author,
        })
        await Hanz.sendMessage(jid, { sticker }, { quoted })
        return sticker
    }

    Hanz.sendVideoAsSticker = async (jid, media, quoted, options = {}) => {
        const sticker = await writeExifVid(await toBuffer(media), {
            packname: options.packname ?? setting.packname,
            author: options.author ?? setting.author,
        })
        await Hanz.sendMessage(jid, { sticker }, { quoted })
        return sticker
    }

    /* ── Kontak ── */
    Hanz.sendContact = (jid, numbers, quoted, displayName) => {
        const name = displayName || setting.ownerName
        const list = (Array.isArray(numbers) ? numbers : [numbers]).map((n) => {
            const num = String(n).replace(/\D/g, '')
            return {
                displayName: name,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nTEL;type=CELL;waid=${num}:+${num}\nEND:VCARD`,
            }
        })
        return Hanz.sendMessage(jid, { contacts: { displayName: name, contacts: list } }, { quoted })
    }

    /* ── Lokasi ── */
    Hanz.sendLocation = (jid, { degreesLatitude, degreesLongitude, name = '', address = '' }, quoted) =>
        Hanz.sendMessage(jid, {
            location: { degreesLatitude, degreesLongitude, name, address },
        }, { quoted })

    Hanz.sendLiveLocation = (jid, { degreesLatitude, degreesLongitude, caption = '' }, quoted) =>
        Hanz.sendMessage(jid, {
            location: {
                degreesLatitude,
                degreesLongitude,
                name: caption,
                address: caption,
            },
        }, { quoted })

    /* ── Lokasi + tombol klasik ── */
    Hanz.sendLocationButtons = async (jid, {
        degreesLatitude = 0, degreesLongitude = 0, name = '', address = '', url,
        jpegThumbnail, text = '', footer = '', buttons = [],
    }, quoted) => {
        const msg = generateWAMessageFromContent(jid, proto.Message.fromObject({
            viewOnceMessage: { message: { buttonsMessage: {
                locationMessage: { degreesLatitude, degreesLongitude, name, address, url, jpegThumbnail},
                contentText: text,
                footerText: footer,
                buttons: buttons.map(b => b.buttonId ? b : {
                    buttonId: b.id, buttonText: { displayText: b.text }, type: 1,
                }),
                headerType: 6,
            } } },
        }), { userJid: decodeJid(Hanz.user.id), quoted })

        await Hanz.relayMessage(jid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [{
                tag: 'biz', attrs: {},
                content: [{
                    tag: 'interactive', attrs: { type: 'native_flow', v: '1' },
                    content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                }],
            }],
        })
        store.save(msg)
        return msg
    }

    /* ── Reaction ── */
    Hanz.sendReact = (jid, emoji, key) =>
        Hanz.sendMessage(jid, { react: { text: emoji, key } })

    /* ── Poll ── */
    Hanz.sendPoll = (jid, name, values, quoted, options = {}) =>
        Hanz.sendMessage(jid, {
            poll: {
                name,
                values,
                selectableCount: options.selectableCount ?? 1,
            },
        }, { quoted })

    Hanz.sendProduct = async (jid, {
        title = '',
        description = '',
        image,
        productId = 'HanzOfc',
        retailerId = 'HanzOfc',
        url = '',
        body = '',
        footer = '',
        priceAmount1000 = 0,
        currencyCode = 'IDR',
        businessOwnerJid,
        salePriceAmount1000,
    } = {}, quoted) => {
        const imgBuf = image ? await toBuffer(image) : null
        if (!imgBuf) throw new Error('sendProduct: image wajib (Buffer / path / URL)')

        const product = {
            productImage: imgBuf,
            productId: String(productId),
            title: String(title || setting.botName),
            description: String(description || ''),
            currencyCode: String(currencyCode || 'IDR'),
            priceAmount1000: Number(priceAmount1000) || 0,
            retailerId: String(retailerId || 'RETAIL'),
            url: url || undefined,
            productImageCount: 1,
        }
        if (salePriceAmount1000 != null) product.salePriceAmount1000 = Number(salePriceAmount1000)

        const ownerJid = businessOwnerJid || decodeJid(Hanz.user.id)
        return Hanz.sendMessage(jid, {
            product,
            businessOwnerJid: ownerJid,
            caption: body || description || '',
            footer: footer || undefined,
        }, { quoted })
    }

    /* ── View once ── */
    Hanz.sendViewOnce = async (jid, media, type = 'image', caption = '', quoted) => {
        const buf = await toBuffer(media)
        if (type === 'video') return Hanz.sendMessage(jid, { video: buf, caption, viewOnce: true }, { quoted })
        return Hanz.sendMessage(jid, { image: buf, caption, viewOnce: true }, { quoted })
    }

    /* ── Download media ── */
    Hanz.downloadMediaMessage = async (message) => {
        const msg = message.msg || message
        const mime = msg.mimetype || ''
        let type = (message.mtype || '').replace(/Message$/i, '') || mime.split('/')[0]
        if (type === 'ptv') type = 'video'
        const stream = await downloadContentFromMessage(msg, type)
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        return Buffer.concat(chunks)
    }

    const sendBaileys = Hanz.sendMessage.bind(Hanz)

    Hanz.sendMessage = async (jid, content = {}, options = {}) => {
        const { buttons, text, caption, footer, title, image, video, document, mimetype, fileName, location } = content
        const contextInfo = (content.contextInfo || options.contextInfo)
            ? { ...(options.contextInfo || {}), ...(content.contextInfo || {}) }
            : undefined
        if (!Array.isArray(buttons) || !buttons.length) {
            return sendBaileys(jid, contextInfo ? { ...content, contextInfo } : content, options)
        }

        const { InteractiveMessage } = proto.Message

        let header = InteractiveMessage.Header.create({ title: title || '', hasMediaAttachment: false })
        if (location) {
            header = InteractiveMessage.Header.create({ title: title || '', hasMediaAttachment: true, locationMessage: location })
        } else if (video) {
            const media = await prepareWAMessageMedia(
                { video: Buffer.isBuffer(video) ? video : { url: video } },
                { upload: Hanz.waUploadToServer }
            )
            header = InteractiveMessage.Header.create({ title: title || '', hasMediaAttachment: true, videoMessage: media.videoMessage })
        } else if (document) {
            const media = await prepareWAMessageMedia(
                { document: Buffer.isBuffer(document) ? document : { url: document }, mimetype, fileName },
                { upload: Hanz.waUploadToServer }
            )
            if (fileName) media.documentMessage.fileName = fileName
            if (mimetype) media.documentMessage.mimetype = mimetype
            header = InteractiveMessage.Header.create({ title: title || '', hasMediaAttachment: true, documentMessage: media.documentMessage })
        } else if (image) {
            const media = await prepareWAMessageMedia(
                { image: Buffer.isBuffer(image) ? image : { url: image } },
                { upload: Hanz.waUploadToServer }
            )
            header = InteractiveMessage.Header.create({ title: title || '', hasMediaAttachment: true, imageMessage: media.imageMessage })
        }

        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage: InteractiveMessage.create({
                        header,
                        body: InteractiveMessage.Body.create({ text: text || caption || '' }),
                        footer: InteractiveMessage.Footer.create({ text: footer || '' }),
                        nativeFlowMessage: InteractiveMessage.NativeFlowMessage.create({ buttons }),
                        ...(contextInfo ? { contextInfo } : {}),
                    }),
                },
            },
        }, { userJid: decodeJid(Hanz.user.id), quoted: content.quoted || options.quoted })

        const additionalNodes = [{
            tag: 'biz',
            attrs: {},
            content: [{
                tag: 'interactive',
                attrs: { type: 'native_flow', v: '1' },
                content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
            }],
        }]
        if (!jid.endsWith('@g.us')) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })

        await Hanz.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes })
        store.save(msg)
        return msg
    }
}