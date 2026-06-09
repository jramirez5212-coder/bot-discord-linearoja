const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { STAFF_ROLE_ID, LOGO_URL } = require("../config");

// Roles que se le dan al nuevo miembro
const ROLES_NUEVO = [
  "1469433888949665976",
  "1479563134552375410",
  "1469433884109443196",
  "1503540325522870332",
];

const CANAL_BIENVENIDA_NUEVO = "1469434070860824699";
const cooldowns = new Map();
const COOLDOWN_MS = 10 * 1000;

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
      `- Llevas **3 días** sin entrar = advertencia | **12 días** = pierdes el rol\n\n` +

      `> 📢 __**COMANDOS DISPONIBLES**__\n` +
      `- \`!horas\` → Ver tus horas acumuladas — úsalo en <#1504709759679598592>\n` +
      `- \`!top\` → Ver el ranking semanal — úsalo en <#1504709759679598592>\n` +
      `- \`!inactivo\` → Justificar inactividad — úsalo en <#1469434074925105204>\n` +
      `- \`!torneo\` → Crear un torneo — úsalo en <#1504732853949300807>\n` +
      `- \`!activense\` \`!tormenta\` \`!battle\` \`!drop\` → Notificar eventos a la banda — úsalos en <#1504732666908639302>\n\n` +

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

  const key    = `nuevo:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    return message.reply("⏳ Espera unos segundos antes de usar este comando de nuevo.");
  }
  cooldowns.set(key, Date.now());

  // Dar roles
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

  // Enviar DM con instrucciones y botón
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_leido:${target.id}`)
        .setLabel("✅ Leído — ¡Entendido!")
        .setStyle(ButtonStyle.Success)
    );

    await target.send({
      embeds:     [buildDMEmbed(target)],
      components: [row]
    });

    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x39FF14)
        .setTitle("✅ Nuevo miembro procesado")
        .setDescription(
          `${target} fue procesado correctamente.\n\n` +
          `📩 DM enviado con instrucciones\n` +
          `🎭 Roles asignados: ${rolesOk.map(r=>`<@&${r}>`).join(", ")}\n` +
          (rolesFail.length ? `⚠️ Roles fallidos: ${rolesFail.map(r=>`<@&${r}>`).join(", ")}` : "")
        )
        .setTimestamp()]
    });

  } catch(e) {
    console.error("[NUEVO] Error enviando DM:", e.message);
    await message.reply(`⚠️ No pude enviar el DM a ${target} (privados cerrados). Roles asignados igualmente.`);
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

module.exports = { handleNuevo, handleNuevoButton };
