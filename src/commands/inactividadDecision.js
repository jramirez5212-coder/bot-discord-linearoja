const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadData, saveData, getUser } = require("../utils/dataManager");
const { ACTIVITY_ROLE_ID, STAFF_ROLE_ID, CANAL_ADVERTENCIAS_ID } = require("../config");

const CANAL_EXPULSADOS_FINAL_ID = "1517009855020273776";
const RECHEQUEO_RANGO_MS = 5 * 60 * 1000; // 5 minutos

async function handleInactividadDecision(interaction, client) {
  if (!interaction.isButton()) return;
  const isExpulsar    = interaction.customId.startsWith("expulsar_inactivo:");
  const isRestablecer = interaction.customId.startsWith("restablecer_inactivo:");
  const isRangoSi      = interaction.customId.startsWith("rango_si:");
  const isRangoNo       = interaction.customId.startsWith("rango_no:");
  if (!isExpulsar && !isRestablecer && !isRangoSi && !isRangoNo) return;

  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
    return interaction.reply({ content: "❌ Solo Staff puede tomar esta decisión.", ephemeral: true });

  const targetId = interaction.customId.split(":")[1];
  const data     = loadData();
  const userData = getUser(data, targetId);

  try {
    const guild  = await client.guilds.fetch(interaction.guildId);
    const member = await guild.members.fetch(targetId).catch(() => null);

    if (isExpulsar) {
      if (member) await member.roles.remove(ACTIVITY_ROLE_ID).catch(() => {});
      userData.advertencias        = 0;
      userData.pendienteExpulsion  = false;
      saveData(data);

      if (member) {
        member.send({ embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🚫 Rol de Actividad Removido")
          .setDescription(`Hola **${member.user.username}**,\n\nTu rol fue **removido** por inactividad.\n\nHabla con el staff si deseas recuperarlo. 🙏`)
          .setTimestamp()] }).catch(() => {});
      }

      // Preguntar por el rango del juego (externo a Discord)
      const rowRango = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rango_si:${targetId}`).setLabel("✅ Sí, ya quité el rango").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rango_no:${targetId}`).setLabel("❌ Aún no").setStyle(ButtonStyle.Danger)
      );

      await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xe74c3c)
          .setDescription(`✅ Rol de Discord **expulsado** por ${interaction.user}.\n\n⚠️ **¿Ya le quitaste el rango del juego/banda a este usuario?**`)],
        components: [rowRango],
      });
      return;
    }

    if (isRangoSi) {
      await terminarExpulsion(interaction, client, targetId, member);
      return;
    }

    if (isRangoNo) {
      await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(`⏳ De acuerdo, te volveré a preguntar en 5 minutos si ya le quitaste el rango del juego a este usuario.`)],
        components: [],
      });
      setTimeout(async () => {
        try {
          const rowRango = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`rango_si:${targetId}`).setLabel("✅ Sí, ya quité el rango").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rango_no:${targetId}`).setLabel("❌ Aún no").setStyle(ButtonStyle.Danger)
          );
          await interaction.message.edit({
            embeds: [EmbedBuilder.from(interaction.message.embeds[0])
              .setDescription(`⚠️ **¿Ya le quitaste el rango del juego/banda a este usuario?**`)],
            components: [rowRango],
          });
        } catch (e) { console.error("[INACTIVIDAD_DECISION] Error re-preguntando rango:", e.message); }
      }, RECHEQUEO_RANGO_MS);
      return;
    }

    // Restablecer
    userData.advertencias       = 0;
    userData.pendienteExpulsion = false;
    userData.botFirstSeen       = Date.now();
    saveData(data);

    if (member) {
      member.send({ embeds: [new EmbedBuilder()
        .setColor(0x39FF14)
        .setTitle("♻️ Advertencias Restablecidas")
        .setDescription(`Hola **${member.user.username}**,\n\nEl staff te dio otra oportunidad y reinició tus advertencias. ¡Vuelve a entrar pronto! 🎙️`)
        .setTimestamp()] }).catch(() => {});
    }

    await interaction.update({
      embeds: [EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x39FF14)
        .setDescription(`♻️ **Advertencias restablecidas** por ${interaction.user}.`)],
      components: [],
    });
  } catch (e) {
    console.error("[INACTIVIDAD_DECISION] Error:", e.message);
    if (!interaction.replied) await interaction.reply({ content: "❌ Ocurrió un error procesando la decisión.", ephemeral: true }).catch(() => {});
  }
}

async function terminarExpulsion(interaction, client, targetId, member) {
  // Borrar el mensaje de la conversación de confirmación
  try { await interaction.message.delete(); } catch {}

  try {
    const canalFinal = await client.channels.fetch(CANAL_EXPULSADOS_FINAL_ID);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🚫 Miembro Expulsado — Confirmado")
      .setDescription(
        `**Usuario expulsado:** ${member ? member : `<@${targetId}>`}\n` +
        `**Aprobó la expulsión:** ${interaction.user}\n` +
        `**Rol de Discord:** removido ✅\n` +
        `**Rango del juego/banda:** removido ✅`
      )
      .setTimestamp();
    await canalFinal.send({ embeds: [embed] });
  } catch (e) {
    console.error("[INACTIVIDAD_DECISION] Error plantilla final:", e.message);
  }

  try { await interaction.deferUpdate(); } catch {}
}

module.exports = { handleInactividadDecision };
