# Kickzone Cup – Anmelde-Bot

Discord-Bot für die Mannschafts-Anmeldung zum Kickzone Cup. Läuft komplett über Netlify Functions (kein Server, kein Terminal nötig).

## Befehle (nur Turnierleitung oder Administrator)

- `/kickzone-start start:<Text> [plaetze] [anmeldeschluss]` – postet die Anmelde-Nachricht im aktuellen Kanal (Standard 16 Plätze)
- `/kickzone-plaetze anzahl:<Zahl>` – Plätze erhöhen oder verringern
- `/kickzone-entfernen kuerzel:<Kürzel>` – eine Mannschaft rauswerfen

Buttons in der Nachricht: **Mannschaft anmelden** (nur Rolle Manager), **Abmelden**, **Anmeldung schließen/öffnen** (nur Turnierleitung).

## Einrichtung

### 1. Discord-App anlegen
1. https://discord.com/developers/applications → **New Application** → Name „Kickzone Cup“
2. Unter **General Information**: Logo als App-Icon hochladen, **Application ID** und **Public Key** notieren
3. Unter **Bot**: **Reset Token** → Token kopieren (geheim halten!)

### 2. GitHub
Neues privates Repo anlegen → **Add file → Upload files** → den kompletten Inhalt dieses Ordners hineinziehen (Ordnerstruktur bleibt erhalten) → Commit.

### 3. Netlify
1. **Add new site → Import an existing project → GitHub** → Repo auswählen → Deploy
2. **Site configuration → Environment variables** → diese Variablen anlegen:

| Variable | Wert |
|---|---|
| `DISCORD_PUBLIC_KEY` | Public Key aus Schritt 1 |
| `DISCORD_APPLICATION_ID` | Application ID aus Schritt 1 |
| `DISCORD_TOKEN` | Bot-Token aus Schritt 1 |
| `MANAGER_ROLE_ID` | ID der Rolle „Manager“ |
| `TURNIERLEITUNG_ROLE_ID` | ID der Rolle „Turnierleitung“ |
| `SETUP_KEY` | ein beliebiges Passwort, das du dir ausdenkst |

Rollen-ID kopieren: In Discord **Einstellungen → Erweitert → Entwicklermodus** an, dann Servereinstellungen → Rollen → Rechtsklick auf die Rolle → **ID kopieren**.

3. Danach **Deploys → Trigger deploy**, damit die Variablen aktiv werden.

### 4. Discord mit Netlify verbinden
Im Developer Portal unter **General Information → Interactions Endpoint URL** eintragen:

```
https://DEINE-SEITE.netlify.app/.netlify/functions/interactions
```

Speichern – Discord prüft die Adresse sofort. Klappt nur, wenn der Deploy mit den Variablen fertig ist.

### 5. Befehle registrieren
Im Browser einmal aufrufen:

```
https://DEINE-SEITE.netlify.app/.netlify/functions/register?key=DEIN_SETUP_KEY
```

### 6. Bot einladen
Developer Portal → **OAuth2 → URL Generator** → Scopes `bot` und `applications.commands` → Berechtigungen: Kanäle ansehen, Nachrichten senden, Links einbetten, Dateien anhängen, Nachrichtenverlauf lesen → Link öffnen und Server auswählen.

Fertig – im gewünschten Kanal `/kickzone-start start:Samstag, 20:00` eingeben.

## Hinweise
- Pro Server läuft immer eine Anmeldung. Ein neues `/kickzone-start` ersetzt die alte.
- Logo und Banner liegen in `public/` und können dort einfach ausgetauscht werden.
