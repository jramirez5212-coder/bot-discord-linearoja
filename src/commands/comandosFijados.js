const { EmbedBuilder } = require("discord.js");
const {
  CANAL_CMD_HORAS, CANAL_CMD_INACTIVO,
  CANAL_CMD_ANUNCIOS, CANAL_CMD_TORNEO, CANAL_CMD_ADMIN,
} = require("../config");

// Texto de comandos por canal
const COMANDOS_POR_CANAL = {
  [CANAL_CMD_HORAS]: {
    titulo: "📊 Comandos de Horas",
    texto: "`!horas` → Ver tus horas acumuladas\n`!top` → Ver el ranking semanal de actividad",
  },
  [CANAL_CMD_INACTIVO]: {
    titulo: "📋 Comando de Inactividad",
    texto: "`!inactivo` → Justificar tu inactividad (abre formulario)\n\n" +
           "⚠️ **MUY IMPORTANTE:** las fechas deben ir en formato **AÑO-MES-DÍA** (`YYYY-MM-DD`).\n" +
           "✅ Ejemplo correcto: `2026-06-20`\n" +
           "❌ Incorrecto: `20-06-2026`, `20/06/26`, `junio 20`\n\n" +
           "Si pones el formato mal, el bot puede confundirse y calcular mal tus fechas de inactividad.",
  },
  [CANAL_CMD_ANUNCIOS]: {
    titulo: "📢 Comandos de Anuncios",
    texto: "`!activense` `!tormenta` `!battle` `!drop` → Notificar eventos a la banda\n`!tandastormentas` → Inicia tanda de 8 avisos cada 5 min\n`!paratanda` → Detiene la tanda activa",
  },
  [CANAL_CMD_TORNEO]: {
    titulo: "🏆 Comandos de Torneo",
    texto: "`!torneo` → Crear un torneo con inscripción\n`!torneostop` → Ver top de participantes\n`!reportetorneo @usuario` → Reportar tramposo en torneo",
  },
  [CANAL_CMD_ADMIN]: {
    titulo: "🛠️ Comandos de Admin",
    texto: "`!chiteado @usuario` → Marcar usuario como chiteado\n`!nuevo @usuario` → Procesar nuevo miembro\n`!migrarroles` → Migrar roles entre servidores",
  },
};

// channelId -> messageId del mensaje fijado actual
const pinnedMessages = new Map();

async function ensurePinnedCommands(channel) {
  const info = COMANDOS_POR_CANAL[channel.id];
  if (!info) return;

  // Borra el mensaje viejo del bot si existe
  const oldId = pinnedMessages.get(channel.id);
  if (oldId) {
    try {
      const oldMsg = await channel.messages.fetch(oldId);
      await oldMsg.delete();
    } catch {}
  }

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle(info.titulo)
    .setDescription(info.texto)
    .setFooter({ text: "Comandos disponibles en este canal" });

  try {
    const nuevo = await channel.send({ embeds: [embed] });
    pinnedMessages.set(channel.id, nuevo.id);
  } catch (e) {
    console.error("[COMANDOS_FIJADOS] Error:", e.message);
  }
}

// Se llama en cada mensaje nuevo en canales de comandos (después de procesar el comando)
async function handleComandosFijados(message) {
  if (!COMANDOS_POR_CANAL[message.channel.id]) return;
  // Ignorar el propio mensaje fijado de comandos para no entrar en loop
  if (message.author.bot && pinnedMessages.get(message.channel.id) === message.id) return;
  await ensurePinnedCommands(message.channel);
}

module.exports = { handleComandosFijados, ensurePinnedCommands, COMANDOS_POR_CANAL };
