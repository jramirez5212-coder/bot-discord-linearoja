const { EmbedBuilder }                                         = require("discord.js");
const { loadDataRush, getUser, todayKey }                      = require("../utils/dataManager");
const { msToHours, lastNDays }                                 = require("../utils/format");
const { RUSH_ACTIVITY_ROLE_ID, TOP_ROLE_ID, TOP_SIZE,
        GUILD_ID, LOGO_URL, RUSH_CANAL_CMD_HORAS }                  = require("../config");

// Alias para compatibilidad con el código copiado de horas.js
const loadData = loadDataRush;

// Sesiones activas para calcular tiempo en vivo
let _activeSessions = null;
function getActiveSessions() {
  if (!_activeSessions) _activeSessions = require("../events/voiceStateUpdate").activeSessions;
  return _activeSessions;
}

async function handleHorasRush(message, client) {
  if (message.author.bot) return;
  const args    = message.content.trim().split(/\s+/);
  const comando = args[0].toLowerCase();
  if (!["!horas","!top"].includes(comando)) return;

  // Solo en canal RUSH — si es otro canal, no hacer nada (puede ser canal ROLAS)
  if (message.channel.id !== RUSH_CANAL_CMD_HORAS) return;

  const data           = loadData();
  const activeSessions = getActiveSessions();
  const ahora          = Date.now();

  // ── !horas ────────────────────────────────────────────────────
  if (comando === "!horas") {
    const target = message.mentions.members.first() || message.member;
    if (!target.roles.cache.has(RUSH_ACTIVITY_ROLE_ID))
      return message.reply("❌ Ese usuario no tiene el rol de actividad.");

    const userData = getUser(data, target.id);
    const dias     = lastNDays(7);
    const hoy      = todayKey();

    // Calcular estado del usuario
    const _ses = activeSessions.get(target.id); const sesionTs = _ses && _ses.isRush ? _ses.startMs : (userData.sessionStart || null);
    const enVivo     = sesionTs ? Math.min(ahora - sesionTs, 12 * 60 * 60 * 1000) : 0;
    const msHoy      = (userData.days?.[hoy]?.totalMs || 0) + enVivo;
    const estaEnVoz  = enVivo > 0;
    const tieneError = !userData.lastSeen && !userData.botFirstSeen && !estaEnVoz;

    // Indicador de estado
    let estadoEmoji = "🔴"; // inactivo
    let estadoTexto = "Inactivo";
    if (estaEnVoz) { estadoEmoji = "🟢"; estadoTexto = "En voz ahora"; }
    else if (tieneError) { estadoEmoji = "🟡"; estadoTexto = "Sin registro"; }
    else if (msHoy > 0) { estadoEmoji = "🟢"; estadoTexto = "Activo hoy"; }

    let diasText = "";
    for (const dia of dias) {
      const ms = userData.days?.[dia]?.totalMs || 0;
      diasText += `${ms > 0 ? "🟩" : "⬜"} \`${dia}\` — ${msToHours(ms)}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${estadoEmoji} ${target.user.username} — ${estadoTexto}`)
      .setColor(estaEnVoz ? 0x39FF14 : tieneError ? 0xf1c40f : msHoy > 0 ? 0x39FF14 : 0xe74c3c)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📅 Últimos 7 días",  value: diasText || "*Sin registros*" },
        { name: "⏰ Hoy",            value: `\`${msToHours(msHoy)}\``,              inline: true },
        { name: "📆 Esta semana",     value: `\`${msToHours(userData.weekMs)}\``,   inline: true },
        { name: "🏆 Total",           value: `\`${msToHours(userData.totalMs)}\``,  inline: true },
        { name: "🔥 Racha",           value: `\`${userData.diasSeguidos || 0}d\``,  inline: true },
        { name: "🎖️ Tops ganados",    value: `\`${userData.topsGanados || 0}\``,    inline: true },
        { name: "⚠️ Advertencias",    value: `\`${userData.advertencias || 0}/3\``, inline: true },
        { name: "👁️ Última vez",      value: userData.lastSeen
            ? `<t:${Math.floor(userData.lastSeen / 1000)}:R>` : "*Nunca*",          inline: true },
      )
      .setFooter({ text: "🟢 Activo • 🔴 Inactivo • 🟡 Sin registro" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // ── !top ──────────────────────────────────────────────────────
  if (comando === "!top") {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(RUSH_ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const ranking = [];
    for (const [id, member] of miembros) {
      const ud     = getUser(data, id);
      const _ses2 = activeSessions.get(id); const sesionTs = _ses2 && _ses2.isRush ? _ses2.startMs : (ud.sessionStart || null);
      const enVivo = sesionTs ? Math.min(ahora - sesionTs, 12 * 60 * 60 * 1000) : 0;
      ranking.push({ member, weekMs: (ud.weekMs||0)+enVivo, totalMs: ud.totalMs||0, enVivo: enVivo>0 });
    }
    ranking.sort((a,b) => b.weekMs - a.weekMs);

    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
    let topText  = "";
    ranking.slice(0, TOP_SIZE).forEach(({ member, weekMs, totalMs, enVivo }, i) => {
      topText +=
        `${medals[i]} **${member.user.username}** ${enVivo ? "🟢" : "🔴"}\n` +
        `┣ Esta semana: \`${msToHours(weekMs)}\`\n` +
        `┗ Total: \`${msToHours(totalMs)}\`\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top ${TOP_SIZE} — Semana Actual`)
      .setColor(0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(topText || "*Sin datos aún.*")
      .setFooter({ text: "🟢 En voz ahora • 🔴 Inactivo" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
}

module.exports = { handleHorasRush };
