const homedir = require('os').homedir()
const crypto = require('hypercore-crypto')
const chokidar = require('chokidar')

const fs = require('fs')

const APP_HOME = process.env.GIT_PEAR || `${homedir}/.gitpear`

function createAppFolder (name) {
  fs.mkdirSync(`${APP_HOME}/${name}`, { recursive: true })
}

function shareAppFolder (name) {
  fs.openSync(`${APP_HOME}/${name}/.git-daemon-export-ok`, 'w')
}

function getACLFilePath (name) {
  if (!fs.existsSync(`${APP_HOME}/${name}/.git-daemon-export-ok`)) throw new Error('Repo is not shared')
  return `${APP_HOME}/${name}/.git-daemon-export-ok`
}

function unshareAppFolder (name) {
  fs.unlinkSync(`${APP_HOME}/${name}/.git-daemon-export-ok`)
}

function isInitialized (name) {
  return fs.existsSync(`${APP_HOME}/${name}/HEAD`)
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
  return `${APP_HOME}/${name}`
}

function readPk () {
  try {
    const seed = fs.readFileSync(`${APP_HOME}/.seed`)
    const keyPair = crypto.keyPair(seed)
    return keyPair.publicKey.toString('hex')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e

    console.error('Seed will be generated after first start of daemon')
  }
}

function getKeyPair () {
  let seed
  try {
    seed = fs.readFileSync(`${APP_HOME}/.seed`)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e

    seed = crypto.randomBytes(32)
    fs.writeFileSync(`${APP_HOME}/.seed`, seed)
  }
  return crypto.keyPair(seed)
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

function isDaemonRunning () {
  return fs.existsSync(`${APP_HOME}/.daemon.pid`)
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
  getKeyPair,
  watch,
  getCodePath,
  APP_HOME,
  getOutStream,
  getErrStream,
  storeDaemonPid,
  getDaemonPid,
  isDaemonRunning,
  removeDaemonPid,
  getACLFilePath
}
