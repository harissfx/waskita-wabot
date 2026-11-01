import path from 'node:path'
import { loadJSON, saveJSON } from './myfunc.js'

const dbDir = path.join(import.meta.dirname, '..', 'database')

const DEFAULTS = {
    users: { banned: false, afk: null },
    groups: {
        welcome: false, antilink: false, antidelete: false, antitoxic: false, badwords: [],
        welcomeText: null, goodbyeText: null, warns: {}, muted: [],
    },
}

function makeStore(name) {
    const file = path.join(dbDir, `${name}.json`)
    const data = loadJSON(file, {})

    return {
        get(id) {
            if (!data[id]) data[id] = structuredClone(DEFAULTS[name])
            else {
                for (const [k, v] of Object.entries(DEFAULTS[name])) {
                    if (!(k in data[id])) data[id][k] = structuredClone(v)
                }
            }
            return data[id]
        },
        has(id) {
            return Boolean(data[id])
        },
        delete(id) {
            delete data[id]
            this.save()
        },
        all() {
            return data
        },
        save() {
            saveJSON(file, data)
        },
    }
}

export const users = makeStore('users')
export const groups = makeStore('groups')