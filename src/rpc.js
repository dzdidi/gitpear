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
    // TODO: reponders to pull requests
    // normal push: git pull <url>
    // force push: git reset --hard url/<branch> 
    // delete branch: git branch -D url/<branch>

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
}
