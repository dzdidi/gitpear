const ProtomuxRPC = require('protomux-rpc')
const SecretStream = require('@hyperswarm/secret-stream')
const { spawn } = require('child_process')
const home = require('./home')
const auth = require('./auth')
const acl = require('./acl')

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
    rpc.respond('get-repos', async req => await this.getReposHandler(socket.remotePublicKey, req))
    rpc.respond('get-refs',  async req => await this.getRefsHandler(socket.remotePublicKey, req))

    if (process.env.GIT_PEAR_AUTH) {
      /* -- PUSH HANDLERS -- */
      rpc.respond('push',     async req => await this.pushHandler(socket.remotePublicKey, req))
      rpc.respond('f-push',   async req => await this.forcePushHandler(socket.remotePublicKey, req))
      rpc.respond('d-branch', async req => await this.deleteBranchHandler(socket.remotePublicKey, req))
    }

    this.connections[peerInfo.publicKey] = rpc
  }

  async getReposHandler (publicKey, req) {
    const { branch, url, userId } = await this.parseReq(publicKey, req)

    const res = {}
    for (const repoName in this.repositories) {
      // TODO: add only public repos and those which are shared with the peer
      // Alternatively return only requested repo
      const isPublic = (acl.getACL(repoName).visibility === 'public')
      if (isPublic || acl.getViewers(repoName).includes(userId)) {
        res[repoName] = this.drives[repoName].key.toString('hex')
      }
    }
    return Buffer.from(JSON.stringify(res))
  }

  async getRefsHandler (publicKey, req) {
    const { repoName, branch, url, userId } = await this.parseReq(publicKey, req)
    const res = this.repositories[repoName]

    const isPublic = (acl.getACL(repoName).visibility === 'public')
    if (isPublic || acl.getViewers(repoName).includes(userId)) {
      return Buffer.from(JSON.stringify(res))
    } else {
      throw new Error('You are not allowed to access this repo')
    }
  }

  async pushHandler (publicKey, req) {
    const { url, repoName, branch, userId } = await this.parseReq(publicKey, req)
    const isContributor = acl.getContributors(repoName).includes(userId)

    if (!isContributor) throw new Error('You are not allowed to push to this repo')

    const isProtectedBranch = acl.getACL(repoName).protectedBranches.includes(branch)
    const isAdmin = acl.getAdmins(repoName).includes(userId)

    if (isProtectedBranch && !isAdmin) throw new Error('You are not allowed to push to this branch')

    return await new Promise((resolve, reject) => {
      const env = { ...process.env, GIT_DIR: home.getCodePath(repoName) }
      const child = spawn('git', ['fetch', url, `${branch}:${branch}`], { env })
      let errBuffer = Buffer.from('')
      child.stderr.on('data', data => {
        errBuffer = Buffer.concat([errBuffer, data])
      })

      child.on('close', code => {
        return code === 0 ? resolve(errBuffer) : reject(errBuffer)
      })
    })
  }

  async forcePushHandler (publicKey, req) {
    const { url, repoName, branch, userId } = await this.parseReq(publicKey, req)
    const isContributor = acl.getContributors(repoName).includes(userId)

    if (!isContributor) throw new Error('You are not allowed to push to this repo')

    const isProtectedBranch = acl.getACL(repoName).protectedBranches.includes(branch)
    const isAdmin = acl.getAdmins(repoName).includes(userId)

    if (isProtectedBranch && !isAdmin) throw new Error('You are not allowed to push to this branch')

    return await new Promise((resolve, reject) => {
      const env = { ...process.env, GIT_DIR: home.getCodePath(repoName) }
      const child = spawn('git', ['fetch', url, `${branch}:${branch}`, '--force'], { env })
      let errBuffer = Buffer.from('')
      child.stderr.on('data', data => {
        errBuffer = Buffer.concat([errBuffer, data])
      })

      child.on('close', code => {
        return code === 0 ? resolve(errBuffer) : reject(errBuffer)
      })
    })
  }

  async deleteBranchHandler (publicKey, req) {
    const { url, repoName, branch, userId } = await this.parseReq(publicKey, req)
    const isContributor = acl.getContributors(repoName).includes(userId)

    if (!isContributor) throw new Error('You are not allowed to push to this repo')

    const isProtectedBranch = acl.getACL(repoName).protectedBranches.includes(branch)
    const isAdmin = acl.getAdmins(repoName).includes(userId)

    if (isProtectedBranch && !isAdmin) throw new Error('You are not allowed to push to this branch')

    return await new Promise((resolve, reject) => {
      const env = { ...process.env, GIT_DIR: home.getCodePath(repoName) }
      const child = spawn('git', ['branch', '-D', branch], { env })
      let errBuffer = Buffer.from('')
      child.stderr.on('data', data => {
        errBuffer = Buffer.concat([errBuffer, data])
      })

      child.on('close', code => {
        return code === 0 ? resolve(errBuffer) : reject(errBuffer)
      })
    })
  }

  async parseReq(publicKey, req) {
    if (!req) throw new Error('Request is empty')
    const request = JSON.parse(req.toString())
    const parsed = {
      repoName: request.body.url?.split('/')?.pop(),
      branch: request.body.data?.split('#')[0],
      url: request.body.url,
      userId: await this.authenticate(publicKey, request),
    }
    console.error('parsed', parsed)
    return parsed
  }

  async authenticate (publicKey, request) {
    if (!process.env.GIT_PEAR_AUTH) return publicKey.toString('hex')
    if (process.env.GIT_PEAR_AUTH === 'native') return publicKey.toString('hex')
    if (!request.header) throw new Error('You are not allowed to access this repo')

    return (await auth.getId({ ...request.body, payload: request.header })).userId
  }
}
