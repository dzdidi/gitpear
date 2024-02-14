const ProtomuxRPC = require('protomux-rpc')

const Hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')

const home = require('../home')
const auth = require('../auth')

async function list (url, name) {
  const matches = url.match(/pear:\/\/([a-f0-9]{64})/)

  if (!matches || matches.length < 2) {
    console.error('Invalid URL')
    process.exit(1)
  }

  const targetKey = matches[1]
  console.log('Connecting to:', targetKey)

  const swarmOpts = {}
  if (process.env.GIT_PEAR_AUTH === 'native') {
    swarmOpts.keyPair = home.getKeyPair()
  }
  const swarm = new Hyperswarm(swarmOpts)

  swarm.join(crypto.discoveryKey(Buffer.from(targetKey, 'hex')), { server: false })

  swarm.on('connection', async (socket) => {
    const rpc = new ProtomuxRPC(socket)

    let payload = { body: { url, method: 'get-repos' } }
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

    paylod = { body: { url, method: 'get-acl' } }
    if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
      payload.header = await auth.getToken(payload.body)
    }
    const repoACLres = await rpc.request('get-acl', Buffer.from(JSON.stringify(payload)))
    const repoACL = JSON.parse(repoACLres.toString())

    console.log('Repo Visibility:', '\t', repoACL.visibility)
    console.log('Protected Branch(s):', '\t', repoACL.protectedBranches.join(', '))
    console.log('User:', '\t', 'Role:')
    if (name) {
      console.log(name, '\t', repoACL.ACL[name])
      process.exit(0)
    }

    for (const user in repoACL.ACL) {
      console.log(user, '\t', repoACL.ACL[user])
    }

    process.exit(0)
  })
}

module.exports = {
  list,
}
