import path from 'node:path'
import { loadJSON, saveJSON } from './myfunc.js'
import { users, groups } from './db.js'

const settingFile = path.join(import.meta.dirname, '..', 'src', 'setting.json')
const setting = {
    botName: 'Base Bot', ownerName: 'Owner', owner: [], packname: 'Base Bot', author: 'Base Bot',
    prefix: '.', sessionName: 'session', pairingNumber: '', usePairingCode: true, public: true,
    timezone: 'Asia/Jakarta',
    ...loadJSON(settingFile, {}),
}

const ownerFile = path.join(import.meta.dirname, '..', 'database', 'owner.json')

const db = {
    user: (id) => users.get(id),
    hasUser: (id) => users.has(id),
    group: (id) => groups.get(id),
    saveUsers: () => users.save(),
    saveGroups: () => groups.save(),
    owner: loadJSON(ownerFile, []),
    saveOwner: () => saveJSON(ownerFile, db.owner),
}

const STORE_MAX = 3000
const store = {
    messages: new Map(),
    save(msg) {
        if (!msg?.key?.id || !msg.message) return
        this.messages.set(`${msg.key.remoteJid}|${msg.key.id}`, msg)
        if (this.messages.size > STORE_MAX) this.messages.delete(this.messages.keys().next().value)
    },
    load(jid, id) {
        return this.messages.get(`${jid}|${id}`)
    },
}

const botDeleted = new Set()
const markDeleted = (id) => {
    if (!id) return
    if (botDeleted.size > 500) botDeleted.delete(botDeleted.values().next().value)
    botDeleted.add(id)
}

const groupCache = new Map()
const GROUP_TTL = 5 * 60 * 1000

const sessionDir = path.join(import.meta.dirname, '..', 'database', setting.sessionName)

export { setting, settingFile, db, store, groupCache, GROUP_TTL, sessionDir, botDeleted, markDeleted }