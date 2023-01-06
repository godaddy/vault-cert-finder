FROM node:19.4-alpine
WORKDIR /usr/src/vault-cert-finder
COPY . ./
RUN yarn
ENTRYPOINT ["yarn", "start"]