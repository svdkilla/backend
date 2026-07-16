FROM alpine:3.19 AS frontend
WORKDIR /opt/frontend

ARG BRANCH=main
ARG FRONTEND_VERSION=2.8.1
ARG FRONTEND_URL=https://github.com/remnawave/frontend/releases/download/${FRONTEND_VERSION}/remnawave-frontend.zip
ARG FRONTEND_SHA256=38facb318f9f8282fa76f5cdfa92bb0c37a96cd5e9b842fe8d1c952b91532dc1
ARG WASM_EXEC_SHA256=0c949f4996f9a89698e4b5c586de32249c3b69b7baadb64d220073cc04acba14
ARG XRAY_SCHEMA_SHA256=56fcad2cb142ae3315c2b7142846ef098b384d71899ed7af1082fc0a7448d465
ARG XRAY_SCHEMA_CN_SHA256=98666e1aaebc507c3f1e55207c3d7858c62bdf1e086f17ca950ba2b80382ad4a
ARG VALIDATOR_WASM_SHA256=48cc137cfe4b90784385bb5f255f5ab7b9b780bdca62a9b19bbeb5efa3e59bce

RUN apk add --no-cache curl unzip ca-certificates \
    && curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "${FRONTEND_URL}" -o frontend.zip \
    && curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://validator.remna.dev/wasm_exec.js -o wasm_exec.js \
    && curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://validator.remna.dev/xray.schema.json -o xray.schema.json \
    && curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://validator.remna.dev/xray.schema.cn.json -o xray.schema.cn.json \
    && curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://validator.remna.dev/main.wasm -o main.wasm \
    && printf '%s  %s\n' \
        "${FRONTEND_SHA256}" frontend.zip \
        "${WASM_EXEC_SHA256}" wasm_exec.js \
        "${XRAY_SCHEMA_SHA256}" xray.schema.json \
        "${XRAY_SCHEMA_CN_SHA256}" xray.schema.cn.json \
        "${VALIDATOR_WASM_SHA256}" main.wasm \
        | sha256sum -c - \
    && unzip frontend.zip -d frontend_temp \
    && mv wasm_exec.js xray.schema.json xray.schema.cn.json main.wasm frontend_temp/dist/assets/

FROM node:24.18-trixie-slim AS backend-build
WORKDIR /opt/app

# RUN apk add python3 python3-dev build-base pkgconfig libunwind-dev

#ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x,linux-musl-arm64-openssl-3.0.x
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x,linux-arm64-openssl-3.0.x


COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY patches ./patches


RUN npm ci --prefer-offline --no-audit --no-fund

COPY . .

RUN npm run migrate:generate

RUN npm run build

RUN npm cache clean --force 

RUN npm prune --omit=dev

FROM node:24.18-trixie-slim

LABEL org.opencontainers.image.title="Remnawave"
LABEL org.opencontainers.image.description="Powerful proxy management tool"
LABEL org.opencontainers.image.url="https://github.com/remnawave/backend"
LABEL org.opencontainers.image.source="https://github.com/remnawave/backend"
LABEL org.opencontainers.image.vendor="Remnawave"
LABEL org.opencontainers.image.licenses="AGPL-3.0"
LABEL org.opencontainers.image.documentation="https://docs.rw"

WORKDIR /opt/app

ARG BRANCH=main

ARG __RW_METADATA_VERSION=1.1.1
ARG __RW_METADATA_GIT_BACKEND_COMMIT=0f344f388807f5323b49024a563b3f8146d66857
ARG __RW_METADATA_GIT_FRONTEND_COMMIT=0f344f388807f5323b49024a563b3f8146d66857
ARG __RW_METADATA_GIT_BRANCH=dev
ARG __RW_METADATA_BUILD_TIME=2011-11-11T11:11:11Z
ARG __RW_METADATA_BUILD_NUMBER=0

# Install jemalloc
# RUN apk add --no-cache jemalloc
# ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2
# libunwind
# Install mimalloc
#RUN apk add --no-cache mimalloc2 curl
#ENV LD_PRELOAD=/usr/lib/libmimalloc.so.2


RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV REMNAWAVE_BRANCH=${BRANCH}
ENV PRISMA_HIDE_UPDATE_MESSAGE=true
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

ENV PM2_DISABLE_VERSION_CHECK=true
ENV PM2_HOME=/tmp/pm2
ENV NODE_OPTIONS="--max-old-space-size=16384"

ENV __RW_METADATA_VERSION=${__RW_METADATA_VERSION}
ENV __RW_METADATA_GIT_BACKEND_COMMIT=${__RW_METADATA_GIT_BACKEND_COMMIT}
ENV __RW_METADATA_GIT_FRONTEND_COMMIT=${__RW_METADATA_GIT_FRONTEND_COMMIT}
ENV __RW_METADATA_GIT_BRANCH=${__RW_METADATA_GIT_BRANCH}
ENV __RW_METADATA_BUILD_TIME=${__RW_METADATA_BUILD_TIME}
ENV __RW_METADATA_BUILD_NUMBER=${__RW_METADATA_BUILD_NUMBER}

COPY --chown=node:node --from=backend-build /opt/app/dist ./dist
COPY --chown=node:node --from=frontend /opt/frontend/frontend_temp/dist ./frontend
COPY --chown=node:node --from=backend-build /opt/app/prisma ./prisma
COPY --chown=node:node --from=backend-build /opt/app/node_modules ./node_modules

COPY --chown=node:node configs /var/lib/remnawave/configs
COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma.config.ts ./prisma.config.ts

COPY --chown=node:node ecosystem.config.js ./
COPY --chown=node:node docker-entrypoint.sh ./

# Keep shell entrypoints portable when the build context comes from Windows.
RUN sed -i 's/\r$//' docker-entrypoint.sh \
    && sh -n docker-entrypoint.sh

RUN npm install --global pm2@7.0.3 \
    && npm cache clean --force \
    && npm link

USER node


ENTRYPOINT [ "/bin/sh", "docker-entrypoint.sh" ]

CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
