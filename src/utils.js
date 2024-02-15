const fs = require('fs')
const path = require('path')

function printACL (repoACL) {
  console.log('Repo Visibility:', '\t', repoACL.visibility)
  console.log('Protected Branch(s):', '\t', repoACL.protectedBranches.join(', '))
  console.log('User:', '\t', 'Role:')
  for (const user in repoACL.ACL) {
    console.log(user, '\t', repoACL.ACL[user])
  }
}

function printACLForUser (repoACL, u) {
  console.log('Repo Visibility:', '\t', repoACL.visibility)
  console.log('Protected Branch(s):', '\t', repoACL.protectedBranches.join(', '))
  console.log('User:', u, '\t', repoACL.ACL[u])
}

function checkIfGitRepo (p) {
  if (!fs.existsSync(path.join(p, '.git'))) {
    console.error(` ${p} is not a git repo`)
    process.exit(1)
  }
}

function logBranches (repoACL) {
  console.log('Repo Visibility:', '\t', repoACL.visibility)
  console.log('Protected Branch(s):', '\t', repoACL.protectedBranches.join(', '))
}

module.exports = {
  printACL,
  printACLForUser,
  checkIfGitRepo,
  logBranches
}
