{
  description = "pear to pear git transport";


  inputs = {
    dream2nix.url = "github:nix-community/dream2nix/legacy";
    nixpkgs.follows = "dream2nix/nixpkgs";
  };

  outputs =
    inputs @ { self
    , dream2nix
    , nixpkgs
    , ...
    }:
    dream2nix.lib.makeFlakeOutputs {
      systems = [ "x86_64-darwin" "x86_64-linux" "aarch64-darwin" "aarch64-linux" ];
      config.projectRoot = ./.;
      source = ./.;
      projects = ./projects.toml;
      settings = [
        # for all impure nodejs projects with just a `package.json`,
        # add arguments for the `package-json` translator
        {
          filter = project: project.translator == "package-json";
          subsystemInfo.npmArgs = "--legacy-peer-deps";
          subsystemInfo.nodejs = 18;
        }
      ];
    };
}
