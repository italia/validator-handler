# syntax=docker/dockerfile:1

FROM node:20.15.0-buster-slim

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
RUN npx puppeteer browsers install chrome@116.0.5845.96
RUN npx puppeteer browsers install chrome
RUN cd node_modules/geoip-lite && npm run-script updatedb license_key=${GEOIP_LICENSE}

RUN npm run build

EXPOSE 3000

# Use dumb-init as the entry point
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["/bin/bash"]
