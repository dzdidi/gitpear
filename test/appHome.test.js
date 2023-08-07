const { test } = require('brittle')
const fs = require('fs')
const path = require('path')

const appHome = require('../src/appHome')

test('getAppHome', t => {
  t.ok(appHome.APP_HOME)
})

test('createAppFolder, share, is shared, unshare, isInitialized, list, getCodePath', t => {
  appHome.createAppFolder('appHome-test')

  t.ok(fs.existsSync(path.join(appHome.APP_HOME, 'appHome-test', 'code')))

  t.absent(appHome.isShared('appHome-test'))
  t.absent(fs.existsSync(path.join(appHome.APP_HOME, 'appHome-test', '.git-daemon-export-ok')))

  appHome.shareAppFolder('appHome-test')

  t.ok(appHome.isShared('appHome-test'))
  t.ok(fs.existsSync(path.join(appHome.APP_HOME, 'appHome-test', '.git-daemon-export-ok')))

  appHome.unshareAppFolder('appHome-test')

  t.absent(appHome.isShared('appHome-test'))
  t.absent(fs.existsSync(path.join(appHome.APP_HOME, 'appHome-test', '.git-daemon-export-ok')))

  t.absent(appHome.isInitialized('appHome-test'))
  t.ok(appHome.isInitialized('foo'))

  t.alike(new Set(appHome.list()), new Set(['foo', 'bar', 'zar', 'appHome-test']))
  t.alike(new Set(appHome.list(true)), new Set(['foo', 'bar', 'zar']))

  t.alike(path.resolve(appHome.getCodePath('appHome-test')), path.resolve(path.join(appHome.APP_HOME, 'appHome-test', 'code')))

  t.teardown(() => {
    fs.rmdirSync(path.join(appHome.APP_HOME, 'appHome-test', 'code'), { recursive: true })
  })
})

test('readPk, getKeyPair', t => {
  t.ok(appHome.readPk())
  t.ok(appHome.getKeyPair())
})

test('getOutStream, getErrStream', t => {
  t.absent(fs.existsSync(path.join(appHome.APP_HOME, 'out.log')))
  t.ok(appHome.getOutStream())
  t.ok(fs.existsSync(path.join(appHome.APP_HOME, 'out.log')))

  t.absent(fs.existsSync(path.join(appHome.APP_HOME, 'err.log')))
  t.ok(appHome.getErrStream())
  t.ok(fs.existsSync(path.join(appHome.APP_HOME, 'err.log')))

  t.teardown(() => {
    fs.unlinkSync(path.join(appHome.APP_HOME, 'out.log'))
    fs.unlinkSync(path.join(appHome.APP_HOME, 'err.log'))
  })
})

test('getDaemonPid, removeDaemonPid', t => {
  t.absent(appHome.getDaemonPid())
  appHome.storeDaemonPid(123)
  t.alike(appHome.getDaemonPid(), 123)
  appHome.removeDaemonPid()
  t.absent(appHome.getDaemonPid())
})
