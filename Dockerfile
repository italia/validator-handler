# syntax=docker/dockerfile:1@sha256:2780b5c3bab67f1f76c781860de469442999ed1a0d7992a5efdf2cffc0e3d769

FROM node:24.13-bookworm-slim@sha256:bf22df20270b654c4e9da59d8d4a3516cce6ba2852e159b27288d645b7a7eedc

ARG GEOIP_LICENSE

# Install dumb-init
RUN apt-get update && apt-get install -y dumb-init

# Create app directory
WORKDIR /usr/src/app/

RUN apt-get install -y git
RUN apt-get install -y nano
RUN apt-get install -y chromium

RUN npm install -g npm@10.9.0
RUN npm install -g puppeteer

# Bundle app source
COPY . /usr/src/app/

RUN touch /usr/src/app/.env

RUN npm install
RUN cd node_modules/geoip-lite && npm run-script updatedb license_key=${GEOIP_LICENSE}

RUN npm run build

EXPOSE 3000

# Use dumb-init as the entry point
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["/bin/bash"]
