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

## Estándar UX/UI: Modales y Diálogos Fintech Mobile

Para todos los modales, diálogos y popups con o sin inputs que se implementen en FinApp:

1. **Centrado vertical dinámico (anti-bloqueo por teclado virtual):**
   - **Nunca** utilizar bottom sheets anclados exclusivamente abajo (`items-end p-0`) cuando haya campos de entrada o formularios, ya que el teclado móvil en Safari iOS y Chrome Android los tapa.
   - El contenedor exterior siempre debe estructurarse como:
     ```tsx
     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
     ```
   - La tarjeta del modal siempre debe usar:
     ```tsx
     <motion.div
       initial={{ opacity: 0, scale: 0.95, y: 15 }}
       animate={{ opacity: 1, scale: 1, y: 0 }}
       exit={{ opacity: 0, scale: 0.95, y: 15 }}
       transition={{ type: 'spring', damping: 25, stiffness: 350 }}
       className="relative w-full max-w-md sm:max-w-lg bg-surface-container-lowest rounded-[2rem] sm:rounded-[2.5rem] border border-on-surface/10 shadow-2xl p-5 sm:p-6 z-10 overflow-y-auto no-scrollbar flex flex-col max-h-[85dvh] my-auto"
     >
     ```

2. **Unidades de altura dinámica (`dvh`):**
   - Utilizar siempre `max-h-[85dvh]` en vez de `vh` para que el límite de altura responda en tiempo real a la aparición/ocultamiento del teclado virtual del celular.

3. **Backdrop limpio sin parpadeo de color ni destellos:**
   - Evitar colisiones entre clases CSS de Tailwind (`transition-opacity`) y animaciones de `framer-motion`:
     ```tsx
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       exit={{ opacity: 0 }}
       transition={{ duration: 0.15, ease: 'easeOut' }}
       onClick={onClose}
       className="fixed inset-0 bg-black/60 backdrop-blur-xs"
     />
     ```
   - Mantener el blur suave (`backdrop-blur-xs`) y con aislamiento (`isolate`) en la sección de fondo para prevenir artefactos en la GPU móvil.

