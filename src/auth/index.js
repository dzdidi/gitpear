function getId (data) {
  if (!process.env.GIT_PEAR_AUTH) return data
  if (process.env.GIT_PEAR_AUTH === 'nip98') {
    const nip98 = require('./nip98')
    return nip98.getId(data)
  }
}

async function getToken (payload) {
  if (!process.env.GIT_PEAR_AUTH) return payload
  if (process.env.GIT_PEAR_AUTH === 'nip98') {
    const nip98 = require('./nip98')
    return nip98.getToken(payload)
  }
}

module.exports = {
  getId,
  getToken
}
