#!/usr/bin/env node

const ProtomuxRPC = require('protomux-rpc')

const RAM = require('random-access-memory')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const Hyperdrive = require('hyperdrive')
const crypto = require('hypercore-crypto')

const git = require('./git.js')

const url = process.argv[3]
const matches = url.match(/pear:\/\/([a-f0-9]{64})\/(.*)/)

if (!matches || matches.length < 3) {
  console.error('Invalid URL')
  process.exit(1)
}

const targetKey = matches[1]
const repoName = matches[2]

const store = new Corestore(RAM)
const swarm = new Hyperswarm()

swarm.join(crypto.discoveryKey(Buffer.from(targetKey, 'hex')), { server: false })

swarm.on('connection', async (socket) => {
  store.replicate(socket)
  const rpc = new ProtomuxRPC(socket)

  const reposRes = await rpc.request('get-repos')
  const repositories = JSON.parse(reposRes.toString())
  if (!repositories) {
    console.error('Failed to retrieve repositories')
    process.exit(1)
  }

  if (!repositories[repoName]) {
    console.error('Failed to retrieve repository')
    process.exit(1)
  }

  const driveKey = Buffer.from(repositories[repoName], 'hex')
  if (!driveKey) {
    console.error('Failed to retrieve pack key')
    process.exit(1)
  }

  const packStore = store.namespace(repoName)
  const drive = new Hyperdrive(packStore, driveKey)
  await drive.ready()
  swarm.join(drive.discoveryKey, { server: false, client: true })
  await swarm.flush()

  await drive.core.update({ wait: true })

  const refsRes = await rpc.request('get-refs', Buffer.from(repoName))

  await talkToGit(JSON.parse(refsRes.toString()), drive)
})

async function talkToGit (refs, drive) {
  for (const ref in refs) {
    console.warn(refs[ref] + '\t' + ref)
  }
  process.stdin.setEncoding('utf8')
  const didFetch = false
  process.stdin.on('readable', async function () {
    const chunk = process.stdin.read()
    if (chunk === 'capabilities\n') {
      process.stdout.write('fetch\n\n')
    } else if (chunk === 'list\n') {
      Object.keys(refs).forEach(function (branch, i) {
        process.stdout.write(refs[branch] + ' ' + branch + '\n')
      })
      process.stdout.write('\n')
    } else if (chunk && chunk.search(/^fetch/) !== -1) {
      const lines = chunk.split(/\n/).filter(l => l !== '')

      const targets = []
      await lines.forEach(async function (line) {
        if (line === '') return

        line = line.split(/\s/)

        if (targets.includes(line[1])) return

        targets.push(line[1])
      })

      for (let i = 0; i < targets.length; i++) {
        const sha = targets[i]

        const exist = await drive.exists(`/packs/${sha}.pack`)
        if (!exist) process.exit(1)

        const driveStream = drive.createReadStream(`/packs/${sha}.pack`, { start: 0 })
        await git.unpackStream(driveStream)
      }

      process.stdout.write('\n\n')
      process.exit(0)
    } else if (chunk && chunk !== '' && chunk !== '\n') {
      console.warn('unhandled command: "' + chunk + '"')
    }

    if (chunk === '\n') {
      process.stdout.write('\n')
      if (!didFetch) {
        // If git already has all the refs it needs, we should exit now.
        process.exit()
      }
    }
  })
  process.stdout.on('error', function () {
    // stdout was closed
  })
}
