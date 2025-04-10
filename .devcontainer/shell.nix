let
  sources = import ./nix/sources.nix;
  pkgs = import sources.nixpkgs {};
in

pkgs.mkShell {
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
    nodejs_22  # includes npm

    # Docker & cloud
    docker
    docker-compose
    trivy
    cosign
    # awscli2
    nodePackages.aws-cdk
    devpod
    # devpod-desktop

    # Python + env tools
    pyenv
    poetry
    python313Packages.black
    python313Packages.mypy
    python313Packages.pytest
    python313Packages.pytest-cov
    python313Packages.mkdocs
    python313Packages.ruff
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
}
