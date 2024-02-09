# Use the official Node.js image as the base image
FROM node:latest

# install nginx
RUN apt-get update && apt-get install -y nginx git fcgiwrap spawn-fcgi
ENV GIT_PEAR=/srv/repos/pear
EXPOSE 80
STOPSIGNAL SIGTERM
# Set the working directory inside the container
WORKDIR /app

# Clone the gitpear repository from GitHub
RUN git clone https://github.com/dzdidi/gitpear.git

# Change the working directory to the gitpear directory
WORKDIR /app/gitpear

# Install the dependencies using npm
RUN npm install

# Link the gitpear package globally
RUN npm link

RUN mkdir -p /srv/repos/pear


COPY default /etc/nginx/sites-enabled/default

WORKDIR /app
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/bin/bash", "-c", "/app/entrypoint.sh"]


