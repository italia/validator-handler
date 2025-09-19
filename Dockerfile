# syntax=docker/dockerfile:1@sha256:dabfc0969b935b2080555ace70ee69a5261af8a8f1b4df97b9e7fbcf6722eddf

FROM node:20.15-bookworm-slim@sha256:b21bcf3e7b6e68d723eabedc6067974950941167b5d7a9e414bd5ac2011cd1c4

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
