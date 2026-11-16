# Ylläri-Zombiet: pelisuunnittelu

Pelin idea, tarina ja hahmot ovat lapsen. Alkuperäiset muistiinpanot ovat tiedostossa `tarina-ja-ulkoasu.md` ja piirrokset kansiossa `private/pics/`, jota ei viedä repoon. Tämä dokumentti kokoaa ne pelattavaksi suunnitelmaksi. Periaate: jokainen lapsen idea toteutetaan jossain muodossa, jotta hän tunnistaa pelin omakseen. Luvun 11 taulukko näyttää, missä kukin idea on.

Visuaalinen konsepti on tiedostossa `visual-concept.html`. Avaa se selaimessa: kuvat liikkuvat.

## 1. Idea yhdellä lauseella

Yöllä mädäntyneessä luonnossa sade synnyttää zombeja. Ritari taistelee niitä vastaan, pääsee VIP-aitioon viiden tapon jälkeen ja läpäisee pelin kymmenellä tapolla.

## 2. Yksi pelikerta

Pelikerta kestää 2 - 4 minuuttia. Lyhyt kierros sopii lapselle, ja onnenpyörä tekee jokaisesta kerrasta erilaisen.

| Hetki | Mitä tapahtuu |
|---|---|
| Aloitus | Nimimerkki arvotaan (ks. luku 9), hahmon valinta (Ritari tai Minipelaaja) ja hajotelmien vaikeustaso |
| Alkupyöräytys | Metsän onnenpyörä antaa ensimmäisen aseen |
| Tapot 1 - 4 | Mätä metsä. Zombeja nousee sateesta. Kolmas tappo antaa toisen pyöräytyksen |
| Toisen tapon jälkeen | Metsään ilmestyy lukkokivi. Sen hajotelmat ratkaisemalla pääsee Salamaluolaan (vapaaehtoinen, ks. luku 8) |
| Tappo 5 | VIP-kyltti syttyy, salama iskee ja pelaaja siirtyy VIP-aitioon. VIP-pyöräytys |
| Tapot 6 - 9 | VIP-aitio. Zombit ovat supervahvoja. Kahdeksas tappo antaa toisen VIP-pyöräytyksen. Aitiossa on toinen, vaikeampi lukkokivi |
| Tappo 10 | Viimeinen zombi on aina Pimeä lordi tai Jätti. Peli läpäisty |
| Loppuruutu | Pisteet, aika, saavutukset, pistetaulukko, valmis viesti |

Häviö: sydämet loppuvat. Loppuruutu näyttää tapot ja tarjoaa uuden pelin.

Pisteet: `tapot x 100 + jäljellä olevat sydämet x 50 + aikabonus + hajotelmat`, jossa aikabonus on `max(0, 300 - sekunnit)`. Läpäisy antaa 500 lisää ja jokainen avattu lukkokivi 100 - 200 nopeuden mukaan. Hajotelman ratkaisuaika ei kuluta pelikelloa. Enimmäispistemäärä on siis rajattu, mikä helpottaa huijausten tunnistamista palvelimella.

## 3. Ohjaus ja pelaaja

- Liike: nuolet tai WASD. Kosketusnäytöllä raahaus mistä tahansa (virtuaalinen ohjain), versio 2.
- Pelaaja ei heiluta aseita itse. Hän vain lyö: lyönti lähtee automaattisesti lähimpään zombiin, kun se on kantaman sisällä. Onnenpyörän aseet toimivat itsestään pelaajan ympärillä.
- Viisi sydäntä. Zombin kosketus vie yhden, ja sen jälkeen pelaaja on hetken suojassa.

| Hahmo | Kuvaus | Versio |
|---|---|---|
| Ritari | Tumma kypärä, valkoiset silmät, vaaleansininen haarniska, musta ritarin miekka. Peruslyönti miekalla, vahinko 2 | 1 |
| Minipelaaja | Pieni ja nopea erikoishahmo. Vain lyö nyrkillä, vahinko 1. Parantuu: joka kolmas tappo antaa sydämen takaisin | 1 |

## 4. Aseet

Ase on yksi rivi dataa: nimi, pyörä (metsä tai VIP), paino arvonnassa, vahinko, viive, kantama ja käyttäytyminen. Käyttäytymisiä on viisi, ja ne ovat ainoa koodi, jonka aseet tarvitsevat.

| Käyttäytyminen | Mitä koodi tekee |
|---|---|
| `strike` | Isku lähimpään zombiin kantaman sisällä. Parametrit: vahinko, tönäisy, erikoisvaikutus |
| `orbit` | Terät kiertävät pelaajaa ja osuvat koskettamaansa |
| `status` | Vaikutus alueella pelaajan ympärillä (jäädytys) |
| `projectile` | Ammus, joka kimpoaa tai jää paikalleen vetämään |
| `helper` | Apuri, joka liikkuu itse ja hyökkää |

| Ase | Pyörä | Käyttäytyminen | Vaikutus | Versio |
|---|---|---|---|---|
| Musta miekka / nyrkki | perus | strike | Peruslyönti, aina käytössä | 1 |
| Superhanskat | metsä | strike | Zombi lentää kauas. Vahinko 3. Joka kolmas osuma antaa sydämen ("vetää helppiä") | 1 |
| 2 mini-katanaa | metsä | orbit | Kaksi terää kiertää. Joka viides sekunti pyörremyrsky, joka työntää zombit pois | 1 |
| Moukari | metsä | strike | Hidas, osuu kaikkiin lähellä oleviin, tärisyttää ruutua | 1 |
| Nuntsakot | metsä | orbit | Nopea ja lyhyt kierto, vahinko 1 | 1 |
| Jalkapallo | metsä | projectile | Potku lähtee itsestään, pallo kimpoaa zombista toiseen | 2 |
| Lelut | metsä | helper | Vinkulelu, jonka perään zombit lähtevät hetkeksi | 2 |
| Kissarobotti | metsä | helper | Apuri, joka puree zombeja, vahinko 1 | 2 |
| Galaksi-pyssy | metsä | projectile | Ammus jää mustaksi aukoksi, joka imee zombit yhteen | 2 |
| Laser-miekka | VIP | orbit | Kolme päätä, keskellä kristalli. Sininen laser-tornado pelaajan ympärillä | 1 |
| Siniset jääskat | VIP | status | Jäädyttää lähellä olevat zombit jääkuutioon 2 sekunniksi | 1 |
| Puristushanskat | VIP | strike | Zombi puristuu littanaksi ja on hetken avuton, seuraava osuma tappaa | 1 |
| Rudi-Karri-robotti | VIP | helper | Tappaa yhdellä iskulla. Lähes mahdoton saada | 1 |

Kaikki saadut aseet ovat käytössä yhtä aikaa. Pelikerrassa on enintään kuusi pyöräytystä (neljä varmaa ja kaksi Salamaluolasta), joten erillistä varustevalikkoa ei tarvita. Sama ase toista kertaa nostaa sen tasoa (vahinko + 1).

### Onnenpyörä

- Metsän pyörä ja VIP-pyörä ovat sama koodi eri datalla.
- Arvonta on painotettu ja tehdään asiakaspuolella. Sillä ei ole rahallista arvoa, eikä mitään voi ostaa.
- Rudi-Karrin siivu on pyörässä hiuksenohut. Mahdollisuus näytetään lukuna `0,00000001 %`. Todellinen todennäköisyys on erillinen parametri, ehdotus 1 / 500 VIP-pyöräytystä kohti. Näin se on lähes mahdoton, mutta joku saa sen joskus.
- Rudi-Karri on kaksipäinen kissarobotti: toinen pää on Rudi, toinen Karri.
- Taidot (lapsen toive tulevaisuuteen): versiossa 2 pyörään lisätään taitoja, esim. nopeus, lisäsydän ja pidempi suoja.

## 5. Zombit

Zombi on yksi rivi dataa: mitat, värit, elämä, nopeus, paino arvonnassa ja mahdollinen erikoiskäytös. Kaikki piirretään samalla rungolla (ks. luku 10).

| Tyyppi | Ulkonäkö | Elämä | Nopeus | Erikoista | Versio |
|---|---|---|---|---|---|
| Tavallinen (Versio 1 -piirros) | Laiha, paita ja housut, suu kiinni, hehkuvat silmät | 2 | hidas | Perus | 1 |
| Kauhu-zombi (piirros) | Iso munanmuotoinen pää, mutrusuu, maahan asti roikkuvat kädet, kumara | 3 | hiipii | Hiipii hitaasti. Kun pelaaja on lähellä, pysähtyy hetkeksi ja syöksyy | 1 |
| Hiekkazombi | Hiekanvärinen | 3 | keski | Jättää hiekkajäljen, joka hidastaa pelaajaa | 1 |
| Jättizombi | Lähes kaksinkertainen koko | 8 | hyvin hidas | Ei lennä superhanskoista kauas | 1 |
| Random zombi | Arvotut mitat, värit ja nopeus joka kerta | 1 - 5 | arvottu | Ei kahta samanlaista | 1 |
| Pimeä lordi | Musta viitta, kultainen piikkikruunu, vihreät silmät | 6 | nopea | Saapuu salaman mukana. Lapsen Darth Vader -zombi omana hahmona | 1 |
| Ylläri-zombi | Lahjapaketti, josta kurkkii silmäpari | 1 | hyppii | Avautuessaan paljastaa satunnaisen zombin. Tämä on "kaikenlaiset zombit" ja pelin nimi | 1 |
| Uudet tyypit | Päivityksissä | | | Yksi rivi dataan | 2 + |

Erikoisaseet vain harvoilla: noin joka kahdeksas zombi kantaa asetta (luu, keppi, sateenvarjo). Se ulottuu pidemmälle. Tapettuna se pudottaa sydämen.

VIP-aitiossa samat tyypit ovat supervahvoja: elämä x 2, nopeus x 1,4, koko x 1,3 ja vihreä hehku.

Syntyminen: pilvestä putoaa iso pisara, maahan syntyy lätäkkö ja zombi nousee siitä. Pelaaja näkee pisaran ajoissa ja ehtii reagoida. Kerralla elossa enintään 8 zombia.

## 6. Miljöö

| Lapsen idea | Pelissä |
|---|---|
| Yö, tumma taivas, tummat pilvet | Ylin kolmannes ruudusta on taivasta, pilvet liikkuvat hitaasti |
| Sataa | Ohut sade koko ajan, lisäksi isot pisarat, joista zombit syntyvät |
| Salamat lyövät puihin ja muualle | Noin viiden sekunnin välein salama. Osuma puuhun sytyttää sen hetkeksi kytemään. Ruutu välähtää |
| Mätä sammal | Tummanvihreät laikut maassa |
| Kuivahtaneet puut | Lehdettömät puut. Hahmot kulkevat niiden edestä ja takaa |
| Likainen vesi | Samea lampi, jossa kelluu roskaa. Hidastaa kaikkia |
| Kuiva ruoho | Kellertävät tupsut, jotka huojuvat tuulessa |

Versiossa 2 salama vaikuttaa peliin: maahan iskevä salama näkyy ensin varoitusmerkkinä ja tainnuttaa osuessaan zombit.

## 7. VIP-aitio

Aitio on valaistu lava myrskyn keskellä, ja sillä on vaaleansininen kaide. Sade yltää sinnekin, joten zombit syntyvät samalla tavalla.

Taustataulu on aina näkyvissä, kuten lapsi toivoi:

- **Kuka on vahvin**: kolme parasta pistetaulukosta ja oma sijoitus.
- **Saavutukset**: merkit pysyvät näkyvillä. Tallennetaan selaimeen.
- **Viestit**: rullaava nauha. Vain valmiit viestit (esim. "Hyvä peli!", "Varokaa jättiä!"), ei vapaata tekstiä.

Ennen kuin API on olemassa (vaihe 5), taulu näyttää oman selaimen parhaat tulokset.

Saavutukset, versio 1: Ensimmäinen tappo, VIP-vieras, Peli läpäisty, Ei naarmuakaan (läpäisy täysillä sydämillä), Salamannopea (alle 90 s), Jättien kaataja, Lordin voittaja, Hajotelmamestari (molemmat lukkokivet avattu), Rudi-Karrin ystävä.

Kaveriporukka: versio 2 toteuttaa porukkakoodin (esim. `KISSA-42`). Koodin jakaneet näkevät oman pistetaulukon ja toistensa valmiit viestit. Vapaa keskustelu vaatisi moderoinnin ja reaaliaikaisen palvelun, eikä sovi yksityisyyslinjaukseen.

## 8. Hajotelmat ja Salamaluola

Idea on vanhemman, ja lapsi on hyväksynyt sen. Hajotelmat ovat pelin vauhtipähkinöitä: ratkaisemalla niitä pääsee jännään paikkaan.

Luvun hajotelma tarkoittaa, että luku jaetaan osiin, joiden summa on alkuperäinen luku. Esimerkiksi 5 = 2 + 3.

### Miten se toimii

1. Kentällä on lukkokivi, jossa hehkuu luku. Kun pelaaja koskettaa kiveä, salama pysäyttää ajan: zombit ja sade jähmettyvät.
2. Kivi näyttää hajotelman, josta puuttuu osa, esim. `12 = 7 + ?`.
3. Ilmassa leijuu kolme isoa pisaraa, joissa on luvut. Pelaaja kävelee oikeaan pisaraan. Ohjaus pysyy samana, eikä mitään tarvitse kirjoittaa, joten tämä toimii myös kosketusnäytöllä.
4. Kolme oikeaa peräkkäin avaa kiven. Kello käy (vauhtipähkinä): nopea ratkaisu antaa lisäpisteitä.
5. Väärä vastaus ei vie sydäntä. Pisara särkyy ja jäljelle jäävät kaksi. Jos aika loppuu, kivi sulkeutuu ja peli jatkuu tavallisesti.

### Vaikeustasot

Taso valitaan aloitusruudussa, ja peli muistaa sen. Lapsi toivoi myös vaikeita hajotelmia.

| Taso | Esimerkki | Sisältö |
|---|---|---|
| Helppo | `9 = 4 + ?` | Luvut 20 asti, kaksi osaa |
| Keski | `74 = 38 + ?` | Luvut 100 asti, kaksi osaa, kymmenylitys |
| Vaikea | `1000 = 640 + 250 + ?` | Luvut 1000 asti, kolme osaa |
| Mestari | `? + ? = 150` | Pelaaja kerää kaksi pisaraa viidestä niin, että summa täsmää |

Väärät vaihtoehdot eivät ole satunnaisia, vaan tyypillisiä virheitä: oikea vastaus plus tai miinus 1, plus tai miinus 10 ja unohdettu muistinumero. VIP-aition kivi käyttää yhtä tasoa vaikeampaa kuin metsän kivi.

### Salamaluola

Kiven takana on Salamaluola: pieni huone, jossa salama on jähmettynyt kristalliksi ja valaisee seinät vaaleansinisiksi. Luolassa ei ole zombeja. Siellä on aarrearkku, josta saa:

- yhden sydämen takaisin
- ylimääräisen pyöräytyksen. Metsän kivestä saa metsän pyörän, VIP-aition kivestä VIP-pyörän.

Luola on vapaaehtoinen. Pelin voi läpäistä ilman sitä, mutta paras pistemäärä vaatii molemmat kivet.

Hajotelmien arvonta ja tarkistus ovat puhdasta logiikkaa ilman Phaseria, joten ne testataan yksikkötesteillä.

## 9. Nimimerkki

Nimimerkki arvotaan sanalistoista: adjektiivi, eläin ja numero, esim. `Hurja-Kissa-42`. Pelaaja voi arpoa uuden niin monta kertaa kuin haluaa. Vapaata tekstiä ei ole.

Perustelu: lapsi ei voi vahingossa kirjoittaa omaa nimeään tai muuta henkilötietoa, eikä pistetaulukkoon voi kirjoittaa asiattomuuksia. Palvelin tallentaa vain listojen indeksit, joten syötettä ei tarvitse moderoida.

## 10. Ulkoasu

### Ikkuna ja kuvakulma

Looginen resoluutio on 320 x 240 pikseliä, ruudulla kokonaislukuskaalaus (2x). Kuvakulma on vino: ylhäällä taivas ja horisontti, alhaalla maa, jolla hahmot liikkuvat vapaasti kaikkiin suuntiin. Alempana oleva hahmo piirtyy ylemmän päälle. Tämä vastaa sivun luonnosta (`private/pics/verkkosivu.png`): pilvi ja pisarat ylhäällä, hahmot seisovat maassa, VIP-kyltti oikeassa yläkulmassa.

### Oma tyyli: lehtiraajat

Piirroksissa raajat ovat pitkiä ja lehden muotoisia, ja hahmot ovat eloisan vinoja. Siitä tulee pelin tyyli:

- Hahmo koostuu osista: pää, vartalo, kaksi kättä, kaksi jalkaa. Raaja on viiva, joka on keskeltä paksu ja päistä ohut.
- Liike lasketaan sinikäyrästä. Kädet tekevät isoja kaaria, vartalo huojuu ja pää notkuu. Erillisiä animaatioruutuja ei piirretä.
- Koko hahmon ympärillä on tumma ääriviiva.
- Hahmotyyppi on rivi lukuja: raajojen pituus, kumaruus, huojunta, askeltiheys ja värit. Kauhu-zombin "isot kaaret, kumara asento, pää notkuu" ovat suoraan näitä lukuja.
- Ei kuutioita, ei Minecraftin tekstuureja, hahmomalleja tai värimaailmaa.

### Paletti

16 väriä. Koko peli käyttää vain näitä.

| Väri | Käyttö | Väri | Käyttö |
|---|---|---|---|
| `#0B0E14` | Ääriviivat | `#16241A` | Maa |
| `#151B2B` | Yötaivas | `#2C4429` | Mätä sammal |
| `#232C44` | Pilvet, likavesi | `#5F8F4A` | Zombin iho |
| `#3A4763` | Myrsky, haarniskan varjo | `#B4D46A` | Zombin silmät, hehku |
| `#8FA6C4` | Sade | `#8A7A4A` | Kuiva ruoho |
| `#E7E8EA` | Salama, pelaajan silmät, teksti | `#C9A76A` | Hiekka, kulta |
| `#7CC8F2` | Pelaaja, VIP, jää | `#4A3A2A` | Kuivat puut |
| `#B5E1F8` | Laser, hohde | `#D96B6B` | Sydämet, vaara |

Vaaleansininen (`#7CC8F2`) on idean tehneen lapsen lempiväri. Se kuuluu pelissä vain pelaajan puolelle: pelaaja, VIP-aitio, jää ja laser. Zombit eivät koskaan ole vaaleansinisiä, joten ruudulta näkee heti, kuka on kuka.

### Käyttöliittymä pelin sisällä

- Vasen yläkulma: sydämet ja kymmenen tapon palkki, jossa viides ja kymmenes ruutu on korostettu.
- Oikea yläkulma: VIP-kyltti. Punainen ja lukittu, kunnes viides tappo sytyttää sen vaaleansiniseksi.
- Vasen alakulma: saadut aseet kuvakkeina.
- Teksti: pikselifontti, jossa on ä ja ö. Fontti tarjoillaan omalta palvelimelta, ja lisenssin on sallittava se (esim. OFL).

### Sivu pelin ympärillä

Sivu seuraa gerlitek.fi:n ilmettä: tausta `#0F1115`, pinnat `#151923` ja `#1B2030`, reunat `#252D3F`, teksti `#E7E8EA` ja `#A9AFBA`, Inter-fontti, pyöristetyt kortit. Korostusväri on vaaleansininen `#7CC8F2`, vaalea sävy `#B5E1F8`.

### Äänet

Versio 2. Sade, ukkonen ja iskuäänet tuotetaan Web Audio API:lla ilman äänitiedostoja. Ääni on oletuksena pois ja käynnistyy napista.

## 11. Lapsen ideat ja niiden paikka pelissä

| Idea | Toteutus | Versio |
|---|---|---|
| Random, hiekka-, tavallinen, jätti-, Darth Vader -zombi, kaikenlaiset | Luku 5 | 1 |
| Päivityksissä lisää zombeja | Zombi on rivi dataa | 2 + |
| VIP-aitio 5 tapon jälkeen, läpi 10 tapolla | Luku 2 | 1 |
| Onnenpyörä, paremmat aseet VIP:ssä | Luku 4 | 1 |
| Taitoja pyörästä tulevaisuudessa | Luku 4 | 2 |
| Galaksi-pyssy ja musta aukko, kissarobotti | Luku 4 | 2 |
| 2 mini-katanaa ja pyörremyrsky | Luku 4 | 1 |
| Superhanskat: lentää kauas, vetää helppiä | Luku 4 | 1 |
| VIP: supervahvat zombit | Luku 5 | 1 |
| VIP: kuka on vahvin, saavutukset näkyvillä, viestit | Luku 7 | 1 (paikallinen), verkossa API:n myötä |
| VIP: kaveriporukka ja juttelu | Porukkakoodi ja valmiit viestit | 2 |
| Laser-miekka: kolme päätä, kristalli, sininen laser-tornado | Luku 4 | 1 |
| Rudi-Karri-robotti, lähes mahdoton, luku näkyvissä | Luku 4 | 1 |
| Siniset jääskat, puristushanskat | Luku 4 | 1 |
| Mätä luonto, sammal, puut, vesi, ruoho, yö, sade, salamat | Luku 6 | 1 |
| Vesisateessa syntyy zombeja | Luku 5, pisara ja lätäkkö | 1 |
| Versio 1 -kuva: laiha, kieli ei ulkona, vaatteet, erikoisaseet harvoilla | Luku 5 | 1 |
| Kauhu-zombi: 1. taso, huojuu, isot kaaret, kumara, pää notkuu, hiipii ja hyökkää | Luku 5 ja 10 | 1 |
| Pelaaja ei voi heilutella, vain lyö | Luku 3 | 1 |
| Pelaajan aseet: miekat, nuntsakot, moukarit | Luku 4 | 1 |
| Pelaajan aseet: jalkapallo, lelut | Luku 4 | 2 |
| Minipelaaja: vain lyö, 1 elämä per lyönti, voi parantaa | Luku 3 | 1 |
| Pelaajan kuva: valkoiset silmät, musta miekka, ritarin varusteet | Luku 3 ja 10 | 1 |
| Hajotelmat vauhtipähkinöinä, niillä pääsee jännään paikkaan, myös vaikeita (vanhemman idea, lapsen hyväksymä) | Luku 8: lukkokivi ja Salamaluola | 1 |

## 12. Tapahtumaskeema

Vain nimimerkki ja satunnainen istuntotunniste. Ei IP-osoitteita eikä henkilötietoja. Jokaisessa tapahtumassa on lisäksi `event`, `ts` (asiakkaan kello, ISO 8601), `session_id`, `seq` (juokseva numero) ja `version`.

| Tapahtuma | Kentät |
|---|---|
| `game_started` | nickname, character |
| `wheel_spun` | wheel (forest, vip), weapon, kills |
| `zombie_killed` | zombie_type, weapon, zone, total_kills |
| `player_hit` | zombie_type, zone, hearts_left |
| `vip_entered` | duration_s, hearts_left |
| `puzzle_answered` | level, target, parts, answer, correct, time_ms |
| `cave_entered` | zone, level, duration_s |
| `achievement_unlocked` | achievement |
| `game_ended` | result (won, lost), kills, duration_s, hearts_left, score |

`puzzle_answered` kertoo dashboardissa, mitkä hajotelmat ovat vaikeita ja kuinka nopeasti ne ratkeavat. Pelikerrasta syntyy noin 20 - 40 tapahtumaa. Ne lähetetään erinä: VIP-aitioon siirryttäessä ja pelin lopussa.

## 13. Versiot

- **Versio 1**: kaikki, missä yllä lukee 1. Toimii kokonaan selaimessa ilman API:a.
- **Versio 1 verkossa**: pistetaulukko, viestit ja telemetria API:n kautta (arkkitehtuurin vaiheet 5 ja 6).
- **Versio 2**: ammus- ja apuriaseet, taidot, porukkakoodi, kosketusohjaus, äänet, salaman vaikutus peliin.

## 14. Kysymykset lapselle

1. Mitä superhanskojen "vetää paljon helppiä" tarkoittaa? Ehdotus: zombilta lähtee paljon elämää ja pelaaja saa välillä sydämen.
2. Mitä "siniset jääskat" ovat: hanskat, luistimet vai jotain muuta? Miltä ne näyttävät?
3. Minkä värisiä Rudi ja Karri ovat? Robotin kaksi päätä väritetään niiden mukaan.
4. Sopiiko, että Darth Vader -zombi on Pimeä lordi, jolla on viitta ja kultainen piikkikruunu?
5. Sopiiko Ylläri-zombi (lahjapaketti) "kaikenlaisiksi zombeiksi"?
6. Näyttääkö ritari oikealta? Katso `visual-concept.html`.
7. Mitä lelut tekevät zombeille?
8. Miltä Salamaluolassa näyttää, ja mitä aarrearkusta pitäisi saada?
9. Mikä on vaikein hajotelma, jonka haluat peliin?
