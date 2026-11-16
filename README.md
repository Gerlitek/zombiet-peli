# Ylläri-Zombiet

Pieni selainpeli: taistele zombieita vastaan. Pelin idea, tarina ja hahmot ovat lapsen suunnittelemia.

Projekti on samalla työnäyte pilvikehityksestä: Azure, Bicep, CI/CD ja datakerrokset.

## Kehitys

```
cd web
npm install
npm run dev     # peli osoitteessa http://localhost:5173
npm test        # yksikkötestit (Vitest)
npm run build   # tyyppitarkistus ja tuotantoversio kansioon dist/
```

## Dokumentit

- `docs/game-design.md`: pelisuunnitelma
- `docs/visual-concept.html`: visuaalinen konsepti (avaa selaimessa)
- `docs/architecture.md`: arkkitehtuuri, kustannusrajat ja päätökset
- `docs/tarina-ja-ulkoasu.md`: lapsen alkuperäiset ideat

## Rakenne

| Kansio | Sisältö |
|---|---|
| `web/` | Peli: Vite, TypeScript, Phaser 4 |
| `infra/` | Azure-resurssit Bicepillä |
| `.github/workflows/` | CI/CD |
