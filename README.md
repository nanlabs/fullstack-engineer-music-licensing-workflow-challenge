# Fullstack Engineer Challenge – Music Licensing Workflow (Backend Only)

Este proyecto implementa la API del desafío técnico, enfocada exclusivamente en el **Backend** ya que mi postulación es para un rol Back End.  
Incluye:  
- Backend en **NestJS**  
- Base de datos **PostgreSQL**  
- **Redis** para sincronización de WebSockets
- Aplicación **dockerizada**  
- Soporte para múltiples instancias vía `docker-compose`
- Pruebas **unitarias** y una prueba de **integración**
- **GitHub Actions CI** (lint + unit tests)

---

## 📦 Tecnologías principales

- **Node.js 20**
- **NestJS**
- **TypeScript**
- **PostgreSQL**
- **Redis**
- **Docker & Docker Compose**
- **Jest** (unit tests + integración)
- **ESLint**
- **GitHub Actions** (CI)

---

# 🚀 Cómo levantar el proyecto

Clonar el repositorio

En la raiz del projecto debes hacer una copia del ```env.example``` y renombrarlo a ```.env```

Asegurate de tener:

- Docker Desktop (Mas comodo para ver los logs)
- Docker Compose

Luego ejecutá desde la raíz del proyecto:

```
docker compose up --watch --build
```

Esto levanta:
 - backend (instancia 1)
 - backend-2 (instancia 2 para simular WebSockets distribuidos)
 - postgres
 - redis

Podras ver el swagger en
Backend 1: ```http://localhost:3000/api/v1/swagger```
Backend 2 (Para probar websockets): ```http://localhost:3001/api/v1/swagger```                                    

Tambien tienes disponible en la carpeta ```docs``` el archivo ```NaNLABS Challenge.postman_collection.json``` que es la colection de postman para poder probar todos los endpoints, este esta scripteado de tal forma que cuando crees por ejemplo una movie el id se asigna directamente a las otra peticionas haciendolo muy comodo de probar

Tambien en en cuenta que en cualquier momento puedes usar el endpoint seed, ya sea desde postman o swagger, eso borra las dbs y carga datos de prueba
Recomiendo hacerlo para probar de manera comoda

---

# 🛢️ Cómo ver Database

Pueden ver la db con pgAdmin, ingresando a ```http://localhost:5050/```
Email: __admin@example.com__
Password: __admin123__

Agregar DB a pgAdmin
Click derecho en __Servers__ > __Regsiter__ > __Server..__
En _Name_, poner cualquier nombre, en la pestaña _Connection_, en _Host name/adress_ poner "__db__" y en _Username_ y _Password_ poner "__postgres__", se clickea _Save_ y con esto ya podras ver la db

*(Luego dentro de la db, vas a databases > music >schemas > public > tables y veras las disitntas tablas, haciendo click derecho sobre cualquier tabla en View/Edit Data > All Rows, asi podras ver los datos)*

---

#  Como probar Websockets

Primero recomiendo usar el ```seed``` para ya dejar los datos listos

Recomiendo primero que nada abrir ambos swaggers
Backend 1: ```http://localhost:3000/api/v1/swagger```
Backend 2: ```http://localhost:3001/api/v1/swagger```

Precionar F12 en ambos y poner la consola del navegador

En la carpeta ```docs``` copiara el contenido del archivo ```test-socket.js```, y lo pegaras en ambas consolas, con eso estamos haciendo el join al websocket para una de las scenes el seed, (tambien puedes cambiarlo y usar uno propio en el file dice hay un comentario que dice donde cambiarlo)

Y listo, ahora deberias ya ahi mismo desde cualqueira de los swaggers o postman y ejecutar el ```PATCH /api/v1/tracks/status/tracks/6ae31240-2601-4b68-a8d4-21bb06e75ab9``` (en swagger es el que esta por default en el try out)

Al ejecutar veras el log de aviso de cambio de estado en ambas consolas, lo cual al ser cada uno de un backend distinto, demuestra el funcionamiento del webhook y la sincronizacion de instancias a travez de redis