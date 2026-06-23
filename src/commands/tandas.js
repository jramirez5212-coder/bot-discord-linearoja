const { EmbedBuilder } = require("discord.js");
const { ACTIVITY_ROLE_ID, RUSH_ACTIVITY_ROLE_ID, CANAL_CMD_ANUNCIOS, LOGO_URL } = require("../config");

const tandasActivas = new Map();
const cooldowns     = new Map();
const COOLDOWN_MS   = 10 * 1000;

async function handleTandas(message) {
  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();

  const esRush = cmd === "!tandastormentasrush" || cmd === "!paratandarush";
  if (!["!tandastormentas","!paratanda","!tandastormentasrush","!paratandarush"].includes(cmd)) return;

  const rolReq = esRush ? RUSH_ACTIVITY_ROLE_ID : ACTIVITY_ROLE_ID;
  if (!message.member.roles.cache.has(rolReq))
    return message.reply(`❌ Solo ${esRush ? "RUSH" : "ROLAS"} puede usar este comando.`);

  if (message.channel.id !== CANAL_CMD_ANUNCIOS) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_ANUNCIOS}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const tandasKey = `${message.channel.id}:${esRush ? "rush" : "rolas"}`;

  // ── !paratanda / !paratandarush ───────────────────────────────
  if (cmd === "!paratanda" || cmd === "!paratandarush") {
    const tanda = tandasActivas.get(tandasKey);
    if (!tanda) return message.reply("❌ No hay ninguna tanda activa.");
    if (tanda.userId !== message.author.id)
      return message.reply("❌ Solo quien activó la tanda puede pararla.");
    clearInterval(tanda.interval);
    tandasActivas.delete(tandasKey);
    try { await message.delete(); } catch {}
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0x39FF14)
      .setTitle(`✅ Tanda detenida — ${esRush ? "RUSH" : "ROLAS"}`)
      .setDescription(`${message.author} detuvo la tanda de tormentas.`)
      .setTimestamp()] });
    return;
  }

  // ── !tandastormentas / !tandastormentasrush ───────────────────
  if (tandasActivas.has(tandasKey))
    return message.reply("❌ Ya hay una tanda activa. Usa `!paratanda` para detenerla.");

  const key    = `tanda:${message.author.id}:${esRush?"rush":"rolas"}`;
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
  // Sin mención de rol
  const label  = esRush ? "RUSH" : "ROLAS";

  const enviarMensaje = async (num) => {
    try {
      await canal.send({
        // sin content
        embeds: [new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`🌪️ TANDA DE TORMENTAS — ${label} ¡ENTRAR! (${num}/${MAX})`)
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
      tandasActivas.delete(tandasKey);
      try {
        await canal.send({ embeds: [new EmbedBuilder()
          .setColor(0x39FF14)
          .setTitle(`✅ Tanda finalizada — ${label}`)
          .setDescription(`Se enviaron **${MAX} avisos**. ¡A jugar! 🎮`)
          .setTimestamp()] });
      } catch {}
    }
  }, 5 * 60 * 1000);

  tandasActivas.set(tandasKey, { interval, userId: message.author.id });
}

module.exports = { handleTandas };
