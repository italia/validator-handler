# syntax=docker/dockerfile:1

FROM node:16.17.0-buster-slim

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied

# Create app directory
WORKDIR /usr/src/app/

RUN apt-get update

RUN apt-get install -y chromium

RUN npm install -g npm@8.19.2

# Bundle app source
COPY . /usr/src/app/

RUN touch /usr/src/app/.env

RUN npm install --verbose

RUN npm run build

EXPOSE 3000
CMD [ "/bin/bash" ]
