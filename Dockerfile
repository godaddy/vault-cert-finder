FROM node:19.3-alpine
WORKDIR /usr/src/vault-cert-finder
COPY . ./
RUN yarn
ENTRYPOINT ["yarn", "start"]