{
  description = "pear to pear git transport";

  inputs = {
    dream2nix.url = "github:nix-community/dream2nix";
    nixpkgs.follows = "dream2nix/nixpkgs";
  };

  outputs = inputs @ {
    self,
    dream2nix,
    nixpkgs,
    ...
  }: let
    system = "x86_64-darwin";
  in {
    packages.${system} = dream2nix.lib.importPackages {
      projectRoot = ./.;
      # can be changed to ".git" or "flake.nix" to get rid of .project-root
      projectRootFile = "flake.nix";
      packagesDir = ./def;
      packageSets.nixpkgs = nixpkgs.legacyPackages.${system};
    };
  };
}
