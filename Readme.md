# gitpear - 🍐2🍐 transport for git

CLI, Daemon and [Remote helper](https://www.git-scm.com/docs/gitremote-helpers) for git. It is based on [holepunch](https://docs.holepunch.to/) for networking and data sharing.

##

gitpear creates local [bare repository](https://git-scm.com/docs/git-init#Documentation/git-init.txt---bare) in application directory (default `~/.gitpear/<repository name>`), adds it as a [git remote](https://git-scm.com/docs/git-remote) in corresponding repository with name `pear`. So just like in traditional flow doing `git push origin`, here we do `git push pear`. Upon each push gitpear regenerates [pack files](https://git-scm.com/book/en/v2/Git-Internals-Packfiles) that are shared in ephemeral [hyperdrive](https://docs.holepunch.to/building-blocks/hyperdrive).

To enable clone or fetch or pull using `git <clone|fetch|pull> pear:<public key>/<repo name>`. It implements [git remote helper](https://www.git-scm.com/docs/gitremote-helpers) that uses [hyperswarm](https://docs.holepunch.to/building-blocks/hyperswarm) for networking in order to directly connect to peer. After connection is initialized it sends RPC request to retrieve list of repositories, clone corresponding pack files and unpack them locally.


## Installation

It is necessary for corresponding binaries to be in `$PATH`, thus gitpear needs to be installed globally

### From remote
```sh
npm install -g git@github.com:dzdidi/gitpear.git
```

### From local
```sh
git clone git@github.com:dzdidi/gitpear.git
cd gitpear
npm link
```

NOTE: application home directory will be created in `~/.gitpear` - this may require `sudo`

##

All data will be persisted in application directory (default `~/.gitpear`). To change it. Provide environment variable `GIT_PEAR`

* `gitpear daemon <-s, --start | -k, --stop>` - start or stop daemon

* `gitpear key` - print out public key. Share it with your peers so that they can do `git pull pear:<public key>/<repo name>`

* `gitpear init [-s, --share] <path>` - It will create [bare repository](https://git-scm.com/docs/git-init#Documentation/git-init.txt---bare) of the same name in application directory (default ~/.gitpear/<repository name>). It will add [git remote](https://git-scm.com/docs/git-remote) in current repository with name `pear`. So just like in traditional flow doing `git push orign`, here we do `git push pear`. By default repository will not be shared. To enable sharing provide `-s` or call `gitpear share <path>` later

* `gitpear share <path>` - makes repository sharable

* `gitpear unshare <path>` -  stop sharing repository

* `gitpear list [-s, --shared]` - list all or (only shared) repositories
