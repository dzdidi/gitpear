# gitpear - 🍐2🍐 transport for git

CLI, Daemon and [Remote helper](https://www.git-scm.com/docs/gitremote-helpers) for git. It is based on [holepunch](https://docs.holepunch.to/) for networking and data sharing.

##

gitpear creates local [bare repository](https://git-scm.com/docs/git-init#Documentation/git-init.txt---bare) in application directory (default `~/.gitpear/<repository name>`), adds it as a [git remote](https://git-scm.com/docs/git-remote) in corresponding repository with name `pear`. So just like in traditional flow doing `git push origin`, here we do `git push pear`. Upon each push gitpear regenerates [pack files](https://git-scm.com/book/en/v2/Git-Internals-Packfiles) that are shared in ephemeral [hyperdrive](https://docs.holepunch.to/building-blocks/hyperdrive).

To enable clone or fetch or pull using `git <clone|fetch|pull> pear:<public key>/<repo name>`. It implements [git remote helper](https://www.git-scm.com/docs/gitremote-helpers) that uses [hyperswarm](https://docs.holepunch.to/building-blocks/hyperswarm) for networking in order to directly connect to peer. After connection is initialized it sends RPC request to retrieve list of repositories, clone corresponding pack files and unpack them locally.


## Installation

It is necessary for corresponding binaries to be in `$PATH`, thus gitpear needs to be installed globally.
NOTE: application home directory will be created in `~/.gitpear` - this may require `sudo`.

### From npm
```sh
npm install -g gitpear
```

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

##

All data will be persisted in application directory (default `~/.gitpear`). To change it. Provide environment variable `GIT_PEAR`

* `git pear daemon <-s, --start | -k, --stop>` - start or stop daemon

* `git pear key` - print out public key. Share it with your peers so that they can do `git pull pear:<public key>/<repo name>`

* `git pear init [-s, --share] <path>` - It will create [bare repository](https://git-scm.com/docs/git-init#Documentation/git-init.txt---bare) of the same name in application directory (default ~/.gitpear/<repository name>). It will add [git remote](https://git-scm.com/docs/git-remote) in current repository with name `pear`. So just like in traditional flow doing `git push orign`, here we do `git push pear`. By default repository will not be shared. To enable sharing provide `-s` or call `gitpear share <path>` later

* `git pear share <path>` - makes repository sharable

* `git pear unshare <path>` -  stop sharing repository

* `git pear list [-s, --shared]` - list all or (only shared) repositories

## Usage example

Please not this is only remote helper and its intention is only to enable direct `clone|fetch|pull` of repository hosted on private computer.

Collaboration is possible however with the following flow between Alice and Bob in a pure peer-to-peer manner of git.

1. Both Alice and Bob have gitpear installed and Alice wants Bob to help her with repo Repo
2. Alice steps are:
```
cd Repo
git pear init -s
git pear list
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
