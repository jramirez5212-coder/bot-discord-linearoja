const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { CANAL_CMD_TORNEO } = require("../config");

const CANAL_PANEL_EVENTOS = "1516259370994761781";

const EMOJIS = {
  torneo:      "🏆",
  tormenta:    "🌪️",
  battle:      "💥",
  drop:        "🎁",
  mega_torneo: "🔥",
  mega_battle: "⚔️",
};

const RANKS = {
  F1: { color: 0xffffff, emoji: "⬜" },
  F4: { color: 0x39FF14, emoji: "🟩" },
  F7: { color: 0xff6b00, emoji: "🟧" },
  F9: { color: 0xe74c3c, emoji: "🟥" },
};

let panelMessageId = null;
let panelRushMessageId = null;

function diffEnPalabras(diffMin) {
  if (diffMin < 1)   return "ahora mismo";
  if (diffMin < 60)  return `en ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
  const horas = Math.floor(diffMin / 60);
  const mins  = diffMin % 60;
  if (mins === 0) return `en ${horas} hora${horas === 1 ? "" : "s"}`;
  return `en ${horas}h ${mins}min`;
}

// ── PANEL DE EVENTOS ──────────────────────────────────────────────────────────
function buildPanelEmbed(EVENTOS, label = 'ROLAS') {
  const ahora = (() => {
    const c = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
    return c.getHours() * 60 + c.getMinutes();
  })();

  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }

  const ordenados = [...EVENTOS].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));

  // Encontrar evento actual (el último que ya pasó)
  let eventoActual = null;
  let eventoActualIdx = -1;
  for (let i = ordenados.length - 1; i >= 0; i--) {
    if (horaAMin(ordenados[i].hora) <= ahora) {
      eventoActual    = ordenados[i];
      eventoActualIdx = i;
      break;
    }
  }
  if (!eventoActual) {
    eventoActual    = ordenados[ordenados.length - 1];
    eventoActualIdx = ordenados.length - 1;
  }

  // Próximos 2 eventos con timestamp de Discord para cuenta regresiva nativa
  const proximos = [];
  for (let i = 1; i <= 2; i++) {
    const idx     = (eventoActualIdx + i) % ordenados.length;
    const e       = ordenados[idx];
    const diffMin = (horaAMin(e.hora) - ahora + 1440) % 1440;
    const tsUnix  = Math.floor(Date.now() / 1000) + diffMin * 60;
    proximos.push({ ...e, diffMin, tsUnix });
  }

  const COLOR_PANEL = label === "RUSH" ? 0x3498db : 0xFF69B4; // Azul RUSH, Rosado ROLAS

  const embed = new EmbedBuilder()
    .setColor(COLOR_PANEL)
    .setTitle(`📊 Panel de Eventos — ${label}`)
    .addFields(
      {
        name: "🟢 ── AHORA ──",
        value: `${eventoActual.hora} — ${emoji} **${eventoActual.nombre}**${eventoActual.puntos ? ` → ${eventoActual.puntos}` : ""} → Rank **${eventoActual.rank}**\n🟢 **EN CURSO**`,
        inline: false
      },
      {
        name: "📅 ── EVENTOS PRÓXIMOS ──",
        value: proximos.map(e => {
          const em = EMOJIS[e.tipo] || "🎮";
          return `${e.hora} — ${em} **${e.nombre}**${e.puntos ? ` → ${e.puntos}` : ""} → Rank **${e.rank}**\n⏳ ${diffEnPalabras(e.diffMin)}`;
        }).join("\n\n"),
        inline: false
      }
    )
    .setFooter({ text: `Sistema de Eventos — ${label} | Última actualización` })
    .setTimestamp();

  return embed;
}

function buildListadoEmbed(EVENTOS) {
  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }
  const ordenados = [...EVENTOS].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));

  const lineas = ordenados.map(e => {
    const em = EMOJIS[e.tipo] || "🎮";
    return `• **${e.hora}** — ${em} ${e.nombre}${e.puntos ? ` → ${e.puntos}` : ""} → Rank **${e.rank}**`;
  });

  return new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle("📋 Listado de eventos")
    .setDescription(lineas.join("\n"))
    .setTimestamp();
}

async function initPanelEventos(client, EVENTOS, EVENTOS_RUSH) {
  await actualizarPanel(client, EVENTOS, EVENTOS_RUSH);
  setInterval(() => actualizarPanel(client, EVENTOS, EVENTOS_RUSH), 60 * 1000);
}

async function actualizarPanelUnico(canal, client, EVENTOS, label, msgIdRef, customIdSuffix) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`panel_ver_todos${customIdSuffix}`).setLabel(`Ver todos — ${label}`).setEmoji("📋").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`panel_proximo_torneo${customIdSuffix}`).setLabel(`Próximo ${label}`).setEmoji("🏆").setStyle(label === "RUSH" ? ButtonStyle.Danger : ButtonStyle.Primary)
  );
  const embed = buildPanelEmbed(EVENTOS, label);
  if (msgIdRef.id) {
    try {
      const msg = await canal.messages.fetch(msgIdRef.id);
      await msg.edit({ embeds: [embed], components: [row] });
      return;
    } catch { msgIdRef.id = null; }
  }
  const msg = await canal.send({ embeds: [embed], components: [row] });
  msgIdRef.id = msg.id;
}

const rolasRef = { id: null };
const rushRef  = { id: null };

async function actualizarPanel(client, EVENTOS, EVENTOS_RUSH) {
  try {
    const canal = await client.channels.fetch(CANAL_PANEL_EVENTOS);
    if (!canal) return;
    await actualizarPanelUnico(canal, client, EVENTOS, "ROLAS", rolasRef, "");
    if (EVENTOS_RUSH) await actualizarPanelUnico(canal, client, EVENTOS_RUSH, "RUSH", rushRef, "_rush");
  } catch (e) {
    console.error("[PANEL] Error:", e.message);
  }
}

async function handlePanelButton(interaction, EVENTOS, EVENTOS_RUSH) {
  if (!interaction.isButton()) return;
  const validIds = ["panel_ver_todos","panel_proximo_torneo","panel_ver_todos_rush","panel_proximo_torneo_rush"];
  if (!validIds.includes(interaction.customId)) return;

  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }

  const isRush = interaction.customId.endsWith("_rush");
  const eventosUsar = isRush ? (EVENTOS_RUSH || EVENTOS) : EVENTOS;
  const label = isRush ? "RUSH" : "ROLAS";

  if (interaction.customId.startsWith("panel_ver_todos")) {
    const embed = buildListadoEmbed(eventosUsar);
    embed.setTitle(`📋 Listado de eventos — ${label}`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.customId.startsWith("panel_proximo_torneo")) {
    const ahora = (() => {
      const c = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      return c.getHours() * 60 + c.getMinutes();
    })();
    const ordenados = [...eventosUsar].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));
    const proximo = ordenados.find(e => horaAMin(e.hora) > ahora) || ordenados[0];
    const diffMin = ((horaAMin(proximo.hora) - ahora) + 1440) % 1440;
    const emoji = EMOJIS[proximo.tipo] || "🎮";

    const embed = new EmbedBuilder()
      .setColor(isRush ? 0x3498db : 0xFF69B4)
      .setTitle(`${emoji} Próximo torneo — ${label}`)
      .setDescription(
        `**${proximo.nombre}**\n` +
        `📅 **Hora:** ${proximo.hora}\n` +
        `🏅 **Rank:** ${proximo.rank}\n` +
        `${proximo.puntos ? `🎯 **Puntos:** ${proximo.puntos}\n` : ""}` +
        `⏳ **${diffEnPalabras(diffMin)}**`
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

// ── CREADOR DE EMBEDS MODO ENCUESTA ──────────────────────────────────────────
const embedSesiones = new Map(); // userId -> { paso, datos, canal }

async function handleEmbedCreator(message) {
  if (message.author.bot) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

  const content = message.content.trim();

  // Iniciar con !embed
  if (content.toLowerCase() === "!embed") {
    if (embedSesiones.has(message.author.id)) {
      embedSesiones.delete(message.author.id);
    }
    embedSesiones.set(message.author.id, { paso: "canal", datos: {} });
    return message.reply("📝 **Creador de embeds**\n\n¿En qué canal quieres enviar el embed? (menciona el canal con #)");
  }

  // Continuar sesión activa
  const sesion = embedSesiones.get(message.author.id);
  if (!sesion) return;

  const skip = content === "-"; // escribir - para omitir un campo

  if (sesion.paso === "canal") {
    const canal = message.mentions.channels.first();
    if (!canal) return message.reply("❌ Menciona el canal con #. Ejemplo: `#anuncios`");
    sesion.datos.canal = canal;
    sesion.paso = "titulo";
    return message.reply("✅ Canal: " + canal + "\n\n**¿Cuál es el título del embed?**");
  }

  if (sesion.paso === "titulo") {
    if (skip) return message.reply("❌ El título es obligatorio.");
    sesion.datos.titulo = content;
    sesion.paso = "descripcion";
    return message.reply(`✅ Título guardado.\n\n**¿Descripción?** (escribe \`-\` para omitir)`);
  }

  if (sesion.paso === "descripcion") {
    sesion.datos.descripcion = skip ? null : content;
    sesion.paso = "color";
    return message.reply(`✅ Descripción guardada.\n\n**¿Color?** Pon un hex como \`#39FF14\` (escribe \`-\` para verde por defecto)`);
  }

  if (sesion.paso === "color") {
    sesion.datos.color = skip ? 0x39FF14 : parseInt(content.replace("#", ""), 16) || 0x39FF14;
    sesion.paso = "logo";
    return message.reply(`✅ Color guardado.\n\n**¿Logo/thumbnail?** (URL de imagen, o \`-\` para omitir)`);
  }

  if (sesion.paso === "logo") {
    sesion.datos.logo = skip ? null : content;
    sesion.paso = "banner";
    return message.reply(`✅ Logo guardado.\n\n**¿Banner/imagen principal?** (URL de imagen, o \`-\` para omitir)`);
  }

  if (sesion.paso === "banner") {
    sesion.datos.banner = skip ? null : content;
    sesion.paso = "footer";
    return message.reply(`✅ Banner guardado.\n\n**¿Texto del footer?** (o \`-\` para omitir)`);
  }

  if (sesion.paso === "footer") {
    sesion.datos.footer = skip ? null : content;
    embedSesiones.delete(message.author.id);

    const { canal, titulo, descripcion, color, logo, banner, footer } = sesion.datos;
    const embed = new EmbedBuilder().setColor(color).setTitle(titulo).setTimestamp();
    if (descripcion) embed.setDescription(descripcion);
    if (logo)        embed.setThumbnail(logo);
    if (banner)      embed.setImage(banner);
    if (footer)      embed.setFooter({ text: footer });

    try {
      await canal.send({ embeds: [embed] });
      await message.reply(`✅ ¡Embed enviado en ${canal}!`);
    } catch (e) {
      await message.reply(`❌ No pude enviar el embed: ${e.message}`);
    }
  }
}


// ── !anuncio ──────────────────────────────────────────────────────────────────
async function handleAnuncioCmd(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!anuncio")) return;
  const { STAFF_ROLE_ID, ACTIVITY_ROLE_ID } = require("../config");
  if (!message.member?.roles?.cache?.has(STAFF_ROLE_ID) && !message.member?.permissions?.has(8n)) return;
  const texto = message.content.slice("!anuncio".length).trim();
  if (!texto) return message.reply("❌ Uso: `!anuncio [texto]`");
  const canal = await message.client.channels.fetch("1516259340431130715").catch(() => null);
  if (!canal) return message.reply("❌ No se encontró el canal de anuncios.");
  const embed = new EmbedBuilder().setColor(0x39FF14).setTitle("📢 ANUNCIO").setDescription(texto).setFooter({ text: `Publicado por ${message.author.tag}` }).setTimestamp();
  await canal.send({ content: `<@&${ACTIVITY_ROLE_ID}>`, embeds: [embed] });
  await message.reply("✅ Anuncio enviado.");
}

// ── !recordatorio ─────────────────────────────────────────────────────────────
async function handleRecordatorio(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!recordatorio")) return;
  const { STAFF_ROLE_ID, ACTIVITY_ROLE_ID } = require("../config");
  if (!message.member?.roles?.cache?.has(STAFF_ROLE_ID) && !message.member?.permissions?.has(8n)) return;
  const args = message.content.slice("!recordatorio".length).trim().split(/\s+/);
  const mins = parseInt(args[0]);
  const texto = args.slice(1).join(" ");
  if (isNaN(mins) || mins < 1 || !texto) return message.reply("❌ Uso: `!recordatorio [minutos] [texto]`");
  await message.reply(`✅ Recordatorio en **${mins} minuto${mins === 1 ? "" : "s"}**.`);
  setTimeout(async () => {
    const canal = await message.client.channels.fetch("1516259340431130715").catch(() => null);
    if (!canal) return;
    const embed = new EmbedBuilder().setColor(0xf39c12).setTitle("⏰ RECORDATORIO").setDescription(texto).setFooter({ text: `Programado por ${message.author.tag}` }).setTimestamp();
    await canal.send({ content: `<@&${ACTIVITY_ROLE_ID}>`, embeds: [embed] });
  }, mins * 60 * 1000);
}

// ── !encuesta (paso a paso) ───────────────────────────────────────────────────
const EMOJI_SI = "<:emoji_41:1504932685813121288>";
const EMOJI_NO = "<:emoji_42:1504932838321946775>";
const encuestaSesiones = new Map();

async function handleEncuesta(message) {
  if (message.author.bot) return;
  const { STAFF_ROLE_ID, ACTIVITY_ROLE_ID } = require("../config");
  if (!message.member?.roles?.cache?.has(STAFF_ROLE_ID) && !message.member?.permissions?.has(8n)) return;
  const content = message.content.trim();
  if (content.toLowerCase() === "!encuesta") {
    encuestaSesiones.set(message.author.id, { paso: "titulo", datos: {} });
    return message.reply("📊 **Creador de encuestas**\n\n¿Cuál es el título de la encuesta?");
  }
  const sesion = encuestaSesiones.get(message.author.id);
  if (!sesion) return;
  if (sesion.paso === "titulo") {
    sesion.datos.titulo = content;
    sesion.paso = "descripcion";
    return message.reply("✅ Título guardado.\n\n**¿Descripción o pregunta?** (escribe `-` para omitir)");
  }
  if (sesion.paso === "descripcion") {
    sesion.datos.descripcion = content === "-" ? null : content;
    sesion.paso = "canal";
    return message.reply("✅ Guardado.\n\n**¿En qué canal?** (menciona el canal con #)");
  }
  if (sesion.paso === "canal") {
    const canal = message.mentions.channels.first();
    if (!canal) return message.reply("❌ Menciona el canal con #");
    encuestaSesiones.delete(message.author.id);
    const embed = new EmbedBuilder().setColor(0x3498db).setTitle(`📊 ${sesion.datos.titulo}`).setTimestamp().setFooter({ text: `Encuesta por ${message.author.tag}` });
    if (sesion.datos.descripcion) embed.setDescription(sesion.datos.descripcion);
    try {
      const msg = await canal.send({ content: `<@&${ACTIVITY_ROLE_ID}>`, embeds: [embed] });
      await msg.react(EMOJI_SI).catch(() => {});
      await msg.react(EMOJI_NO).catch(() => {});
      await message.reply(`✅ Encuesta publicada en ${canal}.`);
    } catch(e) { await message.reply(`❌ Error: ${e.message}`); }
  }
}

module.exports = { initPanelEventos, handlePanelButton, handleEmbedCreator, handleAnuncioCmd, handleRecordatorio, handleEncuesta };
