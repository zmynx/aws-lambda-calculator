FROM public.ecr.aws/lambda/python:3.13

RUN python -m pip install --upgrade pip
# && python -m pip install -r requirements.txt

# Install dependencies
# COPY requirements.txt .

ARG VERSION=main
ENV VERSION=${VERSION}
RUN git config --global http.sslverify false
RUN python -m pip install aws-lambda-calculator@git+https://github.com/zmynx/aws-lambda-calculator#egg=aws_lambda_calculator&subdirectory=aws-lambda-calculator@${VERSION}

# Copy application files
COPY index.py /var/task/

# Set the CMD to point to the handler function in index.py
CMD ["index.lambda_handler"]
