import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectNotePreview } from '../src/notePreview.ts'

const formats = [
  ['prose with punctuation', 'Закрыть задачу;', undefined],
  ['short assignment', 'x = 1', undefined],
  ['ordinary labels', 'Тема: встреча\nМесто: офис', undefined],
  ['English labels without stronger YAML evidence', 'Title: Status\nAuthor: Alex', undefined],
  ['scalar JSON in prose', 'true', undefined],
  ['bracketed prose', '[true story]', undefined],
  ['English word resembling a PowerShell cmdlet', 'Get-together Friday', undefined],
  ['timestamp with embedded JSON', '2026-11-22 INFO {"ok":true}', undefined],
  ['text with literal braces', 'Пример {x}; описание', undefined],
  ['standalone heading', '# Установка', 'markdown'],
  ['markdown with list and fenced code', '# Установка\n\n- Пункт\n\n```py\nprint("ok")\n```', 'markdown'],
  ['markdown with unfinished fence', 'Пример\n\n```js\nconst value =', 'markdown'],
  ['inline markdown at end of line', 'Один **пример**', 'markdown'],
  ['single emphasis', 'Один _пример_', 'markdown'],
  ['ordinary underscores', 'file_name_here', undefined],
  ['escaped Markdown link', '\\[текст](https://example.org)', undefined],
  ['underlined heading', 'Заголовок\n=========', 'markdown'],
  ['markdown link after indentation', '  ["имя"](https://example.org)', 'markdown'],
  ['JSON array with signed number', '[-2,3]', 'json'],
  ['JSON with comments', '// комментарий\n{"flag":true,}', 'jsonc'],
  ['Dockerfile', 'FROM alpine\nRUN echo ok', 'docker'],
  ['dotenv with comment and empty value', '# local\nPORT=3000\nTOKEN=', 'dotenv'],
  ['YAML with comments and nesting', '# server\n\nserver:\n  host: localhost\n  port: 8080', 'yaml'],
  ['YAML with flat keys', 'port: 8080\nhost: localhost', 'yaml'],
  ['INI or TOML section', '[server]\nport = 8080', 'code'],
  ['TOML table array', '[[servers]]\nport = 8080', 'toml'],
  ['Python with leading indentation', '    def f():\r\n\tpass  \r\n', 'python'],
  ['Python with header comment', '# Setup\n\ndef load():\n    return 1', 'python'],
  ['SQL with newlines', 'SELECT name\nFROM users', 'sql'],
  ['Go package and function', 'package main\n\nfunc main() {}', 'go'],
  ['PowerShell command', 'Get-ChildItem -Name', 'powershell'],
  ['TypeScript annotation', 'const port: number = 42', 'typescript'],
  ['unambiguous JavaScript call', 'console.log("ok");', 'javascript'],
]

for (const [name, source, expected] of formats) {
  test(name, () => {
    const preview = detectNotePreview(source)
    assert.equal(preview?.language ?? preview?.shape, expected)
  })
}

test('uses the first part of a fence language hint and respects fence length and indentation', () => {
  const preview = detectNotePreview('\uFEFF  ````C++ linenos\r\n    f();\r\n  ```\r\n  ````')
  assert.deepEqual(preview, { shape: 'code', text: '  f();\n```', language: 'cpp' })
})

test('keeps source in an unclosed fence even when the language is unknown', () => {
  assert.deepEqual(detectNotePreview('~~~custom\n  example'), { shape: 'code', text: '  example', language: undefined })
})

test('formats JSON without losing duplicate keys, precision, escapes or lexical form', () => {
  const source = '{"id":9007199254740993,"id":1e+01,"text":"\\u263a"}'
  const preview = detectNotePreview(source)
  assert.equal(preview.language, 'json')
  assert.equal(preview.text.replace(/\s/g, ''), source)
  assert.match(preview.text, /\n  "id": 9007199254740993,\n/)
})

test('keeps the text and reports the line of malformed JSON', () => {
  const source = '{\n  "host": "localhost",\n  "port": }'
  assert.deepEqual(detectNotePreview(source), { shape: 'code', text: source, language: 'json', errorLine: 3 })
})

test('reports a dangling comma in JSON without comments', () => {
  const preview = detectNotePreview('{"port":8000,}')
  assert.equal(preview.language, 'json')
  assert.equal(preview.errorLine, 1)
})

test('keeps a malformed JSONC source and its comments visible', () => {
  const source = '// preserved\n {"port":'
  assert.deepEqual(detectNotePreview(source), { shape: 'code', text: source, language: 'jsonc', errorLine: 2 })
})

test('validates incomplete JSON even with an explicit fence language', () => {
  assert.deepEqual(detectNotePreview('```json\n{ broken\n```'), {
    shape: 'code', text: '{ broken', language: 'json', errorLine: 1,
  })
})

test('nested JSON exceeding the parser capacity keeps a source preview', () => {
  const source = '['.repeat(4800) + '0' + ']'.repeat(4800)
  const preview = detectNotePreview(source)
  assert.equal(preview.language, 'json')
  assert.equal(preview.text.replace(/\s/g, ''), source)
})

test('deeply nested valid JSON keeps its compact source', () => {
  const source = '['.repeat(80) + '0' + ']'.repeat(80)
  assert.equal(detectNotePreview(source).text, source)
})
