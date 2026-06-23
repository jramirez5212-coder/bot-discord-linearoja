const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const CANAL_LOGS_ROLAS_ID  = "1516259267374612500"; // canal donde Rolas Academy manda los mensajes
const CANAL_ALERTAS_ID     = "1517620722833424394"; // canal donde van las alertas de armario
const BOT_ROLAS_NAME      = "Rolas Academy";        // nombre del bot externo
const DATA_FILE           = path.join(__dirname, "../../armario_data.json");

// Umbral para alerta de "está sacando mucho"
const ALERTA_UMBRAL = 6;

// ── Persistencia ──────────────────────────────────────────────────────────────
function loadArmario() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}");
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return {}; }
}
function saveArmario(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUsuario(data, userId, tag) {
  if (!data[userId]) data[userId] = { tag, armas: {}, dinero: { total: 0 }, hoy: {} };
  if (!data[userId].hoy) data[userId].hoy = {};
  data[userId].tag = tag;
  return data[userId];
}

function fechaHoy() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// ── Parser de líneas del bot Rolas Academy ───────────────────────────────────
// Formatos:
// "@usuario saco N WEAPON_XXX de banda_exlatam (stock)"
// "@usuario metio N WEAPON_XXX en banda_exlatam (stock)"
// "@usuario saco N money de banda_exlatam (stock)"
// "@usuario metio N money en banda_exlatam (stock)"
// Parser compatible con ambos formatos:
// "@usuario saco N ITEM de banda_exlatam (stock)"  ← formato Rolas Academy texto plano
// "<@123456> saco N ITEM de banda_exlatam (stock)"  ← menciones Discord
// Items pueden ser: WEAPON_SMG, corredera, metal, money, medikit, energizante_vip, etc.
function parsearLinea(linea) {
  // Intenta primero con mención Discord <@ID>
  const regexMencion = /^<@!?(\d+)>\s+(saco|metio)\s+(\d+)\s+(\S+)\s+(?:de|en)\s+\S+\s+\((\d+)\)/i;
  const matchMencion = linea.match(regexMencion);
  if (matchMencion) {
    return {
      userId:   matchMencion[1],
      username: null,
      accion:   matchMencion[2].toLowerCase(),
      cantidad: parseInt(matchMencion[3]),
      item:     matchMencion[4].toUpperCase(),
      stock:    parseInt(matchMencion[5]),
    };
  }

  // Formato texto plano: @username saco N ITEM de/en banda_exlatam (stock)
  // El item puede ser cualquier palabra: WEAPON_SMG, corredera, metal, money, etc.
  const regexPlano = /^@(\S+)\s+(saco|metio)\s+(\d+)\s+(\S+)\s+(?:de|en)\s+\S+\s+\((\d+)\)/i;
  const matchPlano = linea.match(regexPlano);
  if (matchPlano) {
    return {
      userId:   null,
      username: matchPlano[1].toLowerCase(),
      accion:   matchPlano[2].toLowerCase(),
      cantidad: parseInt(matchPlano[3]),
      item:     matchPlano[4].toUpperCase(),
      stock:    parseInt(matchPlano[5]),
    };
  }

  return null;
}

// ── Handler principal ─────────────────────────────────────────────────────────
async function handleArmarioLogs(message) {
  if (message.channel.id !== CANAL_LOGS_ROLAS_ID) return;
  // No filtramos por bot/webhook - aceptamos cualquier mensaje en este canal
  // que tenga el formato de Rolas Academy
  if (message.author.id === message.client.user.id) return; // ignorar mensajes del propio bot

  // Debug completo
  console.log(`[ARMARIO] Msg de "${message.author.username}" (bot:${message.author.bot}, webhook:${!!message.webhookId}, appId:${message.applicationId}):`);
  console.log(`[ARMARIO] Contenido: ${message.content?.slice(0, 500)}`);

  const lineas = message.content?.split("\n").filter(Boolean) || [];
  if (!lineas.length) {
    console.log("[ARMARIO] Sin líneas de texto, ignorando.");
    return;
  }

  const data   = loadArmario();
  const hoy    = fechaHoy();
  const alertas = [];

  for (const linea of lineas) {
    const parsed = parsearLinea(linea);
    if (!parsed) continue;

    // Resolver userId y tag
    let userId = parsed.userId;
    let tag    = parsed.username || `<@${userId}>`;

    if (!userId && parsed.username) {
      // Buscar miembro por username en el servidor
      try {
        await message.guild.members.fetch();
        const member = message.guild.members.cache.find(m =>
          m.user.username.toLowerCase() === parsed.username ||
          m.user.tag.toLowerCase().startsWith(parsed.username) ||
          m.displayName.toLowerCase() === parsed.username
        );
        if (member) {
          userId = member.id;
          tag    = member.user.tag;
        } else {
          // No encontrado: usar username como clave
          userId = `username:${parsed.username}`;
          tag    = parsed.username;
        }
      } catch {
        userId = `username:${parsed.username}`;
        tag    = parsed.username;
      }
    } else if (userId) {
      try {
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member) tag = member.user.tag;
      } catch {}
    }

    const ud = getUsuario(data, userId, tag);
    const { item, accion, cantidad } = parsed;

    // Inicializar arma si no existe
    if (!ud.armas[item]) ud.armas[item] = { saco: 0, metio: 0 };
    if (!ud.hoy[hoy])    ud.hoy[hoy]   = {};
    if (!ud.hoy[hoy][item]) ud.hoy[hoy][item] = { saco: 0, metio: 0 };

    // Registrar
    if (item === "MONEY") {
      if (!ud.dinero) ud.dinero = { total: 0 };
      ud.dinero.total += accion === "saco" ? cantidad : -cantidad;
    } else {
      ud.armas[item][accion]       += cantidad;
      ud.hoy[hoy][item][accion]    += cantidad;

      // Verificar alerta si sacó 6 o más del mismo item hoy
      if (accion === "saco") {
        const totalHoySacado = ud.hoy[hoy][item].saco;
        if (totalHoySacado >= ALERTA_UMBRAL && (totalHoySacado - parsed.cantidad) < ALERTA_UMBRAL) {
          // Solo dispara la alerta la primera vez que cruza el umbral
          alertas.push({
            userId,
            tag,
            item,
            total: totalHoySacado,
          });
        }
      }
    }
  }

  saveArmario(data);

  // Mandar alertas al canal de alertas
  for (const alerta of alertas) {
    try {
      const canalAlertas = await message.client.channels.fetch(CANAL_ALERTAS_ID).catch(() => message.channel);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`armario_ok:${alerta.userId}:${alerta.item}`)
          .setLabel("✅ Está bien, es normal")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`armario_rev:${alerta.userId}:${alerta.item}`)
          .setLabel("⚠️ Revisar este caso")
          .setStyle(ButtonStyle.Danger),
      );
      await canalAlertas.send({
        embeds: [new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🚨 Alerta de Armario")
          .setDescription(
            `<@${alerta.userId}> ya sacó **${alerta.total} ${alerta.item}** hoy.\n\n` +
            `¿Qué hacemos? (Solo Staff puede responder)`
          )
          .addFields(
            { name: "👤 Usuario",     value: alerta.tag,          inline: true },
            { name: "🔫 Item",        value: alerta.item,         inline: true },
            { name: "📦 Sacados hoy", value: `${alerta.total}`,   inline: true },
          )
          .setTimestamp()],
        components: [row]
      });
    } catch (e) {
      console.error("[ARMARIO] Error alerta:", e.message);
    }
  }
}

// ── Comando !armario @usuario ─────────────────────────────────────────────────
async function handleArmarioCommand(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!armario")) return;

  const target = message.mentions.members.first() || message.member;
  const data   = loadArmario();
  const ud     = data[target.id];

  if (!ud || !Object.keys(ud.armas || {}).length) {
    return message.reply(`❌ No hay registros de armario para ${target}.`);
  }

  const hoy      = fechaHoy();
  const armasHoy = ud.hoy?.[hoy] || {};

  // Tabla de armas totales
  const lineasArmas = Object.entries(ud.armas)
    .sort((a, b) => b[1].saco - a[1].saco)
    .map(([item, vals]) => {
      const hoyItem = armasHoy[item] || { saco: 0, metio: 0 };
      return `**${item}**\n↑ Sacó: ${vals.saco} (hoy: ${hoyItem.saco}) | ↓ Metió: ${vals.metio} (hoy: ${hoyItem.metio})`;
    });

  const embed = new EmbedBuilder()
    .setColor(0x39FF14)
    .setTitle(`🔫 Armario de ${target.user.tag}`)
    .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
    .setDescription(lineasArmas.join("\n\n") || "Sin registros de armas.")
    .setTimestamp()
    .setFooter({ text: `Datos acumulados desde que el bot empezó a registrar` });

  if (ud.dinero?.total !== undefined) {
    embed.addFields({ name: "💰 Dinero neto (saco - metio)", value: `$${ud.dinero.total.toLocaleString()}`, inline: true });
  }

  await message.reply({ embeds: [embed] });
}

// ── Comando !toparmario ───────────────────────────────────────────────────────
async function handleTopArmario(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!toparmario")) return;

  const data = loadArmario();
  const hoy  = fechaHoy();

  // Calcular total de armas sacadas por usuario hoy
  const ranking = Object.entries(data)
    .map(([uid, ud]) => {
      const armasHoy = ud.hoy?.[hoy] || {};
      const totalHoy = Object.values(armasHoy).reduce((sum, v) => sum + (v.saco || 0), 0);
      const totalGen  = Object.values(ud.armas || {}).reduce((sum, v) => sum + (v.saco || 0), 0);
      return { uid, tag: ud.tag, totalHoy, totalGen };
    })
    .filter(u => u.totalGen > 0)
    .sort((a, b) => b.totalGen - a.totalGen)
    .slice(0, 10);

  if (!ranking.length) return message.reply("❌ No hay datos de armario registrados.");

  const medalias = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  const lineas   = ranking.map((u, i) =>
    `${medalias[i]} **${u.tag}** — ${u.totalGen} armas sacadas en total (hoy: ${u.totalHoy})`
  );

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("🏆 Top Armario — Armas Sacadas")
    .setDescription(lineas.join("\n"))
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// ── Comando !topmetio ─────────────────────────────────────────────────────────
async function handleTopMetio(message) {
  if (message.author.bot) return;
  if (!message.content.trim().toLowerCase().startsWith("!topmetio")) return;

  const data = loadArmario();
  const hoy  = fechaHoy();

  const ranking = Object.entries(data)
    .map(([uid, ud]) => {
      const totalGen = Object.values(ud.armas || {}).reduce((sum, v) => sum + (v.metio || 0), 0);
      const armasHoy = ud.hoy?.[hoy] || {};
      const totalHoy = Object.values(armasHoy).reduce((sum, v) => sum + (v.metio || 0), 0);
      return { uid, tag: ud.tag, totalGen, totalHoy };
    })
    .filter(u => u.totalGen > 0)
    .sort((a, b) => b.totalGen - a.totalGen)
    .slice(0, 10);

  if (!ranking.length) return message.reply("❌ No hay datos de armario registrados.");

  const medalias = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  const lineas   = ranking.map((u, i) =>
    `${medalias[i]} **${u.tag}** — ${u.totalGen} items metidos en total (hoy: ${u.totalHoy})`
  );

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📦 Top Armario — Items Metidos")
    .setDescription(lineas.join("\n"))
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// ── Handler botones de alerta de armario ──────────────────────────────────────
async function handleArmarioAlertaButton(interaction) {
  if (!interaction.isButton()) return;
  const isOk  = interaction.customId.startsWith("armario_ok:");
  const isRev = interaction.customId.startsWith("armario_rev:");
  if (!isOk && !isRev) return;

  const { STAFF_ROLE_ID } = require("../config");
  if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) &&
      !interaction.member.permissions.has(8n))
    return interaction.reply({ content: "❌ Solo Staff puede responder esto.", ephemeral: true });

  const partes  = interaction.customId.split(":");
  const userId  = partes[1];
  const item    = partes[2];

  try {
    await interaction.update({
      embeds: [EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(isOk ? 0x39FF14 : 0xe74c3c)
        .setDescription(
          isOk
            ? `✅ **Marcado como normal** por ${interaction.user}.\n<@${userId}> — ${item}`
            : `⚠️ **Marcado para revisión** por ${interaction.user}.\n<@${userId}> — ${item}`
        )],
      components: []
    });
  } catch (e) {
    console.error("[ARMARIO] Error botón alerta:", e.message);
  }
}

module.exports = { handleArmarioLogs, handleArmarioCommand, handleTopArmario, handleTopMetio, handleArmarioAlertaButton };
