# Changelog
---
## [1.3.2](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/compare/v1.3.2..v1.3.1) - 2025-10-03

### 🐛 Bug Fixes

- updated GET:/movies endpoint to return paginated data, also updated docs and tests - ([7134b12](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/7134b1241065314b480d0799ed110ff4be031857)) - holubba

### 🚜 Refactor

- added version to release script and swagger - ([3c19835](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/3c19835c13e3f900d52b2c6bba641c235918a0ea)) - holubba

### ⚙️ Miscellaneous Tasks

- **(setup)** updated package-json and froze dependencies versions - ([bc89781](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/bc89781f65683f4bc3cc2c76f46d1753d885ec63)) - holubba

---
## [1.3.1](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/compare/v1.3.1..v1.3.0) - 2025-10-02

### 🐛 Bug Fixes

- modified error body to make it more declarative. - ([f7ac89b](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/f7ac89b3b1734ea5741d98aa986a8eb7903b7105)) - holubba
- fixed error code displayed in swagger docs and added 409 status code docs - ([91aad6f](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/91aad6f1c9ac01c37e3e3702535bd06fa0b0a09f)) - holubba

---
## [1.3.0](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/compare/v1.3.0..v1.2.0) - 2025-10-01

### ⛰️  Features

- **(docs)** added changelog url to swagger - ([d22c006](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/d22c006809ccc4eb50ba1ee0c71f0d38fb545cae)) - holubba

### 🐛 Bug Fixes

- small type fix in the parseError helper - ([deb6bcb](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/deb6bcb9a12bb001d3a0e554c8570460301ad5f8)) - holubba

---
## [1.2.0](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/compare/v1.2.0..v1.1.1) - 2025-10-01

### ⛰️  Features

- added better error handling in class-validator pipe - ([c990e88](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/c990e8802208933511884b34bbe83699a0043771)) - holubba

---
## [1.1.1](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/compare/v1.1.1..v1.1.0) - 2025-09-30

### 📚 Documentation

- added extras to readme - ([1d8b0ee](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/1d8b0eeb95690b6a596a6993e21e3f56eb596d30)) - holubba

---
## [1.1.0](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/compare/v1.1.0..v1.0.0) - 2025-09-30

### ⛰️  Features

- added get track by id endpoint and linted the project - ([67ce1da](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/67ce1da213e7d1225fae81ee67ce25ce24cf39df)) - holubba
- added state machine logic to licenses status - ([4bc1cbc](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/4bc1cbc92ba9cce911b202720dfbc23dc5566f53)) - holubba
- added POST create scene endpoint - ([ec15462](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/ec154625c3c4b2a11f76a28c4d2776eb46c9fd62)) - holubba
- added tooling to scaffold new entities - ([cbfa087](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/cbfa087610c66d31f430705908bb68e8f59dfec8)) - holubba
- added custom flags to schematics - ([9961485](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/9961485d718fbe9d8a337daaf75c3c2dc1a2a4b5)) - holubba
- added create song endpoint - ([766af8b](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/766af8bb78060e86c2c137ae3b6b0672c5f8fef4)) - holubba
- added create movie endpoint - ([fb10b5c](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/fb10b5ca0bb8b36e1fc8a957364a1ac2e5db027b)) - holubba
- added a override message option for throw error function plus a fix to the create song outgoing dto - ([d6c0356](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/d6c0356198c6f826fc1c6adfdc4a1429ce29d926)) - holubba
- added lefthook for linted commits - ([36083b0](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/36083b0a2ec989c659a81646fbfeb898e556f726)) - holubba
- added git-cliff for changelog building - ([0f70fe8](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/0f70fe84eca9e0e69c889a78541ea44b4cdb3cd6)) - holubba

### 🐛 Bug Fixes

- **(base-entity)** added a base entity for cleaner entity classes - ([946fe1a](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/946fe1a6d79c7599ff887bebdfff8de585c1e411)) - holubba
- **(docs)** added missing npm i statement necessary to run tests. - ([73fce38](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/73fce380fa6d096c9380227d69bee809785842d1)) - holubba
- **(file-structure)** changed file structure to better match clean architecture model - ([5d14228](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/5d142280a9fd3a93d11df8b5ef346750aa510f4e)) - holubba
- **(file-structure)** more file structure cleanup work - ([3bbdeb9](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/3bbdeb958caab503b5186e013d1b7ba2facd3ee6)) - holubba
- **(file-structure)** more file structure cleanup work - ([4d90c61](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/4d90c61c4c8a8a5ac71ec84400e37a5f8f435722)) - holubba
- **(file-structure)** improved constants files structure - ([991d9e8](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/991d9e867dc4dc1f948f09b46008cc8029b92cd4)) - holubba
- **(file-structure)** made some more changes to file structure to make it clearer - ([5565e20](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/5565e20e06cb177e287e0ada88270167a4ff3529)) - holubba
- fixed clean architecture type problem - ([3acd030](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/3acd0305f071c886dd134d02ec2cc1c0f4293366)) - holubba
- removed unused wrapper and added JsDocs to some utils - ([de71958](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/de71958eb60340fa63d7406e74e64899c85942aa)) - holubba
- renamed domain repositories interfaces to make a clearer structure - ([48044b6](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/48044b6c6f65a9fd036a89c5437c66eca62cff2c)) - holubba
- moved SSE logic to the service layer - ([51463a1](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/51463a1bbbfdd763ba2f906527bc4395816b8cf6)) - holubba
- improved file structure - ([df15f68](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/df15f689f4c8849da30365000dc3c06fa4ef7387)) - holubba
- moved tests setup files into test folder, deleted unneccesary npmignore - ([5160f97](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/5160f9784283bbcd126b149606e3afffb48f1581)) - holubba
- added new status to migration - ([046238e](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/046238e11a0256ef26d0ed3a5c72f744af9fd83f)) - holubba
- added checks to the entities - ([2a32c2f](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/2a32c2fde284510d9749259d214653fbe928c506)) - holubba
- added some types to the serializer - ([70a647d](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/70a647dd00de6aa07332bc4cac5ae80e1c206bcd)) - holubba
- reverted tool to commonjs since it doesnt support esm imports - ([a329dd8](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/a329dd8da64f53b2e6b5df22ae9f3d1088f614ad)) - holubba
- fixed script name in lefthook config file - ([54805f6](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/54805f6ab8c3f326badc3bff1e99027d497ae09d)) - holubba

### 🧪 Testing

- added e2e test for all state machine transitions - ([aa7efd6](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/aa7efd6cc2e4118094835cf53aae30861f0db6a0)) - holubba
- refactor to make test clearer - ([e7dda9a](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/e7dda9a1e0a5d3df4d7b8eb71c66b3a8931d57a1)) - holubba

### ⚙️ Miscellaneous Tasks

- added missing health tag - ([1fbb2ed](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/1fbb2edcf7e1402e3f6068ad940e3831919bfa52)) - holubba
- renamed a couple of files - ([cccd33e](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/cccd33eec39dc459a55d6f631cab729a61ed5d5a)) - holubba
- linted codebase - ([323fc88](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/323fc88ec9c297ec182853a8c70fbb129d01c263)) - holubba

---
## [1.0.0] - 2025-09-22

### ⛰️  Features

- **(first-deliverable)** added endpoint to add a track and associate it with a song - ([01e47aa](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/01e47aab0acca47d71e4f25096e257ed74e5b959)) - holubba
- **(last-two-deliverables)** added SSE endpoint and GET endpoint to fetch all movies. - ([00b8840](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/00b8840422141efa95637231453bc587d69027ac)) - holubba
- **(readme)** added readme - ([d6ee7e5](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/d6ee7e5193dd71c02ade16f208aea0afc938ec9b)) - holubba
- **(second-deliverable)** added licenses status update with license history tracking - ([5cfcdf3](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/5cfcdf3953dbd7e13b2af348a74ad44bb3bf8e14)) - holubba
- scaffolding and basic funtionality - ([8b7ef53](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/8b7ef53925e77ce81b6fb038c97958390a56be55)) - holubba
- added inverse relationships in entities and added base migrations and seeds - ([611d70f](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/611d70fef540b654bcd0aa42152aa698fb6c644b)) - holubba
- modified error normalizer to add new throw error method - ([77cf3dd](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/77cf3dd825601c885ee67b1414b375e0f51e4935)) - holubba
- added basic get movies by id endpoint - ([989f23b](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/989f23b91e921e3c937763f28c79948db6a66ca5)) - holubba
- added constants files - ([50c92bd](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/50c92bdef2276a1aff9300de35cd9c11811437c7)) - holubba

### 🐛 Bug Fixes

- **(error-normalizer)** modified error normalizer so it shows class validator exceptions correctly - ([7668a08](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/7668a08a7b7874124bd35e24af8f76f98c72d4c0)) - holubba
- **(general-bug-fix)** tested the endpoints and made modifications to fix bugs - ([c68c32e](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/c68c32e6523912555268f9d5eae1efe893430929)) - holubba
- **(migrations)** modified migrations to match new entities - ([9826c08](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/9826c08654985e65d2806f81d93a5441a75b6932)) - holubba
- added entities to get entities method and ditched base entity idea - ([9bac98a](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/9bac98ab1aa0e9372ee588a3bcaf4a28ac47a9b2)) - holubba
- status update on SSE endpoint - ([7730b3c](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/7730b3c94a8d6f8fbc268bcd4bc43bf2b29e5086)) - holubba
- renamed folder for better structure - ([bc44198](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/bc441980db11fd0ea8c2ab1c3b7c7fc87b8f1d87)) - holubba
- Update README.md - ([3781df4](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/3781df462fcee009977c5d16d47de3611d725c5c)) - holubba
- deleted unused dependencies and modified lint rules - ([909dee4](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/909dee414f942c75cf4182e1d81a3155f02f9469)) - holubba
- small naming modification - ([51185af](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/51185afd17f609ed82a0272e8dcd449a99353ae1)) - holubba

### 🧪 Testing

- added e2e tests with test containers - ([36f3694](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/36f3694f767463d1d23bee9e57502985caf5764c)) - holubba

### ⚙️ Miscellaneous Tasks

- **(lint)** linted project - ([9ed5921](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/9ed59217074189c7874e1c49ea7eb06fffad12ae)) - holubba
- updated env.example and deleted unused files - ([4540598](https://github.com/holubba/fullstack-engineer-music-licensing-workflow-challenge/commits/4540598ffae5262bc3716019d365a5e1a041cad0)) - holubba

