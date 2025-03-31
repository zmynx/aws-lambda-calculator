# Installation & Usage

### 1. Python Package

<!-- Place this tag where you want the button to render. -->

<a class="github-button" href="https://github.com/zmynx/aws-lambda-calculator/archive/HEAD.zip" data-color-scheme="no-preference: light; light: light; dark: dark;" data-icon="octicon-download" data-size="large" aria-label="Download zmynx/aws-lambda-calculator on GitHub">Download</a>

Install the package using pip (@<version> is optional, main is latest, use a version tag for a specific version):

```bash
python -m pip install aws-lambda-calculator@git+https://github.com/zmynx/aws-lambda-calculator#egg=aws-lambda-calculator&subdirectory=aws-lambda-calculator@main
```

Then import the package in your python code (.py):

```python
import aws_lambda_calculator
```

### 2. API

Clone the repository and install the requirements:

```bash
git clone https://github.com/zMynx/aws-lambda-calculator.git
python -m pip install --requirementes requirements.txt
```

Then run the main.py file with the required arguments:

```bash
python ./main.py --key=value....
```

### 3. CLI

Use the setup script to install the binary:

```bash
curl --remote-name https://github.com/zMynx/aws-lambda-calculator/blob/main/run.sh | bash -s -- --install
```

Then run the binary with the required arguments:

```bash
aws-lambda-calculator --key=value....
```

Optinally, use the alias `alc` for the binary:

```bash
alias alc=aws-lambda-calculator
alc --key=value....
```

### 4. Docker image

<!-- Place this tag where you want the button to render. -->

<a class="github-button" href="https://github.com/zmynx/aws-lambda-calculator/packages" data-color-scheme="no-preference: light; light: light; dark: dark;" data-icon="octicon-package" data-size="large" aria-label="Install this package zmynx/aws-lambda-calculator on GitHub">Install this package</a>
If you wish to use the API on any platform, without installing the binary, use the docker image.

Pull the image:

```bash
docker pull ghcr.io/zMynx/aws-lambda-calculator:latest
```

Then run the image with the required arguments:

```bash
docker run \
    --name aws-lambda-calculator \
    --interactive \
    --tty \
    --rm \
    --pull \
    --args key=value...
```

### 5. Serverless API

The serverless API solution is based on a Lambda function, and can be used by invoking the endpoint, while providing a payload of the configurations to use.\
Endpoint: `https://zmynx.aws-lambda-calculator.com`

e.g. (example using the cli)

```bash
curl \
    --data '{"payload":{"key":"value"}}' \
    https://zmynx.aws-lambda-calculator.com
```

### 6. Web based solution

Navigate to `https://github.com/zMynx/aws-lambda-calculator.io`.

# :octocat: Report :octocat:

Encountered an issue? Think you've found a bug?\
Check our [closed issues](https://github.com/zMynx/aws-lambda-calculator/issues?q=is%3Aissue%20state%3Aclosed) tab for viable solutions, or create a new issue [here](https://github.com/zMynx/aws-lambda-calculator/issues/new/choose).
