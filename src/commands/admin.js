const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle }                                         = require("discord.js");
const { loadData, saveData, getUser, todayKey }                = require("../utils/dataManager");
const { msToHours }                                            = require("../utils/format");
const { ACTIVITY_ROLE_ID, STAFF_ROLE_ID, GUILD_ID,
        LOGO_URL, CANAL_CMD_ADMIN, AFK_CHANNEL_ID }            = require("../config");

const ROL_CHITEADO_ID = "1516258987320807536";

function isAdmin(message) {
  return message.member?.roles?.cache?.has(STAFF_ROLE_ID) ||
         message.member?.permissions?.has(8n);
}

function parseTime(str) {
  let ms = 0;
  const hours = str.match(/(\d+)h/i);
  const mins  = str.match(/(\d+)m/i);
  if (hours) ms += parseInt(hours[1]) * 60 * 60 * 1000;
  if (mins)  ms += parseInt(mins[1])  * 60 * 1000;
  return ms;
}

async function handleAdmin(message, client) {
  if (message.author.bot) return;
  const args    = message.content.trim().split(/\s+/);
  const comando = args[0].toLowerCase();

  const adminCmds = [
    "!addtime","!removetime","!sethoras","!resetuser","!resetweek",
    "!syncvoz","!status","!sesiones","!forceupdate",
    "!info","!setadv","!clearadv","!listactivos","!listinactivos",
    "!chiteado","!torneostop","!reportetorneo"
  ];
  if (!adminCmds.includes(comando)) return;
  if (!isAdmin(message)) return message.reply("❌ No tienes permiso.");

  // Comandos sin restricción de canal
  const sinRestriccion = ["!nuevo","!chiteado","!torneostop","!reportetorneo","!listactivos","!listinactivos"];
  if (!sinRestriccion.includes(comando) && message.channel.id !== CANAL_CMD_ADMIN) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_ADMIN}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const data = loadData();

  // ── !addtime ─────────────────────────────────────────────────
  if (comando === "!addtime") {
    const target = message.mentions.members.first();
    const tiempo = args[2];
    if (!target || !tiempo) return message.reply("❌ Uso: `!addtime @usuario 2h30m`");
    const ms = parseTime(tiempo);
    if (!ms) return message.reply("❌ Tiempo inválido.");
    const ud = getUser(data, target.id); const hoy = todayKey();
    ud.totalMs += ms; ud.weekMs += ms;
    if (!ud.days[hoy]) ud.days[hoy] = { totalMs: 0 };
    ud.days[hoy].totalMs += ms;
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Tiempo agregado")
      .setDescription(`Se agregaron **${msToHours(ms)}** a ${target}\n📆 Semana: \`${msToHours(ud.weekMs)}\`\n🏆 Total: \`${msToHours(ud.totalMs)}\``)
      .setTimestamp()] });
  }

  // ── !removetime ──────────────────────────────────────────────
  if (comando === "!removetime") {
    const target = message.mentions.members.first();
    const tiempo = args[2];
    if (!target || !tiempo) return message.reply("❌ Uso: `!removetime @usuario 1h`");
    const ms = parseTime(tiempo); if (!ms) return message.reply("❌ Tiempo inválido.");
    const ud = getUser(data, target.id); const hoy = todayKey();
    ud.totalMs = Math.max(0, ud.totalMs - ms); ud.weekMs = Math.max(0, ud.weekMs - ms);
    if (ud.days[hoy]) ud.days[hoy].totalMs = Math.max(0, (ud.days[hoy].totalMs||0) - ms);
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("✅ Tiempo removido")
      .setDescription(`Se removieron **${msToHours(ms)}** de ${target}\n📆 Semana: \`${msToHours(ud.weekMs)}\`\n🏆 Total: \`${msToHours(ud.totalMs)}\``)
      .setTimestamp()] });
  }

  // ── !sethoras ────────────────────────────────────────────────
  if (comando === "!sethoras") {
    const target = message.mentions.members.first();
    const tiempo = args[2];
    if (!target || !tiempo) return message.reply("❌ Uso: `!sethoras @usuario 5h`");
    const ms = parseTime(tiempo);
    const ud = getUser(data, target.id); const hoy = todayKey();
    ud.totalMs = ms; ud.weekMs = ms;
    if (!ud.days[hoy]) ud.days[hoy] = { totalMs: 0 };
    ud.days[hoy].totalMs = ms; saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Horas establecidas")
      .setDescription(`Horas de ${target} ajustadas a **${msToHours(ms)}**`).setTimestamp()] });
  }

  // ── !resetuser ───────────────────────────────────────────────
  if (comando === "!resetuser") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Uso: `!resetuser @usuario`");
    data[target.id] = { totalMs:0, weekMs:0, lastSeen:null, days:{}, topsGanados:0, diasSeguidos:0, advertencias:0 };
    saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("✅ Usuario reseteado")
      .setDescription(`Todos los datos de ${target} fueron reseteados.`).setTimestamp()] });
  }

  // ── !resetweek ───────────────────────────────────────────────
  if (comando === "!resetweek") {
    const hoy = todayKey();
    const ahora = Date.now();
    let count = 0;

    // Limpiar sesiones activas en memoria
    const { activeSessions } = require("../events/voiceStateUpdate");
    activeSessions.clear();

    for (const id in data) {
      data[id].weekMs = 0;
      // Borrar horas del día de hoy
      if (data[id].days?.[hoy]) data[id].days[hoy].totalMs = 0;
      // Resetear sessionStart
      if (data[id].sessionStart) data[id].sessionStart = ahora;
      count++;
    }
    saveData(data);
    client.emit("updateActividadEmbed");
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Semana reseteada")
      .setDescription(`Se resetearon las horas semanales de **${count}** usuarios.`).setTimestamp()] });
  }

  // ── !syncvoz ─────────────────────────────────────────────────
  if (comando === "!syncvoz") {
    const { activeSessions } = require("../events/voiceStateUpdate");
    const guild = await client.guilds.fetch(GUILD_ID); await guild.members.fetch();
    activeSessions.clear();
    const ahora = Date.now(); let synced = 0;
    const miembros = guild.members.cache.filter(m =>
      m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot &&
      m.voice?.channelId && m.voice.channelId !== AFK_CHANNEL_ID
    );
    for (const [id] of miembros) {
      const ud = getUser(data, id);
      activeSessions.set(id, ud.sessionStart || ahora);
      if (!ud.sessionStart) ud.sessionStart = ahora;
      synced++;
    }
    saveData(data); client.emit("updateActividadEmbed");
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Voz sincronizada")
      .setDescription(`Se sincronizaron **${synced}** sesiones activas.`).setTimestamp()] });
  }

  // ── !status ──────────────────────────────────────────────────
  if (comando === "!status") {
    const { activeSessions } = require("../events/voiceStateUpdate");
    const ahora = Date.now(); let desc = "";
    for (const [id, ts] of activeSessions) {
      const mins = Math.floor((ahora - ts) / 60000);
      desc += `<@${id}> — \`${mins}m\` en sesión\n`;
    }
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14)
      .setTitle(`📊 Sesiones activas (${activeSessions.size})`)
      .setDescription(desc || "*No hay sesiones activas.*").setTimestamp()] });
  }

  // ── !sesiones ────────────────────────────────────────────────
  if (comando === "!sesiones") {
    let desc = "";
    for (const id in data) {
      if (data[id].sessionStart) {
        const mins = Math.floor((Date.now() - data[id].sessionStart) / 60000);
        desc += `<@${id}> — sesión guardada hace \`${mins}m\`\n`;
      }
    }
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14)
      .setTitle("📋 Sesiones en JSON").setDescription(desc || "*Sin sesiones.*").setTimestamp()] });
  }

  // ── !forceupdate ─────────────────────────────────────────────
  if (comando === "!forceupdate") {
    client.emit("updateActividadEmbed");
    return message.reply("✅ Embed actualizado.");
  }

  // ── !info @usuario ───────────────────────────────────────────
  if (comando === "!info") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Uso: `!info @usuario`");
    const ud = getUser(data, target.id);

    const joinedAt    = target.joinedAt ? `<t:${Math.floor(target.joinedAt.getTime()/1000)}:F>` : "Desconocido";
    const creadoEn    = `<t:${Math.floor(target.user.createdAt.getTime()/1000)}:F>`;
    const roles       = target.roles.cache.filter(r => r.id !== message.guild.id)
                          .sort((a,b) => b.position - a.position)
                          .map(r => `<@&${r.id}>`).slice(0,10).join(", ") || "*Sin roles*";

    const embed = new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle(`📋 Info — ${target.user.tag}`)
      .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "🆔 ID",                value: target.id,                                  inline: true },
        { name: "👤 Usuario",           value: target.user.tag,                            inline: true },
        { name: "🎭 Apodo",             value: target.nickname || "*Sin apodo*",           inline: true },
        { name: "📅 Entró al servidor", value: joinedAt,                                   inline: false },
        { name: "🗓️ Cuenta creada",     value: creadoEn,                                   inline: false },
        { name: "🎖️ Roles",             value: roles,                                      inline: false },
        { name: "⏰ Horas semana",      value: `\`${msToHours(ud.weekMs)}\``,              inline: true },
        { name: "🏆 Total horas",       value: `\`${msToHours(ud.totalMs)}\``,             inline: true },
        { name: "⚠️ Advertencias",      value: `\`${ud.advertencias||0}/3\``,              inline: true },
        { name: "🔥 Racha",             value: `\`${ud.diasSeguidos||0}d\``,               inline: true },
        { name: "🎮 Torneos jugados",   value: `\`${ud.torneosJugados||0}\``,              inline: true },
        { name: "🥇 Tops ganados",      value: `\`${ud.topsGanados||0}\``,                 inline: true },
        { name: "👁️ Última vez en voz", value: ud.lastSeen
            ? `<t:${Math.floor(ud.lastSeen/1000)}:R>` : "*Nunca*",                         inline: false },
      )
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ── !setadv @usuario 2 ───────────────────────────────────────
  if (comando === "!setadv") {
    const target = message.mentions.members.first();
    const num    = parseInt(args[2]);
    if (!target || isNaN(num) || num < 0 || num > 3)
      return message.reply("❌ Uso: `!setadv @usuario 0-3`");
    const ud = getUser(data, target.id);
    ud.advertencias = num; saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Advertencias actualizadas")
      .setDescription(`${target} ahora tiene **${num}/3** advertencias.`).setTimestamp()] });
  }

  // ── !clearadv @usuario ───────────────────────────────────────
  if (comando === "!clearadv") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Uso: `!clearadv @usuario`");
    const ud = getUser(data, target.id);
    ud.advertencias = 0; saveData(data);
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14).setTitle("✅ Advertencias borradas")
      .setDescription(`Se borraron las advertencias de ${target}.`).setTimestamp()] });
  }

  // ── !listactivos ─────────────────────────────────────────────
  if (comando === "!listactivos") {
    const guild = await client.guilds.fetch(GUILD_ID); await guild.members.fetch();
    const miembros = guild.members.cache.filter(m => m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot);
    const lista = [];
    for (const [id, member] of miembros) {
      const ud = getUser(data, id);
      lista.push({ member, weekMs: ud.weekMs||0, totalMs: ud.totalMs||0, torneosJugados: ud.torneosJugados||0 });
    }
    lista.sort((a,b) => b.weekMs - a.weekMs);

    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    let desc = "";
    lista.slice(0,10).forEach(({ member, weekMs, totalMs }, i) => {
      const recomendacion = i < 3 ? " 🔺 *Candidato a ascenso*" : "";
      desc += `${medals[i]} **${member.user.tag}**${recomendacion}\n┣ Semana: \`${msToHours(weekMs)}\` | Total: \`${msToHours(totalMs)}\`\n\n`;
    });

    return message.reply({ embeds: [new EmbedBuilder().setColor(0x39FF14)
      .setTitle("📊 Top 10 más activos")
      .setDescription(desc || "*Sin datos.*")
      .setFooter({ text: "🔺 Top 3 son candidatos a ascenso de rango" })
      .setTimestamp()] });
  }

  // ── !listinactivos ───────────────────────────────────────────
  if (comando === "!listinactivos") {
    const guild = await client.guilds.fetch(GUILD_ID); await guild.members.fetch();
    const miembros = guild.members.cache.filter(m => m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot);
    const ahora = Date.now(); const lista = [];
    for (const [id, member] of miembros) {
      const ud = getUser(data, id);
      const ref = ud.botFirstSeen || ud.lastSeen;
      const dias = ref ? Math.floor((ahora - ref) / (24*60*60*1000)) : 0;
      lista.push({ member, dias, advertencias: ud.advertencias||0 });
    }
    lista.sort((a,b) => b.dias - a.dias);

    let desc = "";
    lista.slice(0,10).forEach(({ member, dias, advertencias }) => {
      const emoji = advertencias >= 3 ? "🚨" : advertencias >= 2 ? "⚠️" : advertencias >= 1 ? "🟡" : "⬜";
      desc += `${emoji} **${member.user.tag}** — \`${dias}d sin entrar\` | Adv: \`${advertencias}/3\`\n`;
    });

    return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c)
      .setTitle("📉 Top 10 más inactivos")
      .setDescription(desc || "*Todos activos.*")
      .setFooter({ text: "🚨 En peligro de perder el rol" })
      .setTimestamp()] });
  }

  // ── !torneostop ──────────────────────────────────────────────
  if (comando === "!torneostop") {
    const guild = await client.guilds.fetch(GUILD_ID); await guild.members.fetch();
    const miembros = guild.members.cache.filter(m => m.roles.cache.has(ACTIVITY_ROLE_ID) && !m.user.bot);
    const lista = [];
    for (const [id, member] of miembros) {
      const ud = getUser(data, id);
      if ((ud.torneosJugados||0) > 0) lista.push({ member, torneos: ud.torneosJugados||0 });
    }
    lista.sort((a,b) => b.torneos - a.torneos);

    const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    let desc = "";
    lista.slice(0,10).forEach(({ member, torneos }, i) => {
      desc += `${medals[i]} **${member.user.tag}** — \`${torneos} torneos\`\n`;
    });

    return message.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f)
      .setTitle("🏆 Top participantes en torneos")
      .setDescription(desc || "*Sin datos de torneos.*")
      .setTimestamp()] });
  }

  // ── !reportetorneo @usuario ─────────────────────────────────
  if (comando === "!reportetorneo") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Uso: `!reportetorneo @usuario`");

    const STRIKE1_ID = require("../config").ROL_AVISO_ID;
    const STRIKE2_ID = require("../config").ROL_AVISO2_ID;
    const STRIKE3_ID = require("../config").ROL_EXPULSADO_ID;
    const CANAL_SANCIONES_ID = require("../config").CANAL_SANCIONES_ID;

    const ud = getUser(data, target.id);
    if (!ud.reportesTorneo) ud.reportesTorneo = 0;
    ud.reportesTorneo += 1;
    saveData(data);

    const canalSancion = await client.channels.fetch(CANAL_SANCIONES_ID).catch(()=>null);
    const reporte = ud.reportesTorneo;

    // Strike 1
    if (reporte === 1) {
      try { await target.roles.add(STRIKE1_ID); } catch {}
      if (canalSancion) await canalSancion.send({ embeds: [new EmbedBuilder()
        .setColor(0xf39c12).setTitle("⚠️ Reporte de Torneo — Strike 1/3")
        .setThumbnail(target.user.displayAvatarURL({dynamic:true}))
        .setDescription(`${target} fue reportado por participar en un torneo sin ser seleccionado.

**Reportes:** \`1/3\`
Si llega a 2 quedará suspendido de torneos por **5 días**.`)
        .addFields({name:"👮 Reportado por", value:`${message.author}`, inline:true},{name:"📅 Fecha",value:new Date().toLocaleDateString("es-CO",{timeZone:"America/Bogota"}),inline:true})
        .setTimestamp()] });
      try { await target.send({ embeds: [new EmbedBuilder()
        .setColor(0xf39c12).setTitle("⚠️ Advertencia de Torneo")
        .setDescription(`Fuiste reportado por participar en un torneo sin haber sido seleccionado. Esto va en contra de las reglas de **EXLATAM**.

**No vuelvas a hacerlo.** Tienes **1/3** reportes.
Al llegar a 2 quedarás suspendido de torneos por **5 días**.`)
        .setTimestamp()] }); } catch {}
    }
    // Strike 2
    else if (reporte === 2) {
      try { await target.roles.add(STRIKE2_ID); } catch {}
      // Suspender de torneos por 5 días
      const expiraSuspension = Date.now() + 5 * 24 * 60 * 60 * 1000;
      ud.suspendidoTorneoHasta = expiraSuspension;
      saveData(data);
      setTimeout(async () => {
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const m = await guild.members.fetch(target.id);
          await m.roles.remove(STRIKE2_ID);
          const d = loadData();
          if (d[target.id]) { delete d[target.id].suspendidoTorneoHasta; saveData(d); }
        } catch {}
      }, 5 * 24 * 60 * 60 * 1000);
      if (canalSancion) await canalSancion.send({ embeds: [new EmbedBuilder()
        .setColor(0xe67e22).setTitle("🚨 Reporte de Torneo — Strike 2/3 — SUSPENDIDO")
        .setThumbnail(target.user.displayAvatarURL({dynamic:true}))
        .setDescription(`${target} recibió su **segundo reporte**.

🚫 **Suspendido de torneos por 5 días.**
Si recibe un tercer reporte será **expulsado de la banda**.`)
        .addFields({name:"👮 Reportado por",value:`${message.author}`,inline:true},{name:"📅 Suspensión hasta",value:`<t:${Math.floor(expiraSuspension/1000)}:F>`,inline:true})
        .setTimestamp()] });
      try { await target.send({ embeds: [new EmbedBuilder()
        .setColor(0xe67e22).setTitle("🚨 Suspensión de Torneos")
        .setDescription(`Recibiste tu **segundo reporte** por hacer trampa en torneos.

Quedas **suspendido de torneos por 5 días**.

Esta es tu **última oportunidad**. Al tercer reporte serás **expulsado de EXLATAM**.`)
        .setTimestamp()] }); } catch {}
    }
    // Strike 3 — Expulsión
    else if (reporte >= 3) {
      try { await target.roles.add(STRIKE3_ID); } catch {}
      // Quitar todos los roles de actividad
      try { await target.roles.remove(ACTIVITY_ROLE_ID); } catch {}
      if (canalSancion) await canalSancion.send({ embeds: [new EmbedBuilder()
        .setColor(0xe74c3c).setTitle("🚫 Reporte de Torneo — Strike 3 — EXPULSADO")
        .setThumbnail(target.user.displayAvatarURL({dynamic:true}))
        .setDescription(`${target} recibió su **tercer reporte** y fue **expulsado de la banda**.

Se removió el rol de actividad automáticamente.`)
        .addFields({name:"👮 Reportado por",value:`${message.author}`,inline:true})
        .setTimestamp()] });
      try { await target.send({ embeds: [new EmbedBuilder()
        .setColor(0xe74c3c).setTitle("🚫 Expulsado de EXLATAM")
        .setDescription(`Recibiste **3 reportes** por hacer trampa en torneos.

Fuiste **expulsado de EXLATAM**.

Si crees que hubo un error, contacta al staff.`)
        .setTimestamp()] }); } catch {}
    }

    return message.reply({ embeds: [new EmbedBuilder()
      .setColor(reporte===1?0xf39c12:reporte===2?0xe67e22:0xe74c3c)
      .setTitle(`✅ Reporte registrado — Strike ${Math.min(reporte,3)}/3`)
      .setDescription(`${target} tiene **${reporte}/3** reportes de torneo.`)
      .setTimestamp()] });
  }

// ── !chiteado @usuario ───────────────────────────────────────
  if (comando === "!chiteado") {
    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Uso: `!chiteado @usuario`");

    const ticket = await marcarChiteado(target, client);

    return message.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c)
      .setTitle("✅ Rol chiteado asignado")
      .setDescription(`${target} tiene el rol de chiteado.${ticket ? `\nMensaje enviado en ${ticket}.` : "\n⚠️ No se encontró ticket abierto."}`)
      .setTimestamp()] });
  }
}

// Función reutilizable: marca a un usuario como chiteado (usada por !chiteado y por el flujo de SS de !nuevo)
async function marcarChiteado(target, client, fotoUrl = null, fotoAdjunta = []) {
  try { await target.roles.add(ROL_CHITEADO_ID); } catch(e) { console.error("[CHITEADO]", e.message); }

  const guild   = await client.guilds.fetch(GUILD_ID);
  const ticket  = guild.channels.cache.find(ch =>
    ch.topic?.includes(`postulacionUser:${target.id}`) ||
    ch.topic?.includes(`ticketOwner:${target.id}`)
  );

  if (ticket) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_formateo:${target.id}`)
        .setLabel("✅ Ya formateé")
        .setStyle(ButtonStyle.Success)
    );
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("⚠️ Aviso de Cheat")
      .setDescription(
        `${target} ha sido marcado como **chiteado**.\n\n` +
        `Para continuar en la banda debes **formatear tu PC**.\n\n` +
        `Cuando hayas formateado presiona el botón de abajo.`
      )
      .setTimestamp();
    if (fotoUrl) embed.setImage(fotoUrl);
    else if (fotoAdjunta.length) embed.setImage(`attachment://${fotoAdjunta[0].name}`);

    await ticket.send({
      content: `<@${target.id}>`,
      embeds: [embed],
      components: [row],
      files: fotoAdjunta
    });
  }

  return ticket;
}

// Botón "Ya formateé" — notifica a los SS
async function handleChiteadoButton(interaction, client) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("btn_formateo:")) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  const SS_ROLE_ID = "1497410474881319102";

  // Deshabilitar botón
  try {
    await interaction.update({
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`btn_formateo:${ownerId}`)
          .setLabel("✅ Formateado confirmado").setStyle(ButtonStyle.Success).setDisabled(true)
      )]
    });
  } catch {}

  // Notificar en el mismo canal
  await interaction.channel.send({
    content: `<@&${SS_ROLE_ID}>`,
    embeds: [new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle("✅ Formateo confirmado")
      .setDescription(
        `<@${ownerId}> confirmó que ya formateó su PC.\n\n` +
        `<@&${SS_ROLE_ID}> por favor proceder con la verificación de SS.`
      )
      .setTimestamp()]
  });
}

module.exports = { handleAdmin, handleChiteadoButton, marcarChiteado };
