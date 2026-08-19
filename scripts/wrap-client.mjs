import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const body = await readFile(join(root, 'lib', '.client-build', 'client.cjs'), 'utf8')
const source = body.replace(/\n\/\/#[#] sourceMappingURL=.*$/u, '')
const id = JSON.stringify(packageJson.name)

const wrapped = `window.__ModuleLoader__.load({ id: ${id}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${source}\nreturn module.exports; } });\n`
await writeFile(join(root, 'lib', 'client.js'), wrapped)
