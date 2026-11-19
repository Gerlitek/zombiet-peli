# Arkkitehtuuri ja päätökset

Tämä dokumentti kirjaa kokonaisarkkitehtuurin ja perustelut. Tavoite on pieni, luettava ja halpa kokonaisuus, jonka jokaisen ratkaisun voi perustella. Pelin sisältö on tiedostossa `game-design.md`.

Kova vaatimus: peli on mahdollisimman ilmainen, eikä yllätyskuluja saa tulla. Jokainen uusi resurssi arvioidaan tätä vasten ennen kuin se lisätään (luku 7).

## 1. Kokonaiskuva

```
Selain
  │  zombit.gerlitek.fi  (staattinen front: Vite + TypeScript + Phaser 4)
  │
  └─ HTTPS, CORS vain pelin domain
       │
       ▼
  Azure Functions (Python)                        resurssiryhmä rg-zombies
    POST /api/events ──────────► Blob  raw/      NDJSON, poistuu 30 vrk
    POST /api/scores ──────────► Table scores
    GET  /api/leaderboard ◄───── Table scores
    GET/POST /api/messages ◄───► Table messages
    GET  /api/stats ◄─────────── Blob  curated/dashboard/summary.json
    ajastin, kerran vuorokaudessa:
        raw/ (JSON) ──► curated/ (Parquet) ──► summary.json
       │
       └─► Application Insights (vain palvelimen telemetria, päiväkatto)

GitHub Actions ──(OIDC, ei avaimia)──► Azure   Bicep ja API:n koodi
GitHub Actions ──(SSH + rsync)───────► gerlitek   front
Omistaja ──(az, käsin)───────────────► tilaus   budjetti ja bootstrap
```

Versio 1 on pelkkä staattinen front. Peli toimii kokonaan selaimessa, joten ensimmäinen julkaisu ei tarvitse Azurea muuten kuin budjetin.

## 2. Front

### Rakenne

```
web/
  index.html            sivu, gerlitek-ilme
  src/
    main.ts             Phaser-konfiguraatio
    art/                palette.ts, pixels.ts (px, ell, limb, figure), character.ts, scenery.ts
    data/               zombies.ts, weapons.ts, wheels.ts, achievements.ts, nicknames.ts, messages.ts
    logic/              spawn.ts, wheel.ts, score.ts, puzzle.ts, achievements.ts
    systems/            weather.ts, spawner.ts, weapons.ts, telemetry.ts, storage.ts
    scenes/             Boot, Menu, Play, Wheel, Puzzle, Cave, End
  public/fonts/         pikselifontti ja Inter omalta palvelimelta
```

Kolme sääntöä pitävät koodin selitettävänä:

1. **Sisältö on dataa.** Zombi, ase, pyörä ja saavutus ovat rivejä `data/`-kansiossa. Uusi zombi ei vaadi uutta koodia.
2. **Säännöt ovat puhtaita funktioita.** `logic/` ei tuo Phaseria. Arvonnat saavat satunnaislukugeneraattorin parametrina, joten ne voi testata (Vitest) ilman selainta.
3. **Yksi pelikohtaus kahdelle alueelle.** `PlayScene` saa alueen (metsä, VIP) konfiguraationa. Pyörä, hajotelma ja luola ovat omia kohtauksiaan, jotka käynnistetään pelin päälle ja jotka pysäyttävät sen.

### Grafiikka ilman kuvatiedostoja

Hahmot piirretään koodilla osista joka ruutu (ks. `game-design.md`, luku 10, ja `web/public/konsepti/index.html`). Konseptisivun piirtofunktiot käyttävät vain operaatiota "täytä suorakulmio", joten ne siirtyvät sellaisinaan Phaserin `Graphics`-oliolle. Tausta (maa, sammal, kaukaiset puut) piirretään kerran tekstuuriksi.

Riski: noin 10 hahmoa x 250 suorakulmiota ruudussa. WebGL:lle määrä on pieni, mutta se mitataan heti vaiheessa 2 hitaalla laitteella. Varasuunnitelma: hahmon askelsykli piirretään käynnistyksessä valmiiksi tekstuureiksi.

### Tila selaimessa

- `localStorage`: nimimerkki (sanalistojen indeksit), saavutukset, omat parhaat tulokset, hajotelmien taso, ääniasetus.
- `sessionStorage`: satunnainen istuntotunniste (`crypto.randomUUID()`), uusi jokaisessa välilehdessä.
- Ei evästeitä, ei kolmannen osapuolen skriptejä, ei ulkoisia fontteja.

### Telemetria frontissa

`systems/telemetry.ts` tarjoaa yhden funktion `track(event)`. Se kerää tapahtumat puskuriin ja lähettää erän `navigator.sendBeacon`illa VIP-siirtymässä, pelin lopussa ja sivulta poistuttaessa. Ennen API:a toteutus on tyhjä ja kirjoittaa kehitystilassa konsoliin. Peli ei koskaan odota verkkoa: jos API ei vastaa, peli jatkuu ja taulut näyttävät paikalliset tulokset.

## 3. API

Azure Functions, Python, v2-ohjelmointimalli (dekoraattorit, yksi `function_app.py`). Kansio `api/`.

| Reitti | Tehtävä | Rajat |
|---|---|---|
| `POST /api/events` | Tapahtumaerän vastaanotto, kirjoitus raw-kerrokseen | enintään 50 tapahtumaa ja 16 kt |
| `POST /api/scores` | Tuloksen tallennus | yksi tulos per istunto |
| `GET /api/leaderboard` | 10 parasta | välimuisti 60 s |
| `GET /api/messages`, `POST /api/messages` | 20 uusinta valmista viestiä, uuden lähetys | viesti on tunniste listasta |
| `GET /api/stats` | Dashboardin valmis JSON | välimuisti 1 h |
| ajastin `curate` | raw -> curated -> summary | kerran vuorokaudessa |

### Validointi

Jokainen kenttä tarkistetaan sallittujen arvojen listaa vasten (tapahtuman nimi, zombityyppi, ase, viestin tunniste, nimimerkin indeksit). Vapaata tekstiä ei ole yhdessäkään kentässä. Tuntemattomat kentät hylätään. Tulokselle tehdään uskottavuustarkistus: tapot 0 - 10, pisteet enintään kaavan maksimi, kesto vähintään 20 s läpäisylle.

Hyväksytty riski: tuloksen voi silti väärentää, koska peli pyörii selaimessa. Panos on leikkipistetaulu, joten tarkistus riittää. Rivin voi poistaa käsin.

### Käytön rajoitus

Functions ei tarjoa valmista rate limitiä, joten se tehdään kolmessa kerroksessa:

1. **Instanssien enimmäismäärä 1** (ks. luku 7). Rajaa rinnakkaisuuden ja laskun.
2. **Istuntokohtainen raja muistissa**: enintään 10 erää minuutissa per `session_id`.
3. **Vuorokausikatto**: laskuri Table Storagessa (esim. 5 000 kirjoitusta / vrk). Kun katto täyttyy, API vastaa 429 ja peli jatkuu ilman verkkoa.

IP-osoitetta ei käytetä rajoitukseen eikä tallenneta mihinkään. Hinta: hyökkääjä voi vaihtaa istuntotunnistetta, jolloin vasta vuorokausikatto pysäyttää hänet. Se on hyväksyttävää, koska katto rajaa kulut.

### Todennus

API on julkinen ja anonyymi, koska peliin ei kirjauduta. CORS sallii vain pelin domainin. CORS ei ole turvamekanismi (se rajoittaa vain selaimia), joten varsinainen suoja on validointi ja rajat.

Function App käyttää tallennustiliä hallitulla identiteetillä (managed identity). Yhteysmerkkijonoja ja avaimia ei ole, ja tallennustilin avainkirjautuminen on pois päältä (`allowSharedKeyAccess: false`).

## 4. Data

### Table Storage

| Taulu | PartitionKey | RowKey | Kentät |
|---|---|---|---|
| `scores` | pelin versio, esim. `v1` | `(999999 - pisteet)` nollilla täytettynä + `_` + session_id | nick (indeksit), score, kills, duration_s, hearts, character, created |
| `messages` | `all` | käänteinen aikaleima + `_` + session_id | nick, message_id |
| `limits` | `daily` (kirjoitukset), `requests` (kaikki pyynnöt), `session` (yksi tulos per istunto) | päivämäärä tai session_id | count |

Table Storage ei osaa lajitella. Rivit palautuvat aina RowKeyn mukaisessa järjestyksessä, joten käänteinen pistemäärä avaimessa tekee kyselystä "10 ensimmäistä riviä" suoraan pistetaulun. Sama temppu käänteisellä aikaleimalla antaa uusimmat viestit. Avain suunnitellaan kyselyn mukaan.

### Blob Storage: kerrokset

```
raw/events/dt=2026-11-16/<session_id>-<erän numero>.ndjson      sellaisenaan vastaanotettu, 30 vrk
curated/events/dt=2026-11-16/part-000.parquet                   validoitu, tyypitetty, deduplikoitu
curated/dashboard/summary.json                                  dashboardin valmis aggregaatti
```

- **raw**: yksi blob per erä, rivi per tapahtuma. API lisää palvelimen aikaleiman. Mitään ei muokata, joten kerroksen voi aina ajaa uudelleen.
- **curated**: ajastettu funktio lukee eilisen päivän raw-kansion, poistaa kaksoiskappaleet avaimella `session_id + seq`, pakottaa tyypit ja kirjoittaa Parquet-tiedoston (`pyarrow`). Ajo on idempotentti: sama päivä tuottaa saman tiedoston ja korvaa vanhan.
- **summary.json**: pieniä aggregaatteja, esim. pelikerrat päivässä, läpäisyprosentti, tapot zombityypeittäin, suosituimmat aseet, hajotelmien osumatarkkuus ja ratkaisuaika tasoittain, Rudi-Karrin saaneiden määrä.
- Osiointi `dt=YYYY-MM-DD` on Hive-tyylinen, joten samat tiedostot voi myöhemmin lukea DuckDB:llä, Sparkilla tai Fabricilla ilman muutoksia.

Elinkaarisääntö poistaa raw-kerroksen 30 vuorokauden jälkeen. Curated säilyy. Se ei sisällä henkilötietoja.

### Dashboard

Staattinen sivu frontissa (`/tilastot`), Chart.js omalta palvelimelta, lukee `GET /api/stats`. Sivu ei tee omia kyselyjä dataan.

## 5. Infra koodina

```
infra/
  budget.bicep          tilaustaso, käsin (olemassa)
  guardrails.bicep      tilaustaso, käsin: Azure Policy ja kustannuspoikkeamahälytys (luku 7)
  bootstrap.bicep       tilaustaso, käsin: resurssiryhmä, identiteetit, roolit
  register-providers.sh tilaustaso, käsin: rekisteröi resource providerit (lista luetaan guardrails.bicepistä)
  main.bicep            resurssiryhmän taso: kokoaa moduulit. Tätä ajavat azd ja CI
  main.parameters.json  azd:n parametrit
  modules/
    monitoring.bicep    Log Analytics + Application Insights, päiväkatto
    storage.bicep       tili, säiliöt raw ja curated, taulut, elinkaarisääntö
    api.bicep           Functions-suunnitelma ja Function App
```

### Kaksi tasoa, kaksi oikeustasoa

| | `budget.bicep`, `guardrails.bicep`, `bootstrap.bicep` | `main.bicep` |
|---|---|---|
| Taso | tilaus | resurssiryhmä |
| Ajaja | omistaja käsin, harvoin | GitHub Actions ja `azd` |
| Sisältö | budjetti, policyt, poikkeamahälytys, providerien rekisteröinti, resurssiryhmä, kaksi hallittua identiteettiä, roolimääritykset | kaikki muu |

**Resource providerit.** Uudessa tilauksessa palvelut ovat rekisteröimättä, ja resurssin luonti kaatuu harhaanjohtavaan virheeseen `SubscriptionNotFound` (todettu 2026-11-17 policy-testissä). Bicep ei voi rekisteröidä providereita, eikä CI-identiteetillä ole siihen oikeutta tilaustasolla. Siksi omistaja ajaa `infra/register-providers.sh`:n ennen bootstrapia ja aina, kun `guardrails.bicep`in sallittuihin tyyppeihin lisätään uusi palvelu. Skripti lukee nimiavaruudet samasta listasta, joten sallitut tyypit ja rekisteröidyt providerit pysyvät samoina.

`bootstrap.bicep` luo:

- resurssiryhmän `rg-zombies`
- identiteetin `id-zombies-github` ja sille federoidun tunnisteen vain GitHub-ympäristölle `production` (subject `repo:Gerlitek@263029107/zombiet-peli@1461639455:environment:production`, GitHubin muuttumaton id-muoto). Pull requesteilla ei ole pääsyä Azureen. Rooli: Contributor, laajuus vain `rg-zombies`.
- identiteetin `id-zombies-api` Function Appille. Roolit resurssiryhmässä: Storage Blob Data Contributor, Storage Table Data Contributor, Monitoring Metrics Publisher ja oma rooli, joka sallii vain toiminnon `Microsoft.Web/sites/stop/action` (kustannusjarru). Aiemmin pysäytykseen käytettiin roolia Website Contributor, mutta se salli myös koodin julkaisun, asetusten muuttamisen ja julkaisutunnusten lukemisen. Vaihdon jälkeen vanha määritys poistetaan kerran käsin: `az role assignment delete --assignee <id-zombies-api:n principalId> --role "Website Contributor" -g rg-zombies`.

Perustelu: roolimääritysten luominen vaatii vahvemmat oikeudet kuin Contributor. Kun ne tehdään käsin bootstrapissa, CI-identiteetti ei koskaan saa oikeutta jakaa oikeuksia. OIDC toteutetaan käyttäjän määrittämällä hallitulla identiteetillä eikä sovellusrekisteröinnillä, jolloin kaikki pysyy Bicepissä eikä Entra ID:hen tarvita erillisiä oikeuksia.

### azd

`azure.yaml` juuressa sisältää yhden palvelun: `api` (`host: function`, `language: python`, `project: ./api`). `azd provision` ajaa `infra/main.bicep`in, `azd deploy` paketoi ja julkaisee API:n. Front ei ole `azure.yaml`:ssa. `azd` tunnistaa kohteen tagista `azd-service-name: api`, joka asetetaan Function Appille Bicepissä.

### Nimet ja alue

Resurssien nimet englanniksi lyhenteillä: `rg-zombies`, `func-zombies-<tiiviste>`, `stzombies<tiiviste>`, `log-zombies`, `appi-zombies`. Tiiviste on `uniqueString(resourceGroup().id)`. Alue: `swedencentral` (tarkista Flex Consumptionin saatavuus ennen käyttöönottoa, vaihtoehto `northeurope`).

## 6. CI/CD

Kolme työnkulkua, jokainen käynnistyy vain oman kansionsa muutoksista.

| Työnkulku | Pull request | Yhdistäminen mainiin |
|---|---|---|
| `web.yml` | tyyppitarkistus, Vitest, build | sama + hyväksyntä ja rsync gerlitekiin |
| `infra.yml` | `az bicep build` ja linter, ei Azure-kirjautumista | `what-if`, hyväksyntä, deploy resurssiryhmään |
| `api.yml` | ruff, pytest | sama + hyväksyntä ja koodin deploy Function Appiin |

- Repo: `github.com/Gerlitek/zombiet-peli`. Federoidun tunnisteen subject käyttää GitHubin numeerisia id:itä (omistaja ja repo), koska uudet repot saavat oletuksena muuttumattoman subjectin (todettu 2026-11-18, kirjautuminen kaatui nimimuotoon). Uudelleennimeäminen ei riko kirjautumista, ja vapautunutta nimeä ei voi ottaa haltuun. Jos repo poistetaan ja luodaan uudelleen, id:t vaihtuvat ja `bootstrap.bicep` on ajettava uudelleen.
- GitHub Actions on yksityisessä repossa maksuton kuukausikiintiön rajoissa (2 000 min/kk). Työnkulut käynnistyvät vain oman kansionsa muutoksista, joten kiintiö ei kulu turhaan.
- Azure-kirjautuminen: `azure/login` OIDC:llä identiteetillä `id-zombies-github`. Repossa on vain kolme tunnistetta (client id, tenant id, subscription id), ei salaisuuksia.
- Deploy mainiin kulkee GitHub-ympäristön `production` kautta, ja ympäristössä on pakollinen manuaalinen hyväksyntä. Federoitu tunniste hyväksyy vain tämän ympäristön, joten Azure-tunnuksen saa vain ajo, jonka omistaja on hyväksynyt. `what-if` ajetaan samassa työssä ennen deployta. Hyväksyntä koskee koko työtä, joten omistaja lukee `what-if`in paikallisesti ennen ajon käynnistämistä, ja putken `what-if` jää lokiin.
- Tilanne 2026-11-18: repo on julkinen ja ympäristö `production` on olemassa (pakollinen hyväksyjä omistaja, ajot sallittu vain haaralle `main`). Federoidun tunnisteen subject on päätetty: `environment:production`. Kaikki kolme deploya käynnistetään käsin (`workflow_dispatch`, vain `main`) ja käyttävät ympäristöä, myös `web.yml` (2026-11-19).
- Hyväksyjä on yksin omistaja, joten portti ei ole kahden henkilön valvonta vaan pysähdyskohta ennen kuin ajo saa Azure-tunnuksen tai SSH-avaimen.
- Actionit on kiinnitetty commit-SHA:han, koska tagin voi siirtää osoittamaan muuta koodia. Dependabot (`.github/dependabot.yml`) avaa kuukausittain pull requestin uusista versioista.
- Front julkaistaan jaetulle webhotellille (Apache) rsyncillä SSH:n yli.
- SSH-avain on ympäristön `production` salaisuus `DEPLOY_SSH_KEY`, joten sen saa vain hyväksytty ajo. Palvelimen käyttäjätunnus on muuttuja `DEPLOY_USER`. Avain on tehty vain tähän, ja palvelimella se on rajattu pelin kansioon (`command=`-rajoitus `authorized_keys`issa, vain rsync).
- Putki tehdään ensin `az`-komennoilla. `azd pipeline config`ia kokeillaan myöhemmin vertailun vuoksi.

## 7. Kustannukset ja rajat

Budjetti `Zombies` (5 USD/kk, hälytykset 50, 80 ja 100 % toteutuneesta sekä 100 % ennustetusta) on käytössä. Lisäksi laskutustilillä on 1 USD:n budjetti.

**Budjetti ei pysäytä mitään.** Se lähettää sähköpostin, ja kustannustieto päivittyy 8 - 24 tunnin viiveellä. Ennustehälytys tarvitsee lisäksi noin viikon historian. Siksi jokaisella resurssilla on oma kova rajansa:

| Resurssi | Raja | Miksi |
|---|---|---|
| Function App | instanssien enimmäismäärä 1, aina valmiina olevia 0, muisti 512 Mt | Suurin yksittäinen kuluriski. Aina valmiina olevat instanssit eivät kuulu ilmaiskiintiöön |
| API | pyynnön enimmäiskoko, vuorokausikatto, validointi | Rajaa suoritukset ja tallennuksen |
| Application Insights | päiväkatto 0,1 Gt, näytteenotto, säilytys 30 vrk | Lokien määrä on Azuren yleisin yllätyslasku |
| Storage | LRS, ei versiointia, raw poistuu 30 vrk | Data pysyy megatavuissa |
| Kaikki | ei Event Hubsia, Stream Analyticsia, Data Factorya, Synapsea, Fabricia | Kiinteä hinta tai korkea minimi |

Budjetin rinnalle tulevat:

- **Azure Policy koko tilaukselle** (`guardrails.bicep`, maksuton). Kaksi deny-sääntöä:
  - *Sallitut resurssityypit*: vain suunnitelman tyypit (tallennustili, Functions-suunnitelma ja Function App, hallittu identiteetti, Log Analytics, Application Insights, hälytykset). Virtuaalikoneet, AKS, tietokannat, IP-osoitteet ja kaikki muu estetään.
  - *Kalliit asetukset*: sallituistakin tyypeistä vain halvin muoto. Functions-suunnitelma vain Flex Consumption (`FC1`). Function Appissa enintään 1 instanssi, muisti enintään 512 Mt, ei aina valmiina olevia instansseja. Tallennustili vain `Standard_LRS`. Log Analytics vain `PerGB2018` ja päiväkatto tasan 0,1 Gt (yhtäsuuruusehto, koska `less`/`greater`-vertailu kaatuu tyyppiristiriitaan, kun kenttä on kokonaisluku, esim. -1 eli rajaton; todettu 2026-11-18, policy epäonnistui turvallisesti eli esti deployn).
  - Policy on tilaustasolla, joten CI-identiteetti (Contributor vain resurssiryhmään) ei voi muuttaa sitä. Uusi resurssityyppi lisätään ensin policyyn ja vasta sitten Bicepiin.
- **Kustannuspoikkeamahälytys** (`guardrails.bicep`, Cost Management, maksuton). Se huomaa äkillisen muutoksen nopeammin kuin kuukausibudjetin prosenttiraja. Hälytyksellä on päättymispäivä, ja se uusitaan vuosittain.
- **Automaattinen pysäytys** samassa vaiheessa kuin Function App luodaan, ei myöhemmin. API:lla on kaksi vuorokausilaskuria taulussa `limits`: kirjoitukset (`DAILY_CAP`, 5000) ja kaikki pyynnöt (`REQUEST_CAP`, 50 000). Pyyntölaskuri tallennetaan 100 pyynnön välein, joten uudelleenkäynnistys ei nollaa sitä (aiemmin se oli vain muistissa, ja isoilla pyynnöillä kaadettu instanssi nollasi katon). Isäntä hylkää yli 32 kt:n rungot (`FUNCTIONS_REQUEST_BODY_SIZE_LIMIT`) ennen koodia. Kun laskuri ylittää katon, API sammuttaa itsensä (hallitulla identiteetillä on oikeus vain pysäyttää). Jos omistaja käynnistää API:n samana päivänä, se vastaa 429 UTC-keskiyöhön asti, ellei laskuririviä poisteta. Tämä ei riipu kustannustiedon viiveestä. Peli jatkaa toimintaansa ilman verkkoa, ja omistaja käynnistää API:n uudelleen käsin.
- **Hätäjarru käsin** kirjattuna README:hen: `az functionapp stop`.

Mitä maksaa, vaikka kukaan ei pelaa: ei mitään kiinteää. Suunnitelmassa ei ole yhtään resurssia, jolla on kuukausimaksu tai vähimmäislaskutus. Ennen jokaista uutta resurssia tarkistetaan hinnastosta, että tämä pätee edelleen.

Arvio normaalikäytön kuluista: alle 0,10 USD/kk. Functions pysyy ilmaiskiintiössä (Flex Consumption: 250 000 suoritusta ja 100 000 Gt-s kuukaudessa), tallennus maksaa sentin osia. Pahin tapaus jatkuvassa väärinkäytössä on automaattisen pysäytyksen ansiosta yhden vuorokausikaton verran suorituksia, eli sentteja. Hinnat ja kiintiöt tarkistetaan hinnastosta ennen käyttöönottoa.

Versio 1 (pelkkä front gerlitekissä) ei käytä Azurea lainkaan, joten sen kulut ovat nolla.

### Kulutarkistus 2026-11-16

Tilauksen tila tarkistettu `az`-komennoilla: ei yhtään resurssia eikä resurssiryhmää, budjetti `Zombies` (5 USD/kk) on voimassa, eikä Defender for Cloud ole käytössä (palveluntarjoajaa `Microsoft.Security` ei ole rekisteröity). Tällä hetkellä tilauksesta ei siis voi syntyä kuluja.

Azuressa ei ole kovaa kulukattoa pay-as-you-go-tilaukselle. Siksi isompi lasku estetään näillä säännöillä, ja jokainen tarkistetaan ennen kuin mitään luodaan:

| Riski | Sääntö | Missä varmistetaan |
|---|---|---|
| Kutsutulva API:in | Instansseja enintään 1, aina valmiina 0, API sammuttaa itsensä vuorokausikaton ylittyessä | `api.bicep`, API:n koodi ja sen testit (`api/tests/test_caps.py`) |
| Lokien määrä | Päiväkatto 0,1 Gt sekä Log Analyticsissa että Application Insightsissa, säilytys 30 vrk, näytteenotto | `monitoring.bicep` |
| Tallennustila | LRS, ei versiointia, ei SFTP:tä (tuntihinta), ei hierarkkista nimiavaruutta, raw poistuu 30 vrk, pyynnön enimmäiskoko 16 kt | `storage.bicep` |
| Maksulliset tietoturvapaketit | Defender for Storage ja Defender for App Service pysyvät pois päältä. Portaali tarjoaa niitä, älä hyväksy | `az security pricing list` ennen ja jälkeen käyttöönoton |
| Väärä resurssi vahingossa (myös tekoälyn tekemänä) | Azure Policy koko tilaukselle: vain suunnitelman resurssityypit ja niiden halvimmat asetukset sallittu. Maksuton | `guardrails.bicep` |
| Vuotanut CI-tunnus | Federoitu tunniste vain ympäristölle `production`, jossa manuaalinen hyväksyntä. Ei tallennettuja salaisuuksia | `bootstrap.bicep`, GitHub-ympäristö |
| Omistajan tunnuksen kaappaus | Vahva MFA | Tilin asetukset |
| Kalliit lisäpalvelut | Ei API Managementia, Front Dooria, Application Gatewayta, NAT-yhdyskäytävää, yksityisiä päätepisteitä, Premium-suunnitelmaa eikä kiinteää IP:tä | Policy, `what-if` ennen jokaista infran julkaisua |
| Unohtuneet resurssit | Kaikki yhdessä resurssiryhmässä. `az group delete` poistaa kaiken kerralla | README |
| GitHub Actions | Tilin kulutusraja 0 USD: minuuttien loputtua ajot pysähtyvät, laskua ei tule | GitHub: Settings, Billing |
| Webhotelli | Kiinteä kuukausihinta, liikennettä ei laskuteta erikseen | Palveluntarjoajan sopimus |

Pahin realistinen tapaus näiden jälkeen: häirikkö täyttää vuorokausikaton, API sammuu, ja kulu on senttejä. Suurin jäljelle jäävä riski ei ole hyökkääjä vaan oma virhe, eli resurssi, joka luodaan väärällä asetuksella. Sitä vastaan ovat Policy, `what-if` ja budjettihälytys.

### Jäännösriski (2026-11-17)

Pay-as-you-go-tilauksella ei ole kovaa kulukattoa, joten suojaus tehdään kerroksittain:

1. **Ei Azurea ennen kuin sitä tarvitaan.** Versio 1 on webhotellissa ilman Azurea. Tilauksessa on vain budjetti ja maksuttomat suojaukset siihen asti, kunnes API tehdään.
2. **Policy**: kalliita resursseja ei voi luoda kukaan muu kuin omistaja, ei edes vahingossa.
3. **Kovat rajat resursseissa**: yksi 512 Mt:n instanssi, API sammuttaa itsensä vuorokausikaton ylittyessä, lokien päiväkatto.
4. **Hälytykset**: budjetti ja poikkeamahälytys. Viive 8 - 24 h, siksi vain varaverkko.

Pahimmat tapaukset kerrosten jälkeen (hinnat tarkistettava hinnastosta ennen vaihetta 5):

| Tapaus | Arvio |
|---|---|
| Normaali käyttö | alle 0,10 USD/kk |
| Kutsutulva, automaattinen pysäytys toimii | senttejä |
| Kutsutulva, pysäytys ei toimi, yksi instanssi täysin kuormitettuna koko kuun | noin 30 USD (0,5 Gt x 2,6 milj. s, josta ilmaiskiintiö vähennetty) |
| Lokit | 0,1 Gt/vrk katto, eli enintään noin 3 Gt/kk, mikä mahtuu Log Analyticsin kuukausittaiseen ilmaisosuuteen |
| Omistajan tunnus kaapattu | rajaton. Torjunta: MFA. Hätäjarrut: `az group delete --name rg-zombies`, tilauksen peruutus, Azure-tukipyyntö heti |

Tilanne 2026-11-20: laskurit ja pysäytyksen laukaisu on testattu yksikkötesteillä, mutta pysäytystä ei ole testattu tuotannossa kuormalla. Testi: matala `REQUEST_CAP` app settingiksi, pyyntöjä yli katon, API:n pitää pysähtyä, ja Cost Management näyttää seuraavana päivänä nollaa.

## 8. Yksityisyys

Pelaajat voivat olla lapsia.

- Tallennetaan vain arvottu nimimerkki (sanalistojen indeksit) ja satunnainen istuntotunniste. Vapaata tekstiä ei ole missään, joten henkilötietoja ei voi päätyä dataan vahingossa.
- Ei IP-osoitteita: API ei lue eikä tallenna niitä.
- Application Insights: vain palvelimen telemetria. Selaimeen ei tule Application Insightsin skriptiä. Palvelu peittää IP-osoitteen oletuksena (`0.0.0.0`), mutta tekee siitä ensin paikannuksen (kaupunki, maa). Asetusta `DisableIpMasking` ei kytketä päälle, ja paikannuskenttien tyhjentäminen selvitetään vaiheessa 6.
- Ei evästeitä, ei kolmannen osapuolen analytiikkaa, ei ulkoisia fontteja tai skriptejä.
- Sivulla on lyhyt tietosuojaseloste selkokielellä: mitä tallennetaan ja miksi.

## 9. Vaiheet

| Vaihe | Sisältö | Tila |
|---|---|---|
| 1 | Budjetti ja työkalut. `guardrails.bicep` ajetaan ennen vaihetta 3 | budjetti valmis, guardrails kirjoitettu |
| 2 | Peli pelattavaksi paikallisesti: grafiikkamoottori, pelaaja, zombit, aseet, pyörä, VIP, hajotelmat | runko olemassa, uusi suunnitelma toteuttamatta |
| 3 | Julkaisu gerlitekiin: `web.yml`, SSH-avain, alidomain | |
| 4 | `bootstrap.bicep`, OIDC, `infra.yml`, tyhjä `main.bicep` putken läpi | |
| 5 | Storage, Function App, pistetaulu ja viestit, `azd` käyttöön, `api.yml` | |
| 6 | Telemetria, raw- ja curated-kerrokset, Application Insights | |
| 7 | Dashboard | |

Vaihe 2 jaetaan pieniin, erikseen näytettäviin askeliin:

1. `art/`: paletti, piirtofunktiot ja hahmo konseptisivulta Phaseriin. Ritari liikkuu metsässä.
2. Zombit datasta, syntyminen pisarasta, peruslyönti, sydämet, läpäisy tapporajalla.
3. Aseiden käyttäytymiset `strike`, `orbit`, `status` ja onnenpyörä.
4. VIP-aitio, taustataulu, saavutukset, loppuruutu.
5. Hajotelmat, lukkokivi ja Salamaluola.
6. Vitest-testit `logic/`-kansiolle, viimeistely.

## 10. Riskit

| Riski | Torjunta |
|---|---|
| Sisältöä on enemmän kuin ehtii | Data-ohjattu sisältö, versiot rajattu `game-design.md`:ssä, vaihe 2 pieninä askelina |
| Koodilla piirretty grafiikka on hidas | Mittaus heti, varasuunnitelma esipiirretyt tekstuurit |
| Omistaja ei pysty selittämään koodia | Kolme sääntöä (luku 2), pienet tiedostot, jokainen askel käydään läpi |
| Lapset ja käyttäjän syöte | Ei vapaata tekstiä missään: arvottu nimimerkki, valmiit viestit |
| Kustannukset | Kovat rajat resursseissa (luku 7), budjetti ja poikkeamahälytys |
| Väärennetyt tulokset | Uskottavuustarkistus, hyväksytty jäännösriski |
| Tavaramerkit ja Minecraft-assosiaatio | Oma lehtiraajatyyli, Pimeä lordi omana hahmona |
| Salaisuudet repossa | OIDC, SSH-avain vain GitHubin salaisuutena, sähköpostit parametrina |
| Linux Consumption poistuu | Flex Consumption alusta asti (luku 11) |
| Yllätyskulut | Ei kiinteähintaisia resursseja, kovat rajat, automaattinen pysäytys (luku 7) |
| Muisti loppuu, kun pelaajia on paljon yhtä aikaa | Yksi instanssi, 512 Mt, HTTP-rinnakkaisuus 16 (`infra/modules/api.bicep`). Mitattu 2026-11-19: Private Bytes keskimäärin 387 Mt ja enintään 435 Mt (ennen rinnakkaisuuden nostoa enintään 395 Mt), 73 pyyntöä ilman virheitä. Jos muisti lähestyy 512 Mt tai 503-virheitä tulee, pienennä arvo 16:sta esim. 8:aan. Tarkistus: `AppPerformanceCounters` (`Name == 'Private Bytes'`) ja `AppRequests` työtilassa `log-zombies` |

## 11. Päätökset (hyväksytty 2026-11-16)

1. **Flex Consumption Consumptionin sijaan.** Python vaatii Linuxin, ja Linux Consumption poistuu käytöstä 30.9.2028. Python 3.12 on sen viimeinen tuettu versio. Flex Consumption on Microsoftin suosittelema seuraaja: sama maksu käytön mukaan, ilmaiskiintiö ja instanssien enimmäismäärän saa arvoon 1.
2. **Arvottu nimimerkki vapaan tekstin sijaan.** Poistaa moderoinnin ja henkilötietoriskin.
3. **OIDC hallitulla identiteetillä** sovellusrekisteröinnin sijaan, ja roolit `bootstrap.bicep`issä.
4. **Rate limit ilman IP-osoitetta**: istuntoraja ja vuorokausikatto.
5. **Rudi-Karrin todellinen todennäköisyys**: 1 / 10 VIP-pyöräytystä kohti. Alkuperäinen 1 / 500 oli pelitestissä liian harvinainen.
6. **Minipelaaja ja hajotelmat kuuluvat versioon 1.**
7. **Kuvakulma**: vino näkymä, jossa taivas on ylhäällä.
8. **Alidomain**: `zombit.gerlitek.fi`, vahvistettu 2026-11-17.

### Ehdotetut 2026-11-17 (odottavat hyväksyntää)

9. **Policy tilaustasolle eikä resurssiryhmään**, ja omana tiedostonaan `guardrails.bicep`. Estää myös muihin resurssiryhmiin luodut resurssit, ja on voimassa jo ennen resurssiryhmää.
10. **Policy rajaa myös asetukset**, ei vain tyyppejä. Pelkkä tyyppirajaus sallisi esim. Premium-suunnitelman tai 100 instanssia.
11. **Pull requesteilla ei Azure-pääsyä.** `what-if` siirtyy deploy-työhön ennen manuaalista hyväksyntää. Hinta: muutoksen vaikutuksen näkee vasta yhdistämisen jälkeen, ennen hyväksyntää.
