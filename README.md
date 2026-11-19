# Ylläri-Zombiet

> **In English:** a small browser game (TypeScript, Phaser 4) built with AI, and a cloud work sample.
> Azure guardrails come first, as code: a budget, Azure Policy that denies anything outside the plan or its cheapest
> settings, and a cost anomaly alert, all in Bicep before any resource exists. The game is deployed with GitHub Actions.
> A Python API on Azure Functions keeps the score table and the game data in storage, with daily caps on writes and
> requests so a flood can't run up the bill. Play it at [zombit.gerlitek.fi](https://zombit.gerlitek.fi) (desktop, in Finnish). Docs are in Finnish; code and commits in English.

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
- [Visuaalinen konsepti](https://zombit.gerlitek.fi/konsepti/): hahmojen ja ilmeen suunnittelu, liikkuvat kuvat (lähde `web/public/konsepti/`)
- `docs/architecture.md`: arkkitehtuuri, kustannusrajat ja päätökset
- `docs/tarina-ja-ulkoasu.md`: lapsen alkuperäiset ideat

## Rakenne

| Kansio | Sisältö |
|---|---|
| `web/` | Peli: Vite, TypeScript, Phaser 4 |
| `infra/` | Azure-resurssit Bicepillä |
| `.github/workflows/` | CI/CD |
