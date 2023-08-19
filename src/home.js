const homedir = require('os').homedir()

const bip39 = require('bip39')
const bip32 = require('bip32')
const ecc = require('tiny-secp256k1')

const crypto = require('hypercore-crypto')
const chokidar = require('chokidar')

const fs = require('fs')

const APP_HOME = process.env.GIT_PEAR || `${homedir}/.gitpear`

function mnemonicExists () {
  return fs.existsSync(`${APP_HOME}/.mnemonic`)
}

function createAppFolder (name) {
  fs.mkdirSync(`${APP_HOME}/${name}/code`, { recursive: true })
}

function shareAppFolder (name) {
  fs.openSync(`${APP_HOME}/${name}/.git-daemon-export-ok`, 'w')
}

function unshareAppFolder (name) {
  fs.unlinkSync(`${APP_HOME}/${name}/.git-daemon-export-ok`)
}

function isInitialized (name) {
  return fs.existsSync(`${APP_HOME}/${name}/code/HEAD`)
}

function isShared (name) {
  return fs.existsSync(`${APP_HOME}/${name}/.git-daemon-export-ok`)
}

function list (sharedOnly) {
  const repos = fs.readdirSync(APP_HOME)
  if (!sharedOnly) return repos.filter(r => !r.startsWith('.') && isInitialized(r))

  return repos.filter(repo => isShared(repo))
}

function getCodePath (name) {
  return `${APP_HOME}/${name}/code`
}

function readPk () {
  const keyPair = getKeyPair()
  return keyPair.publicKey.toString('hex')
}

function getKeychainFromMnemonic (mnemonic) {
  const PRIMARY_KEY_DERIVATION_PATH = 'm/777' // FIXME
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = bip32.BIP32Factory(ecc).fromSeed(seed)
  const primaryKey = root.derivePath(PRIMARY_KEY_DERIVATION_PATH).privateKey

  return crypto.keyPair(primaryKey)
}

function getKeyPair () {
  let mnemonic
  try {
    mnemonic = fs.readFileSync(`${APP_HOME}/.mnemonic`, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e

    mnemonic = bip39.generateMnemonic()
    fs.writeFileSync(`${APP_HOME}/.mnemonic`, mnemonic)
  }

  return getKeychainFromMnemonic(mnemonic)
}

function watch (cb) {
  chokidar.watch(APP_HOME).on('all', (event, path) => {
    if (!['add', 'change', 'unlink'].includes(event)) return

    return cb(event, path)
  })
}

function getOutStream () {
  return fs.openSync(`${APP_HOME}/out.log`, 'a')
}

function getErrStream () {
  return fs.openSync(`${APP_HOME}/err.log`, 'a')
}

function storeDaemonPid (pid) {
  fs.writeFileSync(`${APP_HOME}/.daemon.pid`, Buffer.from(pid.toString()))
}

function getDaemonPid () {
  try {
    return parseInt(fs.readFileSync(`${APP_HOME}/.daemon.pid`).toString())
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}

function removeDaemonPid () {
  try {
    fs.unlinkSync(`${APP_HOME}/.daemon.pid`)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
}

module.exports = {
  createAppFolder,
  shareAppFolder,
  unshareAppFolder,
  isInitialized,
  isShared,
  list,
  readPk,
  watch,
  getCodePath,
  APP_HOME,
  getOutStream,
  getErrStream,
  storeDaemonPid,
  getDaemonPid,
  removeDaemonPid,
  getKeyPair,
  mnemonicExists
}
