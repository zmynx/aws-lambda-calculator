# Use AWS Lambda base image for Python 3.11
FROM public.ecr.aws/lambda/python:3.13

# Copy application files
COPY index.py /var/task/

# Set the CMD to point to the handler function in index.py
CMD ["index.lambda_handler"]

