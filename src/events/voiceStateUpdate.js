const { loadData, saveData, loadDataRush, saveDataRush, getUser, cleanOldDays, todayKey } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, RUSH_ACTIVITY_ROLE_ID, MAX_SESSION_MS, AFK_CHANNEL_ID } = require("../config");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const TIEMPO_ENSORDECIDO_MS = 5 * 60 * 1000;
const TIEMPO_SILENCIADO_MS  = 8 * 60 * 1000;
const antiFarmeoTimers = new Map();
const CANAL_LOGS_VOZ_ID = "1516294458591674530";

// Usuarios exentos del anti-farmeo
const afkExemptos     = new Set();
const afkExemptosMute = new Set();
const afkExemptoDeaf  = new Set();

// Sesiones activas en memoria
const activeSessions = new Map(); // userId -> { startMs, isRush }
const pendingUpdates = new Map();

// Detecta si el miembro es ROLAS, RUSH o ninguno
function detectarSistema(member) {
  if (member.roles.cache.has(ACTIVITY_ROLE_ID))      return "ROLAS";
  if (member.roles.cache.has(RUSH_ACTIVITY_ROLE_ID)) return "RUSH";
  return null;
}

// Carga y guarda el archivo correcto según el sistema
function cargarDatos(isRush) { return isRush ? loadDataRush() : loadData(); }
function guardarDatos(data, isRush) { isRush ? saveDataRush(data) : saveData(data); }

// Al arrancar: recuperar sesiones activas de ambos archivos
function recoverSessions(client) {
  try {
    for (const [isRush, label] of [[false,"ROLAS"],[true,"RUSH"]]) {
      const data = cargarDatos(isRush);
      for (const userId in data) {
        const ud = data[userId];
        if (ud.sessionStart) {
          activeSessions.set(userId, { startMs: ud.sessionStart, isRush });
          console.log(`[VOZ-${label}] ↩ Sesión recuperada: ${userId} desde ${new Date(ud.sessionStart).toLocaleTimeString()}`);
        }
      }
    }
  } catch(e) { console.error("[VOZ] Error recuperando sesiones:", e.message); }
}

module.exports = {
  activeSessions,
  recoverSessions,
  handleAntiFarmeoButton,
  afkExemptos,
  afkExemptosMute,
  afkExemptoDeaf,

  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const sistema = detectarSistema(member);
    if (!sistema) return; // No tiene rol de actividad ni ROLAS ni RUSH

    // RUSH no trackea horas de voz — solo ROLAS
    if (sistema === "RUSH") return;
    const userId  = member.id;
    const entró   = !oldState.channelId && newState.channelId;
    const salió   = oldState.channelId  && !newState.channelId;
    const cambióCh = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

    const nuevoCanalEsAFK = newState.channelId === AFK_CHANNEL_ID;
    const viejoCanalEsAFK = oldState.channelId === AFK_CHANNEL_ID;

    // ── ENTRÓ A VOZ ──────────────────────────────────────────
    if ((entró && !nuevoCanalEsAFK) || (cambióCh && viejoCanalEsAFK && !nuevoCanalEsAFK)) {
      const ahora = Date.now();
      activeSessions.set(userId, { startMs: ahora, isRush });

      const data     = cargarDatos(isRush);
      const userData = getUser(data, userId);
      userData.sessionStart = ahora;
      guardarDatos(data, isRush);

      console.log(`[VOZ-${sistema}] ▶ ${member.user.tag} entró a #${newState.channel?.name}`);
    }

    // ── SALIÓ DE VOZ ─────────────────────────────────────────
    if ((salió && !viejoCanalEsAFK) || (cambióCh && !viejoCanalEsAFK && nuevoCanalEsAFK)) {
      const sesion = activeSessions.get(userId);
      if (sesion) {
        const duration = Date.now() - sesion.startMs;
        const sesIsRush = sesion.isRush;

        if (duration > 0 && duration < MAX_SESSION_MS) {
          const data     = cargarDatos(sesIsRush);
          const userData = getUser(data, userId);
          const hoy      = todayKey();

          userData.totalMs  += duration;
          userData.weekMs   += duration;
          userData.lastSeen  = Date.now();

          if (!userData.days[hoy]) userData.days[hoy] = { totalMs: 0 };
          userData.days[hoy].totalMs += duration;

          // Racha de días seguidos
          const ayer    = new Date();
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

          delete userData.sessionStart;
          cleanOldDays(userData);
          guardarDatos(data, sesIsRush);
          console.log(`[VOZ-${sesIsRush ? "RUSH" : "ROLAS"}] ✓ ${member.user.tag} +${Math.floor(duration/60000)}m guardado`);
        } else {
          const data     = cargarDatos(sesIsRush);
          const userData = getUser(data, userId);
          delete userData.sessionStart;
          guardarDatos(data, sesIsRush);
        }

        activeSessions.delete(userId);
      }

      clearTimeout(pendingUpdates.get(userId));
      pendingUpdates.set(userId, setTimeout(() => {
        client.emit("updateActividadEmbed");
        pendingUpdates.delete(userId);
      }, 5000));

      clearTimeout(antiFarmeoTimers.get(userId));
      antiFarmeoTimers.delete(userId);
    }

    // ── ANTI-FARMEO ───────────────────────────────────────────
    if (newState.channelId && !nuevoCanalEsAFK) {
      const estaEnsordecido = newState.selfDeaf || newState.deaf;
      const estaSilenciado  = (newState.selfMute || newState.mute) && !estaEnsordecido;

      const exentoTotal = afkExemptos.has(userId);
      const exentoDeaf  = afkExemptoDeaf.has(userId);
      const exentoMute  = afkExemptosMute.has(userId);

      if ((estaEnsordecido && !exentoTotal && !exentoDeaf) ||
          (estaSilenciado  && !exentoTotal && !exentoMute)) {
        if (!antiFarmeoTimers.has(userId)) {
          const tiempoEspera = estaEnsordecido ? TIEMPO_ENSORDECIDO_MS : TIEMPO_SILENCIADO_MS;
          const timer = setTimeout(() => enviarChequeoAntiFarmeo(member, client, userId), tiempoEspera);
          antiFarmeoTimers.set(userId, timer);
        }
      } else {
        clearTimeout(antiFarmeoTimers.get(userId));
        antiFarmeoTimers.delete(userId);
      }
    } else {
      clearTimeout(antiFarmeoTimers.get(userId));
      antiFarmeoTimers.delete(userId);
    }
  },
};

async function enviarChequeoAntiFarmeo(member, client, userId) {
  antiFarmeoTimers.delete(userId);

  const guild       = member.guild;
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
    moverAAFK(freshMember);
    return;
  }

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
    console.log(`[ANTIFARMEO] ${member.user.tag} movido a AFK.`);
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

  try {
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
