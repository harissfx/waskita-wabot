import chalk from 'chalk'
import figlet from 'figlet'
import readline from 'node:readline'
import moment from 'moment-timezone'
import { setting } from './state.js'

const EVENT_THEME = {
    ok:   { bar: chalk.green,  badge: chalk.bgGreen.black.bold,  text: chalk.green },
    info: { bar: chalk.gray,   badge: chalk.bgWhite.black.bold,  text: chalk.white },
    warn: { bar: chalk.yellow, badge: chalk.bgYellow.black.bold, text: chalk.yellow },
    err:  { bar: chalk.red,    badge: chalk.bgRed.white.bold,    text: chalk.red },
}

function logEvent(kind, text, level = 'info', print = true) {
    const stamp = moment().tz(setting.timezone).format('YYYY-MM-DD HH:mm:ss')
    if (!print) return
    const t = EVENT_THEME[level] || EVENT_THEME.info
    console.log(
        t.bar('▎') + ' ' + t.badge(` ${kind} `) + '  ' + chalk.gray(stamp.slice(11)) + '  ' + t.text(text) + '\n'
    )
}

const ask = (text) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        rl.question(text, (answer) => { rl.close(); resolve(answer) })
    })

if (!global.__hanzProcHandlers) {
    global.__hanzProcHandlers = true

    process.on('uncaughtException', (err) => {
        console.error(chalk.red('[Error Uncaught]:'), err?.stack || err)
        logEvent('SISTEM', `Error tidak tertangkap: ${err?.message || err}`, 'err', false)
    })
    process.on('unhandledRejection', (reason) => {
        console.error(chalk.red('[Error Rejection]:'), reason?.stack || reason)
        logEvent('SISTEM', `Promise ditolak: ${reason?.message || reason}`, 'err', false)
    })

    let stopping = false
    for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
        process.on(sig, () => {
            stopping = true
            logEvent('SISTEM', `Proses menerima ${sig}, bot dihentikan`, 'warn')
            process.exit(code)
        })
    }
    process.on('exit', (code) => {
        try { if (process.stdout.isTTY) process.stdout.write('\x1b[?25h') } catch {}
        if (!stopping) logEvent('SISTEM', `Proses berakhir (exit code ${code})`, code ? 'err' : 'info')
    })
}

function printBanner(hasSession = false) {
    console.log(
        chalk.cyan(
            figlet.textSync("Hanz Ofc", {
                font: 'Standard',
                horizontalLayout: 'default',
                verticalLayout: 'default',
                width: 80,
                whitespaceBreak: false,
            })
        )
    )
    console.log(chalk.cyan('================================================='))
    console.log(chalk.cyan(' • Powered By Haris Sync'))
    console.log(chalk.cyan(' • Thanks To Wong Hore Team & Pancuran Group'))
    console.log(chalk.cyan(' • Info Script: https://github.com/harissfx/waskita-wabot'))
    console.log(chalk.cyan('================================================='))
    if (hasSession) {
        console.log(chalk.yellow('INFO:'), chalk.hex('#39FF14')('Session ditemukan, menghubungkan ulang...\n'))
    } else {
        console.log(chalk.yellow('INFO:'), chalk.hex('#39FF14')('Jika code pairing tidak muncul tekan enter 1-2x lagi\n'))
    }
}

export { logEvent, ask, printBanner }