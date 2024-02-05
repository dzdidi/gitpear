# gitpear - 🍐2🍐 transport for git

CLI, Daemon and [Remote helper](https://www.git-scm.com/docs/gitremote-helpers) for git. It is based on [holepunch](https://docs.holepunch.to/) for networking and data sharing.

##

gitpear creates local [bare repository](https://git-scm.com/docs/git-init#Documentation/git-init.txt---bare) in application directory (default `~/.gitpear/<repository name>`), adds it as a [git remote](https://git-scm.com/docs/git-remote) in corresponding repository with name `pear`. So just like in traditional flow doing `git push origin`, here we do `git push pear`. Upon each push gitpear regenerates [pack files](https://git-scm.com/book/en/v2/Git-Internals-Packfiles) that are shared in ephemeral [hyperdrive](https://docs.holepunch.to/building-blocks/hyperdrive).

To enable clone or fetch or pull using `git <clone|fetch|pull> pear:<public key>/<repo name>`. It implements [git remote helper](https://www.git-scm.com/docs/gitremote-helpers) that uses [hyperswarm](https://docs.holepunch.to/building-blocks/hyperswarm) for networking in order to directly connect to peer. After connection is initialized it sends RPC request to retrieve list of repositories, clone corresponding pack files and unpack them locally.


## Installation

It is necessary for corresponding binaries to be in `$PATH`, thus gitpear needs to be installed globally.
NOTE: application home directory will be created in `~/.gitpear` - this may require `sudo`.

### From git
```sh
git clone git@github.com:dzdidi/gitpear.git
cd gitpear
npm install
npm link
```

### From git + Nix
```sh
git clone git@github.com:dzdidi/gitpear.git
cd gitpear
npm install
npm nix
```

See `./result` - for binaries build by nix. To make the available add to path by running `PATH="${PATH:+${PATH}:}${PWD}/result/bin/"`

## Running

All data will be persisted in application directory (default `~/.gitpear`). To change it. Provide environment variable `GIT_PEAR`

* `git pear daemon <-s, --start | -k, --stop>` - start or stop daemon
* `git pear key` - print out public key. Share it with your peers so that they can do `git pull pear:<public key>/<repo name>`
* `git pear init [-s, --share] <path>` - It will create [bare repository](https://git-scm.com/docs/git-init#Documentation/git-init.txt---bare) of the same name in application directory (default ~/.gitpear/<repository name>). It will add [git remote](https://git-scm.com/docs/git-remote) in current repository with name `pear`. So just like in traditional flow doing `git push orign`, here we do `git push pear`. By default repository will not be shared. To enable sharing provide `-s` or call `gitpear share <path>` later
* `git pear share <path>` - makes repository sharable
* `git pear unshare <path>` -  stop sharing repository
* `git pear list [-s, --shared]` - list all or (only shared) repositories

### ACL (for authenticated access to enable support of PUSH)

Support of `push` capabilities only enabled for authenticated users. Currently supported authentications are based on:
* [noise](https://github.com/libp2p/specs/blob/master/noise/README.md);
* [NIP98](https://github.com/nostr-protocol/nips/blob/master/98.md).

To start daemon with authenticated support provide environment varibales `GIT_PEAR_AUTH` with values `nip98` or `native`.
The `nip98` also requires `GIT_PEAR_AUTH_NSEC` with value of your [NIP19 nsec](https://github.com/nostr-protocol/nips/blob/master/19.md).

For example:
```
GIT_PEAR_AUTH=nip98 GIT_PEAR_AUTH_NSEC=nsec.... git pear daemon -s 
```
or 
```
GIT_PEAR_AUTH=native git pear daemon -s 
```

To manage access to repository use one or combination of the following commands, if `path` is not provide the command will be executed in the current directory. For `userId` use [NIP19 npub](https://github.com/nostr-protocol/nips/blob/master/19.md).

* `git pear acl [command] <path>` - ACL managegement
* `git pear acl list [userId] <path>` - list repository visitbility and user's role (or roles of all users if userId is not provided)
* `git pear acl add <userId:role> <path>` - add user as a "role" to repository, available roles are `viewer`, `contributor`, `admin`. Roles exaplained:
  * `viewer` - can read all branches;
  * `contributor` - can edit all branches except protected (default master) 
  * `admin` - can edit protected branches
* `git pear acl remove <userId> <path>` - revoke use access to repository


### Branch protection rules
It is possible to setup basic branch protection rules (master is proteted by default).
* `git pear branch`, same as `git pear branch list .` - list protection rules
* `git pear branch add <branch name> <repo path>` - mark branch as protected (defatul repo path is ".")
* `git pear branch remove <branch name> <repo path>` - unmark branch as protected

# Examples of usage

## Un authenticated usage example (no push)

Collaboration is possible with the following flow between Alice and Bob in a peer-to-peer manner.

1. Both Alice and Bob have gitpear installed and Alice wants Bob to help her with repo Repo
2. Alice steps are:
```
cd Repo
git pear init -s
git pear list -s
# outputs:
# Repo    pear://<Alice public key>/Repo
```

3. Bob's steps:
```
git clone pear://<Alice public key>/Repo
cd Repo
git pear init -s
git checkout -b feature
# implement feature
git commit -m 'done'
git push pear feature
git pear list 
# outputs:
# Repo    pear://<Bob public key>/Repo
```

4. Alice's steps
```
git checkout master
git remote add bob pear://<Bob public key>/Repo
git fetch bob
git pull
git merge feature
git push pear master
```

5. Bob's steps are
```
git checkout master
git fetch origin
git pull
```

## Authenticated usage example (push) - at your own risk

Collaboration is possible with the following flow between Carol and David in a peer-to-peer manner.

Supported authentication methods are `native` and `nip98`. The `nip98` authentication, requires environment variable `GIT_PEAR_AUTH_NSEC` with nsec

### Carol steps (as a server of code)
1. Start daemon
* `GIT_PEAR_AUTH='native' git pear daemon -s`
2. Go to repository
* `cd repo`
3. Initialize git pear repository
* `git pear init .`
4. Share repository wit hviben visibility () - (default is `public`)
* `git pear share . public`
5. Add Daviv as a `contirbutor`.
6. List David's npub as a contributor
* `git pear acl add <David pub key hex>:contributor`
7. Retreive repo url and share it with Dave
* `git pear list -s`

### Dave side (a collaborator for code)
1. Start daemon. This will be needed later for push. Not that no auth or sec are provided which means that push to this place will not be supportedd.
* `git pear daemon -s`
2. Clone repository. Authorization data and type are necesary for server (Carol) to grant corresponding access persmissions
* `GIT_PEAR_AUTH='native' git clone pear://<Carol's pub key hex>/<repo name>`
3. Do the necessary change in separate branch 
* `git checkout -b feat/david`
* do change
* `git add .`
* `git commit -s -m 'made by David'`
4. Push branch to origin
* `GIT_PEAR_AUTH='native' git push origin feat/david`

### Carol steps
1. For Carol the changes will arrive as branch `feat/david` into her `pear`
* `git fetch pear`
2. From there she can do
* `git diff pear/feat/david` or `git pull pear feat/david` ... merge to master and push to `pear`
