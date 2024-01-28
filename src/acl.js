const home = require('./home')

const roles = {
  admin: {
    description: 'Read and write to all branches',
  },
  contributor: {
    description: 'Read and write to all branches except protected ones',
  },
  viewer: {
    description: 'Read all branches',
  },
}
const DEFAULT_ACL = {
  visibibility: 'public', // public|private 
  protectedBranches: ['master'],
  ACL: {}
}


