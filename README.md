# Seguimiento de promociones

Aplicación web interna (React + TypeScript + Vite, Supabase) para el seguimiento de promociones.

## Requisitos previos

- Node 24
- Docker (en marcha, lo usa Supabase local)

## Arranque local

```bash
npm install
npx supabase start          # levanta Supabase local
cp .env.example .env.local  # y rellenar la anon key de `npx supabase status`
                            # (puertos locales 544xx para no chocar con otros proyectos Supabase)
npm run dev
```

## Pruebas

```bash
npm run env:test   # genera .env.test desde `supabase status -o env` (una vez por stack)
npm test           # pruebas unitarias
npm run test:int   # pruebas de integración (requiere Supabase en marcha)
```

## Otros comandos

- `npm run db:reset`: recrea la base de datos y aplica las migraciones.
- `npm run tipos`: regenera `src/lib/database.types.ts`.
- `npm run build`: compilación de producción.
