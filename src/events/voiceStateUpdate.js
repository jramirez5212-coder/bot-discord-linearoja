const { loadData, saveData, getUser, cleanOldDays, todayKey } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, MAX_SESSION_MS, AFK_CHANNEL_ID }   = require("../config");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const TIEMPO_ENSORDECIDO_MS = 5 * 60 * 1000; // 5 min
const TIEMPO_SILENCIADO_MS  = 8 * 60 * 1000; // 8 min
const antiFarmeoTimers = new Map(); // userId -> timeout
const CANAL_LOGS_VOZ_ID = "1516294458591674530";

// Sesiones activas en memoria
const activeSessions = new Map();
const pendingUpdates = new Map();

// Al arrancar el bot, recuperar sesiones activas del JSON
function recoverSessions(client) {
  try {
    const data = loadData();
    for (const userId in data) {
      const ud = data[userId];
      if (ud.sessionStart) {
        activeSessions.set(userId, ud.sessionStart);
        console.log(`[VOZ] ↩ Sesión recuperada: ${userId} desde ${new Date(ud.sessionStart).toLocaleTimeString()}`);
      }
    }
  } catch(e) { console.error("[VOZ] Error recuperando sesiones:", e.message); }
}

module.exports = {
  activeSessions,
  recoverSessions,
  handleAntiFarmeoButton,

  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    if (!member.roles.cache.has(ACTIVITY_ROLE_ID)) return;

    const userId    = member.id;
    const entró     = !oldState.channelId && newState.channelId;
    const salió     = oldState.channelId  && !newState.channelId;
    const cambióCh  = oldState.channelId  && newState.channelId && oldState.channelId !== newState.channelId;

    // Ignorar canal AFK
    const nuevoCanalEsAFK = newState.channelId === AFK_CHANNEL_ID;
    const viejoCanalEsAFK = oldState.channelId === AFK_CHANNEL_ID;

    // ── ENTRÓ A VOZ (o salió de AFK) ────────────────────────
    if ((entró && !nuevoCanalEsAFK) || (cambióCh && viejoCanalEsAFK && !nuevoCanalEsAFK)) {
      const ahora = Date.now();
      activeSessions.set(userId, ahora);

      // Guardar sessionStart en JSON para recuperar tras reinicio
      const data     = loadData();
      const userData = getUser(data, userId);
      userData.sessionStart = ahora;
      saveData(data);

      console.log(`[VOZ] ▶ ${member.user.tag} entró a #${newState.channel?.name}`);
      // Log de Discord desactivado (solo se mantiene el log en consola)
    }

    // ── SALIÓ DE VOZ (o entró a AFK) ───────────────────────
    if ((salió && !viejoCanalEsAFK) || (cambióCh && !viejoCanalEsAFK && nuevoCanalEsAFK)) {
      const joinedAt = activeSessions.get(userId);
      if (joinedAt) {
        const duration = Date.now() - joinedAt;

        if (duration > 0 && duration < MAX_SESSION_MS) {
          const data     = loadData();
          const userData = getUser(data, userId);
          const hoy      = todayKey();

          userData.totalMs  += duration;
          userData.weekMs   += duration;
          userData.lastSeen  = Date.now();

          if (!userData.days[hoy]) userData.days[hoy] = { totalMs: 0 };
          userData.days[hoy].totalMs += duration;

          // Racha de días seguidos
          const ayer = new Date();
          ayer.setDate(ayer.getDate() - 1);
          const ayerKey = ayer.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
          if (userData.ultimoDiaContinuo === ayerKey || userData.ultimoDiaContinuo === hoy) {
            if (userData.ultimoDiaContinuo !== hoy) {
              userData.diasSeguidos      = (userData.diasSeguidos || 0) + 1;
              userData.ultimoDiaContinuo = hoy;
            }
          } else {
            userData.diasSeguidos      = 1;
            userData.ultimoDiaContinuo = hoy;
          }

          // Limpiar sessionStart
          delete userData.sessionStart;
          cleanOldDays(userData);
          saveData(data);
          console.log(`[VOZ] ✓ ${member.user.tag} +${Math.floor(duration/60000)}m guardado`);
          // Log de Discord desactivado (solo se mantiene el log en consola)
        } else {
          // Limpiar sessionStart aunque no se guarden horas
          const data     = loadData();
          const userData = getUser(data, userId);
          delete userData.sessionStart;
          saveData(data);
        }

        activeSessions.delete(userId);
      }

      clearTimeout(pendingUpdates.get(userId));
      pendingUpdates.set(userId, setTimeout(() => {
        client.emit("updateActividadEmbed");
        pendingUpdates.delete(userId);
      }, 5000));

      // Salió de voz: cancelar timer de anti-farmeo si lo tenía
      clearTimeout(antiFarmeoTimers.get(userId));
      antiFarmeoTimers.delete(userId);
    }

    // ── ANTI-FARMEO: detectar ensordecido / silenciado ─────
    if (newState.channelId && !nuevoCanalEsAFK) {
      const estaEnsordecido = newState.selfDeaf || newState.deaf;
      const estaSilenciado  = (newState.selfMute || newState.mute) && !estaEnsordecido;

      if (estaEnsordecido || estaSilenciado) {
        // Solo arrancar timer si no hay uno ya corriendo para este usuario
        if (!antiFarmeoTimers.has(userId)) {
          const tiempoEspera = estaEnsordecido ? TIEMPO_ENSORDECIDO_MS : TIEMPO_SILENCIADO_MS;
          const timer = setTimeout(() => enviarChequeoAntiFarmeo(member, client, userId), tiempoEspera);
          antiFarmeoTimers.set(userId, timer);
        }
      } else {
        // Ya no está ensordecido ni silenciado: cancelar timer
        clearTimeout(antiFarmeoTimers.get(userId));
        antiFarmeoTimers.delete(userId);
      }
    } else {
      // Salió del canal o entró a AFK: cancelar timer
      clearTimeout(antiFarmeoTimers.get(userId));
      antiFarmeoTimers.delete(userId);
    }
  },
};

async function enviarChequeoAntiFarmeo(member, client, userId) {
  antiFarmeoTimers.delete(userId);

  // Verificar que sigue en voz y sigue ensordecido/silenciado
  const guild = member.guild;
  const freshMember = await guild.members.fetch(userId).catch(() => null);
  if (!freshMember || !freshMember.voice.channelId) return;
  if (freshMember.voice.channelId === AFK_CHANNEL_ID) return;

  const sigueEnsordecido = freshMember.voice.selfDeaf || freshMember.voice.deaf;
  const sigueSilenciado  = freshMember.voice.selfMute || freshMember.voice.mute;
  if (!sigueEnsordecido && !sigueSilenciado) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`antifarmeo_activo:${userId}`).setLabel("✅ Sigo activo").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`antifarmeo_afk:${userId}`).setLabel("💤 Muéveme al AFK").setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("🎙️ ¿Sigues activo?")
    .setDescription(
      `Llevas un rato ${sigueEnsordecido ? "**ensordecido**" : "**silenciado**"} en el canal de voz.\n\n` +
      `Si sigues ahí presiona **"Sigo activo"**. Si no respondes en 2 minutos serás movido al canal AFK.`
    )
    .setTimestamp();

  let respondido = false;
  try {
    await freshMember.send({ embeds: [embed], components: [row] });
  } catch {
    // No se pudo mandar DM (privados cerrados): mover directo a AFK
    moverAAFK(freshMember);
    return;
  }

  // Si no responde en 2 minutos, mover a AFK
  setTimeout(async () => {
    if (respondido) return;
    const m = await guild.members.fetch(userId).catch(() => null);
    if (!m || !m.voice.channelId || m.voice.channelId === AFK_CHANNEL_ID) return;
    moverAAFK(m);
  }, 2 * 60 * 1000);

  pendingAntiFarmeoResponses.set(userId, () => { respondido = true; });
}

async function moverAAFK(member) {
  try {
    await member.voice.setChannel(AFK_CHANNEL_ID);
    console.log(`[ANTIFARMEO] ${member.user.tag} movido a AFK por inactividad/ensordecido sin respuesta.`);
  } catch (e) {
    console.error("[ANTIFARMEO] Error moviendo a AFK:", e.message);
  }
}

const pendingAntiFarmeoResponses = new Map();

async function handleAntiFarmeoButton(interaction) {
  if (!interaction.isButton()) return;
  const isActivo = interaction.customId.startsWith("antifarmeo_activo:");
  const isAfk    = interaction.customId.startsWith("antifarmeo_afk:");
  if (!isActivo && !isAfk) return;

  const userId = interaction.customId.split(":")[1];
  if (interaction.user.id !== userId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  const marcarRespondido = pendingAntiFarmeoResponses.get(userId);
  if (marcarRespondido) marcarRespondido();
  pendingAntiFarmeoResponses.delete(userId);

  if (isActivo) {
    try {
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Confirmado").setDescription("Perfecto, sigues activo. ¡Gracias!")],
        components: [],
      });
    } catch {}
    return;
  }

  // Quiere moverse al AFK voluntariamente
  try {
    // Buscar el member en todos los guilds donde el bot esté (DM no tiene guild)
    for (const [, guild] of interaction.client.guilds.cache) {
      const m = await guild.members.fetch(userId).catch(() => null);
      if (m?.voice?.channelId) { await moverAAFK(m); break; }
    }
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("💤 Movido al AFK").setDescription("Te movimos al canal AFK. ¡Gracias por avisar!")],
      components: [],
    });
  } catch {}
}
