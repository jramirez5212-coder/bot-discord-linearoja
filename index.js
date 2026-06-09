require("dotenv").config();

const {
  Client, GatewayIntentBits, Partials,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, AttachmentBuilder
} = require("discord.js");

const fs   = require("fs");
const path = require("path");
const https = require("https");

const voiceEvent                   = require("./src/events/voiceStateUpdate");
const { handleHoras }              = require("./src/commands/horas");
const { handleAnuncios }           = require("./src/commands/anuncios");
const { handleInactividad,
        handleInactividadButton,
        handleInactividadModal,
        isExcused }                = require("./src/commands/inactividad");
const { handleTorneo,
        handleTorneoInteraction,
        recoverTorneoRoles }       = require("./src/commands/torneo");
const { handleAdmin,
        handleChiteadoButton }      = require("./src/commands/admin");
const { handleNuevo,
        handleNuevoButton }         = require("./src/commands/nuevo");
const { handleTandas }             = require("./src/commands/tandas");
const { startActividadTask }       = require("./src/tasks/actividadTask");
const { startInactividadTask }     = require("./src/tasks/inactividadTask");

global.isExcused = isExcused;

const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error("Falta TOKEN en el archivo .env");

const COLOR      = 0x00ff3c;
const SS_ROLE_ID = "1497410474881319102";

const config = {
  guildName: "EXLATAM / #300K?",
  guildId: "1455775938200473606",
  welcomeChannelId: "1469434029475496209",
  staffBandasRoleId: "1479568728340431100",
  postulacionesPanelChannelId: "1503502893616070729",
  postulacionesChannelId: "1503480237307203665",
  categoriaAprobadosId: "1503482480169189607",
  categoriaRechazadosId: "1503482612721782894",
  botLogsChannelId: "1484299743440928768",
  logoUrl: "https://cdn.discordapp.com/attachments/1495181084248510555/1496961392316780544/ex1-removebg-preview.png?ex=6a00e170&is=69ff8ff0&hm=50f5e8ba4101bb15b3d05c648a5ad13ef57f8408b2cfad94431a2effe219bab6&",
  bannerUrl: "https://cdn.discordapp.com/attachments/1495181084248510555/1495181776614588426/bannerdc1.png?ex=6a00ff8a&is=69ffae0a&hm=f54d7a23160bfc30fdd22e438104f200f5e8cc1970985179fba540aae6af1904&"
};

const questions = ["Nombre:","Residencia/País?:","Edad (**mínimo 15**):","5 Clips o 1HG:","Foto de las horas de FiveM:","Foto KD (**mínimo 1.8**):","Link Steam Público:","Tiempo Disponible?:"];

const ticketTypes = {
  reportes:  { label:"Reportes",  emoji:"⛔",  categoryId:"1469433997191811308", roleId:"1469433860293918921", description:"⚠️ **Cuéntanos en qué te podemos ayudar.**\n\n~ Usuario reportado:\n~ Motivo del reporte:\n~ Pruebas / clips:\n~ Explicación completa de lo sucedido:" },
  compras:   { label:"Compras",   emoji:"<:emoji_24:1486354461558308944>", categoryId:"1469433995371483320", roleId:"1481851324395163759", description:"⚠️ **Mientras tanto dinos qué te gustaría comprar de la tienda:**\n\n~ Producto:\n~ Cantidad:\n~ Método de pago:\n~ ¿Está en stock?:" },
  partners:  { label:"Partners",  emoji:"🤝", categoryId:"1469433998722732279", roleId:"1469433860293918921", description:"⚠️ **Solicitud de partner**\n\n~ Nombre del servidor:\n~ Invitación:\n~ Miembros:\n~ ¿Qué tipo de alianza quieres hacer?:\n~ ¿Qué puedes ofrecer como partner?:" }
};

const appFile  = "./applications.json";
const metaFile = "./rolas_meta.json";
for (const file of [appFile, metaFile]) { if (!fs.existsSync(file)) fs.writeFileSync(file, "{}"); }

const loadJson = f => { try { return JSON.parse(fs.readFileSync(f,"utf8")); } catch { return {}; } };
const saveJson = (f,d) => fs.writeFileSync(f, JSON.stringify(d,null,2));
const loadApps = () => loadJson(appFile);
const saveApps = d => saveJson(appFile, d);
const loadMeta = () => loadJson(metaFile);
const saveMeta = d => saveJson(metaFile, d);

const colombiaDate = () => new Date().toLocaleDateString("en-CA",{timeZone:"America/Bogota"});
const colombiaTime = () => new Date().toLocaleTimeString("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit",hour12:true});
const todayFooter  = n => `Ahora somos ${n} miembros • hoy a las ${new Date().toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit",hour12:true})}`;
const cleanName        = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,35);
const cleanChannelName = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,80);
const answerFromMessage = m => { const t=m.content?.trim()||""; const f=m.attachments.map(a=>a.url); return [t,...f].filter(Boolean).join("\n")||"Sin respuesta"; };
const isStaffMember    = m => m?.roles?.cache?.has(config.staffBandasRoleId) || m?.permissions?.has(PermissionFlagsBits.Administrator);
const canStaff         = i => i.member?.roles?.cache?.has(config.staffBandasRoleId) || i.member?.permissions?.has(PermissionFlagsBits.Administrator);
const getTicketTypeFromChannel = ch => ch?.topic?.match(/ticketType:([a-zA-Z0-9_-]+)/)?.[1] || null;
const canManageThisTicket = i => { if (!i.member) return false; if (i.member.permissions.has(PermissionFlagsBits.Administrator)) return true; const t=ticketTypes[getTicketTypeFromChannel(i.channel)]; return t?i.member.roles.cache.has(t.roleId):false; };
const getTicketUserId  = ch => ch.topic?.match(/postulacionUser:(\d+)/)?.[1] || null;

const buildRenameTicketModal = () => { const m=new ModalBuilder().setCustomId("modal_rename_ticket").setTitle("Renombrar ticket"); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("new_name").setLabel("Nuevo nombre del canal").setPlaceholder("Ejemplo: reporte-juan").setStyle(TextInputStyle.Short).setRequired(true))); return m; };
const renameResultModal      = () => { const m=new ModalBuilder().setCustomId("modal_rename_resultado").setTitle("Renombrar ticket"); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("new_name").setLabel("Nuevo nombre del canal").setPlaceholder("Ejemplo: aprobado-juan").setStyle(TextInputStyle.Short).setRequired(true))); return m; };

const resultTicketButtons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("cerrar_resultado_ticket").setLabel("Cerrar ticket").setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId("renombrar_resultado_ticket").setLabel("Renombrar ticket").setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("solicitar_ss").setLabel("Solicitar encargado de SS").setStyle(ButtonStyle.Secondary).setEmoji("📋")
);

const decisionButtons = id => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`aprobar_${id}`).setLabel("Aprobar").setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`rechazar_${id}`).setLabel("Rechazar").setStyle(ButtonStyle.Danger)
);

const questionEmbed = i => new EmbedBuilder().setColor(COLOR)
  .setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl})
  .setTitle("📝 | Postulación")
  .setDescription(`**${i+1}/${questions.length}. ${questions[i]}**\n\nResponde enviando un mensaje. Puedes enviar texto, links o imágenes.`)
  .setFooter({text:config.guildName,iconURL:config.logoUrl});

// Embed de postulación con formato bonito
const buildApplicationEmbed = (user, app) => {
  const fields = questions.map((q, i) => {
    const answer = app.answers[i] || "Sin respuesta";
    return { name: `**${q}**`, value: answer, inline: false };
  });

  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({name:"EXLATAM Postulaciones", iconURL:config.logoUrl})
    .setTitle("📝 **POSTULACIÓN**")
    .setThumbnail(user.displayAvatarURL({dynamic:true}))
    .addFields(
      {name:"👤 Usuario", value:`${user}`, inline:true},
      {name:"🆔 ID",      value:user.id,   inline:true},
      {name:"📊 Estado",  value:"`Pendiente`", inline:true},
      ...fields
    )
    .setFooter({text:config.guildName, iconURL:config.logoUrl})
    .setTimestamp();
};

const buildPanel = () => ({
  embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl}).setTitle("📝 Sistema de Postulaciones").setDescription("**Bienvenido al sistema oficial de postulaciones de EXLATAM.**\n\nPresiona el botón de abajo para iniciar. El bot te hará las preguntas una por una por DM.\n\nCuando termines, tu postulación llegará al equipo de staff para aprobarla o rechazarla.").setThumbnail(config.logoUrl).setImage(config.bannerUrl).setFooter({text:"EXLATAM • Sistema de Postulaciones",iconURL:config.logoUrl})],
  components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("start_postulacion").setLabel("Iniciar postulación").setEmoji("📝").setStyle(ButtonStyle.Success))]
});

const ticketPanel = () => ({
  embeds:[new EmbedBuilder().setColor(COLOR).setTitle("<:emoji_16:1486354271351078923> SISTEMA TICKETS EXLATAM").setDescription("<:emoji_13:1485010590358568970>  *Si deseas abrir algun ticket lo puedes hacer presionando los botones de abajo:*\n\n```INFORMACION IMPORTANTE```\n<:emoji_6:1485010432514326558> __Postulaciones:__ Usa el panel de postulaciones para iniciar por DM.\n<:emoji_6:1485010432514326558> __Reportes:__ Reportar alguna inconformidad.\n<:emoji_6:1485010432514326558> __Compras:__ Compras en nuestra tienda.\n<:emoji_6:1485010432514326558> __Partners:__ Alianzas entre discord (PUBLICIDAD).\n\n👇 **SELECCIONA EL TICKET QUE NECESITAS** 👇").setThumbnail(config.logoUrl).setImage(config.bannerUrl).setFooter({text:"TICKETS"})],
  components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_reportes").setLabel("Reportes").setEmoji("⛔").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("ticket_compras").setLabel("Compras").setEmoji("🛍️").setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId("ticket_partners").setLabel("Partners").setEmoji("🤝").setStyle(ButtonStyle.Primary))]
});

async function botLog(emoji,titulo,detalle="",origen="auto",ejecutadoPor=null){try{const ch=await client.channels.fetch(config.botLogsChannelId).catch(()=>null);if(!ch?.isTextBased())return;const embed=new EmbedBuilder().setColor(origen==="manual"?0xf0a500:COLOR).setAuthor({name:"EXLATAM Bot — Log",iconURL:config.logoUrl}).setTitle(`${emoji} ${titulo}`).addFields({name:"Origen",value:origen==="manual"?`🖐️ Manual${ejecutadoPor?` — ${ejecutadoPor}`:""}` :"🤖 Automático",inline:true},{name:"Hora",value:colombiaTime(),inline:true},{name:"Fecha",value:colombiaDate(),inline:true}).setFooter({text:config.guildName,iconURL:config.logoUrl}).setTimestamp();if(detalle)embed.setDescription(detalle);await ch.send({embeds:[embed]});}catch(e){console.log("⚠️ botLog:",e.message);}}

async function sendAutoPostulacionesPanel(origen="auto",ejecutadoPor=null){const ch=await client.channels.fetch(config.postulacionesPanelChannelId).catch(()=>null);if(!ch?.isTextBased())return;const meta=loadMeta();if(meta.postulacionesPanelMessageId){const old=await ch.messages.fetch(meta.postulacionesPanelMessageId).catch(()=>null);if(old){await old.edit(buildPanel());}else{const m=await ch.send(buildPanel());meta.postulacionesPanelMessageId=m.id;saveMeta(meta);}}else{const m=await ch.send(buildPanel());meta.postulacionesPanelMessageId=m.id;saveMeta(meta);}await botLog("📝","Panel de postulaciones actualizado",`Canal: <#${config.postulacionesPanelChannelId}>`,origen,ejecutadoPor);}

async function askQuestion(userId){const apps=loadApps();const app=apps[userId];if(!app)return;const user=await client.users.fetch(userId).catch(()=>null);if(!user)return;await user.send({embeds:[questionEmbed(app.current)]});}

// Enviar postulación al staff con archivos adjuntos visibles
async function sendApplicationToStaff(userId) {
  const apps = loadApps();
  const app  = apps[userId];
  if (!app) return;

  const user = await client.users.fetch(userId).catch(() => null);
  const ch   = await client.channels.fetch(config.postulacionesChannelId).catch(() => null);
  if (!user || !ch?.isTextBased()) return;

  try {
    // Recolectar URLs de imágenes/videos de las respuestas
    const archivos = [];
    for (const answer of app.answers) {
      const urls = answer.split("\n").filter(u => u.startsWith("http"));
      for (const url of urls) {
        // Solo adjuntar si es de Discord (ya están en CDN)
        if (url.includes("cdn.discordapp.com") || url.includes("media.discordapp.net")) {
          archivos.push(url);
        }
      }
    }

    const embed = buildApplicationEmbed(user, app);

    // Enviar embed principal
    const msg = await ch.send({
      content: `<@&${config.staffBandasRoleId}> **📝 Nueva postulación de ${user.tag}**`,
      embeds:  [embed],
      components: [decisionButtons(userId)]
    });

    // Enviar archivos adjuntos si hay (imágenes, videos)
    if (archivos.length > 0) {
      const embedMedia = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("📎 Archivos adjuntos de la postulación")
        .setDescription(archivos.map((url, i) => `**Archivo ${i+1}:** ${url}`).join("\n"))
        .setFooter({text: `Postulación de ${user.tag}`});

      await ch.send({ embeds: [embedMedia] });

      // Enviar imágenes directamente para que se vean en Discord
      for (const url of archivos.slice(0, 5)) {
        try {
          await ch.send({ content: url });
        } catch {}
      }
    }

    app.staffMessageId = msg.id;
    app.status = "pendiente";
    apps[userId] = app;
    saveApps(apps);
    await botLog("📨","Postulación enviada",`<@${userId}>`,"auto");
  } catch(e) { console.log("❌", e.message); }
}

async function createResultTicket(userId, status, staffUser) {
  try {
    const guild   = await client.guilds.fetch(config.guildId);
    const user    = await client.users.fetch(userId).catch(() => null);
    if (!user) return null;
    const approved = status === "aprobada";

    const ch = await guild.channels.create({
      name: `${approved?"aprobado":"rechazado"}-${cleanName(user.username)}`,
      type: ChannelType.GuildText,
      parent: approved ? config.categoriaAprobadosId : config.categoriaRechazadosId,
      topic: `postulacionUser:${userId} | status:${status} | staff:${staffUser.id} | createdAt:${Date.now()}`,
      permissionOverwrites: [
        {id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel]},
        {id:userId, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]},
        {id:config.staffBandasRoleId, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]},
        {id:"1469433858352222379", allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(approved ? COLOR : 0xff3c3c)
      .setAuthor({name:"EXLATAM Postulaciones", iconURL:config.logoUrl})
      .setTitle(approved ? "✅ **POSTULACIÓN** Aprobada" : "❌ **POSTULACIÓN** Rechazada")
      .setDescription(approved
        ? `Tu **POSTULACIÓN** fue **aprobada** por ${staffUser}.\n\nAhora pasas a la **segunda etapa del proceso**, la cual se realizará por **llamada**.\n\nCuando el staff te notifique, deberás entrar a la **sala de espera** para continuar con la entrevista.`
        : `Tu **POSTULACIÓN** fue **rechazada** por ${staffUser}.\n\nPuedes usar este ticket para preguntar el motivo o apelar la decisión de forma respetuosa.`
      )
      .addFields(
        {name: "👤 Solicitante", value: `<@${userId}>`,      inline: true},
        {name: "⚖️ Revisado por", value: `${staffUser}`,     inline: true},
        {name: "📊 Estado",       value: approved ? "`Aprobada`" : "`Rechazada`", inline: true},
      )
      .setThumbnail(config.logoUrl)
      .setFooter({text:config.guildName, iconURL:config.logoUrl})
      .setTimestamp();

    await ch.send({content:`<@${userId}> <@&${config.staffBandasRoleId}>`, embeds:[embed], components:[resultTicketButtons()]});
    await botLog(approved?"✅":"❌", `Ticket ${approved?"aprobado":"rechazado"} creado`, `Usuario: <@${userId}> | Staff: ${staffUser} | Canal: ${ch}`, "auto");
    return ch;
  } catch(e) { console.log("❌", e.message); return null; }
}

async function sendRejectAppealDM(user,staffUser){await user.send({content:`❌ Su **POSTULACIÓN** fue rechazada por ${staffUser}.\n\nSi consideras que hubo un error en la revisión o quieres explicar mejor tu caso, puedes apelar el rechazo presionando el botón de abajo.`,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`apelar_rechazo_${user.id}`).setLabel("Apelar rechazo").setStyle(ButtonStyle.Primary))]}).catch(()=>null);}

async function startFeedback(userId,status,staffId){const apps=loadApps();apps[userId]=apps[userId]||{};apps[userId].feedback={active:true,step:0,status,staffId,answers:[]};saveApps(apps);const user=await client.users.fetch(userId).catch(()=>null);if(!user)return;await user.send({embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl}).setTitle("⭐ Califica la atención").setDescription("El ticket fue cerrado.\n\nDel **1 al 5**, ¿cómo calificas la atención recibida?").setFooter({text:config.guildName,iconURL:config.logoUrl})]}).catch(()=>null);}

async function sendFeedbackToStaff(userId){const apps=loadApps();const app=apps[userId];if(!app?.feedback)return;const ch=await client.channels.fetch(config.postulacionesChannelId).catch(()=>null);const user=await client.users.fetch(userId).catch(()=>null);if(!ch?.isTextBased()||!user)return;await ch.send({embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"Feedback de postulación",iconURL:config.logoUrl}).setTitle("⭐ Calificación recibida").addFields({name:"Usuario",value:`<@${userId}>`,inline:true},{name:"Estado",value:app.feedback.status||"No definido",inline:true},{name:"Staff",value:`<@${app.feedback.staffId}>`,inline:true},{name:"Calificación",value:app.feedback.answers[0]||"Sin calificación",inline:false},{name:"Sugerencia / Comentario",value:app.feedback.answers[1]||"Sin comentario",inline:false}).setThumbnail(user.displayAvatarURL({dynamic:true})).setTimestamp()]});await botLog("⭐","Feedback recibido",`<@${userId}> — ${app.feedback.answers[0]||"?"}`,"auto");delete app.feedback;apps[userId]=app;saveApps(apps);}

const client = new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.DirectMessages],
  partials:[Partials.Channel,Partials.Message,Partials.User]
});

client.once("clientReady", async () => {
  console.log(`✅ BOT COMPLETO EXLATAM — ${client.user.tag}`);
  voiceEvent.recoverSessions(client);
  recoverTorneoRoles(client);
  startActividadTask(client);
  startInactividadTask(client);
  await botLog("🟢","Bot iniciado",`Conectado como **${client.user.tag}**`,"auto");
  await sendAutoPostulacionesPanel("auto").catch(e=>console.log("⚠️",e.message));
  setInterval(()=>sendAutoPostulacionesPanel("auto").catch(()=>{}), 10*60*1000);
});

client.on("guildMemberAdd", async member => {
  try {
    const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(()=>null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setDescription(`*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n*si quieres postular acá lo puedes hacer:* <#${config.postulacionesPanelChannelId}>`)
      .setThumbnail(member.user.displayAvatarURL({dynamic:true}))
      .setImage(config.bannerUrl)
      .setFooter({text:todayFooter(member.guild.memberCount)});
    await channel.send({content:`${member} **Bienvenido a** __${config.guildName}__ 🚙`, embeds:[embed]});
  } catch(e){console.log("⚠️ Bienvenida error:",e.message);}
});

client.on("voiceStateUpdate",(o,n)=>voiceEvent.execute(o,n,client));

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  if (message.guild) {
    await handleHoras(message, client);
    await handleAnuncios(message);
    await handleInactividad(message);
    await handleTorneo(message);
    await handleAdmin(message, client);
    await handleNuevo(message, client);
    await handleTandas(message);

    if (message.content.trim().toLowerCase() === "!panel") {
      if (!isStaffMember(message.member)) return message.reply("❌ No tienes permisos.").catch(()=>null);
      await sendAutoPostulacionesPanel("manual",`<@${message.author.id}>`);
      return message.reply("✅ Panel enviado/actualizado.").catch(()=>null);
    }
    if (message.content === "!paneltickets") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("No tienes permisos.");
      await message.channel.send(ticketPanel());
      return message.reply("✅ Panel enviado.");
    }
    return;
  }

  // DMs postulaciones
  const userId = message.author.id;
  const apps   = loadApps();
  const app    = apps[userId];
  if (!app) return;

  if (app.feedback?.active) {
    app.feedback.answers.push(answerFromMessage(message));
    if (app.feedback.step === 0) {
      app.feedback.step=1;apps[userId]=app;saveApps(apps);
      return message.author.send({embeds:[new EmbedBuilder().setColor(COLOR).setTitle("📝 Sugerencia").setDescription("Ahora escribe una sugerencia o comentario sobre la atención recibida.").setFooter({text:config.guildName,iconURL:config.logoUrl})]}).catch(()=>null);
    }
    await message.author.send("✅ Gracias por tu calificación.").catch(()=>null);
    apps[userId]=app;saveApps(apps);await sendFeedbackToStaff(userId);return;
  }

  if (app.status !== "respondiendo") return;
  app.answers.push(answerFromMessage(message));
  app.current += 1;

  if (app.current >= questions.length) {
    app.status="enviada";apps[userId]=app;saveApps(apps);
    await message.author.send({embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl}).setTitle("✅ **POSTULACIÓN** enviada").setDescription("Tu **POSTULACIÓN** fue enviada correctamente. Espera respuesta del staff.").setFooter({text:config.guildName,iconURL:config.logoUrl})]}).catch(()=>null);
    await sendApplicationToStaff(userId);return;
  }
  apps[userId]=app;saveApps(apps);await askQuestion(userId);
});

client.on("interactionCreate", async interaction => {
  try {
    await handleInactividadButton(interaction);
    await handleInactividadModal(interaction, client);
    await handleTorneoInteraction(interaction, client);
    await handleNuevoButton(interaction, client);
    await handleChiteadoButton(interaction, client);
    if (interaction.replied || interaction.deferred) return;

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_rename_ticket") {
        if (!canManageThisTicket(interaction)) return interaction.reply({content:"No tienes permisos.",ephemeral:true});
        const n=cleanChannelName(interaction.fields.getTextInputValue("new_name"));if(!n)return interaction.reply({content:"Nombre inválido.",ephemeral:true});
        await interaction.channel.setName(n);return interaction.reply({content:`✅ Canal renombrado a **${n}**.`,ephemeral:true});
      }
      if (interaction.customId === "modal_rename_resultado") {
        if (!canStaff(interaction)) return interaction.reply({content:"Solo el staff puede renombrar.",ephemeral:true});
        const n=cleanName(interaction.fields.getTextInputValue("new_name"));if(!n)return interaction.reply({content:"Nombre inválido.",ephemeral:true});
        await interaction.channel.setName(n);await botLog("✏️","Ticket renombrado",`**${n}** por <@${interaction.user.id}>`,"manual",`<@${interaction.user.id}>`);
        return interaction.reply({content:`✅ Canal renombrado a **${n}**.`,ephemeral:true});
      }
      return;
    }

    if (!interaction.isButton()) return;

    // Botón solicitar SS
    const ENTREVISTADOR_ROLE_ID = "1469433858352222379";
    const canSolicitar = i => canStaff(i) || i.member?.roles?.cache?.has(ENTREVISTADOR_ROLE_ID);

    if (interaction.customId === "solicitar_ss") {
      if (!canSolicitar(interaction))
        return interaction.reply({content:"❌ No tienes permiso para solicitar un encargado de SS.",ephemeral:true});
      try {
        await interaction.channel.permissionOverwrites.edit(SS_ROLE_ID, {
          ViewChannel:true, SendMessages:true, ReadMessageHistory:true,
        });
      } catch(e){console.error("[SS] Error:",e.message);}
      await interaction.reply({content:`<@&${SS_ROLE_ID}> Un encargado de SS ha sido solicitado en el ticket!`});
      return;
    }

    if (interaction.customId === "start_postulacion") {
      await interaction.deferReply({ephemeral:true});
      const apps=loadApps();apps[interaction.user.id]={status:"respondiendo",current:0,answers:[],createdAt:Date.now()};saveApps(apps);
      try{await askQuestion(interaction.user.id);await botLog("📝","Postulación iniciada",`<@${interaction.user.id}>`,"auto");return interaction.editReply({content:"📩 Te envié las preguntas por DM. Revisa tus mensajes privados."});}
      catch{delete apps[interaction.user.id];saveApps(apps);return interaction.editReply({content:"No pude enviarte DM. Activa los mensajes privados e intenta otra vez."});}
    }

    if (interaction.customId.startsWith("apelar_rechazo_")) {
      const uid=interaction.customId.replace("apelar_rechazo_","");if(interaction.user.id!==uid)return interaction.reply({content:"Este botón no es para ti.",ephemeral:true});
      const apps=loadApps();const staffId=apps[uid]?.lastRejectStaffId||client.user.id;const su=await client.users.fetch(staffId).catch(()=>client.user);
      const t=await createResultTicket(uid,"rechazada",su);await botLog("🔄","Apelación creada",`<@${uid}>`,"auto");
      return interaction.reply({content:`✅ Ticket de apelación: ${t}`,ephemeral:true});
    }

    if (interaction.customId === "cerrar_resultado_ticket") {
      if (!canStaff(interaction)) return interaction.reply({content:"Solo el staff puede cerrar.",ephemeral:true});
      const uid=getTicketUserId(interaction.channel);await interaction.reply({content:"Cerrando ticket...",ephemeral:true});
      if(uid){const s=interaction.channel.topic?.match(/status:([a-zA-Z]+)/)?.[1]||"cerrada";await startFeedback(uid,s,interaction.user.id);}
      await botLog("🔒","Ticket cerrado",`${interaction.channel.name} | <@${interaction.user.id}>`,"manual",`<@${interaction.user.id}>`);
      setTimeout(()=>interaction.channel.delete().catch(()=>null),3000);return;
    }

    if (interaction.customId === "renombrar_resultado_ticket") {
      if (!canStaff(interaction)) return interaction.reply({content:"Solo el staff puede renombrar.",ephemeral:true});
      return interaction.showModal(renameResultModal());
    }

    if (interaction.customId.startsWith("aprobar_") || interaction.customId.startsWith("rechazar_")) {
      if (!canStaff(interaction)) return interaction.reply({content:"No tienes permisos.",ephemeral:true});
      const approved=interaction.customId.startsWith("aprobar_");const uid=interaction.customId.split("_")[1];
      const user=await client.users.fetch(uid).catch(()=>null);if(!user)return interaction.reply({content:"No encontré al usuario.",ephemeral:true});
      if(approved){
        await user.send({content:`✅ Tu **POSTULACIÓN** fue aprobada por ${interaction.user}.\n\nSe creó un ticket para continuar. La segunda etapa será por llamada.`}).catch(()=>null);
        const t=await createResultTicket(uid,"aprobada",interaction.user);
        await interaction.message.edit({components:[]}).catch(()=>null);
        return interaction.reply({content:`✅ Aprobada. Ticket: ${t}`,ephemeral:true});
      }
      await sendRejectAppealDM(user,interaction.user);
      const apps=loadApps();apps[uid]=apps[uid]||{};apps[uid].lastRejectStaffId=interaction.user.id;apps[uid].status="rechazada";apps[uid].reviewedAt=Date.now();saveApps(apps);
      await interaction.message.edit({components:[]}).catch(()=>null);
      return interaction.reply({content:"❌ Rechazada. DM enviado.",ephemeral:true});
    }

    if (interaction.customId === "cerrar_ticket") {
      if (!canManageThisTicket(interaction)) return interaction.reply({content:"Solo el staff puede cerrar.",ephemeral:true});
      await interaction.reply({content:"Cerrando ticket...",ephemeral:true});
      setTimeout(()=>interaction.channel.delete().catch(()=>null),3000);return;
    }

    if (interaction.customId === "renombrar_ticket") {
      if (!canManageThisTicket(interaction)) return interaction.reply({content:"Solo el staff puede renombrar.",ephemeral:true});
      return interaction.showModal(buildRenameTicketModal());
    }

    if (!interaction.customId.startsWith("ticket_")) return;
    const type=interaction.customId.replace("ticket_","");const ticket=ticketTypes[type];if(!ticket)return;
    const existing=interaction.guild.channels.cache.find(ch=>ch.topic?.includes(`ticketOwner:${interaction.user.id}`)&&ch.topic?.includes(`ticketType:${type}`));
    if(existing)return interaction.reply({content:`Ya tienes un ticket: ${existing}`,ephemeral:true});
    const ch=await interaction.guild.channels.create({name:`${type}-${cleanChannelName(interaction.user.username)}`,type:ChannelType.GuildText,parent:ticket.categoryId,topic:`ticketOwner:${interaction.user.id} | ticketType:${type}`,permissionOverwrites:[{id:interaction.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:interaction.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]},{id:ticket.roleId,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]}]});
    const embed=new EmbedBuilder().setColor(COLOR).setTitle(`${ticket.emoji} ${ticket.label}`).setDescription(ticket.description).setThumbnail(config.logoUrl).setFooter({text:config.guildName});
    const btns=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cerrar_ticket").setLabel("Cerrar").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("renombrar_ticket").setLabel("Renombrar").setStyle(ButtonStyle.Primary));
    await ch.send({content:`<@${interaction.user.id}> Has abierto un ticket de (${ticket.emoji} **${ticket.label}**). Espera que un <@&${ticket.roleId}> te atienda.`,embeds:[embed],components:[btns]});
    return interaction.reply({content:`✅ Ticket creado en ${ch}`,ephemeral:true});

  } catch(error) {
    console.error(error);
    if(!interaction.replied&&!interaction.deferred) await interaction.reply({content:"Ocurrió un error.",ephemeral:true}).catch(()=>null);
  }
});

client.on("error",e=>console.log("⚠️ Error:",e.message));
process.on("unhandledRejection",e=>console.log("⚠️ Promesa rechazada:",e?.message||e));

client.login(TOKEN);
