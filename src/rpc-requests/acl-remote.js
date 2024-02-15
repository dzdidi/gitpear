const ProtomuxRPC = require('protomux-rpc')

const Hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')

const home = require('../home')
const auth = require('../auth')

const { printACL, printACLForUser, logBranches } = require('../utils')

async function list (url, name, rpc, opts) {
  const payload = { body: { url, method: 'get-acl' } }
  if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
    payload.header = await auth.getToken(payload.body)
  }
  const repoACLres = await rpc.request('get-acl', Buffer.from(JSON.stringify(payload)))
  const repoACL = JSON.parse(repoACLres.toString())

  opts.branch ? listACLBranch(repoACL) : listACLUser(repoACL, name)
  process.exit(0)
}

function listACLUser (repoACL, u) {
  u ? printACLForUser(repoACL, u) : printACL(repoACL)
}

function listACLBranch (repoACL) {
  logBranches(repoACL)
}

async function add (url, name, rpc, opts) {
  const payload = { body: { url, method: 'add-acl', name } }
  if (opts.branch) payload.body.branch = true

  if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
    payload.header = await auth.getToken(payload.body)
  }
  const repoACLres = await rpc.request('add-acl', Buffer.from(JSON.stringify(payload)))
  const repoACL = JSON.parse(repoACLres.toString())
  opts.branch ? listACLBranch(repoACL) : listACLUser(repoACL, name.split(':')[0])

  process.exit(0)
}

async function del (url, name, rpc, opts) {
  const payload = { body: { url, method: 'del-acl', name } }
  if (opts.branch) payload.body.branch = true

  if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
    payload.header = await auth.getToken(payload.body)
  }
  const repoACLres = await rpc.request('del-acl', Buffer.from(JSON.stringify(payload)))
  const repoACL = JSON.parse(repoACLres.toString())
  opts.branch ? listACLBranch(repoACL) : listACLUser(repoACL, name)

  process.exit(0)
}

async function wrapper (url, name, opts = {}, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  const matches = url.match(/pear:\/\/([a-f0-9]{64})\/(.*)/)

  if (!matches || matches.length < 3) {
    console.error('Invalid URL')
    process.exit(1)
  }

  const targetKey = matches[1]
  const repoName = matches[2]
  console.log('Connecting to:', targetKey)

  const swarmOpts = {}
  if (process.env.GIT_PEAR_AUTH === 'native') {
    swarmOpts.keyPair = home.getKeyPair()
  }
  const swarm = new Hyperswarm(swarmOpts)

  swarm.join(crypto.discoveryKey(Buffer.from(targetKey, 'hex')), { server: false })

  swarm.on('connection', async (socket) => {
    const rpc = new ProtomuxRPC(socket)

    const payload = { body: { url, method: 'get-repos' } }
    if (!process.env.GIT_PEAR_AUTH) {
      console.debug('Retreiving data using un-authenticated access')
    } else {
      console.debug('Retreiving data using authenticated access')
    }
    if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
      payload.header = await auth.getToken(payload.body)
    }

    const reposRes = await rpc.request('get-repos', Buffer.from(JSON.stringify(payload)))
    const repositories = JSON.parse(reposRes.toString())
    if (!repositories) {
      console.error('Failed to retrieve repositories')
      process.exit(1)
    }
    if (!repositories[repoName]) {
      console.error('Repository not found')
      process.exit(1)
    }

    await cb(url, name, rpc, opts)
  })
}

module.exports = {
  list: (url, name, opts) => wrapper(url, name, opts, list),
  add: (url, name, opts) => wrapper(url, name, opts, add),
  remove: (url, name, opts) => wrapper(url, name, opts, del)
}
