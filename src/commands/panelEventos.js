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

function diffEnPalabras(diffMin) {
  if (diffMin < 1)   return "ahora mismo";
  if (diffMin < 60)  return `en ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;
  const horas = Math.floor(diffMin / 60);
  const mins  = diffMin % 60;
  if (mins === 0) return `en ${horas} hora${horas === 1 ? "" : "s"}`;
  return `en ${horas}h ${mins}min`;
}

// ── PANEL DE EVENTOS ──────────────────────────────────────────────────────────
function buildPanelEmbed(EVENTOS) {
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

  const emoji    = EMOJIS[eventoActual.tipo] || "🎮";
  const rankInfo = RANKS[eventoActual.rank] || {};

  const embed = new EmbedBuilder()
    .setColor(rankInfo.color || 0x39FF14)
    .setTitle("📊 Panel de Eventos — EXLATAM")
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
    .setFooter({ text: `Sistema de Eventos — EXLATAM | Última actualización` })
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

async function initPanelEventos(client, EVENTOS) {
  // Actualizar al iniciar y luego cada minuto
  await actualizarPanel(client, EVENTOS);
  setInterval(() => actualizarPanel(client, EVENTOS), 60 * 1000);
}

async function actualizarPanel(client, EVENTOS) {
  try {
    const canal = await client.channels.fetch(CANAL_PANEL_EVENTOS);
    if (!canal) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("panel_ver_todos").setLabel("Ver todos los eventos").setEmoji("📋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("panel_proximo_torneo").setLabel("Ver próximo torneo").setEmoji("🏆").setStyle(ButtonStyle.Primary)
    );

    const embed = buildPanelEmbed(EVENTOS);

    if (panelMessageId) {
      try {
        const msg = await canal.messages.fetch(panelMessageId);
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      } catch {}
    }

    // Buscar mensaje existente del bot
    const msgs = await canal.messages.fetch({ limit: 20 });
    const existing = msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (existing) {
      panelMessageId = existing.id;
      await existing.edit({ embeds: [embed], components: [row] });
      return;
    }

    const msg = await canal.send({ embeds: [embed], components: [row] });
    panelMessageId = msg.id;
  } catch (e) {
    console.error("[PANEL] Error:", e.message);
  }
}

async function handlePanelButton(interaction, EVENTOS) {
  if (!interaction.isButton()) return;
  if (!["panel_ver_todos", "panel_proximo_torneo"].includes(interaction.customId)) return;

  function horaAMin(h) { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; }

  if (interaction.customId === "panel_ver_todos") {
    const embed = buildListadoEmbed(EVENTOS);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.customId === "panel_proximo_torneo") {
    const ahora = (() => {
      const c = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      return c.getHours() * 60 + c.getMinutes();
    })();
    const ordenados = [...EVENTOS].sort((a, b) => horaAMin(a.hora) - horaAMin(b.hora));
    const proximo = ordenados.find(e => horaAMin(e.hora) > ahora) || ordenados[0];
    const diffMin = ((horaAMin(proximo.hora) - ahora) + 1440) % 1440;
    const emoji = EMOJIS[proximo.tipo] || "🎮";

    const embed = new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle(`${emoji} Próximo torneo`)
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

module.exports = { initPanelEventos, handlePanelButton, handleEmbedCreator };
