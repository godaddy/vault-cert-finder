FROM node:18.10-alpine
WORKDIR /usr/src/vault-cert-finder
COPY . ./
RUN yarn
ENTRYPOINT ["yarn", "start"]