import { describe, expect, it } from 'vitest'
import { decodeBingUrl, parseBingResults } from '../src/search/bing.js'

const target = 'https://example.com/article?id=1'
const encoded = `a1${Buffer.from(target).toString('base64url')}`

const html = `
<ul>
  <li class="b_algo">
    <h2><a href="https://www.bing.com/ck/a?u=${encoded}">Example title</a></h2>
    <div class="b_caption"><p>Example snippet with <strong>markup</strong>.</p></div>
  </li>
</ul>`

describe('Bing parser', () => {
  it('decodes a1 base64url redirect links', () => {
    expect(decodeBingUrl(`https://www.bing.com/ck/a?u=${encoded}`)).toBe(target)
  })

  it('projects only title, URL and snippet from result entries', () => {
    expect(parseBingResults(html)).toEqual([{ title: 'Example title', url: target, snippet: 'Example snippet with markup.' }])
  })
})
