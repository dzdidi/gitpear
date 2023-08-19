const { test } = require('brittle')
const fs = require('fs')
const path = require('path')

const home = require('../src/home')

test('getAppHome', t => {
  t.ok(home.APP_HOME)
})

test('mnemonic exists', t => {
  t.ok(home.mnemonicExists())
  fs.renameSync(`${home.APP_HOME}/.mnemonic`, `${home.APP_HOME}/.mnemonic.bak`)

  t.absent(home.mnemonicExists())
  fs.renameSync(`${home.APP_HOME}/.mnemonic.bak`, `${home.APP_HOME}/.mnemonic`)
})

test('createAppFolder, share, is shared, unshare, isInitialized, list, getCodePath', t => {
  home.createAppFolder('test')

  t.ok(fs.existsSync(path.join(home.APP_HOME, 'test', 'code')))

  t.absent(home.isShared('test'))
  t.absent(fs.existsSync(path.join(home.APP_HOME, 'test', '.git-daemon-export-ok')))

  home.shareAppFolder('test')

  t.ok(home.isShared('test'))
  t.ok(fs.existsSync(path.join(home.APP_HOME, 'test', '.git-daemon-export-ok')))

  home.unshareAppFolder('test')

  t.absent(home.isShared('test'))
  t.absent(fs.existsSync(path.join(home.APP_HOME, 'test', '.git-daemon-export-ok')))

  t.absent(home.isInitialized('test'))
  t.ok(home.isInitialized('foo'))

  t.alike(new Set(home.list()), new Set(['foo', 'bar', 'zar']))
  t.alike(new Set(home.list(true)), new Set(['foo', 'bar']))

  t.alike(path.resolve(home.getCodePath('test')), path.resolve(path.join(home.APP_HOME, 'test', 'code')))

  t.teardown(() => {
    fs.rmSync(path.join(home.APP_HOME, 'test', 'code'), { recursive: true })
  })
})

test('readPk, getKeyPair', t => {
  t.ok(home.readPk())
  t.ok(home.getKeyPair())
})

test('getOutStream, getErrStream', t => {
  t.absent(fs.existsSync(path.join(home.APP_HOME, 'out.log')))
  t.ok(home.getOutStream())
  t.ok(fs.existsSync(path.join(home.APP_HOME, 'out.log')))

  t.absent(fs.existsSync(path.join(home.APP_HOME, 'err.log')))
  t.ok(home.getErrStream())
  t.ok(fs.existsSync(path.join(home.APP_HOME, 'err.log')))

  t.teardown(() => {
    fs.unlinkSync(path.join(home.APP_HOME, 'out.log'))
    fs.unlinkSync(path.join(home.APP_HOME, 'err.log'))
  })
})

test('getDaemonPid, removeDaemonPid', t => {
  t.absent(home.getDaemonPid())
  home.storeDaemonPid(123)
  t.alike(home.getDaemonPid(), 123)
  home.removeDaemonPid()
  t.absent(home.getDaemonPid())
})
