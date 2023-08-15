const test = require('brittle')
const setState = require('../src/state.js')
const Corestore = require('corestore')
const RAM = require('random-access-memory')

const repoNames = ['foo', 'bar']

test('setState', async t => {
  const res = await setState(new Corestore(RAM))

  t.ok(res.announcedRefs)
  t.alike(new Set(Object.values(res.announcedRefs)), new Set(repoNames))

  t.ok(res.repositories)
  t.alike(new Set(Object.keys(res.repositories)), new Set(repoNames))

  t.ok(res.drives)

  for (const repo in res.repositories) {
    t.ok(res.repositories[repo])
    t.ok(res.drives[repo].key)
  }
})
