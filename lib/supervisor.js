import { spawn } from 'node:child_process'

const RESTART_CODE = 42

export default function supervise(entry) {
    if (process.env.HANZ_WORKER || process.env.pm_id || process.env.NO_SUPERVISOR) return false

    let child = null
    let quitting = false
    let hits = 0

    const run = () => {
        child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
            stdio: 'inherit',
            env: { ...process.env, HANZ_WORKER: '1' },
        })
        child.on('exit', (code, signal) => {
            child = null
            if (!quitting && code === RESTART_CODE) return run()
            process.exit(code ?? (signal ? 1 : 0))
        })
    }

    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.on(sig, () => {
            quitting = true
            if (!child) return process.exit(0)
            child.kill(++hits > 1 ? 'SIGKILL' : sig)
            if (hits === 1) setTimeout(() => child && child.kill('SIGKILL'), 5000).unref()
        })
    }

    run()
    return true
}