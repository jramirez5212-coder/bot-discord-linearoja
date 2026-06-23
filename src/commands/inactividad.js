const {
  EmbedBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { ACTIVITY_ROLE_ID, CANAL_INACTIVIDAD_ID, CANAL_CMD_INACTIVO,
        BANNER_INACTIVIDAD, ROL_INACTIVO_ID, GUILD_ID,
        RUSH_ACTIVITY_ROLE_ID, RUSH_ROL_INACTIVO_ID,
        RUSH_CANAL_CMD_INACTIVO }  = require("../config");

const excusasActivas = new Map();
const cooldowns      = new Map();
const COOLDOWN_MS    = 60 * 1000;
const btnMessages    = new Map();

// Detecta si el miembro es ROLAS, RUSH o ninguno
function detectarSistema(member) {
  if (member.roles.cache.has(ACTIVITY_ROLE_ID)) return "ROLAS";
  if (member.roles.cache.has(RUSH_ACTIVITY_ROLE_ID)) return "RUSH";
  return null;
}

async function handleInactividad(message) {
  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();
  if (cmd !== "!inactivo" && cmd !== "!inactivorush") return;

  // Si usó !inactivorush, forzar sistema RUSH
  // Si usó !inactivo, detectar automáticamente
  let sistema;
  if (cmd === "!inactivorush") {
    sistema = "RUSH";
  } else {
    sistema = detectarSistema(message.member);
    if (!sistema)
      return message.reply("❌ No tienes un rol de actividad (ROLAS o RUSH) para usar este comando.");
  }

  const canalValido = sistema === "ROLAS" ? CANAL_CMD_INACTIVO : RUSH_CANAL_CMD_INACTIVO;
  if (message.channel.id !== canalValido) {
    const cmdCorrecto = sistema === "RUSH" ? "!inactivorush" : "!inactivo";
    const aviso = await message.reply(`❌ El comando \`${cmdCorrecto}\` solo se puede usar en <#${canalValido}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const key    = `inactivo:${message.author.id}`;
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
    .setColor(0x39ff3c).setTitle(`📋 Justificación de Inactividad — ${sistema}`)
    .setDescription("Presiona el botón para llenar el formulario de inactividad.")
    .setImage(BANNER_INACTIVIDAD).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_inactivo:${message.author.id}:${sistema}`)
      .setLabel("Llenar formulario")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📋")
  );

  const msg = await message.channel.send({ embeds: [embed], components: [row] });
  btnMessages.set(message.author.id, msg);
  setTimeout(async () => { try { await msg.delete(); } catch {} btnMessages.delete(message.author.id); }, 2 * 60 * 1000);
}

async function handleInactividadButton(interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("btn_inactivo:")) return;

  const partes  = interaction.customId.split(":");
  const ownerId = partes[1];
  const sistema = partes[2] || "ROLAS";

  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón no es para ti.", ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`modal_inactividad:${sistema}`)
    .setTitle(`📋 Justificación de Inactividad — ${sistema}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("razon").setLabel("¿Cuál es tu razón de inactividad?")
        .setStyle(TextInputStyle.Paragraph).setPlaceholder("Ej: Viaje, trabajo, salud...").setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("desde").setLabel("¿Desde qué fecha? (YYYY-MM-DD)")
        .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 2026-05-15").setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("hasta").setLabel("¿Hasta qué fecha? (YYYY-MM-DD)")
        .setStyle(TextInputStyle.Short).setPlaceholder("Ej: 2026-05-20").setRequired(true)
    )
  );
  await interaction.showModal(modal);
}

async function handleInactividadModal(interaction, client) {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith("modal_inactividad")) return;

  const sistema = interaction.customId.split(":")[1] || "ROLAS";
  const actRolId    = sistema === "RUSH" ? RUSH_ACTIVITY_ROLE_ID : ACTIVITY_ROLE_ID;
  const inactRolId  = sistema === "RUSH" ? RUSH_ROL_INACTIVO_ID  : ROL_INACTIVO_ID;
  const canalInact  = sistema === "RUSH" ? RUSH_CANAL_CMD_INACTIVO : CANAL_CMD_INACTIVO;

  const razon = interaction.fields.getTextInputValue("razon");
  const desde = interaction.fields.getTextInputValue("desde").trim();
  const hasta = interaction.fields.getTextInputValue("hasta").trim();

  // ── Validar formato de fechas YYYY-MM-DD ─────────────────────────────────
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!regexFecha.test(desde) || !regexFecha.test(hasta)) {
    return interaction.reply({
      content: `❌ **Formato de fecha incorrecto.**\n\nDebes usar el formato \`YYYY-MM-DD\`.\n✅ Correcto: \`2026-06-20\`\n❌ Incorrecto: \`20-06-2026\`, \`20/06/26\`, \`junio 20\`\n\nVuelve a usar \`!inactivo\` con las fechas correctas.`,
      ephemeral: true
    });
  }

  const desdeDate = new Date(desde + "T00:00:00-05:00");
  const hastaDate = new Date(hasta + "T00:00:00-05:00");
  const hoyDate   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  hoyDate.setHours(0,0,0,0);

  // Verificar que las fechas son válidas
  if (isNaN(desdeDate.getTime()) || isNaN(hastaDate.getTime())) {
    return interaction.reply({
      content: `❌ **Fechas inválidas.** Asegúrate de poner fechas reales en formato \`YYYY-MM-DD\`.`,
      ephemeral: true
    });
  }

  // Verificar que la fecha hasta no sea anterior a hoy
  if (hastaDate < hoyDate) {
    return interaction.reply({
      content: `❌ **La fecha de regreso ya pasó.** Pusiste \`${hasta}\` como fecha de regreso pero ya es pasado.\n\nSi ya regresaste, no necesitas registrar inactividad.`,
      ephemeral: true
    });
  }

  // Verificar que hasta sea después de desde
  if (hastaDate < desdeDate) {
    return interaction.reply({
      content: `❌ **La fecha de regreso (\`${hasta}\`) es anterior a la fecha de inicio (\`${desde}\`).** Verifica las fechas.`,
      ephemeral: true
    });
  }

  excusasActivas.set(interaction.user.id, { hasta, razon, desde });

  // Borrar mensaje con botón
  const btnMsg = btnMessages.get(interaction.user.id);
  if (btnMsg) { try { await btnMsg.delete(); } catch {} btnMessages.delete(interaction.user.id); }

  // Quitar rol de actividad y dar rol de inactivo
  let msHasta = 0;
  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    await member.roles.remove(actRolId).catch(() => {});
    await member.roles.add(inactRolId).catch(() => {});

    msHasta = hastaDate.getTime() - Date.now();
    const MAX_TIMEOUT = 24 * 60 * 60 * 1000; // 24 horas máximo por setTimeout

    if (msHasta > 0) {
      // Si el tiempo es mayor al límite de 32-bit, usamos timeouts encadenados
      const programarRestauracion = (msRestante, userId, actR, inactR, sis) => {
        const espera = Math.min(msRestante, MAX_TIMEOUT);
        setTimeout(async () => {
          const restante = hastaDate.getTime() - Date.now();
          if (restante > 0) {
            // Todavía no llegó la fecha, re-programar
            programarRestauracion(restante, userId, actR, inactR, sis);
          } else {
            // Ya llegó la fecha, restaurar roles
            try {
              const guildFresh  = await client.guilds.fetch(GUILD_ID);
              const memberFresh = await guildFresh.members.fetch(userId);
              await memberFresh.roles.add(actR).catch(() => {});
              await memberFresh.roles.remove(inactR).catch(() => {});
              excusasActivas.delete(userId);
              console.log(`[INACTIVIDAD-${sis}] Roles restaurados automáticamente: ${memberFresh.user.tag}`);
            } catch(e) { console.error(`[INACTIVIDAD-${sis}] Error restaurando roles:`, e.message); }
          }
        }, espera);
      };
      programarRestauracion(msHasta, interaction.user.id, actRolId, inactRolId, sistema);
    }
  } catch(e) { console.error(`[INACTIVIDAD-${sistema}] Error manejando roles:`, e.message); }

  // Embed en canal de inactividad CON botón de regreso
  try {
    const canal = await client.channels.fetch(canalInact);
    if (canal) {
      const embed = new EmbedBuilder()
        .setColor(sistema === "RUSH" ? 0xff6b00 : 0x39ff3c)
        .setTitle(`📋 Justificación de Inactividad — ${sistema}`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setImage(BANNER_INACTIVIDAD)
        .addFields(
          { name: "👤 Miembro", value: `${interaction.user}`, inline: true },
          { name: "📅 Desde",   value: `\`${desde}\``,         inline: true },
          { name: "📅 Hasta",   value: `\`${hasta}\``,         inline: true },
          { name: "📝 Razón",   value: razon,                  inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `ID: ${interaction.user.id} • ${sistema}` });

      const rowRegreso = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inactivo_regrese:${interaction.user.id}:${sistema}`)
          .setLabel("✅ Ya volví")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🏠")
      );

      await canal.send({ embeds: [embed], components: [rowRegreso] });
    }
  } catch(e) { console.error(`[INACTIVIDAD-${sistema}] Error:`, e.message); }

  await interaction.reply({
    content: `✅ Inactividad **${sistema}** registrada del **${desde}** al **${hasta}**.\nSe te quitó el rol de actividad. Cuando regreses, presiona el botón **"✅ Ya volví"** en el canal para recuperar tu rol. Si no lo presionas, el sistema lo restaura automáticamente el **${hasta}**. 🙏`,
    ephemeral: true
  });
}

// Botón "Ya volví" — el usuario recupera su rol manualmente
async function handleRegresesButton(interaction, client) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("inactivo_regrese:")) return;

  const partes  = interaction.customId.split(":");
  const ownerId = partes[1];
  const sistema = partes[2] || "ROLAS";
  const actRolId   = sistema === "RUSH" ? RUSH_ACTIVITY_ROLE_ID : ACTIVITY_ROLE_ID;
  const inactRolId = sistema === "RUSH" ? RUSH_ROL_INACTIVO_ID  : ROL_INACTIVO_ID;

  if (interaction.user.id !== ownerId)
    return interaction.reply({ content: "❌ Este botón es solo para quien registró la inactividad.", ephemeral: true });

  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    await member.roles.add(actRolId).catch(() => {});
    await member.roles.remove(inactRolId).catch(() => {});
    excusasActivas.delete(interaction.user.id);

    // Deshabilitar el botón
    try {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inactivo_regrese:${ownerId}`)
          .setLabel("✅ Regresó")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
      );
      await interaction.update({ components: [disabledRow] });
    } catch {}

    await interaction.followUp({
      content: `🏠 **¡Bienvenido de vuelta ${interaction.user}!** Se te restauró el rol de actividad. ¡A jugar! 🎮`,
      ephemeral: false
    });
    console.log(`[INACTIVIDAD] Regreso manual: ${interaction.user.tag}`);
  } catch(e) {
    console.error("[INACTIVIDAD] Error en regreso:", e.message);
    if (!interaction.replied) await interaction.reply({ content: "❌ Error al restaurar tu rol, avisa al staff.", ephemeral: true }).catch(() => {});
  }
}

function isExcused(userId) {
  const excusa = excusasActivas.get(userId);
  if (!excusa) return false;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  if (hoy <= excusa.hasta) return true;
  excusasActivas.delete(userId);
  return false;
}

module.exports = { handleInactividad, handleInactividadButton, handleInactividadModal, handleRegresesButton, isExcused };
