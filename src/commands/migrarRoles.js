const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const GUILD_VIEJO_ID = "1455775938200473606";
const GUILD_NUEVO_ID = "1188377448346288158";

// Roles que el bot NUNCA debe tocar (gestionados por Discord/integraciones, ej: @everyone, roles de bots)
function esRolValido(role) {
  if (role.id === role.guild.id) return false; // @everyone
  if (role.managed) return false;               // roles de bots/integraciones
  return true;
}

async function handleMigrarRoles(message, client) {
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== "!migrarroles") return;

  if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
    return message.reply("❌ Solo el dueño/admin puede usar este comando.");

  const aviso = await message.reply("⏳ Migrando roles del servidor viejo al nuevo... esto puede tardar varios minutos.");

  try {
    const guildViejo = await client.guilds.fetch(GUILD_VIEJO_ID);
    const guildNuevo = await client.guilds.fetch(GUILD_NUEVO_ID);

    await guildViejo.members.fetch();
    await guildNuevo.members.fetch();
    await guildNuevo.roles.fetch();

    // Mapa: nombre de rol (lowercase) -> objeto Role en el servidor nuevo
    const rolesNuevoPorNombre = new Map();
    guildNuevo.roles.cache.forEach(role => {
      if (esRolValido(role)) rolesNuevoPorNombre.set(role.name.toLowerCase(), role);
    });

    let migrados = 0;
    let sinUsuarioNuevo = 0;
    let rolesNoEncontrados = new Set();
    let errores = 0;

    for (const [userId, memberViejo] of guildViejo.members.cache) {
      if (memberViejo.user.bot) continue;

      const rolesDelUsuario = memberViejo.roles.cache.filter(r => esRolValido(r));
      if (rolesDelUsuario.size === 0) continue;

      const memberNuevo = guildNuevo.members.cache.get(userId);
      if (!memberNuevo) { sinUsuarioNuevo++; continue; }

      const rolesAAsignar = [];
      for (const [, roleViejo] of rolesDelUsuario) {
        const roleNuevo = rolesNuevoPorNombre.get(roleViejo.name.toLowerCase());
        if (roleNuevo) rolesAAsignar.push(roleNuevo.id);
        else rolesNoEncontrados.add(roleViejo.name);
      }

      if (rolesAAsignar.length > 0) {
        try {
          await memberNuevo.roles.add(rolesAAsignar);
          migrados++;
        } catch (e) {
          errores++;
          console.error(`[MIGRAR] Error con ${memberViejo.user.tag}:`, e.message);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle("✅ Migración de roles completada")
      .addFields(
        { name: "👥 Miembros migrados", value: `${migrados}`, inline: true },
        { name: "⚠️ Sin cuenta en el server nuevo", value: `${sinUsuarioNuevo}`, inline: true },
        { name: "❌ Errores", value: `${errores}`, inline: true },
        { name: "🔍 Roles no encontrados en el nuevo server", value: rolesNoEncontrados.size ? [...rolesNoEncontrados].join(", ") : "Ninguno" },
      )
      .setTimestamp();

    await aviso.edit({ content: null, embeds: [embed] });
  } catch (e) {
    console.error("[MIGRAR] Error general:", e);
    await aviso.edit(`❌ Error durante la migración: ${e.message}`);
  }
}

module.exports = { handleMigrarRoles };
