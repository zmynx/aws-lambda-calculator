# Devcontainer Dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install dependencies
RUN apt-get update && apt-get install --yes \
	git \
	zsh \
	curl \
	just \
	ca-certificates \
	pipx \
	&& rm -rf /var/lib/apt/lists/*

RUN pipx ensurepath

# Install oh-my-zsh
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# # Install pyenv
# RUN curl -k https://pyenv.run | bash
#
# # Set environment variables for pyenv
# ENV PATH="/root/.pyenv/bin:/root/.pyenv/shims:/root/.pyenv/versions/3.13.0/bin:$PATH"
# ENV PYENV_ROOT="/root/.pyenv"
#
# # Update shell configuration for pyenv
# RUN echo 'export PATH="$HOME/.pyenv/bin:$PATH"' >> ~/.zshrc && \
# 	echo 'eval "$(pyenv init --path)"' >> ~/.zshrc && \
# 	echo 'eval "$(pyenv virtualenv-init --path)"' >> ~/.zshrc
#
# # Install Python 3.13.0
# RUN /bin/zsh -c "source ~/.zshrc && pyenv install 3.13.0 && pyenv global 3.13.0"

# Install Poetry 2.1.1
RUN pipx install poetry==2.1.1
# RUN curl -sSL https://install.python-poetry.org | POETRY_VERSION=2.1.1 python3 -

# Set environment variables for Poetry
ENV PATH="/root/.local/bin:$PATH"

# Set the default shell to zsh
SHELL ["/bin/zsh", "-c"]
