# Devcontainer Dockerfile
FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu-22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
	git \
	zsh \
	curl \
	&& rm -rf /var/lib/apt/lists/*

# Install oh-my-zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# Install pyenv
RUN curl https://pyenv.run | bash

# Set environment variables for pyenv
ENV PATH="/root/.pyenv/bin:/root/.pyenv/shims:/root/.pyenv/versions/3.13.0/bin:$PATH"
ENV PYENV_ROOT="/root/.pyenv"

# Install Python 3.13.0
RUN pyenv install 3.13.0 && pyenv global 3.13.0

# Install Poetry 2.1.1
RUN curl -sSL https://install.python-poetry.org | POETRY_VERSION=2.1.1 python3 -

# Set environment variables for Poetry
ENV PATH="/root/.local/bin:$PATH"

# Set the default shell to zsh
SHELL ["/bin/zsh", "-c"]
