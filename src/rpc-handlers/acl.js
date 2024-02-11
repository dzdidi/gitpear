const ACL = require('../acl')

async getACLHandler (publicKey, req) {
  const { repoName, userId } = await this.parseACLRequest(publicKey, req)
  return Buffer.from(JSON.stringify(ACL.getACL(repoName)))
}

async addACLHandler (publicKey, req) {
  const { repoName, userId, acl } = await this.parseACLRequest(publicKey, req)

  // TODO
  const aclData = JSON.parse(acl)
  ACL.setACL(repoName, aclData)
  return Buffer.from('ACL updated')
}

async delACLHandler (publicKey, req) {
  const { repoName, userId, acl } = await this.parseACLRequest(publicKey, req)

}

async chgACLHandler (publicKey, req) {
  const { repoName, userId, acl } = await this.parseACLRequest(publicKey, req)
}


async parseACLRequest(publicKey, req) {
  if (!req) throw new Error('Request is empty')
  const request = JSON.parse(req.toString())
  const userId = await this.authenticate(publicKey, request)
  const isOwner = ACL.getOwnder(repoName).includes(userId)
  if (!isOwner) throw new Error('You are not allowed to access this repo')

  const repoName = request.body.url?.split('/')?.pop()
  // TODO: check if repo exists

  return {
    repoName,
    userId,
    // FIXME
    acl: request.body.acl,
  }
}

module.exports = {
  getACLHandler,
  addACLHandler,
  delACLHandler,
  chgACLHandler,
}
