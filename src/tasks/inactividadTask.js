const { EmbedBuilder, ActionRowBuilder,
        ButtonBuilder, ButtonStyle }                    = require("discord.js");
const { loadData, saveData, getUser, todayKey,
        horaMinutoColombia }                            = require("../utils/dataManager");
const { msToHours }                                     = require("../utils/format");
const { ACTIVITY_ROLE_ID, STAFF_ROLE_ID,
        CANAL_ADVERTENCIAS_ID, CANAL_LOGS_ID,
        CANAL_SANCIONES_ID, CANAL_AVISO_LINK,
        GUILD_ID, DIA_ADV_1, DIA_ADV_2,
        DIA_ADV_3, DIA_EXPULSA }                       = require("../config");

const CANAL_DECISION_EXPULSION_ID = "1517009855020273776";

let lastCheck = null;

function startInactividadTask(client) {
  console.log(`[INACTIVIDAD] Bot prendido: ${todayKey()}`);
  setInterval(() => checkMedianoche(client), 60 * 1000);
}

async function checkMedianoche(client) {
  const hora     = horaMinutoColombia();
  const fechaHoy = todayKey();
  if (hora !== "23:59" || lastCheck === fechaHoy) return;
  lastCheck = fechaHoy;
  console.log("[INACTIVIDAD] Check de medianoche...");

  try {
    const guild        = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    const data         = loadData();
    const canalAdv     = await client.channels.fetch(CANAL_ADVERTENCIAS_ID).catch(() => null);
    const canalLogs    = await client.channels.fetch(CANAL_LOGS_ID).catch(() => null);
    const canalSancion = await client.channels.fetch(CANAL_SANCIONES_ID).catch(() => null);

    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot
    );

    const ahora_ms = Date.now();

    for (const [id, member] of miembros) {
      const userData = getUser(data, id);
      const msHoy    = userData.days?.[fechaHoy]?.totalMs || 0;

      if (!userData.lastSeen && !userData.botFirstSeen) {
        userData.botFirstSeen = Date.now();
        continue;
      }

      const referencia = userData.botFirstSeen || userData.lastSeen;
      const diasSin    = Math.floor((ahora_ms - referencia) / (24 * 60 * 60 * 1000));
      const cumplioHoy = msHoy > 0;
      const excusado   = global.isExcused && global.isExcused(id);

      // Log diario en #logs
      if (canalLogs) {
        const logEmbed = new EmbedBuilder()
          .setColor(cumplioHoy ? 0x39FF14 : 0xe74c3c)
          .setThumbnail(member.user.displayAvatarURL())
          .setTitle(`${cumplioHoy ? "✅" : "❌"} ${member.user.username}`)
          .addFields(
            { name: "📅 Fecha",           value: fechaHoy,                         inline: true },
            { name: "⏰ Horas hoy",       value: msToHours(msHoy),                 inline: true },
            { name: "📆 Esta semana",     value: msToHours(userData.weekMs),       inline: true },
            { name: "🏆 Total",           value: msToHours(userData.totalMs),      inline: true },
            { name: "📉 Días sin entrar", value: `${diasSin}d`,                    inline: true },
            { name: "🔥 Racha",           value: `${userData.diasSeguidos || 0}d`, inline: true },
          )
          .setTimestamp();
        try { await canalLogs.send({ embeds: [logEmbed] }); } catch {}
      }

      if (cumplioHoy) {
        userData.advertencias  = 0;
        userData.botFirstSeen  = Date.now();
        if (userData.lastSeen) userData.botFirstSeen = userData.lastSeen;
        continue;
      }
      if (excusado) continue;

      // Aviso diario en canal de advertencias con link al canal
      if (diasSin >= 1 && canalAdv) {
        try {
          await canalAdv.send(
            `${member} hoy no entraste, recuerda que si no entras manda ${CANAL_AVISO_LINK}`
          );
        } catch {}
      }

      if (!userData.advertencias) userData.advertencias = 0;

      // Día 1 — Advertencia 1
      if (diasSin === DIA_ADV_1 && userData.advertencias < 1) {
        userData.advertencias = 1;
        await enviarSancion(member, canalSancion, 1, diasSin,
          `Llevas **${diasSin} día** sin conectarte al canal de voz.\nEsta es tu **primera advertencia**.`,
          0xf39c12, "⚠️");
        await enviarDM(member, diasSin, 1, "Esta es tu primera advertencia por inactividad.");
      }
      // Día 3 — Advertencia 2
      else if (diasSin === DIA_ADV_2 && userData.advertencias < 2) {
        userData.advertencias = 2;
        await enviarSancion(member, canalSancion, 2, diasSin,
          `Llevas **${diasSin} días** sin conectarte.\nEsta es tu **segunda advertencia**.\nSi no te conectas pronto perderás tu rol.`,
          0xe67e22, "🚨");
        await enviarDM(member, diasSin, 2, "Esta es tu segunda advertencia. Conéctate pronto o perderás tu rol.");
      }
      // Día 5 — Advertencia final
      else if (diasSin === DIA_ADV_3 && userData.advertencias < 3) {
        userData.advertencias = 3;
        await enviarSancion(member, canalSancion, 3, diasSin,
          `Llevas **${diasSin} días** sin conectarte.\n🚨 **ÚLTIMA ADVERTENCIA** — Si mañana no te conectas serás **expulsado del rol**.`,
          0xe74c3c, "🚨");
        await enviarDM(member, diasSin, 3, "🚨 ÚLTIMA ADVERTENCIA. Si no te conectas mañana perderás tu rol definitivamente.");
      }
      // Día 6 — Pedir confirmación al staff antes de expulsar
      else if (diasSin >= DIA_EXPULSA && !userData.pendienteExpulsion) {
        userData.pendienteExpulsion = true;

        const canalDecision = await client.channels.fetch(CANAL_DECISION_EXPULSION_ID).catch(() => null);
        if (canalDecision) {
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🚫 ¿Expulsar del Rol de Actividad?")
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(
              `**${member.user.tag}** lleva **${diasSin} días** sin actividad y agotó sus 3 advertencias.\n\n` +
              `Staff: decide qué hacer con este miembro.`
            )
            .addFields(
              { name: "⚠️ Advertencias",  value: "3 / 3",       inline: true },
              { name: "📉 Días inactivo", value: `${diasSin}d`,  inline: true },
              { name: "📅 Fecha",         value: fechaHoy,       inline: true },
            )
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`expulsar_inactivo:${member.id}`)
              .setLabel("Expulsar del rol")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("🚫"),
            new ButtonBuilder()
              .setCustomId(`restablecer_inactivo:${member.id}`)
              .setLabel("Restablecer advertencias")
              .setStyle(ButtonStyle.Success)
              .setEmoji("♻️"),
          );

          try {
            await canalDecision.send({
              content: `<@&${STAFF_ROLE_ID}> decisión pendiente sobre ${member}.`,
              embeds:  [embed],
              components: [row],
            });
          } catch {}
        }
      }

      if (userData.lastSeen) userData.botFirstSeen = userData.lastSeen;
    }

    saveData(data);
    console.log("[INACTIVIDAD] Completado.");
  } catch (err) {
    console.error("[INACTIVIDAD] Error:", err);
  }
}

async function enviarSancion(member, canal, numero, diasSin, mensaje, color, emoji) {
  if (!canal) return;
  try {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} Advertencia ${numero}/3 — ${member.user.username}`)
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`${member}\n\n${mensaje}`)
      .addFields(
        { name: "⚠️ Advertencia nº", value: `${numero} / 3`, inline: true },
        { name: "📉 Días inactivo",  value: `${diasSin}d`,   inline: true },
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${member.id}` });
    await canal.send({ embeds: [embed] });
  } catch (err) { console.error("[SANCION] Error:", err); }
}

async function enviarDM(member, diasSin, numAdv, extra) {
  try {
    await member.send({ embeds: [new EmbedBuilder()
      .setColor(numAdv === 3 ? 0xe74c3c : 0xe67e22)
      .setTitle(`⚠️ Advertencia ${numAdv}/3 de Inactividad`)
      .setDescription(
        `Hola **${member.user.username}**,\n\n` +
        `Llevas **${diasSin} día(s)** sin conectarte.\n\n${extra}\n\n¡Te esperamos! 🎙️`
      )
      .setTimestamp()] });
  } catch {}
}

module.exports = { startInactividadTask };
