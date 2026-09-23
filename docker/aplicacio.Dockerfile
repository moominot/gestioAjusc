# L'aplicació Next.js, per servir-la a la rèplica sense tenir Node al servidor.
#
# Les NEXT_PUBLIC_ s'incrusten en compilar, i per això entren com a arguments
# de construcció i no com a variables d'entorn: si canvien, cal tornar a
# construir la imatge (docker compose up -d --build aplicacio).

FROM node:22-alpine AS construccio
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm test && npm run typecheck && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=construccio /app ./
EXPOSE 3000
CMD ["npm", "start"]
