const { EmbedBuilder } = require("discord.js");
const { ACTIVITY_ROLE_ID, RUSH_ACTIVITY_ROLE_ID, LOGO_URL,
        CANAL_CMD_ANUNCIOS }          = require("../config");

const cooldowns   = new Map();
const COOLDOWN_MS = 60 * 1000;

// ROLAS — comandos normales
const COMANDOS_ROLAS = {
  "!activense": { titulo:"⚡ ¡ACTÍVENSE — ROLAS!",           mensaje:`<@&${ACTIVITY_ROLE_ID}> ¡Activense muchachones!`, color:0x39FF14, desc:"¡Vengan al canal de voz ahora!" },
  "!tormenta":  { titulo:"🌪️ ¡TORMENTA EN 1 MIN — ROLAS!",  mensaje:`<@&${ACTIVITY_ROLE_ID}> **¡Tormenta en 1 minuto, entren!**`, color:0x3498db, desc:"¡Prepárense, tormenta en 1 minuto!" },
  "!battle":    { titulo:"⚔️ ¡BATTLE ROYAL — ROLAS!",        mensaje:`<@&${ACTIVITY_ROLE_ID}> **¡Battle Royal en 1 minuto, entren!**`, color:0xe74c3c, desc:"¡Battle Royal comenzando!" },
  "!drop":      { titulo:"📦 ¡DROP — ROLAS!",                mensaje:`<@&${ACTIVITY_ROLE_ID}> **¡Drop en 1 minuto, entren!**`, color:0xf39c12, desc:"¡Drop cayendo en 1 minuto!" },
};

// RUSH — mismos comandos con sufijo "rush"
const COMANDOS_RUSH = {
  "!activenserush": { titulo:"⚡ ¡ACTÍVENSE — RUSH!",           mensaje:`<@&${RUSH_ACTIVITY_ROLE_ID}> ¡Activense muchachones RUSH!`, color:0x39FF14, desc:"¡Vengan al canal de voz ahora!" },
  "!tormentarush":  { titulo:"🌪️ ¡TORMENTA EN 1 MIN — RUSH!",  mensaje:`<@&${RUSH_ACTIVITY_ROLE_ID}> **¡Tormenta en 1 minuto, entren!**`, color:0x3498db, desc:"¡Prepárense, tormenta en 1 minuto!" },
  "!battlerush":    { titulo:"⚔️ ¡BATTLE ROYAL — RUSH!",        mensaje:`<@&${RUSH_ACTIVITY_ROLE_ID}> **¡Battle Royal en 1 minuto, entren!**`, color:0xe74c3c, desc:"¡Battle Royal comenzando!" },
  "!droprush":      { titulo:"📦 ¡DROP — RUSH!",                mensaje:`<@&${RUSH_ACTIVITY_ROLE_ID}> **¡Drop en 1 minuto, entren!**`, color:0xf39c12, desc:"¡Drop cayendo en 1 minuto!" },
};

const TODOS_COMANDOS = { ...COMANDOS_ROLAS, ...COMANDOS_RUSH };

async function handleAnuncios(message) {
  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();
  if (!TODOS_COMANDOS[cmd]) return;

  const esRush = cmd.endsWith("rush");
  const rolReq = esRush ? RUSH_ACTIVITY_ROLE_ID : ACTIVITY_ROLE_ID;

  if (!message.member.roles.cache.has(rolReq))
    return message.reply(`❌ Solo ${esRush ? "RUSH" : "ROLAS"} puede usar este comando.`);

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

  const { titulo, color, desc } = TODOS_COMANDOS[cmd];
  try { await message.delete(); } catch {}

  const embed = new EmbedBuilder()
    .setTitle(titulo).setDescription(desc).setColor(color)
    .setThumbnail(LOGO_URL).setTimestamp()
    .setFooter({ text: `Enviado por ${message.author.username}` });

  await message.channel.send({ embeds: [embed] });
}

module.exports = { handleAnuncios };
