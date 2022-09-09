FROM node:18.9-alpine
WORKDIR /usr/src/vault-cert-finder
COPY . ./
RUN yarn
ENTRYPOINT ["yarn", "start"]