const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { GUILD_ID } = require("../config");

const commands = [
  // ── Actividad ────────────────────────────────────────────────
  new SlashCommandBuilder().setName("horas").setDescription("Ver tus horas de actividad acumuladas"),
  new SlashCommandBuilder().setName("top").setDescription("Ver el ranking semanal de actividad"),
  new SlashCommandBuilder().setName("sesiones").setDescription("Ver tus sesiones de voz recientes"),

  // ── Inactividad ──────────────────────────────────────────────
  new SlashCommandBuilder().setName("inactivo").setDescription("Justificar tu inactividad (abre formulario)"),

  // ── Torneos ──────────────────────────────────────────────────
  new SlashCommandBuilder().setName("torneo").setDescription("Crear un torneo con inscripciones"),
  new SlashCommandBuilder().setName("torneostop").setDescription("Ver el top de participantes en torneos"),
  new SlashCommandBuilder().setName("reportetorneo")
    .setDescription("Reportar a alguien por hacer trampa en un torneo")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a reportar").setRequired(true)),

  // ── Anuncios ─────────────────────────────────────────────────
  new SlashCommandBuilder().setName("activense").setDescription("Notificar a la banda que se activen"),
  new SlashCommandBuilder().setName("tormenta").setDescription("Avisar que hay tormenta"),
  new SlashCommandBuilder().setName("battle").setDescription("Avisar que hay battle royale"),
  new SlashCommandBuilder().setName("drop").setDescription("Avisar que hay drop del día"),
  new SlashCommandBuilder().setName("tandastormentas").setDescription("Iniciar tanda de 8 avisos de tormenta cada 5 min"),
  new SlashCommandBuilder().setName("paratanda").setDescription("Detener la tanda de tormentas activa"),

  // ── Armario ──────────────────────────────────────────────────
  new SlashCommandBuilder().setName("armario")
    .setDescription("Ver el historial de armas del armario de un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a consultar (dejar vacío para verte a ti)").setRequired(false)),
  new SlashCommandBuilder().setName("toparmario").setDescription("Top 10 de quienes más armas han sacado"),

  // ── Admin ────────────────────────────────────────────────────
  new SlashCommandBuilder().setName("nuevo")
    .setDescription("Procesar un nuevo miembro (inicia flujo de SS)")
    .addUserOption(o => o.setName("usuario").setDescription("Nuevo miembro a procesar").setRequired(true)),
  new SlashCommandBuilder().setName("chiteado")
    .setDescription("Marcar a un usuario como chiteado")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a marcar").setRequired(true)),
  new SlashCommandBuilder().setName("migrarroles").setDescription("Migrar roles del servidor viejo al nuevo (solo admin)"),
  new SlashCommandBuilder().setName("panel").setDescription("Actualizar el panel de actividad (solo admin)"),
  new SlashCommandBuilder().setName("paneltickets").setDescription("Reenviar el panel de tickets (solo admin)"),
  new SlashCommandBuilder().setName("listactivos").setDescription("Listar miembros activos esta semana (solo admin)"),
  new SlashCommandBuilder().setName("listinactivos").setDescription("Listar miembros inactivos esta semana (solo admin)"),
  new SlashCommandBuilder().setName("embed")
    .setDescription("Crear y enviar un embed personalizado a un canal (solo admin)")
    .addChannelOption(o => o.setName("canal").setDescription("Canal destino").setRequired(true))
    .addStringOption(o => o.setName("titulo").setDescription("Título del embed").setRequired(true))
    .addStringOption(o => o.setName("descripcion").setDescription("Descripción del embed").setRequired(false))
    .addStringOption(o => o.setName("color").setDescription("Color hex (ej: #39FF14)").setRequired(false))
    .addStringOption(o => o.setName("logo").setDescription("URL del logo/thumbnail").setRequired(false))
    .addStringOption(o => o.setName("banner").setDescription("URL del banner/imagen").setRequired(false))
    .addStringOption(o => o.setName("footer").setDescription("Texto del footer").setRequired(false)),

  // ── Super Admin ──────────────────────────────────────────────
  new SlashCommandBuilder().setName("addtime")
    .setDescription("Añadir horas manualmente a un usuario (solo admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addIntegerOption(o => o.setName("minutos").setDescription("Minutos a añadir").setRequired(true)),
  new SlashCommandBuilder().setName("removetime")
    .setDescription("Quitar horas manualmente a un usuario (solo admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addIntegerOption(o => o.setName("minutos").setDescription("Minutos a quitar").setRequired(true)),
  new SlashCommandBuilder().setName("sethoras")
    .setDescription("Establecer horas exactas a un usuario (solo admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addIntegerOption(o => o.setName("minutos").setDescription("Minutos totales").setRequired(true)),
  new SlashCommandBuilder().setName("resetuser")
    .setDescription("Resetear datos de un usuario (solo admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder().setName("resetweek").setDescription("Resetear el ranking semanal (solo admin)"),
  new SlashCommandBuilder().setName("setadv")
    .setDescription("Establecer advertencias de inactividad a un usuario (solo admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true))
    .addIntegerOption(o => o.setName("cantidad").setDescription("Número de advertencias (0-3)").setRequired(true)),
  new SlashCommandBuilder().setName("clearadv")
    .setDescription("Limpiar advertencias de inactividad a un usuario (solo admin)")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario").setRequired(true)),
  new SlashCommandBuilder().setName("syncvoz").setDescription("Sincronizar sesiones de voz activas (solo admin)"),
  new SlashCommandBuilder().setName("forceupdate").setDescription("Forzar actualización del embed de actividad (solo admin)"),
  new SlashCommandBuilder().setName("info")
    .setDescription("Ver información de actividad de un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("Usuario a consultar").setRequired(false)),
  new SlashCommandBuilder().setName("status").setDescription("Ver el estado del bot"),
].map(c => c.toJSON());

async function registrarSlashCommands(clientId, token) {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    console.log("[SLASH] Registrando slash commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: commands });
    console.log(`[SLASH] ${commands.length} slash commands registrados.`);
  } catch (e) {
    console.error("[SLASH] Error registrando commands:", e.message);
  }
}

module.exports = { registrarSlashCommands };
