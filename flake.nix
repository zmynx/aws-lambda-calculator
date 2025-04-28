{
  description = "AWS Lambda Calculator DevShell with Python 3.13, Docker, and CLI tools";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        python = pkgs.python313;

        # poetry_2_1_1 = python.pkgs.buildPythonPackage rec {
        #   pname = "poetry";
        #   version = "2.1.1";
        #
        #   src = pkgs.fetchPypi {
        #     inherit pname version;
        #     sha256 = "1z0fl0xq6pzv5fl5v7igvzc5c137i6dcca6gvb86qggibf3769nq";
        #   };
        #
        #   propagatedBuildInputs = with python.pkgs; [
        #     poetry-core
        #     requests
        #     cachy
        #     crashtest
        #     cleo
        #     shellingham
        #     tomlkit
        #     virtualenv
        #   ];
        #
        #   doCheck = false;
        #   format = "pyproject";
        # };
      in {
        devShells.default = pkgs.mkShell {
          name = "python-dev-env";

          buildInputs = with pkgs; [
            # CLI & shell tools
            zsh
            oh-my-zsh
            git
            gh
            jq
            yq
            fzf
            bat
            just
            nodejs_22

            # Docker & cloud
            docker
            docker-compose
            trivy
            cosign
            awscli2
            nodePackages.aws-cdk
            devpod
            # devpod-desktop

            # Python + tools
            pyenv
            python
            # poetry_2_1_1
            # python313Packages.black
            # python313Packages.pytest
            # python313Packages.pytest-cov
            # python313Packages.mkdocs
            # python313Packages.ruff
          ];

          shellHook = ''
            export SHELL=$(which zsh)

            # Pyenv setup
            export PYENV_ROOT="$HOME/.pyenv"
            export PATH="$PYENV_ROOT/bin:$PATH"
            eval "$(pyenv init -)"
            pyenv global 3.13.0

            echo "     __  __                   "
            echo " ___|  \/  |_   _ _ __ __  __ "
            echo "|_  / |\/| | | | | '_ \\ \/ / "
            echo " / /| |  | | |_| | | | |>  <  "
            echo "/___|_|  |_|\__, |_| |_/_/\_\ "
            echo "            |___/             "
            echo "AWS Lambda Calculator DevShell"
          '';
        };
      });
}
