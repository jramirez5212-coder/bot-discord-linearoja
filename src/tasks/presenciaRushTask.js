const { EmbedBuilder } = require("discord.js");
const { RUSH_ACTIVITY_ROLE_ID, GUILD_ID, LOGO_URL, VOICE_CHANNELS_ALLOWED } = require("../config");

const CANAL_PRESENCIA_RUSH = "1518493643214815252";
let presenciaMsgId = null;

function colombiaTime() {
  return new Date().toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
}
function colombiaDate() {
  return new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
}

async function updatePresenciaRush(client) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch().catch(() => {});

    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(RUSH_ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const enVoz    = [];
    const fuera    = [];

    for (const [, member] of miembros) {
      const enCanalPermitido = member.voice.channelId &&
        VOICE_CHANNELS_ALLOWED.includes(member.voice.channelId);
      if (enCanalPermitido) {
        enVoz.push(member);
      } else {
        fuera.push(member);
      }
    }

    const listaVoz  = enVoz.length  ? enVoz.map(m  => `• ${m}`).join("\n") : "_Nadie en canal de voz_";
    const listaFuera = fuera.length ? fuera.map(m => `• ${m}`).join("\n")  : "_Todos están activos_";

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📋 Plantilla RUSH — Presencia")
      .setThumbnail(LOGO_URL)
      .addFields(
        { name: `🟢 EN CANAL DE VOZ (${enVoz.length})`,   value: listaVoz,   inline: false },
        { name: `🔴 FUERA (${fuera.length})`,              value: listaFuera, inline: false },
      )
      .setFooter({ text: `${colombiaDate()} • Colombia (UTC-5) • actualizado a las ${colombiaTime()}` })
      .setTimestamp();

    const canal = await client.channels.fetch(CANAL_PRESENCIA_RUSH).catch(() => null);
    if (!canal) return;

    if (presenciaMsgId) {
      try {
        const msg = await canal.messages.fetch(presenciaMsgId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch { presenciaMsgId = null; }
    }

    // Buscar mensaje existente del bot
    const msgs = await canal.messages.fetch({ limit: 10 });
    const existing = msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    if (existing) {
      presenciaMsgId = existing.id;
      await existing.edit({ embeds: [embed] });
      return;
    }

    const msg = await canal.send({ embeds: [embed] });
    presenciaMsgId = msg.id;
  } catch(e) {
    console.error("[PRESENCIA-RUSH] Error:", e.message);
  }
}

function startPresenciaRushTask(client) {
  // Actualizar cada 30 segundos
  setTimeout(() => updatePresenciaRush(client), 5000);
  setInterval(() => updatePresenciaRush(client), 30 * 1000);

  // Actualizar también cuando alguien entra o sale de voz
  client.on("voiceStateUpdate", () => {
    updatePresenciaRush(client).catch(() => {});
  });

  console.log("[PRESENCIA-RUSH] Sistema de presencia iniciado.");
}

module.exports = { startPresenciaRushTask };
