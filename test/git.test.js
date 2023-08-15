const test = require('brittle')
const fs = require('fs')
const path = require('path')

const home = require('../src/home.js')

const git = require('../src/git.js')

test('git - lsPromise', async t => {
  const res = await git.lsPromise('./')

  t.ok(res)
  t.ok(res.HEAD)
  t.is(Buffer.from(res.HEAD, 'hex').length, 20)
  for (const key in res) {
    if (key === 'HEAD') continue

    t.ok(key.startsWith('refs/'))
    t.is(Buffer.from(res[key], 'hex').length, 20)
  }
})

test('git - uploadPack (wo have)', async t => {
  t.plan(3)
  const { HEAD } = await git.lsPromise('./')
  t.ok(HEAD)

  const res = git.uploadPack('./', HEAD)
  res.on('exit', (code) => t.ok(code === 0))
  res.on('ready', () => {
    const stream = fs.createWriteStream('/dev/null')
    res.stdout.pipe(stream)
    stream.on('close', () => t.pass())
  })
})

test('git - uploadPack (w have)', { skip: true }, async t => {
  t.plan(3)
  const SECOND_COMMIT = ''
  const { HEAD } = await git.lsPromise('./')
  t.ok(HEAD)

  const res = git.uploadPack('./', HEAD, SECOND_COMMIT)

  res.on('exit', (code) => t.ok(code === 0))
  res.on('ready', () => {
    const stream = fs.createWriteStream('/dev/null')
    res.stdout.pipe(stream)
    stream.on('close', () => t.pass())
  })
})

test('git - createBareRepo', async t => {
  t.absent(fs.existsSync(path.join(home.APP_HOME, 'test-git', 'code')))
  home.createAppFolder('test-git')

  t.absent(fs.existsSync(path.join(home.APP_HOME, 'test-git', 'code', 'HEAD')))
  await git.createBareRepo('test-git')

  t.ok(fs.existsSync(path.join(home.APP_HOME, 'test-git', 'code', 'HEAD')))

  t.teardown(() => {
    fs.rmSync(path.join(home.APP_HOME, 'test-git'), { recursive: true })
  })
})
