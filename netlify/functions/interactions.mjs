import { verifyKey } from "discord-interactions";
import { getStore } from "@netlify/blobs";

const API = "https://discord.com/api/v10";
const COLOR = 0xc4000f;
const EPHEMERAL = 64;
const ADMIN_PERMISSION = 8n;

const json = (data) =>
  new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

const reply = (content) => json({ type: 4, data: { content, flags: EPHEMERAL } });

const siteUrl = () => process.env.URL || "";

async function discord(path, method, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const store = () => getStore("kickzone");
const cupKey = (guildId) => `cup-${guildId}`;
const loadCup = (guildId) => store().get(cupKey(guildId), { type: "json" });
const saveCup = (cup) => store().setJSON(cupKey(cup.guildId), cup);

function hasRole(member, envName) {
  const roleId = process.env[envName];
  return !!roleId && (member?.roles || []).includes(roleId);
}

function isAdmin(member) {
  const perms = BigInt(member?.permissions || "0");
  return (perms & ADMIN_PERMISSION) === ADMIN_PERMISSION || hasRole(member, "TURNIERLEITUNG_ROLE_ID");
}

function displayName(member) {
  return member?.nick || member?.user?.global_name || member?.user?.username || "Unbekannt";
}

function buildMessage(cup) {
  const full = cup.teams.length >= cup.slots;
  const status = !cup.open ? "🔴 Geschlossen" : full ? "🟠 Voll" : "🟢 Offen";

  const list = cup.teams.length
    ? cup.teams.map((t, i) => `**${i + 1}.** ${t.name} \`${t.tag}\` – ${t.manager}`).join("\n")
    : "*Noch keine Mannschaften angemeldet.*";

  const description =
    "Manager melden hier ihre Mannschaft an.\nPro Manager ist eine Mannschaft erlaubt.\n\n" +
    `📋 **Angemeldete Mannschaften**\n${list}`;

  const embed = {
    title: "🏆 Kickzone Cup – Anmeldung",
    description: description.slice(0, 4000),
    color: COLOR,
    thumbnail: { url: `${siteUrl()}/logo.png` },
    image: { url: `${siteUrl()}/banner.png` },
    fields: [
      { name: "📅 Start", value: cup.start, inline: true },
      { name: "👥 Plätze", value: `${cup.teams.length} / ${cup.slots}`, inline: true },
      { name: "Status", value: status, inline: true },
    ],
    footer: {
      text: cup.deadline ? `Kickzone Cup • Anmeldeschluss: ${cup.deadline}` : "Kickzone Cup",
      icon_url: `${siteUrl()}/logo.png`,
    },
  };

  const components = [
    {
      type: 1,
      components: [
        { type: 2, style: 4, custom_id: "kz_register", label: "Mannschaft anmelden", emoji: { name: "➕" }, disabled: !cup.open || full },
        { type: 2, style: 2, custom_id: "kz_leave", label: "Abmelden", emoji: { name: "✖️" } },
        { type: 2, style: 2, custom_id: "kz_toggle", label: cup.open ? "Anmeldung schließen" : "Anmeldung öffnen", emoji: { name: cup.open ? "🔒" : "🔓" } },
      ],
    },
  ];

  return { embeds: [embed], components };
}

async function refreshPostedMessage(cup) {
  await discord(`/channels/${cup.channelId}/messages/${cup.messageId}`, "PATCH", buildMessage(cup));
}

const registerModal = {
  type: 9,
  data: {
    custom_id: "kz_modal",
    title: "Mannschaft anmelden",
    components: [
      { type: 1, components: [{ type: 4, custom_id: "name", label: "Mannschaftsname", style: 1, min_length: 2, max_length: 32, required: true, placeholder: "Rot-Weiß Kickers" }] },
      { type: 1, components: [{ type: 4, custom_id: "tag", label: "Kürzel (2–4 Zeichen)", style: 1, min_length: 2, max_length: 4, required: true, placeholder: "RWK" }] },
      { type: 1, components: [{ type: 4, custom_id: "club", label: "EA-FC-Clubname (optional)", style: 1, max_length: 40, required: false, placeholder: "RW Kickers FC" }] },
    ],
  },
};

function modalValue(data, id) {
  for (const row of data.components || []) {
    for (const c of row.components || []) if (c.custom_id === id) return (c.value || "").trim();
  }
  return "";
}

function option(data, name) {
  return (data.options || []).find((o) => o.name === name)?.value;
}

async function handleCommand(i) {
  const name = i.data.name;
  const member = i.member;
  if (!isAdmin(member)) return reply("Diesen Befehl darf nur die Turnierleitung benutzen.");

  if (name === "kickzone-start") {
    const cup = {
      guildId: i.guild_id,
      channelId: i.channel_id,
      messageId: null,
      start: option(i.data, "start"),
      deadline: option(i.data, "anmeldeschluss") || "",
      slots: option(i.data, "plaetze") || 16,
      open: true,
      teams: [],
    };
    const msg = await discord(`/channels/${cup.channelId}/messages`, "POST", buildMessage(cup));
    cup.messageId = msg.id;
    await saveCup(cup);
    return reply("Der Kickzone Cup ist gestartet – die Anmeldung ist offen.");
  }

  const cup = await loadCup(i.guild_id);
  if (!cup) return reply("Es läuft gerade keine Anmeldung. Starte eine mit `/kickzone-start`.");

  if (name === "kickzone-plaetze") {
    const amount = option(i.data, "anzahl");
    if (amount < cup.teams.length) {
      return reply(`Es sind schon ${cup.teams.length} Mannschaften angemeldet – weniger Plätze gehen nicht.`);
    }
    cup.slots = amount;
    await saveCup(cup);
    await refreshPostedMessage(cup);
    return reply(`Plätze auf ${amount} gesetzt.`);
  }

  if (name === "kickzone-entfernen") {
    const tag = String(option(i.data, "kuerzel")).toUpperCase();
    const before = cup.teams.length;
    cup.teams = cup.teams.filter((t) => t.tag !== tag);
    if (cup.teams.length === before) return reply(`Keine Mannschaft mit dem Kürzel \`${tag}\` gefunden.`);
    await saveCup(cup);
    await refreshPostedMessage(cup);
    return reply(`Mannschaft \`${tag}\` wurde entfernt.`);
  }

  return reply("Unbekannter Befehl.");
}

async function handleComponent(i) {
  const cup = await loadCup(i.guild_id);
  if (!cup || cup.messageId !== i.message.id) {
    return reply("Diese Anmeldung ist nicht mehr aktiv.");
  }
  const userId = i.member.user.id;

  if (i.data.custom_id === "kz_register") {
    if (!hasRole(i.member, "MANAGER_ROLE_ID")) return reply("Nur Mitglieder mit der Rolle **Manager** können eine Mannschaft anmelden.");
    if (!cup.open) return reply("Die Anmeldung ist geschlossen.");
    if (cup.teams.some((t) => t.userId === userId)) return reply("Du hast bereits eine Mannschaft angemeldet.");
    if (cup.teams.length >= cup.slots) return reply("Alle Plätze sind vergeben.");
    return json(registerModal);
  }

  if (i.data.custom_id === "kz_leave") {
    const before = cup.teams.length;
    cup.teams = cup.teams.filter((t) => t.userId !== userId);
    if (cup.teams.length === before) return reply("Du hast keine Mannschaft angemeldet.");
    await saveCup(cup);
    return json({ type: 7, data: buildMessage(cup) });
  }

  if (i.data.custom_id === "kz_toggle") {
    if (!isAdmin(i.member)) return reply("Nur die Turnierleitung kann die Anmeldung öffnen oder schließen.");
    cup.open = !cup.open;
    await saveCup(cup);
    return json({ type: 7, data: buildMessage(cup) });
  }

  return reply("Unbekannter Button.");
}

async function handleModal(i) {
  const cup = await loadCup(i.guild_id);
  if (!cup || !i.message || cup.messageId !== i.message.id) return reply("Diese Anmeldung ist nicht mehr aktiv.");
  const userId = i.member.user.id;

  if (!hasRole(i.member, "MANAGER_ROLE_ID")) return reply("Nur Manager können eine Mannschaft anmelden.");
  if (!cup.open) return reply("Die Anmeldung wurde inzwischen geschlossen.");
  if (cup.teams.some((t) => t.userId === userId)) return reply("Du hast bereits eine Mannschaft angemeldet.");
  if (cup.teams.length >= cup.slots) return reply("Leider sind inzwischen alle Plätze vergeben.");

  const name = modalValue(i.data, "name");
  const tag = modalValue(i.data, "tag").toUpperCase();
  const club = modalValue(i.data, "club");

  if (!/^[A-Z0-9ÄÖÜ]{2,4}$/.test(tag)) return reply("Das Kürzel darf nur Buchstaben und Zahlen enthalten (2–4 Zeichen).");
  if (cup.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return reply("Dieser Mannschaftsname ist schon vergeben.");
  if (cup.teams.some((t) => t.tag === tag)) return reply("Dieses Kürzel ist schon vergeben.");

  cup.teams.push({ userId, manager: displayName(i.member), name, tag, club, at: Date.now() });
  await saveCup(cup);
  return json({ type: 7, data: buildMessage(cup) });
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Kickzone Cup Bot", { status: 200 });

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const body = await req.text();

  const valid = signature && timestamp && (await verifyKey(body, signature, timestamp, process.env.DISCORD_PUBLIC_KEY));
  if (!valid) return new Response("Ungültige Signatur", { status: 401 });

  const i = JSON.parse(body);

  try {
    if (i.type === 1) return json({ type: 1 });
    if (!i.guild_id) return reply("Der Bot funktioniert nur auf einem Server.");
    if (i.type === 2) return await handleCommand(i);
    if (i.type === 3) return await handleComponent(i);
    if (i.type === 5) return await handleModal(i);
  } catch (err) {
    console.error(err);
    return reply("Da ist etwas schiefgelaufen. Versuch es gleich nochmal.");
  }
  return reply("Unbekannte Aktion.");
};
