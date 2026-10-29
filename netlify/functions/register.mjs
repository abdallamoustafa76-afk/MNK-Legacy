const commands = [
  {
    name: "kickzone-start",
    description: "Startet eine neue Kickzone-Cup-Anmeldung in diesem Kanal",
    dm_permission: false,
    options: [
      { type: 3, name: "start", description: "Wann startet der Cup? z. B. Samstag, 20:00", required: true },
      { type: 4, name: "plaetze", description: "Anzahl Plätze (Standard 16)", required: false, min_value: 2, max_value: 64 },
      { type: 3, name: "anmeldeschluss", description: "z. B. Samstag, 19:30", required: false },
    ],
  },
  {
    name: "kickzone-plaetze",
    description: "Ändert die Anzahl der Plätze der laufenden Anmeldung",
    dm_permission: false,
    options: [{ type: 4, name: "anzahl", description: "Neue Gesamtzahl an Plätzen", required: true, min_value: 2, max_value: 64 }],
  },
  {
    name: "kickzone-entfernen",
    description: "Entfernt eine Mannschaft aus der Anmeldung",
    dm_permission: false,
    options: [{ type: 3, name: "kuerzel", description: "Kürzel der Mannschaft, z. B. RWK", required: true }],
  },
];

export default async (req) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.SETUP_KEY || key !== process.env.SETUP_KEY) {
    return new Response("Falscher oder fehlender Schlüssel.", { status: 401 });
  }

  const res = await fetch(`https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });

  const text = await res.text();
  const msg = res.ok ? "Befehle erfolgreich registriert ✅" : `Fehler ${res.status}: ${text}`;
  return new Response(msg, { status: res.ok ? 200 : 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
