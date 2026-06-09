const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ACTIVITY_ROLE_ID, CANAL_CMD_ANUNCIOS, LOGO_URL }             = require("../config");

const tandasActivas = new Map();
const cooldowns     = new Map();
const COOLDOWN_MS   = 10 * 1000;

async function handleTandas(message) {
  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();

  if (!["!tandastormentas", "!paratanda"].includes(cmd)) return;
  if (!message.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return message.reply("❌ No tienes permiso.");

  // Solo en canal de anuncios
  if (message.channel.id !== CANAL_CMD_ANUNCIOS) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_ANUNCIOS}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  // ── !paratanda ────────────────────────────────────────────────
  if (cmd === "!paratanda") {
    const tanda = tandasActivas.get(message.channel.id);
    if (!tanda) return message.reply("❌ No hay ninguna tanda activa en este canal.");
    if (tanda.userId !== message.author.id)
      return message.reply("❌ Solo quien activó la tanda puede pararla.");

    clearInterval(tanda.interval);
    tandasActivas.delete(message.channel.id);
    try { await message.delete(); } catch {}

    await message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle("✅ Tanda de tormentas detenida")
      .setDescription(`${message.author} detuvo la tanda de tormentas.`)
      .setTimestamp()] });
    return;
  }

  // ── !tandastormentas ──────────────────────────────────────────
  if (tandasActivas.has(message.channel.id))
    return message.reply("❌ Ya hay una tanda activa. Usa `!paratanda` para detenerla.");

  const key    = `tanda:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    const segs = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
    return message.reply(`⏳ Espera **${segs} segundos**.`);
  }
  cooldowns.set(key, Date.now());
  try { await message.delete(); } catch {}

  let enviados = 0;
  const MAX    = 8;
  const canal  = message.channel;

  const enviarMensaje = async (num) => {
    try {
      await canal.send({
        content: `<@&${ACTIVITY_ROLE_ID}>`,
        embeds: [new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`🌪️ TANDA DE TORMENTAS — ¡ENTRAR! (${num}/${MAX})`)
          .setDescription("**¡¡¡TANDA DE TORMENTAS, ENTREN!!!!!!**\n\n🌪️ ¡Todos al canal de voz AHORA!")
          .setThumbnail(LOGO_URL)
          .setFooter({ text: `Aviso ${num} de ${MAX} • Próximo en 5 min` })
          .setTimestamp()]
      });
    } catch(e) { console.error("[TANDA] Error:", e.message); }
  };

  enviados++;
  await enviarMensaje(enviados);
  if (enviados >= MAX) return;

  const interval = setInterval(async () => {
    enviados++;
    await enviarMensaje(enviados);

    if (enviados >= MAX) {
      clearInterval(interval);
      tandasActivas.delete(canal.id);
      try {
        await canal.send({ embeds: [new EmbedBuilder()
          .setColor(0x39FF14)
          .setTitle("✅ Tanda de tormentas finalizada")
          .setDescription(`Se enviaron **${MAX} avisos**. ¡A jugar! 🎮`)
          .setTimestamp()] });
      } catch {}
    }
  }, 5 * 60 * 1000);

  tandasActivas.set(canal.id, { interval, userId: message.author.id });
}

module.exports = { handleTandas };
