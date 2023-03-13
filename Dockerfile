# syntax=docker/dockerfile:1

FROM node:18.15.0-buster-slim

ARG GEOIP_LICENSE

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied

# Create app directory
WORKDIR /usr/src/app/

RUN apt-get update

RUN apt-get install -y git
RUN apt-get install -y nano
RUN apt-get install -y chromium

RUN npm install -g npm@9.5.0

# Bundle app source
COPY . /usr/src/app/

RUN touch /usr/src/app/.env

RUN npm install --verbose
RUN cd node_modules/geoip-lite && npm run-script updatedb license_key=${GEOIP_LICENSE}

RUN npm run build

EXPOSE 3000
CMD [ "/bin/bash" ]
