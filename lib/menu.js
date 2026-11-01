export const renderCategory = (menu, key, prefix = '') => {
    const cat = menu[key]
    if (!cat) return ''
    const rows = cat.cmds.map((c) => `│⭔ ${prefix}${c}`).join('\n')
    return `╭──❍『${cat.title}』\n│\n${rows}\n│\n╰────❍`
}

export const renderAll = (menu, prefix = '', pushname = '') => {
    const body = Object.values(menu)
        .map(({ title, cmds }) => `┣╌ ⟪ *${title}* ⟫\n${cmds.map((c) => `┃▷${prefix}${c}`).join('\n')}\n┃`)
        .join('\n')
    return `┏──────────────⭓\n┆ Halo ${pushname}\n┢╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╼\n${body}\n╰──────────────⊱`
}