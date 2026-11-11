# Reglas del Proyecto FinApp

## Flujo de Trabajo Obligatorio: QA Primero (QA-First)

1. **Siempre implementar y desplegar en QA primero:**
   - Todos los cambios de código, reglas de Firestore, índices o configuración deben desarrollarse sobre la rama `dev` y probarse/desplegarse primero en el ambiente de **QA**.
   - Comando de despliegue a QA: `npm run deploy:qa`
   - URL de QA: `https://finapp-qa.web.app`

2. **Prohibición de tocar Producción sin pedido explícito:**
   - **Nunca** ejecutar `npm run deploy:prod`, hacer merge/push a `main`, ni modificar datos o reglas en el proyecto de Producción (`gen-lang-client-0187524364`) sin que el usuario lo solicite de forma **explícita** después de validar en QA.

3. **Actualización de base de datos QA desde Producción:**
   - Cuando el usuario pida actualizar los datos de QA con Producción, ejecutar `npm run db:sync-qa`.
   - Este script (`scripts/sync-prod-to-qa.mjs`) lee Producción en modo **solo lectura** y escribe únicamente en el proyecto `finapp-qa`, manteniendo Producción intacto.
   - Nunca exponer ni commitear credenciales (`scripts/keys/*.json`, `.env*`).

## Mapa de Ambientes

| Concepto | QA (Desarrollo / Pruebas) | Producción |
| :--- | :--- | :--- |
| **Rama Git** | `dev` | `main` |
| **Firebase Project ID** | `finapp-qa` | `gen-lang-client-0187524364` |
| **Firestore Database ID** | `(default)` | `ai-studio-7acfc9af-7e0a-4798-8750-8aa5612b35a9` |
| **URLs** | `https://finapp-qa.web.app` | `https://finapp-vbeta.web.app` / `https://gen-lang-client-0187524364.web.app` |
| **Script de deploy** | `npm run deploy:qa` | `npm run deploy:prod` *(solo bajo pedido explícito)* |

## Comunicación

- Responder siempre en **español**.
