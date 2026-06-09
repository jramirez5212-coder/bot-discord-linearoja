const {
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { loadData, saveData, getUser } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, LOGO_URL, CANAL_CMD_TORNEO, GUILD_ID } = require("../config");

const ROL_TORNEO_ID  = "1504721382368481331";
const COOLDOWN_MS    = 60 * 1000;
const INSCRIPCION_MS = 30 * 1000; // 30 segundos para inscribirse
const cooldowns      = new Map();
const torneosActivos = new Map();

// Guardar/limpiar rol torneo en JSON
function guardarRolTorneo(userId, expira) {
  const data = loadData();
  const ud   = getUser(data, userId);
  ud.torneoRolExpira = expira;
  saveData(data);
}
function limpiarRolTorneo(userId) {
  const data = loadData();
  if (data[userId]) { delete data[userId].torneoRolExpira; saveData(data); }
}

// Recuperar roles pendientes al reiniciar
async function recoverTorneoRoles(client) {
  try {
    const data  = loadData();
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    const ahora = Date.now();
    for (const userId in data) {
      const ud = data[userId];
      if (!ud.torneoRolExpira) continue;
      if (ud.torneoRolExpira <= ahora) {
        try { const m = guild.members.cache.get(userId); if (m) await m.roles.remove(ROL_TORNEO_ID); } catch {}
        delete ud.torneoRolExpira;
      } else {
        const msRestante = ud.torneoRolExpira - ahora;
        setTimeout(async () => {
          try { const m = guild.members.cache.get(userId); if (m) await m.roles.remove(ROL_TORNEO_ID); } catch {}
          limpiarRolTorneo(userId);
        }, msRestante);
      }
    }
    saveData(data);
  } catch(e) { console.error("[TORNEO] Error recuperando roles:", e.message); }
}

// Animación del sorteo
async function animarSorteo(canal, participantes, cupo, nombre, client) {
  const seleccionados = [];
  const pool = [...participantes];

  // Mezclar pool aleatoriamente
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Seleccionar los ganadores
  const ganadores = pool.slice(0, Math.min(cupo, pool.length));

  // Embed animación inicial
  const msgAnim = await canal.send({
    embeds: [new EmbedBuilder()
      .setTitle("🎰 ¡SORTEANDO PARTICIPANTES!")
      .setColor(0xf1c40f)
      .setDescription("```\n⠿ Mezclando participantes... ⠿\n```")
      .setThumbnail(LOGO_URL)
      .setTimestamp()]
  });

  // Animación — 6 frames de 1 segundo
  const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 800));
    // Mostrar nombres aleatorios en cada frame
    const shuffled = [...participantes].sort(() => Math.random() - 0.5).slice(0, 5);
    const preview  = shuffled.map(id => `<@${id}>`).join(" • ");
    try {
      await msgAnim.edit({ embeds: [new EmbedBuilder()
        .setTitle(`🎰 SORTEANDO... ${frames[i % frames.length]}`)
        .setColor(0xf1c40f)
        .setDescription(`**Participantes en la ruleta:** ${participantes.length}\n\n${preview}...`)
        .setThumbnail(LOGO_URL)
        .setTimestamp()] });
    } catch {}
  }

  // Revelar ganadores uno por uno
  await new Promise(r => setTimeout(r, 1000));
  let descGanadores = "";
  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟",
                  "1️⃣1️⃣","1️⃣2️⃣","1️⃣3️⃣","1️⃣4️⃣","1️⃣5️⃣","1️⃣6️⃣","1️⃣7️⃣","1️⃣8️⃣","1️⃣9️⃣","2️⃣0️⃣"];

  for (let i = 0; i < ganadores.length; i++) {
    await new Promise(r => setTimeout(r, 700));
    descGanadores += `${medals[i]} <@${ganadores[i]}>\n`;
    try {
      await msgAnim.edit({ embeds: [new EmbedBuilder()
        .setTitle(`🎉 ¡RESULTADO DEL SORTEO! — ${nombre}`)
        .setColor(0x39FF14)
        .setDescription(
          `**Seleccionados (${i+1}/${ganadores.length}):**\n\n${descGanadores}` +
          (i < ganadores.length - 1 ? "\n*⠿ Revelando más...*" : "")
        )
        .setThumbnail(LOGO_URL)
        .setTimestamp()] });
    } catch {}
  }

  // Embed final completo
  await new Promise(r => setTimeout(r, 1000));
  const noSeleccionados = pool.slice(cupo).map(id => `<@${id}>`).join(", ") || "*Nadie*";

  try {
    await msgAnim.edit({ embeds: [new EmbedBuilder()
      .setTitle(`🏆 ¡SORTEO FINALIZADO! — ${nombre}`)
      .setColor(0x39FF14)
      .setThumbnail(LOGO_URL)
      .setDescription(
        `**¡Felicitaciones a los seleccionados!** 🎉\n\n` +
        `${descGanadores}\n` +
        `**Total participantes:** ${participantes.length}\n` +
        `**Cupo:** ${ganadores.length}`
      )
      .addFields(
        ganadores.length < participantes.length
          ? [{ name: "😔 No seleccionados", value: noSeleccionados.slice(0, 1000), inline: false }]
          : []
      )
      .setFooter({ text: "¡Buena suerte a todos! 🎮" })
      .setTimestamp()] });
  } catch {}

  return ganadores;
}

async function handleTorneo(message) {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== "!torneo") return;

  if (!message.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return message.reply("❌ No tienes permiso para usar este comando.");

  if (message.channel.id !== CANAL_CMD_TORNEO) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_TORNEO}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const key    = `torneo:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    const segs  = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
    const aviso = await message.reply(`⏳ Espera **${segs} segundos**.`);
    setTimeout(() => { try { aviso.delete(); } catch {} }, 5000);
    try { await message.delete(); } catch {}
    return;
  }
  cooldowns.set(key, Date.now());
  try { await message.delete(); } catch {}

  const embed = new EmbedBuilder()
    .setColor(0x39FF14).setTitle("🏆 Crear Torneo")
    .setDescription("Presiona el botón para configurar el torneo.")
    .setThumbnail(LOGO_URL).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_torneo:${message.author.id}`)
      .setLabel("Crear torneo").setStyle(ButtonStyle.Primary).setEmoji("🏆")
  );

  const msg = await message.channel.send({ embeds: [embed], components: [row] });
  setTimeout(async () => { try { await msg.delete(); } catch {} }, 2 * 60 * 1000);
}

async function handleTorneoInteraction(interaction, client) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  // Botón abrir modal
  if (interaction.isButton() && interaction.customId.startsWith("btn_torneo:")) {
    const ownerId = interaction.customId.split(":")[1];
    if (interaction.user.id !== ownerId)
      return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

    const modal = new ModalBuilder().setCustomId("modal_torneo").setTitle("🏆 Crear Torneo");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("nombre").setLabel("Nombre del torneo")
          .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 5v5 Drift").setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("cupo").setLabel("¿Cuántos jugadores se seleccionan?")
          .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 10").setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  // Modal submit
  if (interaction.isModalSubmit() && interaction.customId === "modal_torneo") {
    const nombre = interaction.fields.getTextInputValue("nombre");
    const cupo   = parseInt(interaction.fields.getTextInputValue("cupo"));
    if (isNaN(cupo) || cupo < 2 || cupo > 50)
      return interaction.reply({ content: "❌ El cupo debe ser entre 2 y 50.", ephemeral: true });

    try { await interaction.message?.delete(); } catch {}

    const torneo = {
      cupo, nombre,
      inscritos:   [],
      channelId:   interaction.channelId,
      organizador: interaction.user.id,
      startTime:   Date.now(),
    };

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Torneo: ${nombre}`)
      .setColor(0x39FF14).setThumbnail(LOGO_URL)
      .setDescription(
        `<@&${ACTIVITY_ROLE_ID}> **¡Se abre el sorteo!**\n\n` +
        `Presiona el botón para entrar al sorteo.\n` +
        `En **30 segundos** se seleccionarán **${cupo} jugadores** aleatoriamente.`
      )
      .addFields(
        { name: "🎮 Nombre",      value: nombre,               inline: true },
        { name: "🎰 Cupo sorteo", value: `${cupo} jugadores`,  inline: true },
        { name: "👤 Organizador", value: `${interaction.user}`, inline: true },
        { name: "⏳ Cierra en",   value: "30 segundos",         inline: true },
        { name: "✋ Inscritos",   value: "0",                   inline: true },
      )
      .setFooter({ text: "¡Todos tienen la misma oportunidad!" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("unirse_torneo")
        .setLabel("¡Quiero jugar! (0)").setStyle(ButtonStyle.Success).setEmoji("🎮")
    );

    await interaction.reply({
      content: `<@&${ACTIVITY_ROLE_ID}> 🏆 **¡Torneo ${nombre} — Entra al sorteo!**`,
      embeds:  [embed],
      components: [row]
    });

    const msg = await interaction.fetchReply();
    torneo.messageId = msg.id;
    torneosActivos.set(msg.id, torneo);

    // Countdown — actualizar cada 5 segundos
    let segundosRestantes = 30;
    const countdown = setInterval(async () => {
      segundosRestantes -= 5;
      const t = torneosActivos.get(msg.id);
      if (!t || segundosRestantes <= 0) { clearInterval(countdown); return; }
      try {
        const canal = await client.channels.fetch(t.channelId);
        const m     = await canal.messages.fetch(msg.id);
        const embedUpdate = new EmbedBuilder()
          .setTitle(`🏆 Torneo: ${t.nombre}`)
          .setColor(segundosRestantes <= 10 ? 0xe74c3c : 0x39FF14).setThumbnail(LOGO_URL)
          .setDescription(
            `**¡Se abre el sorteo!**\n\n` +
            `Presiona el botón para entrar al sorteo.\n` +
            `En **${segundosRestantes} segundos** se seleccionarán **${t.cupo} jugadores** aleatoriamente.`
          )
          .addFields(
            { name: "🎮 Nombre",      value: t.nombre,              inline: true },
            { name: "🎰 Cupo sorteo", value: `${t.cupo} jugadores`, inline: true },
            { name: "👤 Organizador", value: `<@${t.organizador}>`, inline: true },
            { name: "⏳ Cierra en",   value: `${segundosRestantes} segundos`, inline: true },
            { name: "✋ Inscritos",   value: `${t.inscritos.length}`, inline: true },
          )
          .setFooter({ text: "¡Todos tienen la misma oportunidad!" })
          .setTimestamp();
        const rowUpdate = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("unirse_torneo")
            .setLabel(`¡Quiero jugar! (${t.inscritos.length})`)
            .setStyle(segundosRestantes <= 10 ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji("🎮")
        );
        await m.edit({ embeds: [embedUpdate], components: [rowUpdate] });
      } catch { clearInterval(countdown); }
    }, 5000);

    // Después de 30 segundos — hacer el sorteo
    setTimeout(async () => {
      clearInterval(countdown);
      const t = torneosActivos.get(msg.id);
      if (!t) return;
      torneosActivos.delete(msg.id);

      try {
        // Cerrar botón
        const canal = await client.channels.fetch(t.channelId);
        const m     = await canal.messages.fetch(msg.id);
        await m.edit({
          embeds: [new EmbedBuilder()
            .setTitle(`🏆 Torneo: ${t.nombre} — ¡Inscripciones cerradas!`)
            .setColor(0x95a5a6).setThumbnail(LOGO_URL)
            .setDescription(`🔒 Las inscripciones cerraron.\n\n**${t.inscritos.length}** participantes entraron al sorteo.`)
            .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("unirse_torneo")
              .setLabel(`Cerrado (${t.inscritos.length} inscritos)`)
              .setStyle(ButtonStyle.Secondary).setEmoji("🔒").setDisabled(true)
          )]
        });
      } catch {}

      if (t.inscritos.length === 0) {
        try {
          const canal = await client.channels.fetch(t.channelId);
          await canal.send({ embeds: [new EmbedBuilder()
            .setTitle(`😔 Torneo ${t.nombre} — Sin participantes`)
            .setColor(0xe74c3c).setDescription("Nadie se inscribió al torneo.")
            .setTimestamp()] });
        } catch {}
        return;
      }

      // Animar sorteo
      try {
        const canal    = await client.channels.fetch(t.channelId);
        const ganadores = await animarSorteo(canal, t.inscritos, t.cupo, t.nombre, client);

        // Dar rol a los seleccionados
        const guild = await client.guilds.fetch(GUILD_ID);
        const expira = Date.now() + 10 * 60 * 1000;
        for (const uid of ganadores) {
          try {
            const member = await guild.members.fetch(uid);
            await member.roles.add(ROL_TORNEO_ID);
            guardarRolTorneo(uid, expira);
            setTimeout(async () => {
              try { await member.roles.remove(ROL_TORNEO_ID); } catch {}
              limpiarRolTorneo(uid);
            }, 10 * 60 * 1000);
          } catch {}
        }

        // Contar torneos jugados
        const data = loadData();
        for (const uid of ganadores) {
          const ud = getUser(data, uid);
          ud.torneosJugados = (ud.torneosJugados || 0) + 1;
        }
        saveData(data);

      } catch(e) { console.error("[TORNEO] Error sorteo:", e.message); }
    }, INSCRIPCION_MS);

    return;
  }

  // Botón inscribirse
  if (interaction.isButton() && interaction.customId === "unirse_torneo") {
    const torneo = torneosActivos.get(interaction.message.id);
    if (!torneo) return interaction.reply({ content: "❌ Las inscripciones ya cerraron.", ephemeral: true });
    if (torneo.inscritos.includes(interaction.user.id))
      return interaction.reply({ content: "⚠️ Ya estás inscrito en el sorteo.", ephemeral: true });

    if (!interaction.member.roles.cache.has(ACTIVITY_ROLE_ID))
      return interaction.reply({ content: "❌ No tienes el rol de actividad.", ephemeral: true });

    // Verificar si está suspendido de torneos
    const dataTorneo = loadData();
    const udTorneo   = dataTorneo[interaction.user.id];
    if (udTorneo?.suspendidoTorneoHasta && udTorneo.suspendidoTorneoHasta > Date.now()) {
      const expira = Math.floor(udTorneo.suspendidoTorneoHasta / 1000);
      return interaction.reply({ content: `🚫 Estás suspendido de torneos hasta <t:${expira}:F>.`, ephemeral: true });
    }

    torneo.inscritos.push(interaction.user.id);

    const rowUpdate = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("unirse_torneo")
        .setLabel(`¡Quiero jugar! (${torneo.inscritos.length})`)
        .setStyle(ButtonStyle.Success).setEmoji("🎮")
    );

    try { await interaction.update({ components: [rowUpdate] }); } catch {}

    await interaction.followUp({
      content: `✅ <@${interaction.user.id}> entró al sorteo del torneo **${torneo.nombre}**. ¡Buena suerte! 🎰`,
      ephemeral: false
    });
  }
}

module.exports = { handleTorneo, handleTorneoInteraction, recoverTorneoRoles };
