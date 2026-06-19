const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { STAFF_ROLE_ID, LOGO_URL,
        CANAL_CMD_HORAS, CANAL_CMD_INACTIVO,
        CANAL_CMD_TORNEO, CANAL_CMD_ANUNCIOS } = require("../config");

// Roles que se le dan al nuevo miembro
const ROLES_NUEVO = [
  "1516258966756266054",
  "1516258974163402862",
  "1516258980601659583",
  "1516258985286696961",
];

const CANAL_BIENVENIDA_NUEVO = "1516662918664683561";
const CANAL_VIDEO_TUTORIAL   = "1516684343010136094";
const CANAL_SS_NUEVO         = "1516259312148680848";
const cooldowns = new Map();
const COOLDOWN_MS = 10 * 1000;

// Estado pendiente: solicitudId -> { target, autor, mensajeOriginal }
const pendientesSS = new Map();

// Busca el adjunto de video más reciente en el canal fijo de tutorial
async function getTutorialVideoAttachment(client) {
  try {
    const canal = await client.channels.fetch(CANAL_VIDEO_TUTORIAL);
    const mensajes = await canal.messages.fetch({ limit: 20 });
    for (const msg of mensajes.values()) {
      const video = msg.attachments.find(a => a.contentType?.startsWith("video/") || a.name?.endsWith(".mp4"));
      if (video) return video;
    }
  } catch (e) {
    console.error("[NUEVO] Error obteniendo video tutorial:", e.message);
  }
  return null;
}

// Mensaje DM completo
function buildDMEmbed(member) {
  return new EmbedBuilder()
    .setColor(0x39FF14)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTitle("<:exlatam:1496642022759596245> ¡Bienvenido/a a EXLATAM ROLAS!")
    .setDescription(
      `**Antes de continuar, lee atentamente las siguientes instrucciones:**\n\n` +

      `> 📋 __**REGLAS OBLIGATORIAS EX**__\n` +
      `- **OBLIGATORIO TENER LA ETIQUETA DEL SERVIDOR.**\n` +
      `- **SIEMPRE QUE JUEGUES ESTAR EN CANAL DE VOZ.** *¡Recuerda somos una comunidad, te puedes quedar a charlar!*\n` +
      `- **PROHIBIDO SACAR DE FORMA EXCESIVA COSAS DEL ARMARIO DE LA BANDA. LO QUE SAQUES LO DEVUELVES.**\n` +
      `- **OBLIGATORIO TENER LA CAMISA DE LA BANDA. LO DEMÁS LO QUE QUIERAS.**\n\n` +

      `> 🎙️ __**ACTIVIDAD DE VOZ**__\n` +
      `- Debes conectarte diariamente al canal de voz\n` +
      `- Tu tiempo se registra automáticamente\n` +
      `- Si no puedes conectarte usa \`!inactivo\` para justificarte\n` +
      `- Llevas **1 día** sin entrar = advertencia | **6 días** = pierdes el rol\n\n` +

      `> 📢 __**COMANDOS DISPONIBLES**__\n` +
      `- \`!horas\` → Ver tus horas acumuladas — úsalo en <#${CANAL_CMD_HORAS}>\n` +
      `- \`!top\` → Ver el ranking semanal — úsalo en <#${CANAL_CMD_HORAS}>\n` +
      `- \`!inactivo\` → Justificar inactividad — úsalo en <#${CANAL_CMD_INACTIVO}>\n` +
      `- \`!torneo\` → Crear un torneo — úsalo en <#${CANAL_CMD_TORNEO}>\n` +
      `- \`!activense\` \`!tormenta\` \`!battle\` \`!drop\` → Notificar eventos a la banda — úsalos en <#${CANAL_CMD_ANUNCIOS}>\n\n` +

      `> 📍 __**CANALES IMPORTANTES**__\n` +
      `- Los comandos solo funcionan en sus canales específicos\n` +
      `- Lee los canales de información del servidor\n\n` +

      `✅ **Presiona el botón de abajo para confirmar que leíste las instrucciones y recibir tu bienvenida oficial.**`
    )
    .setTimestamp();
}

async function handleNuevo(message, client) {
  if (message.author.bot) return;
  if (message.content.trim().split(/\s+/)[0].toLowerCase() !== "!nuevo") return;

  // Solo staff
  if (!message.member?.roles?.cache?.has(STAFF_ROLE_ID) &&
      !message.member?.permissions?.has(8n))
    return message.reply("❌ No tienes permiso para usar este comando.");

  const target = message.mentions.members.first();
  if (!target)
    return message.reply("❌ Uso: `!nuevo @usuario`");

  // Evitar abrir una segunda solicitud de SS si ya hay una pendiente para este usuario
  for (const s of pendientesSS.values()) {
    if (s.targetId === target.id) {
      return message.reply(`⚠️ Ya hay una solicitud de SS pendiente para ${target}. Termínala antes de volver a usar \`!nuevo\` con esta persona.`);
    }
  }

  const key    = `nuevo:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    return message.reply("⏳ Espera unos segundos antes de usar este comando de nuevo.");
  }
  cooldowns.set(key, Date.now());

  // Pedir la foto de la SS en el canal privado de staff
  try {
    const canalSS = await client.channels.fetch(CANAL_SS_NUEVO);
    if (!canalSS) return message.reply("❌ No se encontró el canal de SS, revisa la configuración.");

    const solicitudId = `${message.author.id}-${target.id}-${Date.now()}`;
    pendientesSS.set(solicitudId, {
      targetId:        target.id,
      atendioId:       message.author.id,
      canalComandoId:  message.channel.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📸 Foto de SS requerida")
      .setDescription(
        `${message.author}, sube aquí la **foto de la SS** de ${target} (revisión de cheats).\n\n` +
        `Tu siguiente mensaje con una imagen en este canal será tomado como la foto de SS de esta solicitud.`
      )
      .setFooter({ text: `Solicitud: ${solicitudId}` })
      .setTimestamp();

    const msgPeticion = await canalSS.send({ content: `<@${message.author.id}>`, embeds: [embed] });
    pendientesSS.get(solicitudId).msgPeticionId = msgPeticion.id;
    await message.reply(`📸 Te pedí la foto de la SS de ${target} en <#${CANAL_SS_NUEVO}>. Sube la imagen ahí para continuar.`);
  } catch(e) {
    console.error("[NUEVO] Error pidiendo foto SS:", e.message);
    await message.reply("❌ Ocurrió un error al iniciar el proceso, intenta de nuevo.");
  }
}

// Escucha mensajes con imagen en el canal de SS para completar la solicitud pendiente
async function handleNuevoFotoSS(message, client) {
  if (message.author.bot) return;
  if (message.channel.id !== CANAL_SS_NUEVO) return;

  const imagen = [...message.attachments.values()].find(a => a.contentType?.startsWith("image/"));
  if (!imagen) return;

  // Buscar la solicitud pendiente más reciente de este autor sin foto asignada todavía
  let solicitudId = null;
  let solicitud   = null;
  for (const [id, s] of pendientesSS) {
    if (s.atendioId === message.author.id && !s.fotoUrl) { solicitudId = id; solicitud = s; break; }
  }
  if (!solicitud) return;

  // Esperamos 3 segundos para asegurar que el adjunto terminó de subirse/procesarse en el CDN de Discord
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Descargamos la imagen ANTES de borrar el mensaje, porque al borrar la URL del CDN deja de servir el archivo
  let fotoBuffer = null;
  try {
    const res = await fetch(imagen.url);
    fotoBuffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error("[NUEVO] Error descargando foto SS:", e.message);
  }
  solicitud.fotoUrl = imagen.url; // referencia (puede caducar tras borrar, no se usa directamente)
  solicitud.fotoBuffer = fotoBuffer;
  solicitud.fotoName   = imagen.name || "ss.png";

  const target = await message.guild.members.fetch(solicitud.targetId).catch(() => null);
  if (!target) { pendientesSS.delete(solicitudId); return message.reply("❌ No se encontró al usuario, vuelve a usar `!nuevo`."); }

  try { await message.delete(); } catch {} // no dejar la foto visible más de lo necesario

  // Borrar el mensaje original de "Foto de SS requerida"
  if (solicitud.msgPeticionId) {
    try {
      const msgPeticion = await message.channel.messages.fetch(solicitud.msgPeticionId);
      await msgPeticion.delete();
    } catch {}
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ss_limpio:${solicitudId}`).setLabel("✅ Limpio").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ss_chiteado:${solicitudId}`).setLabel("❌ Chiteado").setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📸 Resultado de la SS")
    .setDescription(`Foto recibida para ${target}. ¿Cuál fue el resultado?`)
    .setFooter({ text: `Solicitud: ${solicitudId}` });

  if (fotoBuffer) embed.setImage(`attachment://${solicitud.fotoName}`);

  const msgResultado = await message.channel.send({
    content: `<@${message.author.id}>`,
    embeds: [embed],
    components: [row],
    files: fotoBuffer ? [{ attachment: fotoBuffer, name: solicitud.fotoName }] : []
  });

  // Guardamos la URL re-subida (esta sí persiste mientras el mensaje exista) para reusarla en la plantilla final
  if (msgResultado.attachments.size > 0) {
    solicitud.fotoUrl = [...msgResultado.attachments.values()][0].url;
  }
}

// Botones "Limpio" / "Chiteado" en el canal de SS
async function handleSSResultButton(interaction, client) {
  if (!interaction.isButton()) return;
  const isLimpio   = interaction.customId.startsWith("ss_limpio:");
  const isChiteado = interaction.customId.startsWith("ss_chiteado:");
  if (!isLimpio && !isChiteado) return;

  const solicitudId = interaction.customId.split(":").slice(1).join(":");
  const solicitud    = pendientesSS.get(solicitudId);
  if (!solicitud) return interaction.reply({ content: "❌ Esta solicitud ya no está disponible.", ephemeral: true });

  if (interaction.user.id !== solicitud.atendioId)
    return interaction.reply({ content: "❌ Solo quien ejecutó `!nuevo` puede confirmar el resultado.", ephemeral: true });

  const guild  = interaction.guild;
  const target = await guild.members.fetch(solicitud.targetId).catch(() => null);
  if (!target) { pendientesSS.delete(solicitudId); return interaction.reply({ content: "❌ Usuario no encontrado.", ephemeral: true }); }

  pendientesSS.delete(solicitudId);

  // Acusar recibo de la interacción y borrar el mensaje de "Resultado de la SS"
  try { await interaction.deferUpdate(); } catch {}
  try { await interaction.message.delete(); } catch {}

  const fotoAdjunta = solicitud.fotoBuffer ? [{ attachment: solicitud.fotoBuffer, name: solicitud.fotoName }] : [];
  const fotoEmbedRef = solicitud.fotoBuffer ? `attachment://${solicitud.fotoName}` : null;

  if (isChiteado) {
    const { marcarChiteado } = require("./admin");
    await marcarChiteado(target, client, null, fotoAdjunta);

    // Plantilla simple (sin foto) al ticket de postulación
    const ticketPostulacion = guild.channels.cache.find(ch => ch.topic?.includes(`postulacionUser:${target.id}`));
    if (ticketPostulacion) {
      await ticketPostulacion.send({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("❌ Usuario marcado como Chiteado")
          .setDescription(
            `**Usuario:** ${target}\n` +
            `**Atendió (!nuevo):** <@${solicitud.atendioId}>\n\n` +
            `Se activó el sistema de chiteado automáticamente.`
          )
          .setTimestamp()]
      });
    }

    // Plantilla completa con la foto, se queda en el canal de SS
    await interaction.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("❌ Usuario marcado como Chiteado")
        .setDescription(
          `**Usuario:** ${target}\n` +
          `**Atendió (!nuevo):** <@${solicitud.atendioId}>\n` +
          `**SS realizada por:** ${interaction.user}\n\n` +
          `Se activó el sistema de chiteado automáticamente.`
        )
        .setImage(fotoEmbedRef)
        .setTimestamp()],
      files: fotoAdjunta
    });
    return;
  }

  // Limpio: asignar roles, mandar DM, tutorial
  const rolesOk = [];
  const rolesFail = [];
  for (const rolId of ROLES_NUEVO) {
    try {
      await target.roles.add(rolId);
      rolesOk.push(rolId);
    } catch {
      rolesFail.push(rolId);
    }
  }

  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_leido:${target.id}`)
        .setLabel("✅ Leído — ¡Entendido!")
        .setStyle(ButtonStyle.Success)
    );
    await target.send({ embeds: [buildDMEmbed(target)], components: [row] });
  } catch(e) {
    console.error("[NUEVO] Error enviando DM:", e.message);
  }

  // Plantilla simple (sin foto) — se manda al ticket de postulación del usuario
  const ticketPostulacion = guild.channels.cache.find(ch => ch.topic?.includes(`postulacionUser:${target.id}`));
  if (ticketPostulacion) {
    await ticketPostulacion.send({
      embeds: [new EmbedBuilder()
        .setColor(0x39FF14)
        .setTitle("✅ Nuevo miembro aprobado — Limpio")
        .setDescription(
          `**Usuario:** ${target}\n` +
          `**Atendió (!nuevo):** <@${solicitud.atendioId}>\n` +
          `**Aprobó (resultado SS):** ${interaction.user}\n\n` +
          `🎭 Roles asignados: ${rolesOk.map(r=>`<@&${r}>`).join(", ")}\n` +
          (rolesFail.length ? `⚠️ Roles fallidos: ${rolesFail.map(r=>`<@&${r}>`).join(", ")}` : "")
        )
        .setTimestamp()]
    });
  }

  // Plantilla completa con la foto — se queda en el canal de SS
  await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle("✅ Nuevo miembro aprobado — Limpio")
      .setDescription(
        `**Usuario:** ${target}\n` +
        `**Atendió (!nuevo):** <@${solicitud.atendioId}>\n` +
        `**Aprobó (resultado SS):** ${interaction.user}\n` +
        `**SS realizada por:** ${interaction.user}\n\n` +
        `🎭 Roles asignados: ${rolesOk.map(r=>`<@&${r}>`).join(", ")}\n` +
        (rolesFail.length ? `⚠️ Roles fallidos: ${rolesFail.map(r=>`<@&${r}>`).join(", ")}` : "")
      )
      .setImage(fotoEmbedRef)
      .setTimestamp()],
    files: fotoAdjunta
  });

  // Enviar tutorial en el canal original donde se ejecutó !nuevo
  try {
    const canalComando = await client.channels.fetch(solicitud.canalComandoId);
    const videoAttachment = await getTutorialVideoAttachment(client);
    const rowTutorial = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tutorial_claro:${target.id}`).setLabel("✅ Todo claro").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`tutorial_dudas:${target.id}`).setLabel("❓ Tengo dudas").setStyle(ButtonStyle.Danger)
    );
    const embedTutorial = new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle("🎬 Tutorial de Discord — EXLATAM")
      .setDescription(
        `${target}, antes de empezar mira el **tutorial completo** sobre cómo funciona el servidor.\n\n` +
        `📺 **Ve el video completo** para entender canales, comandos y reglas.\n\n` +
        (videoAttachment ? "" : "⚠️ *No se encontró el video en este momento, avisa al staff.*")
      )
      .setTimestamp();

    await canalComando.send({ embeds: [embedTutorial], components: [rowTutorial] });
    if (videoAttachment) {
      try { await canalComando.send({ content: videoAttachment.url }); } catch {}
    }
  } catch(e) {
    console.error("[NUEVO] Error enviando tutorial:", e.message);
  }
}

// Cuando el usuario presiona "Leído"
async function handleNuevoButton(interaction, client) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("btn_leido:")) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  // Deshabilitar botón
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_leido:${ownerId}`)
        .setLabel("✅ ¡Instrucciones leídas!")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.update({ components: [row] });
  } catch {}

  // Mandar bienvenida en el canal
  try {
    const canal = await client.channels.fetch(CANAL_BIENVENIDA_NUEVO);
    if (canal) {
      const embed = new EmbedBuilder()
        .setColor(0x39FF14)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `# <:exlatam:1496642022759596245> ¡Bienvenido/a a EXLATAM ROLAS <@${ownerId}>! <a:emoji_30:1504932273739530543>\n\n` +
          `<:emoji_27:1504932117233008671> **Ya eres parte oficial de la familia.**\n` +
          `-# <a:emoji_35:1504932489104195714> *¡Mucho éxito y a darle duro!* <a:emoji_35:1504932489104195714>`
        )
        .setTimestamp();

      await canal.send({
        content: `<@${ownerId}>`,
        embeds:  [embed]
      });
    }
  } catch(e) {
    console.error("[NUEVO] Error bienvenida canal:", e.message);
  }
}

// Botones del tutorial: "Todo claro" / "Tengo dudas"
async function handleTutorialButton(interaction, client) {
  if (!interaction.isButton()) return;
  const isClaro = interaction.customId.startsWith("tutorial_claro:");
  const isDudas = interaction.customId.startsWith("tutorial_dudas:");
  if (!isClaro && !isDudas) return;

  const ownerId = interaction.customId.split(":")[1];
  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  if (isClaro) {
    try {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tutorial_claro:${ownerId}`).setLabel("✅ Todo claro").setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`tutorial_dudas:${ownerId}`).setLabel("❓ Tengo dudas").setStyle(ButtonStyle.Danger).setDisabled(true)
      );
      await interaction.update({ components: [row] });
    } catch {}
    return interaction.followUp({ content: `✅ ${interaction.user} entendió el tutorial. ¡Bienvenido!`, ephemeral: false });
  }

  // Tengo dudas — notificar al staff
  try {
    await interaction.reply({ content: `❓ <@&${STAFF_ROLE_ID}> ${interaction.user} tiene dudas sobre el tutorial del servidor, por favor ayúdenle.`, ephemeral: false });
  } catch {}
}

module.exports = { handleNuevo, handleNuevoButton, handleTutorialButton, handleNuevoFotoSS, handleSSResultButton };
