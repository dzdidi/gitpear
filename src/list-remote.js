const ProtomuxRPC = require('protomux-rpc')

const Hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')

const home = require('./home')
const auth = require('./auth')

module.exports = async function listRemote (url) {
  const matches = url.match(/pear:\/\/([a-f0-9]{64})/)

  if (!matches || matches.length < 2) {
    console.error('Invalid URL')
    process.exit(1)
  }

  const targetKey = matches[1]
  console.log('Connecting to:', targetKey)

  const swarmOpts = {}
  if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
    swarmOpts.keyPair = home.getKeyPair()
  }
  const swarm = new Hyperswarm(swarmOpts)

  swarm.join(crypto.discoveryKey(Buffer.from(targetKey, 'hex')), { server: false })

  swarm.on('connection', async (socket) => {
    const rpc = new ProtomuxRPC(socket)

    let payload = { body: { url, method: 'get-repos' } }
    if (process.env.GIT_PEAR_AUTH && process.env.GIT_PEAR_AUTH !== 'native') {
      payload.header = await auth.getToken(payload.body)
      console.debug('Retreiving data using authenticated access')
    } else {
      console.debug('Retreiving data using un-authenticated access')
    }
    console.log()

    const reposRes = await rpc.request('get-repos', Buffer.from(JSON.stringify(payload)))
    const repositories = JSON.parse(reposRes.toString())
    if (!repositories) {
      console.error('Failed to retrieve repositories')
      process.exit(1)
    }

    console.log('Repositories:', '\t', 'HEAD')
    for (const repo in repositories) {
      console.log(repo, '\t', repositories[repo])
    }
    process.exit(0)
  })
}
