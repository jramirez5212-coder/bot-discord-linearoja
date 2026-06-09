const { EmbedBuilder } = require("discord.js");
const { ACTIVITY_ROLE_ID, LOGO_URL,
        CANAL_CMD_ANUNCIOS }          = require("../config");

const cooldowns   = new Map();
const COOLDOWN_MS = 60 * 1000;

const COMANDOS = {
  "!activense": { titulo:"⚡ ¡ACTÍVENSE!",              mensaje:`¡Activense muchachones! <@&${ACTIVITY_ROLE_ID}>`, color:0x39FF14, desc:"¡Vengan al canal de voz ahora!" },
  "!tormenta":  { titulo:"🌪️ ¡TORMENTA EN 1 MINUTO!",  mensaje:`<@&${ACTIVITY_ROLE_ID}> **¡Tormenta en 1 minuto, entren!**`, color:0x3498db, desc:"¡Prepárense, tormenta en 1 minuto!" },
  "!battle":    { titulo:"⚔️ ¡BATTLE ROYAL EN 1 MINUTO!", mensaje:`<@&${ACTIVITY_ROLE_ID}> **¡Battle Royal en 1 minuto, entren!**`, color:0xe74c3c, desc:"¡Battle Royal comenzando en 1 minuto!" },
  "!drop":      { titulo:"📦 ¡DROP EN 1 MINUTO!",       mensaje:`<@&${ACTIVITY_ROLE_ID}> **¡Drop en 1 minuto, entren!**`, color:0xf39c12, desc:"¡Drop cayendo en 1 minuto!" },
};

async function handleAnuncios(message) {
  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();
  if (!COMANDOS[cmd]) return;

  if (!message.member.roles.cache.has(ACTIVITY_ROLE_ID))
    return message.reply("❌ No tienes permiso para usar este comando.");

  // Solo en canal permitido
  if (message.channel.id !== CANAL_CMD_ANUNCIOS) {
    const aviso = await message.reply(`❌ Este comando solo se puede usar en <#${CANAL_CMD_ANUNCIOS}>`);
    setTimeout(() => { try { aviso.delete(); message.delete(); } catch {} }, 5000);
    return;
  }

  const key    = `${cmd}:${message.author.id}`;
  const ultimo = cooldowns.get(key);
  if (ultimo && Date.now() - ultimo < COOLDOWN_MS) {
    const segs = Math.ceil((COOLDOWN_MS - (Date.now() - ultimo)) / 1000);
    return message.reply(`⏳ Espera **${segs} segundos**.`);
  }
  cooldowns.set(key, Date.now());

  const { titulo, mensaje, color, desc } = COMANDOS[cmd];
  try { await message.delete(); } catch {}

  const embed = new EmbedBuilder()
    .setTitle(titulo).setDescription(desc).setColor(color)
    .setThumbnail(LOGO_URL).setTimestamp()
    .setFooter({ text: `Enviado por ${message.author.username}` });

  await message.channel.send({ content: mensaje, embeds: [embed] });
}

module.exports = { handleAnuncios };
