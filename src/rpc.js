const ProtomuxRPC = require('protomux-rpc')

module.exports = class RPC {
  constructor (announcedRefs, repositories, drives) {
    this.connections = {}
    this.announcedRefs = announcedRefs
    this.repositories = repositories
    this.drives = drives
  }

  async setHandlers (socket, peerInfo) {
    if (this.connections[peerInfo.publicKey]) return this.connections[peerInfo.publicKey]

    const rpc = new ProtomuxRPC(socket)
    // XXX: handshaking can be used for access and permission management
    // for example check of peerInfo.publicKey is in a list of allowed keys
    // which can in turn be stored in a .git-daemon-export-ok file

    /* -- PULL HANDLERS -- */
    rpc.respond('get-repos', req => this.getReposHandler(req))
    rpc.respond('get-refs', async req => await this.getRefsHandler(req))

    /* -- PUSH HANDLERS -- */
    rpc.respond('push-to-repo', async req => this.pushHandler(req))
    rpc.respond('force-push-to-repo', req => this.forcePushHandler(req))
    rpc.respond('delete-branch-from-repo', req => this.deleteBranchHandler(req))

    this.connections[peerInfo.publicKey] = rpc
  }

  getReposHandler (_req) {
    const res = {}
    for (const repo in this.repositories) {
      res[repo] = this.drives[repo].key.toString('hex')
    }
    return Buffer.from(JSON.stringify(res))
  }

  getRefsHandler (req) {
    const res = this.repositories[req.toString()]

    return Buffer.from(JSON.stringify(res))
  }

  pushHandler (req) {
    // TODO: check ACL
    // XXX: from the inside of a bare repo:
    // git fetch url <branch>:<branch>
    console.error('req', req.toString())
    console.error('pushHandler not implemented')
  }

  forcePushHandler (req) {
    // TODO: check ACL
    // XXX: from the inside of a bare repo:
    // git reset --hard url <branch>
    console.error('req', req.toString())
    console.error('forcePushHandler not implemented')
  }

  deleteBranchHandler (req) {
    // TODO: check ACL
    // XXX: from the inside of a bare repo:
    // git push -d pear <branch>
    console.error('req', req.toString())
    console.error('deleteBranchHandler not implemented')
  }

  parsePushCommand(req) {
    const [url, branch] = req.toString().split(':')
    const [key, repo] = url.split('/')
    return {
      url: `pear://${url}`,
      repo,
      key,
      branch
    }
  }

  loadACL(repoName) {
    // TODO: read contact of .git-daemon-export-ok
    // find key and its permissions
  }
}
