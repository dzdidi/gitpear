const ProtomuxRPC = require('protomux-rpc')
const { spawn } = require('child_process')
const home = require('./home')
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
    rpc.respond('get-repos', async req => await this.getReposHandler(peerInfo.publicKey, req))
    rpc.respond('get-refs',  async req => await this.getRefsHandler(peerInfo.publicKey, req))

    /* -- PUSH HANDLERS -- */
    rpc.respond('push',     async req => await this.pushHandler(peerInfo.publicKey, req))
    rpc.respond('f-push',   async req => await this.forcePushHandler(peerInfo.publicKey, req))
    rpc.respond('d-branch', async req => await this.deleteBranchHandler(peerInfo.publicKey, req))

    this.connections[peerInfo.publicKey] = rpc
  }

  async getReposHandler (publicKey, req) {
    const { branch, url } = await this.parseReq(publicKey, req, 'r')

    const res = {}
    for (const repoName in this.repositories) {
      // TODO: add only public repos and those which are shared with the peer
      // Alternatively return only requested repo
      res[repoName] = this.drives[repoName].key.toString('hex')
    }
    return Buffer.from(JSON.stringify(res))
  }

  async getRefsHandler (publicKey, req) {
    const { repoName, branch, url } = await this.parseReq(publicKey, req, 'r')
    const res = this.repositories[repoName]

    return Buffer.from(JSON.stringify(res))
  }

  async pushHandler (publicKey, req) {
    const { url, repoName, branch } = await this.parseReq(publicKey, req, 'w')
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
    const { url, repoName, branch } = await this.parseReq(publicKey, req, 'w')
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
    const { url, repoName, branch } = await this.parseReq(publicKey, req, 'w')
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

  async parseReq(publicKey, req, access, branch = '*') {
    if (!req) throw new Error('Request is empty')
    let request = JSON.parse(req.toString())
    const parsed = {
      repoName: request.body.url?.split('/')?.pop(),
      branch: request.body.data?.split('#')[0],
      url: request.body.url
    }
    if (!process.env.GIT_PEAR_AUTH) return parsed

    if (process.env.GIT_PEAR_AUTH !== 'naitive' && !request.header) {
      throw new Error('You are not allowed to access this repo')
    }

    let userId
    if (process.env.GIT_PEAR_AUTH === 'naitive') {
      userId = publicKey
    } else {
      userId = (await acl.getId({ ...request.body, payload: request.header })).userId
    }
    const aclObj = home.getACL(parsed.repoName)
    const userACL = aclObj[userId] || aclObj['*']
    if (!userACL) throw new Error('You are not allowed to access this repo')

    if (aclObj.protectecBranches.includes(branch)) {
      // protected branch must have exaplicit access grant
      if (access === 'w') {

      } else {
        // 
      }
    } else {
      
    }

    return parsed
  }
}
