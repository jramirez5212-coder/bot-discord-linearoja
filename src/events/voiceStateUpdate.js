const { loadData, saveData, getUser, cleanOldDays, todayKey } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, MAX_SESSION_MS, AFK_CHANNEL_ID }   = require("../config");

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
    }
  },
};
