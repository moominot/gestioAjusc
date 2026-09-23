# Posar l'aplicació en marxa

Guia per muntar el projecte de Supabase, aplicar-hi l'esquema i desplegar
l'aplicació. Es fa un sol cop.

Cal tenir-hi a mà el `GENERADOR_BARRUF.xlsx`, per si s'ha de regenerar la
llavor.

---

## 1. Crear el projecte de Supabase

A [supabase.com](https://supabase.com), **New project**.

| Camp | Què hi va |
|---|---|
| Name | `ajusc-barruf` |
| Database password | Genereu-la i **deseu-la al gestor de contrasenyes del club**, no al vostre. Cal per al CLI i no es pot recuperar. |
| Region | `Central EU (Frankfurt)` o `West EU (Ireland)`: són els més propers. |
| Plan | Free |

> **Compte amb el pla gratuït:** els projectes es pausen després d'una setmana
> sense cap activitat. Amb una web que rep visites no hauria de passar, però si
> un dia el trobeu aturat, es reactiva des del tauler.

---

## 2. Aplicar l'esquema

Les cinc migracions de `supabase/migrations/` s'han d'aplicar **en ordre**. El
nom porta la marca de temps al davant justament per això.

| Fitxer | Què fa |
|---|---|
| `…100_nucli_barruf` | Taules, RLS, privilegis |
| `…200_llavor_barruf` | Els 609 jugadors de l'edició 199 |
| `…300_vistes_publiques` | El model de lectura |
| `…400_importa_campionat` | Importació atòmica |
| `…500_publica_edicio` | Publicació d'edicions |

### Amb el CLI (recomanat)

És el que permetrà anar afegint migracions més endavant sense tocar res a mà.
El CLI ja ve com a dependència del projecte, o sigui que amb `npm install` n'hi
ha prou.

> **No proveu `npm install -g supabase`**: falla a posta. El paquet no admet la
> instal·lació global. Aquí es fa servir amb `npx`, que és la manera
> recomanada; si en voleu un de global, és per Homebrew o Scoop.

```bash
npx supabase login
npx supabase link --project-ref <la-referència-del-projecte>
npx supabase db push
```

La referència del projecte és el tros de l'URL:
`https://<referència>.supabase.co`.

El primer `db push` crea la taula d'historial
`supabase_migrations.schema_migrations`, i a partir d'aquí cada migració
s'aplica un sol cop: executar-lo dues vegades seguides diu
`Remote database is up to date` i no toca res.

### Sense CLI

Des del tauler, **SQL Editor**, enganxeu el contingut de cada fitxer **en ordre**
i executeu-los un per un. Funciona igual, però Supabase no en durà l'historial i
haureu de recordar quines heu aplicat.

### Comprovació

Al SQL Editor:

```sql
SELECT count(*) AS jugadors FROM jugadors;                  -- 609
SELECT numero, es_llavor FROM barruf_edicions;              -- 199, true
SELECT count(*) FROM barruf_classificacio WHERE estat='act'; -- 167
```

---

## 3. Configurar l'entrada per correu

**Authentication → Sign In / Providers**: que **Email** estigui actiu. No cal
contrasenya; l'aplicació fa servir enllaç per correu.

**Authentication → URL Configuration**, afegiu a *Redirect URLs*:

```
http://localhost:3000/auth/retorn
https://<el-domini-de-producció>/auth/retorn
```

Si no hi són, l'enllaç del correu rebotarà.

> El correu que envia Supabase de franc té un límit baix per hora. Per a tres o
> quatre gestors sobra. Si algun dia no arriben, es configura un servei SMTP
> propi a **Authentication → Emails**.

---

## 4. Donar d'alta el primer gestor

Hi ha un ou i una gallina: per ser gestor cal constar a `perfils`, i per
constar-hi cal existir a `auth.users`, cosa que passa en entrar per primera
vegada.

1. Aixequeu l'aplicació (pas 5) i aneu a `/entrar`.
2. Poseu-hi el vostre correu i demaneu l'enllaç.
3. Obriu-lo. Us durà a `/gestio` i us dirà que no hi teniu accés: és correcte,
   encara no sou gestor.
4. Al SQL Editor:

```sql
INSERT INTO perfils (id, nom, rol)
SELECT id, 'El vostre nom', 'admin'
FROM auth.users
WHERE email = 'el-vostre@correu.cat';
```

5. Torneu a carregar `/gestio`.

Per als gestors següents, el mateix: que entrin un cop i després afegiu-los la
fila. Poseu `'gestor'` en comptes de `'admin'`.

---

## 5. Les variables d'entorn

Copieu `.env.example` a `.env.local` i ompliu-lo. Els valors són a
**Project Settings → API Keys**.

```
NEXT_PUBLIC_SUPABASE_URL=https://<referència>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la clau pública>
NEXT_PUBLIC_URL_BASE=http://localhost:3000
```

### Quina clau

Supabase està canviant el sistema de claus. Als projectes nous hi trobareu una
**clau publicable** (`sb_publishable_…`), que és la que substitueix l'antiga
`anon`. Serveix qualsevol de les dues: l'aplicació només l'envia al navegador i
qui mana sobre les dades és l'RLS.

**La que no ha de sortir mai del servidor** és la secreta (`sb_secret_…`, abans
`service_role`): es salta totes les polítiques. Aquesta aplicació no la fa
servir enlloc, i no li'n cal cap.

Comproveu-ho:

```bash
npm install
npm run dev
```

---

## 6. Desplegar a Vercel

1. A [vercel.com](https://vercel.com), **Add New → Project**, i trieu el
   repositori. Detecta Next.js sol.
2. A **Environment Variables**, poseu-hi les tres d'abans, amb
   `NEXT_PUBLIC_URL_BASE` apuntant al domini de producció.
3. **Deploy**.
4. Torneu al pas 3 i afegiu l'URL de producció a les *Redirect URLs* de
   Supabase.

Cada empenta a la branca principal es desplegarà sola.

---

## 7. Primera importació

Amb tot en marxa, a `/gestio/importar`:

1. Pugeu els fitxers `.trn`, `.sco` i `.ini` del SwissPerfect, o bé un full de
   càlcul (vegeu [`lib/importacio/README.md`](../lib/importacio/README.md)).
2. Reviseu els noms que hagin quedat dubtosos.
3. Marqueu **el campionat s'ha acabat** només si és cert.
4. Importeu.

I a `/gestio/publicar`, calculeu primer sense desar per veure qui es mou, i
publiqueu quan ho tingueu clar.

---

## Coses que val la pena saber

**No toqueu mai la base de dades directament.** Qualsevol canvi d'esquema ha
d'anar en una migració nova, o el proper `db push` us el trepitjarà.

**El BARRUF no s'edita a mà.** No hi ha cap pantalla per fer-ho i és volgut: la
puntuació és una projecció dels resultats. Si un número no quadra, el que està
malament és un resultat; corregiu-lo i torneu a publicar.

**Còpies de seguretat.** El pla gratuït en fa de diàries amb una setmana de
retenció. Abans d'una operació grossa, val la pena baixar-se un bolcat:

```bash
npx supabase db dump -f copia-$(date +%F).sql
```

**Si la llavor s'ha de refer** (perquè trobeu un error a l'edició 199), es
regenera i no s'edita a mà:

```bash
python3 scripts/genera_llavor.py GENERADOR_BARRUF.xlsx \
  > supabase/migrations/20260922100200_llavor_barruf.sql
python3 scripts/genera_llavor.py GENERADOR_BARRUF.xlsx --json \
  > lib/importacio/__fixtures__/registre-llavor.json
```

---

## Les migracions, automàtiques

Si connecteu el repositori de GitHub al projecte de Supabase (al tauler,
**Project Settings → Integrations → GitHub**), Supabase aplica sol les
migracions noves de `supabase/migrations/` cada vegada que es puja a la branca
de producció. Llavors no cal ni `supabase login` ni `db push`: n'hi ha prou amb
pujar el codi.

`supabase/config.toml` porta l'identificador del projecte i és el que fa que la
integració sàpiga on ha d'anar.

Compte amb una cosa: amb això, **pujar una migració a main l'aplica a la base de
dades de debò**. És còmode, però vol dir que el que es puja ha d'estar provat.
Per a això hi ha la rèplica de [`docker/`](../docker/README.md).
