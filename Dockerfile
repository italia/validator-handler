# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

FROM node:22.21-bookworm-slim@sha256:f9f7f95dcf1f007b007c4dcd44ea8f7773f931b71dc79d57c216e731c87a090b

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
