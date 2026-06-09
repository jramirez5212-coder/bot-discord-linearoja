const { EmbedBuilder }                              = require("discord.js");
const { loadData, getUser, todayKey,
        horaMinutoColombia, loadTops, saveTops,
        saveData }                                  = require("../utils/dataManager");
const { msToHours }                                 = require("../utils/format");
const { CANAL_ACTIVIDAD_ID, CANAL_TOP_ID,
        CANAL_LOGS_ID, ACTIVITY_ROLE_ID,
        TOP_ROLE_ID, STAFF_ROLE_ID,
        TOP_SIZE, GUILD_ID, LOGO_URL }              = require("../config");

let embedActividadId = null;
let embedTopId       = null;
let lastTopWeek      = null;
let guildCache       = null;

let _activeSessions = null;
function getActiveSessions() {
  if (!_activeSessions)
    _activeSessions = require("../events/voiceStateUpdate").activeSessions;
  return _activeSessions;
}

async function getGuild(client) {
  if (!guildCache) {
    guildCache = await client.guilds.fetch(GUILD_ID);
    await guildCache.members.fetch();
  }
  return guildCache;
}

function startActividadTask(client) {
  client.on("updateActividadEmbed", () => updateEmbeds(client));
  setInterval(() => updateEmbeds(client), 30 * 1000);
  setInterval(async () => {
    try { if (guildCache) await guildCache.members.fetch(); } catch {}
  }, 10 * 60 * 1000);
  setInterval(() => checkTopSemanal(client), 60 * 1000);
  setTimeout(() => updateEmbeds(client), 5000);
}

async function updateEmbeds(client) {
  await updateActividadEmbed(client);
  await updateTopEmbed(client);
}

// ── Embed actividad diaria ────────────────────────────────────────
async function updateActividadEmbed(client) {
  try {
    const guild = await getGuild(client);
    const canal = await client.channels.fetch(CANAL_ACTIVIDAD_ID).catch(() => null);
    if (!canal) return;

    const data           = loadData();
    const hoy            = todayKey();
    const activeSessions = getActiveSessions();
    const ahora          = Date.now();

    // Usar ACTIVITY_ROLE_ID — el rol que cuenta horas
    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const lista = [];
    for (const [id, member] of miembros) {
      const userData = getUser(data, id);
      const guardado = userData.days?.[hoy]?.totalMs || 0;
      const sesionTs = activeSessions.get(id) || userData.sessionStart;
      const enVivo   = sesionTs ? Math.min(ahora - sesionTs, 12 * 60 * 60 * 1000) : 0;
      lista.push({ member, msTotal: guardado + enVivo, enVivo: enVivo > 0 });
    }
    lista.sort((a, b) => b.msTotal - a.msTotal);

    let desc = "";
    lista.forEach(({ member, msTotal, enVivo }, i) => {
      desc += `**${i + 1}.** ${member} ${enVivo ? "🔴" : ""} 📅 Día: \`${hoy}\` ⏰ Total de horas: \`${msToHours(msTotal)}\`\n`;
    });
    if (!desc) desc = "*Nadie ha estado activo hoy.*";

    const embed = new EmbedBuilder()
      .setTitle("📊 Actividad de Miembros — Voz / Radio")
      .setColor(0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(desc.slice(0, 4000))
      .setFooter({ text: "🔴 en voz ahora • Colombia (UTC-5)" })
      .setTimestamp();

    if (embedActividadId) {
      try {
        const msg = await canal.messages.fetch(embedActividadId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch { embedActividadId = null; }
    }
    const msg = await canal.send({ embeds: [embed] });
    embedActividadId = msg.id;

  } catch (err) {
    console.error("[ACTIVIDAD] Error:", err.message);
  }
}

// ── Embed top en vivo ─────────────────────────────────────────────
async function updateTopEmbed(client) {
  try {
    const guild    = await getGuild(client);
    const canalTop = await client.channels.fetch(CANAL_TOP_ID).catch(() => null);
    if (!canalTop) return;

    const data           = loadData();
    const activeSessions = getActiveSessions();
    const ahora          = Date.now();

    // Top usa ACTIVITY_ROLE_ID para contar horas correctamente
    // TOP_ROLE_ID es solo el rol que se da al ganador
    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const ranking = [];
    for (const [id, member] of miembros) {
      const ud     = getUser(data, id);
      const sesionTs = activeSessions.get(id) || ud.sessionStart;
      const enVivo = sesionTs ? Math.min(ahora - sesionTs, 12 * 60 * 60 * 1000) : 0;
      ranking.push({
        member,
        weekMs:  (ud.weekMs || 0) + enVivo,
        totalMs: ud.totalMs || 0,
        enVivo:  enVivo > 0,
      });
    }
    ranking.sort((a, b) => b.weekMs - a.weekMs);

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    let topText = "";
    ranking.slice(0, TOP_SIZE).forEach(({ member, weekMs, totalMs, enVivo }, i) => {
      topText +=
        `${medals[i]} **${member.user.tag}** ${enVivo ? "🔴" : ""}\n` +
        `┣ Esta semana: \`${msToHours(weekMs)}\`\n` +
        `┗ Total: \`${msToHours(totalMs)}\`\n\n`;
    });
    if (!topText) topText = "*Sin datos aún.*";

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top ${TOP_SIZE} — Semana en Curso`)
      .setColor(0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(topText)
      .setFooter({ text: "🔴 en voz ahora • Se actualiza cada 30s" })
      .setTimestamp();

    if (embedTopId) {
      try {
        const msg = await canalTop.messages.fetch(embedTopId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch { embedTopId = null; }
    }
    const msg = await canalTop.send({ embeds: [embed] });
    embedTopId = msg.id;

  } catch (err) {
    console.error("[TOP EMBED] Error:", err.message);
  }
}

// ── Top semanal (lunes 00:00) ─────────────────────────────────────
async function checkTopSemanal(client) {
  const hora  = horaMinutoColombia();
  const fecha = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Bogota", weekday: "long",
  });
  if (hora !== "00:01" || fecha !== "Monday") return;
  const semanaActual = todayKey();
  if (lastTopWeek === semanaActual) return;
  lastTopWeek = semanaActual;
  console.log("[TOP] Ejecutando top semanal...");

  try {
    const guild = await getGuild(client);
    await guildCache.members.fetch();
    const data     = loadData();
    const canalTop = await client.channels.fetch(CANAL_TOP_ID).catch(() => null);
    const canalLog = await client.channels.fetch(CANAL_LOGS_ID).catch(() => null);

    // Usar ACTIVITY_ROLE_ID para el ranking
    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const ranking = [];
    for (const [id, member] of miembros) {
      const ud = getUser(data, id);
      ranking.push({ member, id, weekMs: ud.weekMs || 0, userData: ud });
    }
    ranking.sort((a, b) => b.weekMs - a.weekMs);
    const top = ranking.slice(0, TOP_SIZE);

    // Quitar rol TOP a todos los que lo tienen
    for (const [, member] of miembros) {
      if (member.roles.cache.has(TOP_ROLE_ID)) {
        try { await member.roles.remove(TOP_ROLE_ID); } catch {}
      }
    }

    const tops     = loadTops();
    const medals   = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const ascensos = [];
    let ganadores  = "";

    for (let i = 0; i < top.length; i++) {
      const { member, id, weekMs, userData } = top[i];
      try { await member.roles.add(TOP_ROLE_ID); } catch {}
      userData.topsGanados = (userData.topsGanados || 0) + 1;
      if (userData.topsGanados >= 2 && (userData.diasSeguidos || 0) >= 5)
        ascensos.push({ member, topsGanados: userData.topsGanados });
      tops.push({ userId: id, semana: semanaActual, puesto: i + 1, weekMs });
      ganadores += `${medals[i]} ${member} — \`${msToHours(weekMs)}\`\n`;
    }

    saveTops(tops);
    for (const id in data) {
      data[id].weekMs = 0;
      // Resetear sessionStart para que no cuente horas viejas en la nueva semana
      if (data[id].sessionStart) {
        data[id].sessionStart = Date.now();
      }
    }
    saveData(data);
    embedTopId = null;

    if (canalTop && ganadores) {
      await canalTop.send({
        content: `<@&${TOP_ROLE_ID}> 🎉`,
        embeds: [new EmbedBuilder()
          .setTitle("🎉 ¡Ganadores del Top Semanal!")
          .setColor(0xf1c40f)
          .setThumbnail(LOGO_URL)
          .setDescription(`**¡Felicitaciones a los más activos de la semana!** 🏆\n\n${ganadores}\n¡Sigan así! 🎖️`)
          .addFields({ name: "📅 Semana", value: semanaActual, inline: true })
          .setTimestamp()
          .setFooter({ text: "Nueva semana, nueva oportunidad 💪" })]
      });
    }

    for (const { member, topsGanados } of ascensos) {
      if (canalLog) {
        await canalLog.send({ embeds: [new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("⭐ Posible Ascenso")
          .setDescription(
            `${member} ha ganado **${topsGanados} tops** y tiene actividad constante.\n\n` +
            `<@&${STAFF_ROLE_ID}> este miembro **merece un ascenso**. 🎖️`
          )
          .setTimestamp()] });
      }
    }

    console.log("[TOP] Completado.");
  } catch (err) {
    console.error("[TOP] Error:", err.message);
  }
}

module.exports = { startActividadTask, updateActividadEmbed };
