const ACL = require('../acl')
const home = require('../home')

async function getACLHandler (publicKey, req) {
  const { repoName } = await parseACLRequest.bind(this)(publicKey, req)
  const repoACL = ACL.getACL(repoName)

  return Buffer.from(JSON.stringify(repoACL))
}

async function addACLHandler (publicKey, req) {
  const { repoName, isBranch, name } = await parseACLRequest.bind(this)(publicKey, req)

  isBranch ? ACL.addProtectedBranch(repoName, name) : ACL.grantAccessToUser(repoName, ...name.split(':'))

  const repoACL = ACL.getACL(repoName)
  return Buffer.from(JSON.stringify(repoACL))
}

async function delACLHandler (publicKey, req) {
  const { repoName, isBranch, name } = await parseACLRequest.bind(this)(publicKey, req)

  isBranch ? ACL.removeProtectedBranch(repoName, name) : ACL.revokeAccessFromUser(repoName, name)

  const repoACL = ACL.getACL(repoName)
  return Buffer.from(JSON.stringify(repoACL))
}

async function parseACLRequest (publicKey, req) {
  if (!req) throw new Error('Request is empty')
  const request = JSON.parse(req.toString())
  const userId = await this.authenticate(publicKey, request)
  const repoName = request.body.url?.split('/')?.pop()

  if (!home.isInitialized(repoName)) throw new Error('Repo does not exist')

  const isOwner = ACL.getOwners(repoName).includes(userId)
  if (!isOwner) throw new Error('You are not allowed to access this repo')

  return {
    repoName,
    name: request.body.name,
    userId,
    acl: request.body.acl,
    isBranch: !!request.body.branch
  }
}

module.exports = {
  getACLHandler,
  addACLHandler,
  delACLHandler
}
