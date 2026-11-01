import { fileURLToPath } from 'node:url'
import supervise from './lib/supervisor.js'

/**
 * -----------------------------------------------------------------------------
 * Powered By Hanz Ofc
 * Created base v1.0.0 = 01.11.2026
 * 
 * Thank To:
 *   | Wong Hore Team
 *   | Pancuran Group
 * -----------------------------------------------------------------------------
 * @license MIT (Lihat file LICENSE di root project)
 */

if (!supervise(fileURLToPath(import.meta.url))) await import('./src/bot.js')