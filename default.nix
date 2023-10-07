{
  lib,
  config,
  dream2nix,
  ...
}: {
  imports = [
    # dream2nix.modules.dream2nix.nodejs-package-lock
    # dream2nix.modules.dream2nix.nodejs-granular
    dream2nix.modules.dream2nix.mkDerivation
  ];

  mkDerivation = {
    src = config.deps.fetchFromGitHub {
      owner = "dzdidi";
      repo = "gitpear";
      rev = "v1.0.0";
      sha256 = lib.fakeHash;
    };
  };

  deps = {nixpkgs, ...}: {
    inherit
      (nixpkgs)
      fetchFromGitHub
      stdenv
      ;
  };

  name = "gitpear";
  version = "1.0.0";
}
