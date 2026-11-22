# Family tree (Next.js)

Public view-only family tree, collapsed by default. Admin edits via the hidden `/login` page (not linked anywhere).

## Run
```
npm install
cp .env.example .env.local   # then fill in values
node scripts/hash-password.mjs "your password"   # paste output into .env.local
npm run dev
```

## White-label
- Branding/languages: `config/site.ts`
- Family data: `data/family.json` (or set `FAMILY_DATA_FILE`)
- Data access lives in `lib/store.ts` only, so it can be swapped for a database later (SaaS).

## Notes
- Storage: on Vercel, connect a Blob store (Storage tab) and edits save there automatically; locally it uses data/family.json.
