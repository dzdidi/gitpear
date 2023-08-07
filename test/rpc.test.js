const test = require('brittle')
const RAM = require('random-access-memory')
const createTestnet = require('@hyperswarm/testnet')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const ProtomuxRPC = require('protomux-rpc')

const RPC = require('../src/rpc.js')
const setState = require('../src/state.js')

test('constructor', async t => {
  const rpc = new RPC('announcedRefs', 'repositories', 'drives')
  t.ok(rpc)

  t.is(rpc.announcedRefs, 'announcedRefs')
  t.is(rpc.repositories, 'repositories')
  t.is(rpc.drives, 'drives')
  t.alike(rpc.connections, {})
})

test('e2e', async t => {
  t.plan(3)
  const testnet = await createTestnet(3, t)

  const { rpc, store } = await getRPC()
  const clientStore = new Corestore(RAM)
  const topic = Buffer.alloc(32).fill('pear 2 pear')

  const serverSwarm = new Hyperswarm(testnet)
  serverSwarm.on('connection', (socket, details) => {
    store.replicate(socket)
    rpc.setHandlers(socket, details)
  })
  serverSwarm.join(topic)
  await serverSwarm.flush()

  const clientSwarm = new Hyperswarm(testnet)
  clientSwarm.on('connection', async (socket) => {
    clientStore.replicate(socket)
    const rpc = new ProtomuxRPC(socket)

    const reposRes = await rpc.request('get-repos')
    const reposJSON = JSON.parse(reposRes.toString())

    const driveKey = Buffer.from(reposJSON.foo, 'hex')
    t.ok(driveKey)

    const drive = new Hyperdrive(clientStore.namespace('foo'), driveKey)
    await drive.ready()
    clientSwarm.join(drive.discoveryKey, { server: false, client: true })
    await clientSwarm.flush()

    await drive.core.update({ wait: true })

    const refsRes = await rpc.request('get-refs', Buffer.from('foo'))
    t.ok(refsRes)

    const want = Object.values(JSON.parse(refsRes.toString()))[0]

    const exists = await drive.exists(`/packs/${want}.pack`)
    t.ok(exists)
  })

  clientSwarm.join(topic, { server: false, client: true })

  t.teardown(async () => {
    await serverSwarm.destroy()
    await clientSwarm.destroy()
  })
})

async function getRPC () {
  const store = new Corestore(RAM)
  const { announcedRefs, repositories, drives } = await setState(store)
  return {
    rpc: new RPC(announcedRefs, repositories, drives),
    store
  }
}
