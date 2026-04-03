FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./tsconfig.json
COPY server/src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    r-base \
    r-cran-jsonlite \
    r-cran-readxl \
    r-cran-dplyr \
    r-cran-stringr \
  && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server/scripts ./scripts
COPY server/data ./data
RUN Rscript /app/scripts/preprocess_admission_data.R /app/data/admission_training_data_01.xlsx /app/data/admission_training_data_01.rds \
  && Rscript /app/scripts/preprocess_admission_data.R /app/data/admission_training_data_02.xlsx /app/data/admission_training_data_02.rds
EXPOSE 3001
CMD ["node", "dist/index.js"]
