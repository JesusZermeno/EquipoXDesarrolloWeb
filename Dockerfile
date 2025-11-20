# Imagen base de Node (ligera)
FROM node:18-alpine

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# 1) Copiamos SOLO los package.json del backend para instalar deps
COPY api/package*.json ./api/

# Nos movemos a la carpeta del backend
WORKDIR /app/api

# Instalamos dependencias de producción
RUN npm install --only=production

# 2) Ahora copiamos TODO el proyecto (api + public + demás)
WORKDIR /app
COPY . .

# Volvemos a la carpeta de la API para ejecutar desde ahí,
# igual que haces localmente con "cd api"
WORKDIR /app/api

# Puerto que expone Express
EXPOSE 3000

# Comando para levantar el server (usa el script "start")
CMD ["npm", "start"]
