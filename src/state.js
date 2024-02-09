const Hyperdrive = require('hyperdrive')

const git = require('./git.js')
const home = require('./home.js')

module.exports = async function setState (store, drives = {}) {
  const repos = home.list(true)

  const announcedRefs = {}
  const repositories = {}

  for (const repo of repos) {
    if (!drives[repo]) {
      drives[repo] = new Hyperdrive(store.namespace(repo))
      await drives[repo].ready()
    }

    const homePath = home.getCodePath(repo)
    const ls = await git.lsPromise(homePath)

    repositories[repo] = {}
    for (const ref in ls) {
      repositories[repo][ref] = ls[ref]
      announcedRefs[ls[ref]] = repo

      const localPackStream = git.uploadPack(homePath, ls[ref])
      const driveStream = drives[repo].createWriteStream(`/packs/${ls[ref]}.pack`)
      localPackStream.on('ready', () => localPackStream.stdout.pipe(driveStream))
    }
  }

  return { announcedRefs, repositories, drives }
}
