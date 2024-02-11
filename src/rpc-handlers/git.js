
async getReposHandler (publicKey, req) {
  const { branch, url, userId } = await this.parseReq(publicKey, req)

  const res = {}
  for (const repoName in this.repositories) {
    // TODO: add only public repos and those which are shared with the peer
    // Alternatively return only requested repo
    const isPublic = (ACL.getACL(repoName).visibility === 'public')
    if (isPublic || ACL.getViewers(repoName).includes(userId)) {
      res[repoName] = this.drives[repoName].key.toString('hex')
    }
  }
  return Buffer.from(JSON.stringify(res))
}

async getRefsHandler (publicKey, req) {
  const { repoName, branch, url, userId } = await this.parseReq(publicKey, req)
  const res = this.repositories[repoName]

  const isPublic = (ACL.getACL(repoName).visibility === 'public')
  if (isPublic || ACL.getViewers(repoName).includes(userId)) {
    return Buffer.from(JSON.stringify(res))
  } else {
    throw new Error('You are not allowed to access this repo')
  }
}

async pushHandler (publicKey, req) {
  const { url, repoName, branch, userId } = await this.parseReq(publicKey, req)
  const isContributor = ACL.getContributors(repoName).includes(userId)

  if (!isContributor) throw new Error('You are not allowed to push to this repo')

  const isProtectedBranch = ACL.getACL(repoName).protectedBranches.includes(branch)
  const isAdmin = ACL.getAdmins(repoName).includes(userId)

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
  const isContributor = ACL.getContributors(repoName).includes(userId)

  if (!isContributor) throw new Error('You are not allowed to push to this repo')

  const isProtectedBranch = ACL.getACL(repoName).protectedBranches.includes(branch)
  const isAdmin = ACL.getAdmins(repoName).includes(userId)

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
    const isContributor = ACL.getContributors(repoName).includes(userId)

    if (!isContributor) throw new Error('You are not allowed to push to this repo')

    const isProtectedBranch = ACL.getACL(repoName).protectedBranches.includes(branch)
    const isAdmin = ACL.getAdmins(repoName).includes(userId)

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
  return parsed
}

module.exports = {
  getReposHandler,
  getRefsHandler,
  pushHandler,
  forcePushHandler,
  deleteBranchHandler,
}

