# Ylläri-Zombiet

> **In English:** a small browser game (TypeScript, Phaser 4) built with AI, and a cloud work sample. Azure guardrails as code
> (budget, Azure Policy, cost alert, daily caps), a keyless Python API on Azure Functions, raw JSON events refined nightly
> into a curated Parquet layer, and a static dashboard. Play it at [zombit.gerlitek.fi](https://zombit.gerlitek.fi) (desktop, in Finnish).
> Docs are in Finnish; code and commits in English.

Pieni selainpeli: taistele zombieita vastaan. Pelin idea, tarina ja hahmot ovat lapsen suunnittelemia.

Projekti on samalla työnäyte pilvikehityksestä: Azure, Bicep, CI/CD ja datakerrokset. Pelin tapahtumat tallentuvat raw-kerrokseen (JSON, poistuu 30 vrk:n jälkeen). Yöajo kirjoittaa niistä curated-kerroksen (Parquet) ja yhteenvedon, jota [tilastosivu](https://zombit.gerlitek.fi/tilastot/) näyttää.

## Arkkitehtuuri

```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TD
    Game["&nbsp;&nbsp;&nbsp;&nbsp;Peli selaimessa&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;"] -->|"&nbsp;tapahtumat&nbsp;"| API
    GH["&nbsp;&nbsp;&nbsp;&nbsp;GitHub Actions&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;"] -->|"&nbsp;OIDC deploy&nbsp;"| API
    subgraph Azure["Azure, kaikki Bicepillä"]
        API["&nbsp;&nbsp;&nbsp;&nbsp;Functions API&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;"]
        Scores[("&nbsp;&nbsp;&nbsp;&nbsp;Table: pisteet&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;")]
        Raw[("&nbsp;&nbsp;&nbsp;&nbsp;Blob: raw JSON&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;")]
        Night["&nbsp;&nbsp;&nbsp;&nbsp;Yöajo: siivous&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;"]
        Cur[("&nbsp;&nbsp;&nbsp;&nbsp;Blob: curated Parquet&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;")]
        API --> Scores
        API --> Raw
        Raw --> Night
        Night --> Cur
    end
    Cur -->|"&nbsp;GET /api/stats&nbsp;"| Dash["&nbsp;&nbsp;&nbsp;&nbsp;Tilastosivu&nbsp;&nbsp;&nbsp;&nbsp;<br/>&nbsp;"]
```

Kustannussuojat: budjetti, Policy, vuorokausikatot kirjoituksille ja pyynnöille sekä lokikatto. Tallennustilaan ei pääse avaimilla, vaan API käyttää hallittua identiteettiä. Perustelut: `docs/architecture.md`.

## Dokumentit

- `docs/game-design.md`: pelisuunnitelma
- [Visuaalinen konsepti](https://zombit.gerlitek.fi/konsepti/): hahmojen ja ilmeen suunnittelu, liikkuvat kuvat (lähde `web/public/konsepti/`)
- `docs/architecture.md`: arkkitehtuuri, kustannusrajat ja päätökset
- `docs/tarina-ja-ulkoasu.md`: lapsen alkuperäiset ideat

## Rakenne

| Kansio | Sisältö |
|---|---|
| `web/` | Peli ja tilastosivu: Vite, TypeScript, Phaser 4, Chart.js |
| `api/` | API: Azure Functions (Python), pistetaulukko, telemetria ja yöllinen curated-ajo |
| `infra/` | Azure-resurssit Bicepillä |
| `azure.yaml` | azd: Azure-puolen provisiointi ja deploy |
| `.github/workflows/` | CI/CD: infra, api ja web. Azure-kirjautuminen OIDC:llä, julkaisu hyväksynnän takana |
| `docs/` | Dokumentit |

## Kehitys

```
cd web
npm install
npm run dev     # peli osoitteessa http://localhost:5173
npm test        # yksikkötestit (Vitest)
npm run build   # tyyppitarkistus ja tuotantoversio kansioon dist/
```

Tilastosivu kehitystilassa keksityillä luvuilla: http://localhost:5173/tilastot/?demo

API (Python 3.12), samat komennot kuin CI:ssä:

```
cd api
pip install -r requirements.txt pytest ruff
ruff check .
pytest -q
```
