import chalk from 'chalk'

const color = (text, c) => {
    try { return c ? chalk.keyword(c)(text) : chalk.green(text) } catch { return text }
}

export { color }
