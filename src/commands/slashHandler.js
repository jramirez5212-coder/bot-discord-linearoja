const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { STAFF_ROLE_ID, CANAL_CMD_HORAS, CANAL_CMD_INACTIVO,
        CANAL_CMD_ANUNCIOS, CANAL_CMD_TORNEO, CANAL_CMD_ADMIN } = require("../config");

// Convierte interacción de slash en un objeto compatible con los handlers existentes
function fakeMessage(interaction, contentOverride = null) {
  return {
    author:   interaction.user,
    member:   interaction.member,
    guild:    interaction.guild,
    channel:  interaction.channel,
    client:   interaction.client,
    content:  contentOverride || `!${interaction.commandName}`,
    mentions: {
      members: { first: () => interaction.options.getMember("usuario") || null },
      users:   { first: () => interaction.options.getUser("usuario") || null },
    },
    reply:  async (opts) => {
      if (interaction.replied || interaction.deferred) return interaction.followUp(typeof opts === "string" ? { content: opts, ephemeral: true } : { ...opts, ephemeral: true });
      return interaction.reply(typeof opts === "string" ? { content: opts, ephemeral: true } : { ...opts, ephemeral: true });
    },
    delete: async () => {},
    attachments: new Map(),
  };
}

async function handleSlashCommand(interaction, client) {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  // Diferir respuesta para comandos que tardan
  const comandosLentos = ["nuevo","migrarroles","listactivos","listinactivos","resetweek","forceupdate","syncvoz"];
  if (comandosLentos.includes(cmd)) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  try {
    // ── Actividad ─────────────────────────────────────────────
    if (cmd === "horas") {
      const { handleHoras } = require("./horas");
      return handleHoras(fakeMessage(interaction), client);
    }
    if (cmd === "top") {
      const { handleHoras } = require("./horas");
      return handleHoras(fakeMessage(interaction, "!top"), client);
    }
    if (cmd === "sesiones") {
      const { handleHoras } = require("./horas");
      return handleHoras(fakeMessage(interaction, "!sesiones"), client);
    }
    if (cmd === "info") {
      const { handleHoras } = require("./horas");
      return handleHoras(fakeMessage(interaction, "!info"), client);
    }
    if (cmd === "status") {
      const { handleHoras } = require("./horas");
      return handleHoras(fakeMessage(interaction, "!status"), client);
    }

    // ── Inactividad ───────────────────────────────────────────
    if (cmd === "inactivo") {
      const { handleInactividad } = require("./inactividad");
      // Forzar canal correcto
      const canalInactivo = await client.channels.fetch(CANAL_CMD_INACTIVO).catch(() => interaction.channel);
      const fakeMsg = { ...fakeMessage(interaction, "!inactivo"), channel: canalInactivo };
      return handleInactividad(fakeMsg);
    }

    // ── Torneos ───────────────────────────────────────────────
    if (cmd === "torneo" || cmd === "torneostop" || cmd === "reportetorneo") {
      const { handleAdmin } = require("./admin");
      const userMention = interaction.options.getUser("usuario");
      const content = userMention ? `!${cmd} <@${userMention.id}>` : `!${cmd}`;
      return handleAdmin(fakeMessage(interaction, content), client);
    }

    // ── Anuncios ──────────────────────────────────────────────
    if (["activense","tormenta","battle","drop"].includes(cmd)) {
      const { handleAnuncios } = require("./anuncios");
      const canalAnuncios = await client.channels.fetch(CANAL_CMD_ANUNCIOS).catch(() => interaction.channel);
      return handleAnuncios({ ...fakeMessage(interaction, `!${cmd}`), channel: canalAnuncios });
    }
    if (cmd === "tandastormentas" || cmd === "paratanda") {
      const { handleTandas } = require("./tandas");
      const canalAnuncios = await client.channels.fetch(CANAL_CMD_ANUNCIOS).catch(() => interaction.channel);
      return handleTandas({ ...fakeMessage(interaction, `!${cmd}`), channel: canalAnuncios });
    }

    // ── Armario ───────────────────────────────────────────────
    if (cmd === "armario") {
      const { handleArmarioCommand } = require("./armario");
      const userMention = interaction.options.getUser("usuario");
      const content = userMention ? `!armario <@${userMention.id}>` : "!armario";
      return handleArmarioCommand(fakeMessage(interaction, content));
    }
    if (cmd === "toparmario") {
      const { handleTopArmario } = require("./armario");
      return handleTopArmario(fakeMessage(interaction));
    }

    // ── Nuevo / Chiteado ──────────────────────────────────────
    if (cmd === "nuevo") {
      const { handleNuevo } = require("./nuevo");
      const userMencion = interaction.options.getUser("usuario");
      const content = `!nuevo <@${userMencion.id}>`;
      return handleNuevo(fakeMessage(interaction, content), client);
    }
    if (cmd === "chiteado") {
      const { handleAdmin } = require("./admin");
      const userMencion = interaction.options.getUser("usuario");
      return handleAdmin(fakeMessage(interaction, `!chiteado <@${userMencion.id}>`), client);
    }

    // ── Embed ─────────────────────────────────────────────────
    if (cmd === "embed") {
      const { handleEmbedCreator } = require("./panelEventos");
      const canal       = interaction.options.getChannel("canal");
      const titulo      = interaction.options.getString("titulo");
      const descripcion = interaction.options.getString("descripcion") || "_";
      const color       = interaction.options.getString("color") || "_";
      const logo        = interaction.options.getString("logo") || "_";
      const banner      = interaction.options.getString("banner") || "_";
      const footer      = interaction.options.getString("footer") || "_";
      const content = `!embed <#${canal.id}> | ${titulo} | ${descripcion} | ${color} | ${logo} | ${banner} | ${footer}`;
      return handleEmbedCreator(fakeMessage(interaction, content));
    }

    // ── Panel / Tickets ───────────────────────────────────────
    if (cmd === "panel" || cmd === "paneltickets" || cmd === "forceupdate" || cmd === "syncvoz") {
      const { handleAdmin } = require("./admin");
      return handleAdmin(fakeMessage(interaction, `!${cmd}`), client);
    }

    // ── Admin de actividad ────────────────────────────────────
    if (["addtime","removetime","sethoras","resetuser","resetweek","setadv","clearadv","listactivos","listinactivos","migrarroles"].includes(cmd)) {
      const { handleAdmin } = require("./admin");
      const userMencion = interaction.options.getUser("usuario");
      const minutos     = interaction.options.getInteger("minutos");
      const cantidad    = interaction.options.getInteger("cantidad");
      let content = `!${cmd}`;
      if (userMencion) content += ` <@${userMencion.id}>`;
      if (minutos !== null && minutos !== undefined) content += ` ${minutos}`;
      if (cantidad !== null && cantidad !== undefined) content += ` ${cantidad}`;
      return handleAdmin(fakeMessage(interaction, content), client);
    }

    await interaction.reply({ content: "❌ Comando no reconocido.", ephemeral: true }).catch(() => {});
  } catch(e) {
    console.error(`[SLASH] Error en /${cmd}:`, e.message);
    const msg = `❌ Error ejecutando el comando: ${e.message}`;
    if (interaction.deferred) return interaction.editReply(msg).catch(() => {});
    if (!interaction.replied) return interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
}

module.exports = { handleSlashCommand };
